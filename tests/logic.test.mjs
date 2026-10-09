// Core logic tests: crowd rule, simulation, planner, timetable, AI-plan post-processing, routines, storage sanitising.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getCrowdLevel, stopStates, stopDelay, stops, routes, busUnits, computeBuses, fallbackPaths, computeStopAlong,
  BASE_BUSES, places, haversine, stopById,
} from '../src/data/mockEngine.js'
import { planTrip } from '../src/data/planner.js'
import { routeTimetable, buildGeometry, parseTimetableRequest } from '../src/data/timetable.js'
import { expandTrips, evaluateTrip, habitOf, optionKey, toMinutes } from '../src/data/routine.js'
import { refinePlan, crowdChangePct } from '../server/refine.js'
import { sanitizeStore, USER_ID } from '../server/db.js'

const T_EVENING = 19 * 60 + 50
const paths = fallbackPaths()
const stopAlong = computeStopAlong(paths)
const geometry = buildGeometry(paths, stopAlong)

test('crowd level follows the delay rule exactly at the boundaries', () => {
  assert.equal(getCrowdLevel(0), 'Low')
  assert.equal(getCrowdLevel(4.99), 'Low')
  assert.equal(getCrowdLevel(5), 'Medium')
  assert.equal(getCrowdLevel(9.99), 'Medium')
  assert.equal(getCrowdLevel(10), 'Severe')
  assert.equal(getCrowdLevel(25), 'Severe')
})

test('every stop is served by at least one route and every route stop exists', () => {
  for (const s of stops) assert.ok(routes.some((r) => r.stopIds.includes(s.id)), `stop ${s.id} has no route`)
  for (const r of routes) for (const id of r.stopIds) assert.ok(stopById[id], `route ${r.id} uses unknown stop ${id}`)
})

test('delays stay inside 0..20 minutes for the whole day, with and without extra buses', () => {
  for (let t = 0; t < 24 * 60; t += 15) {
    for (const extras of [{}, { 125: 6, H1: 6 }, { 125: -2, 6: -2 }]) {
      for (const s of stops) {
        const { delay } = stopDelay(s, t, extras)
        assert.ok(delay >= 0 && delay <= 20 + 1e-9, `delay ${delay} out of range at ${t} for ${s.id}`)
        assert.ok(Number.isFinite(delay))
      }
    }
  }
})

test('extra buses reduce delay, pulled buses increase it', () => {
  const stadium = stopById.stadium
  const base = stopDelay(stadium, T_EVENING, {}).delay
  assert.ok(stopDelay(stadium, T_EVENING, { 125: 2, H1: 2, 65: 2 }).delay < base)
  assert.ok(stopDelay(stadium, T_EVENING, { 125: -2, H1: -2, 65: -2 }).delay >= base)
})

test('stopStates never produces NaN or negative waits, even with extreme fleet changes', () => {
  for (const extras of [{}, { 125: -2, H1: -2, 65: -2, 3: -2 }, { 125: 30 }]) {
    for (const s of stopStates(T_EVENING, extras)) {
      assert.ok(Number.isFinite(s.wait) && s.wait >= 0, `bad wait for ${s.stop.id}`)
      assert.ok(Number.isFinite(s.headway) && s.headway > 0, `bad headway for ${s.stop.id}`)
    }
  }
})

test('bus counts per route: base 3, extras add, pulled buses never drop below 1', () => {
  assert.equal(busUnits(5000, 0).length, BASE_BUSES)
  assert.equal(busUnits(5000, 2).length, BASE_BUSES + 2)
  assert.equal(busUnits(5000, -2).length, 1)
  assert.equal(busUnits(5000, -9).length, 1)
})

test('bus positions are valid coordinates inside Baku for the whole day', () => {
  const states = stopStates(T_EVENING, {})
  for (let t = 0; t < 24 * 60; t += 37) {
    for (const b of computeBuses(t, { 125: 3, 6: -2 }, paths, stopAlong, states)) {
      assert.ok(Number.isFinite(b.pos[0]) && Number.isFinite(b.pos[1]), `bad position for ${b.key}`)
      assert.ok(b.pos[0] > 40.3 && b.pos[0] < 40.5 && b.pos[1] > 49.7 && b.pos[1] < 50, `${b.key} left Baku`)
    }
  }
})

