// Tiny persistent store for passenger routines: one SQLite file, no setup (node:sqlite ships with Node 22+).
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = process.env.DATA_DIR || join(dirname(fileURLToPath(import.meta.url)), 'data')
mkdirSync(dir, { recursive: true })
const db = new DatabaseSync(join(dir, 'movex.db'))
db.exec(`CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
)`)

const getStmt = db.prepare('SELECT data, updated_at FROM profiles WHERE user_id = ?')
const putStmt = db.prepare(`INSERT INTO profiles (user_id, data, updated_at) VALUES (?, ?, ?)
  ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`)

export const USER_ID = /^[A-Za-z0-9-]{12,64}$/

export function getProfile(userId) {
  const row = getStmt.get(userId)
  return row ? { data: JSON.parse(row.data), updatedAt: row.updated_at } : null
}

export function saveProfile(userId, data, updatedAt) {
  putStmt.run(userId, JSON.stringify(data), updatedAt)
}

const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '')
const num = (v) => (Number.isFinite(v) ? v : 0)
const times = (o) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {})
  .filter(([d, t]) => /^[0-6]$/.test(d) && /^([01]?\d|2[0-3]):[0-5]\d$/.test(t)).map(([d, t]) => [d, t]))

// never trust the client: rebuild the document from known fields and sane limits
export function sanitizeStore(input) {
  const routines = (Array.isArray(input?.routines) ? input.routines : []).slice(0, 20).map((r) => ({
    id: str(r.id, 40), name: str(r.name, 40), placeId: str(r.placeId, 40),
    home: { lat: num(r.home?.lat), lon: num(r.home?.lon), name: str(r.home?.name, 40) },
    go: times(r.go), back: times(r.back),
  })).filter((r) => r.id && r.placeId)
  const history = {}
  for (const [k, list] of Object.entries(input?.history && typeof input.history === 'object' ? input.history : {}).slice(0, 80)) {
    if (!Array.isArray(list)) continue
    history[str(k, 60)] = list.slice(-30).map((e) => ({ key: str(e.key, 80), label: str(e.label, 100), at: num(e.at) }))
  }
  return { routines, history }
}
