// Synthetic transit engine for the AYNA prototype.
// Everything is derived from the simulation clock `t` (minutes since midnight),
// so the whole city "lives": events create crowds, crowds create delays,
// delays reveal crowding, and dispatching extra buses relieves them.
// NOTE: coordinates are approximate real Baku locations.

export const DAY_START = 17 * 60 + 30
export const DAY_END = 24 * 60
export const START_T = 19 * 60

// Core rule: crowdLevel is derived strictly from delayMinutes.
export function getCrowdLevel(delayMinutes) {
  if (delayMinutes >= 10) return 'Severe'
  if (delayMinutes >= 5) return 'Medium'
  return 'Low'
}

export const LEVEL_COLOR = { Low: '#10b981', Medium: '#f59e0b', Severe: '#ef4444' }

export const toClock = (t) => {
  const m = Math.floor(t) % (24 * 60)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export const stops = [
  { id: 'ganjlik', name: 'Ganjlik Metro', lat: 40.4004, lon: 49.8508, pop: 0.9 },
  { id: 'stadium', name: 'Stadium (Neftchilar)', lat: 40.3948, lon: 49.8545, pop: 0.5 },
  { id: 'azadliq', name: 'Azadliq Avenue', lat: 40.399, lon: 49.8605, pop: 0.5 },
  { id: 'narimanov', name: 'Narimanov Metro', lat: 40.4047, lon: 49.8719, pop: 0.8, am: 2.6 },
  { id: 'may28', name: '28 May Metro', lat: 40.3799, lon: 49.8483, pop: 1 },
  { id: 'sahil', name: 'Sahil Metro', lat: 40.3725, lon: 49.8447, pop: 0.8 },
  { id: 'nizami', name: 'Nizami Metro', lat: 40.3797, lon: 49.83, pop: 0.7 },
  { id: 'elmler', name: 'Elmlar Akademiyasi', lat: 40.3752, lon: 49.8153, pop: 0.6 },
  { id: 'crystal', name: 'Crystal Hall (Bayil)', lat: 40.3445, lon: 49.8555, pop: 0.2 },
  { id: 'heydar', name: 'Heydar Aliyev Center', lat: 40.3965, lon: 49.8665, pop: 0.3 },
  { id: 'icheri', name: 'Icherisheher', lat: 40.3661, lon: 49.835, pop: 0.7 },
  { id: 'khatai', name: 'Khatai Metro', lat: 40.3826, lon: 49.8715, pop: 0.6 },
  { id: 'yanvar20', name: '20 Yanvar Metro', lat: 40.4048, lon: 49.8085, pop: 0.7, am: 2.4 },
  { id: 'memar', name: 'Memar Ajami', lat: 40.411, lon: 49.814, pop: 0.5 },
  { id: 'genclik', name: 'Genclik Mall', lat: 40.3999, lon: 49.8452, pop: 0.6 },
  { id: 'fountain', name: 'Fountain Square', lat: 40.3727, lon: 49.8352, pop: 0.8 },
  { id: 'portbaku', name: 'Port Baku (Boulevard)', lat: 40.3685, lon: 49.848, pop: 0.7 },
  { id: 'flagsq', name: 'Flag Square', lat: 40.3578, lon: 49.8586, pop: 0.4 },
]
export const stopById = Object.fromEntries(stops.map((s) => [s.id, s]))

export const routes = [
  { id: '125', color: '#3b82f6', stopIds: ['narimanov', 'heydar', 'azadliq', 'stadium', 'ganjlik', 'may28', 'sahil'] },
  { id: 'H1', color: '#a855f7', stopIds: ['ganjlik', 'stadium', 'may28', 'sahil', 'icheri'] },
  { id: '88', color: '#14b8a6', stopIds: ['nizami', 'may28', 'sahil', 'crystal'] },
  { id: '13', color: '#f97316', stopIds: ['elmler', 'nizami', 'may28', 'khatai', 'heydar'] },
  { id: '65', color: '#ec4899', stopIds: ['ganjlik', 'may28', 'icheri'] },
  { id: '30', color: '#84cc16', stopIds: ['narimanov', 'khatai', 'may28'] },
  { id: '6', color: '#eab308', stopIds: ['elmler', 'nizami', 'icheri'] },
  { id: '3', color: '#06b6d4', stopIds: ['yanvar20', 'memar', 'genclik', 'ganjlik'] },
  { id: '18', color: '#f43f5e', stopIds: ['nizami', 'fountain', 'sahil', 'portbaku', 'flagsq', 'crystal'] },
]

// Named places passengers can ask to go to (not always a bus stop).
export const places = [
  { id: 'port_baku', name: 'Port Baku Mall', aliases: ['port baku', 'portbaku'], lat: 40.3688, lon: 49.8485 },
  { id: 'boulevard', name: 'Baku Boulevard', aliases: ['boulevard', 'bulvar', 'seaside'], lat: 40.3715, lon: 49.8445 },
  { id: 'flag_square', name: 'National Flag Square', aliases: ['flag square', 'bayraq'], lat: 40.3572, lon: 49.8603 },
  { id: 'fountain_sq', name: 'Fountain Square', aliases: ['fountain', 'fountains'], lat: 40.3722, lon: 49.8358 },
  { id: 'old_city', name: 'Old City (Icherisheher)', aliases: ['old city', 'icherisheher', 'maiden tower', 'qiz qalasi'], lat: 40.3659, lon: 49.8372 },
  { id: 'genclik_mall', name: 'Genclik Mall', aliases: ['genclik', 'gencliyin'], lat: 40.4002, lon: 49.8449 },
  { id: 'stadium_venue', name: 'Tofiq Bahramov Stadium', aliases: ['stadium', 'stadion', 'tofiq bahramov', 'football'], lat: 40.3956, lon: 49.853 },
  { id: 'crystal_hall', name: 'Baku Crystal Hall', aliases: ['crystal hall', 'crystal'], lat: 40.3452, lon: 49.857 },
  { id: 'heydar_center', name: 'Heydar Aliyev Center', aliases: ['heydar aliyev center', 'heydar center', 'heydar aliyev merkezi'], lat: 40.3959, lon: 49.8678 },
  { id: 'bsu', name: 'Baku State University', aliases: ['bsu', 'baku state', 'university', 'bdu'], lat: 40.3747, lon: 49.8162 },
  { id: 'nizami_street', name: 'Nizami Street (shopping)', aliases: ['nizami street', 'torgovaya', 'nizami kucesi'], lat: 40.3795, lon: 49.8335 },
  { id: 'dede_qorqud', name: '20 Yanvar / Dede Qorqud Park', aliases: ['20 yanvar', 'dede qorqud', 'bus station'], lat: 40.4052, lon: 49.8092 },
]
export const BASE_BUSES = 3
export const BASE_HEADWAY = 12 // minutes between buses with no extras
export const BUS_SPEED = 330 // metres per sim-minute

export const events = [
  {
    id: 'e1', name: 'Football match', venue: 'Tofiq Bahramov Stadium', lat: 40.3956, lon: 49.853,
    start: 20 * 60, end: 22 * 60, attendance: 29000, routes: ['125', 'H1', '65'],
  },
  {
    id: 'e2', name: 'Expo & concert', venue: 'Baku Crystal Hall', lat: 40.3452, lon: 49.857,
    start: 18 * 60 + 30, end: 21 * 60, attendance: 20000, routes: ['88'],
  },
  {
    id: 'e3', name: 'Live concert', venue: 'Heydar Aliyev Center', lat: 40.3959, lon: 49.8678,
    start: 21 * 60, end: 23 * 60, attendance: 15000, routes: ['13', '125'],
  },
]

// ---------- geo helpers ----------
export function haversine(a, b) {
  const R = 6371000
  const rad = (x) => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
export const walkMinutes = (a, b) => Math.max(1, Math.round((haversine(a, b) * 1.3) / 80))

export function buildPath(latlngs) {
  const cum = [0]
  for (let i = 1; i < latlngs.length; i++) {
    cum.push(cum[i - 1] + haversine({ lat: latlngs[i - 1][0], lon: latlngs[i - 1][1] }, { lat: latlngs[i][0], lon: latlngs[i][1] }))
  }
  return { pts: latlngs, cum, total: cum[cum.length - 1] }
}
export function pointAt(path, d) {
  const { pts, cum } = path
  let lo = 0
  let hi = cum.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (cum[mid] <= d) lo = mid
    else hi = mid
  }
  const seg = cum[hi] - cum[lo] || 1
  const f = Math.min(1, Math.max(0, (d - cum[lo]) / seg))
  return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f]
}
export function fallbackPaths() {
  return Object.fromEntries(routes.map((r) => [r.id, buildPath(r.stopIds.map((id) => [stopById[id].lat, stopById[id].lon]))]))
}
// distance along each route where each stop sits
export function computeStopAlong(paths) {
  const out = {}
  for (const r of routes) {
    const p = paths[r.id]
    out[r.id] = {}
    for (const id of r.stopIds) {
      const s = stopById[id]
      let best = 0
      let bd = Infinity
      p.pts.forEach((pt, i) => {
        const d = (pt[0] - s.lat) ** 2 + (pt[1] - s.lon) ** 2
        if (d < bd) { bd = d; best = i }
      })
      out[r.id][id] = p.cum[best]
    }
  }
  return out
}

