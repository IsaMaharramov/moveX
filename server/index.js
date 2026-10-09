import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import OpenAI from 'openai'
import { SYSTEM_PROMPT, RESPONSE_SCHEMA, NETWORK_ROUTES } from './prompt.js'
import { FALLBACKS } from './fallbacks.js'
import { initChat, answer } from './chat.js'
import { refinePlan } from './refine.js'
import { initAutopilot, scan, getLatest, startScheduler } from './autopilot.js'

const PORT = process.env.PORT || 3001
const MODEL = 'gpt-4o-mini'
const apiKey = process.env.OPENAI_API_KEY
const client = apiKey ? new OpenAI({ apiKey }) : null

const app = express()
app.use(cors({ origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/] }))
app.use(express.json({ limit: '50kb' }))

initAutopilot(apiKey)
initChat(apiKey)

// ---- Passenger assistant: natural language -> live trip plan ----
// Accept the browser's road-snapped route geometry so timetables match the animated buses.
function validGeometry(g) {
  if (!g || typeof g !== 'object') return null
  const out = {}
  for (const [id, v] of Object.entries(g)) {
    if (!v || !Number.isFinite(v.L) || v.L < 100 || v.L > 200000 || typeof v.along !== 'object') return null
    out[id] = { L: v.L, along: Object.fromEntries(Object.entries(v.along).filter(([, m]) => Number.isFinite(m))) }
  }
  return out
}

app.post('/api/passenger-chat', async (req, res) => {
  const { messages, lat, lon, simMinute, extras, geometry } = req.body ?? {}
  const clean = Array.isArray(messages)
    ? messages.filter((m) => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string').slice(-8).map((m) => ({ role: m.role, content: m.content.slice(0, 500) }))
    : []
  if (!clean.length || clean[clean.length - 1].role !== 'user') return res.status(400).json({ error: 'Send a message first.' })
  if (![lat, lon, simMinute].every(Number.isFinite)) return res.status(400).json({ error: 'Missing location.' })
  const safeExtras = {}
  for (const [k, v] of Object.entries(extras && typeof extras === 'object' ? extras : {})) if (Number.isFinite(v) && v >= -2 && v <= 30) safeExtras[k.slice(0, 4)] = v
  try {
    const geo = validGeometry(geometry)
    return res.json(await answer({ messages: clean, origin: { lat, lon }, simMinute, extras: safeExtras, geometry: geo }))
  } catch (err) {
    console.error('passenger-chat failed:', err?.status ?? '', err?.code ?? '', String(err?.message ?? '').slice(0, 160))
    return res.status(502).json({ error: 'The assistant is unavailable right now.' })
  }
})

// ---- Autopilot: the server collects weather / calendar / news by itself and drafts a plan ----
const SCAN_MINUTES = Number(process.env.SCAN_MINUTES) || 15
let lastForced = 0
app.get('/api/auto-dispatch', (_req, res) => {
  const r = getLatest()
  return r ? res.json({ ...r, scanEveryMinutes: SCAN_MINUTES }) : res.status(202).json({ pending: true, scanEveryMinutes: SCAN_MINUTES })
})
app.post('/api/auto-dispatch/scan', async (req, res) => {
  const injected = Array.isArray(req.body?.injected) ? req.body.injected.filter((s) => s && typeof s.title === 'string' && s.title.trim().length > 3) : []
  if (Date.now() - lastForced < 3000) return res.status(429).json({ error: 'Scanning too fast, wait a few seconds.' })
  lastForced = Date.now()
  try {
    return res.json({ ...(await scan(injected)), scanEveryMinutes: SCAN_MINUTES })
  } catch (e) {
    console.error('manual scan failed', e.message)
    return res.status(500).json({ error: 'Scan failed.' })
  }
})

app.get('/api/health', (_req, res) => res.json({ ok: true, aiConfigured: Boolean(client), model: MODEL }))

// Make sure the plan can always be deployed: known routes only, sane bus counts.
function sanitize(plan) {
  const seen = new Set()
  const dispatch = []
  for (const r of plan.recommended_dispatch ?? []) {
    if (!NETWORK_ROUTES.includes(r.route) || seen.has(r.route)) continue
    seen.add(r.route)
    dispatch.push({
      ...r,
      action: r.action === 'REMOVE' ? 'REMOVE' : 'ADD',
      reason: typeof r.reason === 'string' ? r.reason : '',
      extra_buses: Math.min(r.action === 'REMOVE' ? 2 : 6, Math.max(1, Math.round(r.extra_buses))),
      estimated_crowd_reduction_pct: Math.min(80, Math.max(0, Math.round(r.estimated_crowd_reduction_pct))),
    })
  }
  return refinePlan({ ...plan, recommended_dispatch: dispatch })
}

app.post('/api/predict-dispatch', async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : ''
  const presetId = typeof req.body?.presetId === 'string' ? req.body.presetId : null
  const simTime = typeof req.body?.simTime === 'string' ? req.body.simTime.slice(0, 5) : null
  if (text.length < 5 || text.length > 3000) return res.status(400).json({ error: 'Please enter between 5 and 3000 characters.' })

  const fallback = () => (presetId && FALLBACKS[presetId] ? res.json({ source: 'offline-fallback', plan: sanitize(FALLBACKS[presetId]) }) : null)
  if (!client) return fallback() ?? res.status(503).json({ error: 'AI is not configured on the server (missing OPENAI_API_KEY in .env).' })

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      response_format: { type: 'json_schema', json_schema: RESPONSE_SCHEMA },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `${simTime ? `Current control-room time: ${simTime}.\n` : ''}Situation reported by the dispatcher:\n"""\n${text}\n"""` },
      ],
    })
    const message = completion.choices[0]?.message
    if (message?.refusal) return res.status(422).json({ error: 'The AI declined this request.' })
    const plan = sanitize(JSON.parse(message.content))
    return res.json({ source: 'openai', model: MODEL, plan })
  } catch (err) {
    // Log status/code only; never log request headers or the key.
    console.error('predict-dispatch failed:', err?.status ?? '', err?.code ?? '', String(err?.message ?? '').slice(0, 160))
    return fallback() ?? res.status(502).json({ error: 'The AI service is unavailable right now. Please try again.' })
  }
})

app.listen(PORT, () => {
  console.log(`MoveX API proxy on http://localhost:${PORT} (AI ${client ? 'ready' : 'NOT configured'})`)
  startScheduler(SCAN_MINUTES)
})