test('timetable agrees with the animated buses (a bus really is at the stop at the predicted time)', () => {
  const states = stopStates(T_EVENING, {})
  for (const routeId of ['125', 'H1', '18']) {
    const tt = routeTimetable(routeId, T_EVENING, {}, states, geometry)
    for (const row of tt.stops) {
      for (const dir of ['fwd', 'bwd']) {
        const first = row[dir][0]
        const tAt = T_EVENING + first.inMin
        const buses = computeBuses(tAt, {}, paths, stopAlong, states).filter((b) => b.route === routeId)
        const nearest = Math.min(...buses.map((b) => haversine({ lat: b.pos[0], lon: b.pos[1] }, stopById[row.stopId])))
        // timetable minutes are rounded, buses move ~330 m/min: allow 1.5 min of travel
        assert.ok(nearest < 600, `route ${routeId} ${row.stopId} ${dir}: nearest bus ${Math.round(nearest)} m from stop`)
      }
    }
  }
})

test('timetable times are ordered and the interval matches the fleet size', () => {
  const states = stopStates(T_EVENING, {})
  const tt3 = routeTimetable('125', T_EVENING, {}, states, geometry)
  const tt6 = routeTimetable('125', T_EVENING, { 125: 3 }, states, geometry)
  assert.ok(tt6.intervalMin < tt3.intervalMin, 'more buses must shorten the interval')
  for (const row of tt3.stops) assert.ok(row.fwd.every((a, i, arr) => i === 0 || arr[i - 1].inMin <= a.inMin))
})

test('timetable requests are recognised in English, Azerbaijani and Russian', () => {
  assert.equal(parseTimetableRequest('gimme intervals of bus 125'), '125')
  assert.equal(parseTimetableRequest('H1 avtobusunun cədvəli'), 'H1')
  assert.equal(parseTimetableRequest('расписание автобуса 18'), '18')
  assert.equal(parseTimetableRequest('hello there'), null)
  assert.equal(parseTimetableRequest('bus 125'), null)
})

test('planner: every leg uses stops that really belong to that route', () => {
  const states = stopStates(T_EVENING, {})
  const routeStops = Object.fromEntries(routes.map((r) => [r.id, r.stopIds]))
  for (const place of places) {
    const plan = planTrip({ lat: 40.3968, lon: 49.8532 }, place, states)
    for (const o of plan.all) {
      assert.ok(o.totalMin > 0 && Number.isFinite(o.totalMin))
      assert.notEqual(o.boardStopId, o.alightStopId)
      for (const l of o.legs) {
        assert.ok(routeStops[l.routeId].includes(l.fromStopId), `${place.id}: leg ${l.routeId} does not serve ${l.fromStopId}`)
        assert.ok(routeStops[l.routeId].includes(l.toStopId), `${place.id}: leg ${l.routeId} does not serve ${l.toStopId}`)
      }
      if (o.transfer) assert.equal(o.legs.length, 2)
    }
  }
})

test('planner: a place reachable from every stop area returns an option; far-away origin fails gracefully', () => {
  const states = stopStates(T_EVENING, {})
  const bsu = places.find((p) => p.id === 'bsu')
  assert.ok(planTrip({ lat: 40.3968, lon: 49.8532 }, bsu, states).best, 'stadium area to BSU should be reachable')
  const far = planTrip({ lat: 41.2, lon: 47.0 }, bsu, states) // 300 km away
  assert.equal(far.best, null)
  assert.deepEqual(far.options, [])
})

test('planner: when the destination is a short walk away, the walk-only time is reported', () => {
  const states = stopStates(T_EVENING, {})
  const near = { lat: 40.3957, lon: 49.8533, id: 'x', name: 'next door' }
  const plan = planTrip({ lat: 40.3956, lon: 49.853 }, near, states)
  assert.ok(plan.walkOnlyMin != null && plan.walkOnlyMin <= 3)
})

test('AI plan post-processing: timing, bounds and malformed input', () => {
  const plan = {
    egress_peak_window: '18:30-19:15', affected_routes: ['125'],
    recommended_dispatch: [
      { route: '125', action: 'ADD', extra_buses: 4, depot_origin: 'Korogllu Depot', dispatch_time: '18:20', estimated_crowd_reduction_pct: 90, reason: '' },
      { route: 'H1', action: 'ADD', extra_buses: 2, depot_origin: 'Unknown Depot', dispatch_time: 'soon', estimated_crowd_reduction_pct: 5, reason: '' },
      { route: '6', action: 'REMOVE', extra_buses: 1, depot_origin: 'Dernegul Depot', dispatch_time: '17:00', estimated_crowd_reduction_pct: 0, reason: 'quiet' },
    ],
  }
  const out = refinePlan(plan)
  const [a, b, c] = out.recommended_dispatch
  const toMin = (s) => +s.slice(0, 2) * 60 + +s.slice(3)
  assert.ok(toMin(a.in_position_time) <= 18 * 60 + 30 - 60, 'buses must be in position at least 60 min before the surge')
  assert.equal(toMin(a.dispatch_time), toMin(a.in_position_time) - 35, 'departure = in position minus depot travel')
  assert.ok(a.estimated_crowd_reduction_pct <= 70 && a.estimated_crowd_reduction_pct >= 5)
  assert.ok(b.in_position_time && b.dispatch_time, 'unparsable time must not crash or produce empty fields')
  assert.ok(c.estimated_crowd_reduction_pct < 0, 'pulling a bus must show extra crowding, not relief')
  assert.equal(crowdChangePct('nope', 3, 'ADD'), 0)
})