// ---------- demand / delay model ----------
const smooth = (x) => x * x * (3 - 2 * x)
export function eventLoad(ev, t) {
  if (t < ev.start - 90) return 0
  if (t < ev.start) return smooth((t - (ev.start - 90)) / 90) // arrival wave
  if (t < ev.end) return 0.3 + 0.7 * Math.max(0, 1 - (t - ev.start) / 25) // late arrivals, then people are inside
  if (t < ev.end + 60) return 1.3 * (1 - (t - ev.end) / 60) // departure surge
  return 0
}

const servingCache = Object.fromEntries(stops.map((s) => [s.id, routes.filter((r) => r.stopIds.includes(s.id)).map((r) => r.id)]))
export const servingRoutes = (stopId) => servingCache[stopId]

export function stopRawDelay(stop, t) {
  const rush = Math.exp(-(((t - 18 * 60) / 70) ** 2))
  const morning = Math.exp(-(((t - 8.5 * 60) / 55) ** 2)) // 08:30 commute and school rush
  let d = 0.6 + rush * 2.2 * stop.pop + morning * 4.8 * stop.pop * (stop.am ?? 1) + Math.sin(t / 9 + stop.lat * 900) * 0.5 + 0.5
  for (const ev of events) {
    const dist = haversine(stop, ev)
    d += (eventLoad(ev, t) * ev.attendance * 0.12 * Math.exp(-dist / 450)) / 220
  }
  return Math.min(20, Math.max(0, d))
}

