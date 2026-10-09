import OpenAI from 'openai'
import { createHash } from 'node:crypto'
import { SYSTEM_PROMPT, AUTO_RULES, RESPONSE_SCHEMA, NETWORK_ROUTES, withSignalIds } from './prompt.js'
import { collectAll, bakuNow } from './collectors.js'
import { refinePlan } from './refine.js'

const MODEL = 'gpt-4o-mini'
let client = null
let autoSchema = null
export function initAutopilot(apiKey) {
  client = apiKey ? new OpenAI({ apiKey }) : null
  autoSchema = withSignalIds(RESPONSE_SCHEMA)
}

let latest = null
let scanning = null
let lastHash = null
let scanCounter = 0

export const getLatest = () => latest

function clampPlan(plan) {
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

function feedText(now, weather, signals) {
  const lines = signals.map((s) => `[${s.id}] (${s.type}${s.test ? ', TEST' : ''}) ${s.title} -- ${s.source}${s.published ? `, ${s.published.slice(0, 16).replace('T', ' ')}Z` : ''}`)
  return `Baku local date: ${now.iso} (${now.weekday}), time ${now.time}.
Weather summary: ${weather ? weather.text : 'unavailable'}.
FEED:
${lines.join('\n')}`
}

async function doScan(injected = []) {
  const now = bakuNow()
  const collected = await collectAll()
  let signals = collected.signals
  if (injected.length) {
    const base = signals.length
    const extra = injected.slice(0, 5).map((s, i) => ({
      id: base + i + 1, type: String(s.type || 'news').slice(0, 12), title: String(s.title).slice(0, 300),
      source: 'Test injection', url: null, published: new Date().toISOString(), test: true,
    }))
    signals = [...signals, ...extra]
  }

  const hash = createHash('sha1').update(JSON.stringify([signals.map((s) => s.title), now.iso])).digest('hex')
  if (latest && hash === lastHash && !injected.length && latest.plan) {
    // nothing changed since the last analysis: skip the AI call
    latest = { ...latest, scannedAt: new Date().toISOString(), sources: collected.sources, cached: true }
    return latest
  }

  const base = {
    scanId: ++scanCounter, scannedAt: new Date().toISOString(), bakuTime: `${now.iso} ${now.time}`,
    sources: collected.sources, weather: collected.weather, signals, cached: false, model: MODEL, injected: injected.length > 0,
  }
  if (!client) return (latest = { ...base, plan: null, error: 'AI is not configured on the server (missing OPENAI_API_KEY in .env).' })

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: 'json_schema', json_schema: autoSchema },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT + AUTO_RULES },
        { role: 'user', content: feedText(now, collected.weather, signals) },
      ],
    })
    const msg = completion.choices[0]?.message
    if (msg?.refusal) throw new Error('The AI declined this request.')
    const raw = JSON.parse(msg.content)
    const used = new Set(raw.used_signal_ids ?? [])
    const plan = clampPlan(raw)
    delete plan.used_signal_ids
    lastHash = injected.length ? null : hash
    latest = { ...base, plan, signals: signals.map((s) => ({ ...s, used: used.has(s.id) })), error: null }
  } catch (err) {
    // Log status/code only; never the key.
    console.error('auto scan AI step failed:', err?.status ?? '', err?.code ?? '', String(err?.message ?? '').slice(0, 160))
    latest = { ...base, plan: latest?.plan ?? null, error: 'AI analysis failed on this scan. Showing the previous result.' }
  }
  return latest
}

// One scan at a time; concurrent callers share the same promise.
export function scan(injected = []) {
  if (!scanning) scanning = doScan(injected).finally(() => { scanning = null })
  return scanning
}

export function startScheduler(minutes) {
  scan()
    .then((r) => console.log(`Auto scan #${r.scanId}: ${r.signals.length} signals, plan: ${r.plan?.scenario_title ?? r.error}`))
    .catch((e) => console.error('scan error', e.message))
  setInterval(() => scan().catch((e) => console.error('scan error', e.message)), minutes * 60_000).unref()
}