test('AI plan post-processing: never tells buses to leave in the past', () => {
  const plan = {
    egress_peak_window: '16:30-17:15', affected_routes: ['125'],
    recommended_dispatch: [{ route: '125', action: 'ADD', extra_buses: 3, depot_origin: 'Zig Depot', dispatch_time: '15:00', estimated_crowd_reduction_pct: 30, reason: '' }],
  }
  const now = 15 * 60 + 40 // 15:40
  const out = refinePlan(plan, now)
  const depart = +out.recommended_dispatch[0].dispatch_time.slice(0, 2) * 60 + +out.recommended_dispatch[0].dispatch_time.slice(3)
  assert.ok(depart >= now, `departure ${out.recommended_dispatch[0].dispatch_time} is before now (15:40)`)
})

test('routines: invalid times are ignored, habits are the most frequent choice', () => {
  const r = { id: 'r', name: 'x', home: { lat: 40.404, lon: 49.8712, name: 'h' }, placeId: 'bsu', go: { 0: '08:45', 1: '25:99', 2: 'abc' }, back: {} }
  const trips = expandTrips([r])
  assert.equal(trips.filter((t) => t.kind === 'go').length, 1, 'only 08:45 is a valid time; 25:99 and abc must be ignored')
  assert.equal(toMinutes('25:99'), null)
  assert.equal(toMinutes('24:00'), null)
  assert.equal(toMinutes('23:59'), 1439)
  assert.equal(toMinutes('08:45'), 525)
  assert.equal(toMinutes('nope'), null)
  const habit = habitOf([{ key: 'a' }, { key: 'b' }, { key: 'a' }])
  assert.equal(habit.key, 'a')
  assert.equal(habit.count, 2)
})

test('routines: crowded usual stop triggers a warning, calm stop says all clear', () => {
  const home = { lat: 40.404, lon: 49.8712, name: 'Home' }
  const bsu = places.find((p) => p.id === 'bsu')
  const trip = (t) => ({ routineId: 'r', kind: 'go', time: 'x', minute: t, from: home, to: { lat: bsu.lat, lon: bsu.lon, name: bsu.name } })
  const rush = evaluateTrip(trip(8 * 60 + 45), stopStates(8 * 60 + 15, {}), {})
  const calm = evaluateTrip(trip(11 * 60), stopStates(10 * 60 + 30, {}), {})
  assert.equal(rush.tone, 'warn')
  assert.equal(calm.tone, 'ok')
  const noConnection = evaluateTrip({ ...trip(600), from: { lat: 41.5, lon: 47, name: 'far' } }, stopStates(570, {}), {})
  assert.equal(noConnection.tone, 'info')
  assert.equal(optionKey(rush.usual).includes('|'), true)
})

test('storage: server-side sanitising bounds hostile or broken documents', () => {
  const evil = {
    routines: Array.from({ length: 500 }, (_, i) => ({ id: `r${i}`, name: 'x'.repeat(5000), placeId: 'bsu', home: { lat: 'NaN', lon: null }, go: { 9: '08:00', 1: '<script>' }, back: { 2: '09:30' } })),
    history: { ['k'.repeat(500)]: 'not-a-list', ok: Array.from({ length: 999 }, () => ({ key: 'z'.repeat(999), label: 1, at: 'x' })) },
  }
  const out = sanitizeStore(evil)
  assert.ok(out.routines.length <= 20)
  assert.ok(out.routines.every((r) => r.name.length <= 40 && Object.keys(r.go).length === 0 && r.back[2] === '09:30'))
  assert.ok(Object.values(out.history).every((l) => l.length <= 30 && l.every((e) => e.key.length <= 80)))
  assert.deepEqual(sanitizeStore(null), { routines: [], history: {} })
  assert.ok(USER_ID.test('abcdefgh-1234-5678'))
  assert.ok(!USER_ID.test('../../etc/passwd'))
  assert.ok(!USER_ID.test('short'))
})