export const extraCount = (extras, routeId) => extras[routeId] || 0
export function stopDelay(stop, t, extras) {
  const raw = stopRawDelay(stop, t)
  const relief = 1.5 * servingRoutes(stop.id).reduce((s, r) => s + extraCount(extras, r), 0)
  return { raw, delay: Math.max(0, raw - relief) }
}

export function stopStates(t, extras) {
  return stops.map((stop) => {
    const { raw, delay } = stopDelay(stop, t, extras)
    const serving = servingRoutes(stop.id)
    const extraBuses = serving.reduce((s, r) => s + extraCount(extras, r), 0)
    const headway = BASE_HEADWAY * BASE_BUSES / Math.max(1.2, BASE_BUSES + extraBuses / Math.max(1, serving.length) * 2)
    return {
      stop, raw, delay, level: getCrowdLevel(delay), serving,
      waiting: Math.round(delay * 26 + 6),
      headway,
      wait: Math.round(headway / (2 * Math.sqrt(serving.length)) + delay),
    }
  })
}

export function forecastSeries(extras) {
  const out = []
  for (let t = DAY_START; t <= DAY_END; t += 5) {
    let max = 0
    for (const s of stops) max = Math.max(max, stopDelay(s, t, extras).delay)
    out.push({ t, delay: max })
  }
  return out
}

export function eventStatus(ev, t) {
  if (t < ev.start - 90) return { label: `Starts in ${Math.round(ev.start - t)} min`, tone: 'slate' }
  if (t < ev.start) return { label: `Arrival wave · starts in ${Math.round(ev.start - t)} min`, tone: 'amber' }
  if (t < ev.end) return { label: 'Event live', tone: 'blue' }
  if (t < ev.end + 60) return { label: 'Departure surge', tone: 'red' }
  return { label: 'Ended', tone: 'slate' }
}

// Smallest "+N per route" that keeps the predicted peak near the venue below the Medium level.
export function recommendFor(ev) {
  const near = stops.filter((s) => haversine(s, ev) < 900)
  const peakWith = (k) => {
    const extras = Object.fromEntries(ev.routes.map((r) => [r, k]))
    let peak = 0
    for (let t = ev.start - 90; t <= ev.end + 60; t += 5) for (const s of near) peak = Math.max(peak, stopDelay(s, t, extras).delay)
    return peak
  }
  const noDispatchPeak = peakWith(0)
  let k = 0
  while (k < 10 && peakWith(k) >= 8) k += 1
  return { k, noDispatchPeak, withPeak: peakWith(k) }
}

// ---------- buses ----------
const hash = (str) => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 7)

// Buses on a route: base fleet evenly spread, extra buses slotted in between. Shared with the timetable.
export function busUnits(L, extra) {
  const base = Math.max(1, BASE_BUSES + Math.min(0, extra)) // negative extra = buses pulled off the route
  return [
    ...Array.from({ length: base }, (_, i) => ({ i, offset: (i * 2 * L) / base, extra: false })),
    ...Array.from({ length: Math.max(0, extra) }, (_, j) => ({ i: BASE_BUSES + j, offset: 2 * L * ((0.17 + 0.29 * j) % 1), extra: true })),
  ]
}

export function computeBuses(t, extras, paths, stopAlong, states) {
  const stateById = Object.fromEntries(states.map((s) => [s.stop.id, s]))
  const buses = []
  for (const r of routes) {
    const path = paths[r.id]
    const L = path.total
    const extra = extraCount(extras, r.id)
    const units = busUnits(L, extra)
    for (const u of units) {
      const d = (u.offset + t * BUS_SPEED) % (2 * L)
      const along = d < L ? d : 2 * L - d
      let nearest = r.stopIds[0]
      let nd = Infinity
      for (const id of r.stopIds) {
        const dd = Math.abs(stopAlong[r.id][id] - along)
        if (dd < nd) { nd = dd; nearest = id }
      }
      const jitter = ((hash(`${r.id}${u.i}`) % 10) / 10 - 0.5) * 1.4
      const delay = Math.max(0, stateById[nearest].delay + jitter)
      buses.push({
        key: `${r.id}-${u.i}`, route: r.id, color: r.color, pos: pointAt(path, along), extra: u.extra,
        delay, level: getCrowdLevel(delay), nextStop: stopById[nearest].name,
      })
    }
  }
  return buses
}
