// Trip planner shared by the browser (offline fallback) and the AI chat server (tool call).
// Pure functions over the simulated city: no browser or Node APIs.
import { stops, stopById, routes, haversine, walkMinutes, BUS_SPEED } from './mockEngine.js'

const CROWD_PENALTY = { Low: 0, Medium: 3, Severe: 8 } // minutes, so calm stops win ties
const routeById = Object.fromEntries(routes.map((r) => [r.id, r]))

function rideMinutes(route, fromId, toId) {
  const ids = route.stopIds
  const a = ids.indexOf(fromId)
  const b = ids.indexOf(toId)
  const [lo, hi] = a < b ? [a, b] : [b, a]
  let metres = 0
  for (let i = lo; i < hi; i++) metres += haversine(stopById[ids[i]], stopById[ids[i + 1]])
  return Math.max(2, Math.round((metres * 1.3) / BUS_SPEED))
}

// origin / dest: { lat, lon }; states: output of stopStates(t, extras)
export function planTrip(origin, dest, states) {
  const stateById = Object.fromEntries(states.map((s) => [s.stop.id, s]))
  const nearestStopId = [...stops].sort((a, b) => haversine(origin, a) - haversine(origin, b))[0].id
  const boardCandidates = stops.filter((s) => haversine(origin, s) <= 1500)
  const alightCandidates = stops.filter((s) => haversine(dest, s) <= 1300)

  const options = []
  for (const board of boardCandidates) {
    const st = stateById[board.id]
    const walkToMin = walkMinutes(origin, board)
    for (const rid of st.serving) {
      const route = routeById[rid]
      const base = { boardStopId: board.id, boardStop: board.name, walkToMin, boardLevel: st.level, boardDelayMin: Math.round(st.delay), waitingPeople: st.waiting, isNearestStop: board.id === nearestStopId }
      for (const alight of alightCandidates) {
        const walkFromMin = walkMinutes(alight, dest)
        // direct
        if (alight.id !== board.id && route.stopIds.includes(alight.id)) {
          const rideMin = rideMinutes(route, board.id, alight.id)
          const totalMin = walkToMin + st.wait + rideMin + walkFromMin
          options.push({ ...base, routeId: rid, alightStopId: alight.id, alightStop: alight.name, waitMin: st.wait, rideMin, walkFromMin, totalMin, transfer: null,
            legs: [{ routeId: rid, fromStopId: board.id, toStopId: alight.id, rideMin }], score: totalMin + CROWD_PENALTY[st.level] })
        }
        // one transfer
        for (const tid of route.stopIds) {
          if (tid === board.id || tid === alight.id) continue
          const ts = stateById[tid]
          for (const rid2 of ts.serving) {
            const r2 = routeById[rid2]
            if (rid2 === rid || !r2.stopIds.includes(alight.id)) continue
            const ride1 = rideMinutes(route, board.id, tid)
            const ride2 = rideMinutes(r2, tid, alight.id)
            const totalMin = walkToMin + st.wait + ride1 + ts.wait + ride2 + walkFromMin
            options.push({ ...base, routeId: rid, alightStopId: alight.id, alightStop: alight.name, waitMin: st.wait, rideMin: ride1 + ride2, walkFromMin, totalMin,
              transfer: { stopId: tid, stop: ts.stop.name, routeId: rid2, waitMin: ts.wait, level: ts.level },
              legs: [{ routeId: rid, fromStopId: board.id, toStopId: tid, rideMin: ride1 }, { routeId: rid2, fromStopId: tid, toStopId: alight.id, rideMin: ride2 }],
              score: totalMin + CROWD_PENALTY[st.level] + CROWD_PENALTY[ts.level] + 3 })
          }
        }
      }
    }
  }
  // one option per boarding stop + route, best alighting stop only
  const bestByKey = new Map()
  for (const o of options) {
    const k = `${o.boardStopId}|${o.legs.map((l) => l.routeId).join('+')}`
    if (!bestByKey.has(k) || o.score < bestByKey.get(k).score) bestByKey.set(k, o)
  }
  const ranked = [...bestByKey.values()].sort((a, b) => a.score - b.score)
  const top = ranked.slice(0, 3)
  const nearest = ranked.filter((o) => o.isNearestStop).sort((a, b) => a.score - b.score)[0] ?? null
  const walkDist = haversine(origin, dest)
  const walkOnlyMin = walkDist <= 1500 ? walkMinutes(origin, dest) : null
  return { options: top, best: top[0] ?? null, nearestStopOption: nearest, walkOnlyMin, nearestStopId }
}

export function findPlace(text, placeList) {
  const q = text.toLowerCase()
  return placeList.find((p) => p.aliases.some((a) => q.includes(a)) || q.includes(p.name.toLowerCase())) ?? null
}
