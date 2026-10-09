// "My routine": weekly commute schedule, learned habits, and the smart pre-trip recommendation.
// Pure logic (no React). Storage helpers use localStorage, guarded for non-browser use.
import { planTrip } from './planner.js'
import { places, stopById, toClock } from './mockEngine.js'

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const ALERT_LEAD_MIN = 30
const KEY = 'movex-routine-v1'

export const toMinutes = (hhmm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? ''); return m ? +m[1] * 60 + +m[2] : null }

export function loadStore() {
  try {
    const raw = typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem(KEY) || 'null') : null
    if (raw && Array.isArray(raw.routines)) return { routines: raw.routines, history: raw.history ?? {}, updatedAt: raw.updatedAt ?? 0 }
  } catch { /* ignore corrupt storage */ }
  return { routines: [], history: {}, updatedAt: 0 }
}
export function saveStore(store) {
  try { localStorage.setItem(KEY, JSON.stringify(store)) } catch { /* private mode */ }
}

// The sync code: a random id made once per browser. It is also the key of the copy saved on the server.
const USER_KEY = 'movex-user-id'
export function getUserId() {
  try {
    let id = localStorage.getItem(USER_KEY)
    if (!id) {
      id = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`).replace(/[^A-Za-z0-9-]/g, '')
      localStorage.setItem(USER_KEY, id)
    }
    return id
  } catch { return 'anonymous-device-0000' }
}
export function setUserId(id) { try { localStorage.setItem(USER_KEY, id) } catch { /* ignore */ } }

// routine: { id, name, home: { lat, lon, name }, placeId, go: { [dayIdx]: 'HH:MM' }, back: { [dayIdx]: 'HH:MM' } }
export function expandTrips(routines) {
  const trips = []
  for (const r of routines) {
    const place = places.find((p) => p.id === r.placeId)
    if (!place) continue
    for (const kind of ['go', 'back']) {
      for (const [day, hhmm] of Object.entries(r[kind] ?? {})) {
        const minute = toMinutes(hhmm)
        if (minute == null) continue
        const home = { lat: r.home.lat, lon: r.home.lon, name: r.home.name || 'Home' }
        const dest = { lat: place.lat, lon: place.lon, name: place.name }
        trips.push({
          id: `${r.id}|${kind}|${day}`, routineId: r.id, routineName: r.name, kind, day: +day, minute, time: hhmm,
          from: kind === 'go' ? home : dest, to: kind === 'go' ? dest : home,
        })
      }
    }
  }
  return trips
}

export const optionKey = (o) => `${o.boardStopId}|${o.legs.map((l) => l.routeId).join('+')}`
export const historyKey = (routineId, kind) => `${routineId}|${kind}`

// the choice the passenger made most often, with how consistent they are
export function habitOf(entries = []) {
  if (!entries.length) return null
  const counts = new Map()
  for (const e of entries) counts.set(e.key, { n: (counts.get(e.key)?.n ?? 0) + 1, sample: e })
  const [key, v] = [...counts.entries()].sort((a, b) => b[1].n - a[1].n)[0]
  return { key, count: v.n, total: entries.length, label: v.sample.label }
}

const describe = (o) => `bus ${o.legs.map((l) => l.routeId).join(' → ')} from ${o.boardStop}`

// Compare the passenger's usual option with what is best right now.
export function evaluateTrip(trip, states, history) {
  const plan = planTrip(trip.from, trip.to, states)
  if (!plan.best) return { tone: 'info', plan, title: `${trip.time} trip: no bus connection found`, body: 'I could not find a bus connection for this trip right now.', rec: null, usual: null, habit: null }

  const habit = habitOf(history[historyKey(trip.routineId, trip.kind)])
  const usual = (habit && plan.all.find((o) => optionKey(o) === habit.key)) || plan.nearestStopOption || plan.best
  const usualKey = optionKey(usual)
  // familiar routes get a 3-minute bonus so we do not nag for tiny savings
  const rec = [...plan.all].sort((a, b) => (a.score - (optionKey(a) === usualKey ? 3 : 0)) - (b.score - (optionKey(b) === usualKey ? 3 : 0)))[0]
  const saving = usual.totalMin - rec.totalMin
  const change = optionKey(rec) !== usualKey && saving >= 3
  const where = trip.kind === 'go' ? `to ${trip.to.name}` : `home from ${trip.from.name}`
  const habitNote = habit ? ` You took this ${habit.count} of your last ${habit.total} trips.` : ''

  if (change) {
    return {
      tone: 'warn', plan, rec, usual, habit, change: true, saving,
      title: `Your ${trip.time} trip ${where}: avoid ${usual.boardStop}`,
      body: `Your usual ${describe(usual)} is ${usual.boardLevel.toLowerCase()} right now (buses ${usual.boardDelayMin} min late, ~${usual.waitingPeople} waiting).${habitNote} Today use ${describe(rec)} instead (${rec.walkToMin} min walk, ${rec.boardLevel.toLowerCase()} crowd). It saves about ${saving} min (${rec.totalMin} vs ${usual.totalMin} min).`,
    }
  }
  if (usual.boardLevel !== 'Low') {
    return {
      tone: 'warn', plan, rec, usual, habit, change: false, saving: 0,
      title: `Your ${trip.time} trip ${where}: busy stop`,
      body: `${describe(usual)} is ${usual.boardLevel.toLowerCase()} (buses ${usual.boardDelayMin} min late) and nothing nearby is clearly better. Leave a few minutes early. Total about ${usual.totalMin} min.${habitNote}`,
    }
  }
  return {
    tone: 'ok', plan, rec, usual, habit, change: false, saving: 0,
    title: `Your ${trip.time} trip ${where}: all clear`,
    body: `Your usual ${describe(usual)} is running normally (${usual.boardLevel.toLowerCase()} crowd, ~${usual.waitMin} min wait). Total about ${usual.totalMin} min.${habitNote}`,
  }
}

export const fmtLead = (minutes) => `${Math.max(1, Math.round(minutes))} min`
export { toClock, stopById }
