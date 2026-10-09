// Bus timetable derived from the SAME bus positions the map animates, so times always match what you see.
import { routes, stopById, BUS_SPEED, busUnits, toClock, fallbackPaths, computeStopAlong } from './mockEngine.js'

// geometry: { [routeId]: { L: routeLengthMetres, along: { [stopId]: metresAlongRoute } } }
export function defaultGeometry() {
  const paths = fallbackPaths()
  const along = computeStopAlong(paths)
  return Object.fromEntries(routes.map((r) => [r.id, { L: paths[r.id].total, along: along[r.id] }]))
}

export function buildGeometry(paths, stopAlong) {
  return Object.fromEntries(routes.map((r) => [r.id, { L: paths[r.id].total, along: stopAlong[r.id] }]))
}

export function routeTimetable(routeId, t, extras, states, geometry, perDirection = 4) {
  const route = routes.find((r) => r.id === routeId)
  const g = geometry?.[routeId]
  if (!route || !g) return null
  const L = g.L
  const units = busUnits(L, extras[routeId] || 0)
  const cycle = (2 * L) / BUS_SPEED // minutes for a full out-and-back loop
  const stateById = Object.fromEntries(states.map((s) => [s.stop.id, s]))
  const mod = (x) => ((x % (2 * L)) + 2 * L) % (2 * L)

  const stopsOut = route.stopIds.map((id) => {
    const a = g.along[id]
    const st = stateById[id]
    const lateBy = Math.max(1, Math.round(st.delay * 0.5))
    const pass = { fwd: [], bwd: [] }
    for (const u of units) {
      const d = mod(u.offset + t * BUS_SPEED)
      const toFwd = mod(a - d) / BUS_SPEED
      const toBwd = mod(2 * L - a - d) / BUS_SPEED
      for (let k = 0; k < 2; k++) {
        pass.fwd.push({ min: toFwd + k * cycle, extra: u.extra })
        pass.bwd.push({ min: toBwd + k * cycle, extra: u.extra })
      }
    }
    const fmt = (arr) => arr.sort((x, y) => x.min - y.min).slice(0, perDirection).map((x) => ({
      from: toClock(t + x.min), to: toClock(t + x.min + lateBy), inMin: Math.round(x.min), extra: x.extra,
    }))
    return { stopId: id, name: stopById[id].name, level: st.level, delayMin: Math.round(st.delay), fwd: fmt(pass.fwd), bwd: fmt(pass.bwd) }
  })

  return {
    routeId, color: route.color, buses: units.length, extraBuses: extras[routeId] || 0,
    intervalMin: Math.max(1, Math.round(cycle / units.length)), cycleMin: Math.round(cycle),
    towardsFwd: stopById[route.stopIds[route.stopIds.length - 1]].name,
    towardsBwd: stopById[route.stopIds[0]].name,
    asOf: toClock(t), stops: stopsOut,
  }
}

const ROUTE_ID = /\b(H1|125|88|13|65|30|6|3|18)\b/i
const ASKS = /interval|schedule|timetable|when|how often|frequency|cədvəl|cedvel|intervalı|neçə dəqiqə|nə vaxt|интервал|расписание|когда|как часто/i
// offline fallback: "gimme intervals of bus 125"
export function parseTimetableRequest(text) {
  const m = ROUTE_ID.exec(text)
  return m && ASKS.test(text) ? m[1].toUpperCase() : null
}
