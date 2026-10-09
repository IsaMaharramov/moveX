// Benchmark inside the simulator: today's reactive way of working vs MoveX predictive dispatch.
// Run: node tests/bench.mjs
// NOTE: the simulator is our own model, so this checks that the logic behaves sensibly. It is NOT proof of real-world gains.
import { stopStates, events, recommendFor, DAY_START, DAY_END, servingRoutes } from '../src/data/mockEngine.js'

const STEP = 5
const MOBILISE_MIN = 30 // reactive: time from noticing a problem to buses being in position

function run(strategy) {
  let extras = {}
  const pending = [] // reactive orders { at, routes, n }
  const calmSince = {}
  let severeStopMin = 0
  let mediumPlusStopMin = 0
  let peak = 0
  let weighted = 0
  let weight = 0
  let extraBusMin = 0
  const plannedEvents = strategy.startsWith('moveX') ? events.map((ev) => ({ ev, ...recommendFor(ev) })) : []

  for (let t = DAY_START; t < DAY_END; t += STEP) {
    if (strategy.startsWith('moveX')) {
      // predictive: planned extras are on the road from before the arrival wave until after the departure surge
      extras = {}
      for (const { ev, k } of plannedEvents) {
        const on = Math.max(DAY_START, ev.start - (strategy === 'moveX-lean' ? 100 : 150))
        const off = ev.end + (strategy === 'moveX-lean' ? 60 : 75)
        if (t >= on && t < off) for (const r of ev.routes) extras[r] = (extras[r] ?? 0) + k
      }
    }
    if (strategy === 'reactive') {
      for (let i = pending.length - 1; i >= 0; i--) {
        if (pending[i].at <= t) { for (const r of pending[i].routes) extras[r] = Math.min(6, (extras[r] ?? 0) + pending[i].n); pending.splice(i, 1) }
      }
    }
    const clean = { ...extras }
    const states = stopStates(t, clean)

    if (strategy === 'reactive') {
      for (const s of states) {
        const inFlight = pending.some((p) => p.routes.some((r) => s.serving.includes(r)))
        if (s.level === 'Severe' && !inFlight) pending.push({ at: t + MOBILISE_MIN, routes: s.serving, n: 2 })
        calmSince[s.stop.id] = s.delay < 3 ? (calmSince[s.stop.id] ?? t) : null
      }
      // recall extras once every stop a route serves has been calm for 30 min
      for (const r of Object.keys(extras)) {
        const calm = states.filter((s) => s.serving.includes(r)).every((s) => calmSince[s.stop.id] != null && t - calmSince[s.stop.id] >= 30)
        if (calm) delete extras[r]
      }
    }

    for (const s of states) {
      if (s.level === 'Severe') severeStopMin += STEP
      if (s.level !== 'Low') mediumPlusStopMin += STEP
      peak = Math.max(peak, s.delay)
      weighted += s.waiting * s.delay
      weight += s.waiting
    }
    extraBusMin += STEP * Object.entries(clean).reduce((a, [, v]) => a + Math.max(0, v), 0)
  }
  return {
    severeStopMin, mediumPlusStopMin, peakDelay: +peak.toFixed(1), avgDelayPeopleWeighted: +(weighted / weight).toFixed(2), extraBusHours: +(extraBusMin / 60).toFixed(1),
  }
}

void servingRoutes
const rows = { 'Today: no early action': run('none'), 'Today: reactive human dispatcher (+2 after Severe, 30 min to arrive)': run('reactive'), 'MoveX: predictive plan (in position 150 min early)': run('moveX'), 'MoveX: predictive plan, leaner timing (100 min early)': run('moveX-lean') }
console.table(rows)
const base = rows['Today: no early action']
for (const [name, r] of Object.entries(rows)) {
  console.log(`${name}: severe stop-minutes ${r.severeStopMin} (${Math.round((1 - r.severeStopMin / base.severeStopMin) * 100)}% less than doing nothing), extra bus-hours ${r.extraBusHours}`)
}
