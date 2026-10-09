// Cost and abuse guard for the endpoints that call OpenAI: a public link must not be able to drain the API budget.
const WINDOW_MS = 60_000
const PER_IP = Number(process.env.AI_PER_IP_PER_MIN) || 20
const DAILY_CAP = Number(process.env.AI_DAILY_CAP) || 3000

const hits = new Map() // ip -> timestamps in the last minute
let day = new Date().toDateString()
let today = 0

export function aiLimiter(req, res, next) {
  if (req.method !== 'POST') return next()
  const now = Date.now()
  if (new Date().toDateString() !== day) { day = new Date().toDateString(); today = 0 }
  if (today >= DAILY_CAP) return res.status(429).json({ error: 'The daily AI limit was reached. Please try again tomorrow.' })
  const recent = (hits.get(req.ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= PER_IP) {
    res.set('Retry-After', '30')
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' })
  }
  recent.push(now)
  hits.set(req.ip, recent)
  today += 1
  if (hits.size > 5000) for (const [ip, list] of hits) if (!list.some((t) => now - t < WINDOW_MS)) hits.delete(ip)
  return next()
}
