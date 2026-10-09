// Post-processing for AI dispatch plans: the model decides WHAT to change, the engine decides WHEN and HOW MUCH it helps.
import { routes, stops, stopRawDelay, DAY_START, DAY_END, BASE_BUSES } from '../src/data/mockEngine.js'

const DEPOT_TRAVEL_MIN = { 'korogllu depot': 35, 'dernegul depot': 25, 'zig depot': 30, 'bayil depot': 40 }
const LEAD_BEFORE_PEAK = 60 // buses must be in position this long before the surge starts

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

// ADD: share of the route's peak delay removed, weighted by how busy each stop gets (positive number).
// REMOVE: how much more crowded the route gets with fewer buses (negative number), scaled by how busy the route is.
export function crowdChangePct(routeId, k, action) {
  const route = routes.find((r) => r.id === routeId)
  if (!route) return 0
  if (action === 'REMOVE') {
    const avgPeak = route.stopIds.reduce((s, id) => s + peakRaw[id], 0) / route.stopIds.length
    const loadPerBus = k / Math.max(1, BASE_BUSES - k) // 3 -> 2 buses is +50% riders per bus
    return -Math.min(60, Math.max(1, Math.round(100 * loadPerBus * Math.min(1, avgPeak / 10))))
  }
  // capacity gained by k extra buses, scaled by how many of the route's stops get really busy
  const sev = route.stopIds.reduce((sum, id) => sum + Math.min(peakRaw[id], 12) / 12, 0) / route.stopIds.length
  const capacityGain = k / (BASE_BUSES + k)
  return Math.min(70, Math.max(5, Math.round(100 * capacityGain * (0.35 + 0.65 * sev))))
}

const avgPeakOf = (route) => route.stopIds.reduce((sum, id) => sum + peakRaw[id], 0) / route.stopIds.length
const DEPOT_BY_HASH = ['Korogllu Depot', 'Dernegul Depot', 'Zig Depot', 'Bayil Depot']

// If the model only asked for more buses, balance the fleet: pull one bus from the quietest unaffected routes.
function addReductions(plan, dispatch) {
  if (!dispatch.some((r) => r.action === 'ADD') || dispatch.some((r) => r.action === 'REMOVE')) return dispatch
  const busy = new Set([...dispatch.map((r) => r.route), ...plan.affected_routes])
  const topAdd = dispatch.filter((r) => r.action === 'ADD').sort((x, y) => y.extra_buses - x.extra_buses)[0].route
  const quiet = routes.filter((r) => !busy.has(r.id)).map((r) => ({ r, avg: avgPeakOf(r) })).filter((x) => x.avg < 7).sort((x, y) => x.avg - y.avg).slice(0, 2)
  const extra = quiet.map(({ r, avg }) => ({
    route: r.id, action: 'REMOVE', extra_buses: 1, depot_origin: DEPOT_BY_HASH[hash(r.id) % 4], dispatch_time: fmt((toMin(plan.egress_peak_window) ?? 18 * 60) - 120),
    estimated_crowd_reduction_pct: crowdChangePct(r.id, 1, 'REMOVE'), in_position_time: fmt((toMin(plan.egress_peak_window) ?? 18 * 60) - 120), depot_travel_min: 0,
    reason: `Lowest expected demand today (avg peak delay ${avg.toFixed(1)} min). Reassign the bus to route ${topAdd}. (load-balancing rule)`,
  }))
  return [...dispatch, ...extra]
}

export function refinePlan(plan) {
  const peakStart = toMin(plan.egress_peak_window)
  const dispatch = plan.recommended_dispatch.map((r) => {
    const action = r.action === 'REMOVE' ? 'REMOVE' : 'ADD'
    const base = { ...r, action, estimated_crowd_reduction_pct: crowdChangePct(r.route, r.extra_buses, action) }
    if (action === 'REMOVE') return { ...base, in_position_time: r.dispatch_time, depot_travel_min: 0 }
    const travel = DEPOT_TRAVEL_MIN[r.depot_origin?.toLowerCase()] ?? 30
    let inPosition = toMin(r.dispatch_time)
    if (peakStart != null) {
      // stagger by route so buses do not all arrive in one clump, and never later than 60 min before the surge
      const latest = peakStart - LEAD_BEFORE_PEAK - (hash(r.route) % 4) * 10
      inPosition = inPosition == null ? latest : Math.min(inPosition, latest)
    }
    const depart = inPosition == null ? null : inPosition - travel
    return {
      ...base,
      in_position_time: inPosition == null ? r.dispatch_time : fmt(inPosition),
      dispatch_time: depart == null ? r.dispatch_time : fmt(depart), // time to leave the depot
      depot_travel_min: travel,
    }
  })
  return { ...plan, recommended_dispatch: addReductions(plan, dispatch) }
}
