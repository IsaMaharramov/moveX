// Post-processing for AI dispatch plans: the model decides WHAT to send, the engine decides WHEN and HOW MUCH it helps.
import { routes, stops, stopById, stopRawDelay, DAY_START, DAY_END } from '../src/data/mockEngine.js'

const DEPOT_TRAVEL_MIN = { 'korogllu depot': 35, 'dernegul depot': 25, 'zig depot': 30, 'bayil depot': 40 }
const LEAD_BEFORE_PEAK = 60 // buses must be in position this long before the surge starts
const RELIEF_PER_EXTRA_BUS = 1.5 // same effect the simulator applies when buses are deployed

// highest simulated delay each stop reaches during the day: how exposed it is
const peakRaw = {}
for (const s of stops) {
  let max = 0
  for (let t = DAY_START; t <= DAY_END; t += 10) max = Math.max(max, stopRawDelay(s, t))
  peakRaw[s.id] = max
}

const toMin = (hhmm) => { const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? ''); return m ? +m[1] * 60 + +m[2] : null }
const fmt = (min) => { const m = ((Math.round(min) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }
const hash = (str) => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 7)

// share of the route's peak delay that k extra buses remove, weighted by how busy each stop gets
export function crowdReductionPct(routeId, k) {
  const route = routes.find((r) => r.id === routeId)
  if (!route) return 0
  const relief = RELIEF_PER_EXTRA_BUS * k
  let total = 0
  let left = 0
  for (const id of route.stopIds) {
    const raw = peakRaw[stopById[id].id]
    total += raw
    left += Math.max(0, raw - relief)
  }
  if (total <= 0) return 0
  return Math.min(70, Math.max(5, Math.round(100 * (1 - left / total))))
}

export function refinePlan(plan) {
  const peakStart = toMin(plan.egress_peak_window)
  const dispatch = plan.recommended_dispatch.map((r) => {
    const travel = DEPOT_TRAVEL_MIN[r.depot_origin?.toLowerCase()] ?? 30
    let inPosition = toMin(r.dispatch_time)
    if (peakStart != null) {
      // stagger by route so buses do not all arrive in one clump, and never later than 60 min before the surge
      const latest = peakStart - LEAD_BEFORE_PEAK - (hash(r.route) % 4) * 10
      inPosition = inPosition == null ? latest : Math.min(inPosition, latest)
    }
    const depart = inPosition == null ? null : inPosition - travel
    return {
      ...r,
      in_position_time: inPosition == null ? r.dispatch_time : fmt(inPosition),
      dispatch_time: depart == null ? r.dispatch_time : fmt(depart), // time to leave the depot
      depot_travel_min: travel,
      estimated_crowd_reduction_pct: crowdReductionPct(r.route, r.extra_buses),
    }
  })
  return { ...plan, recommended_dispatch: dispatch }
}
