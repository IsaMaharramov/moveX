import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadStore, saveStore, expandTrips, evaluateTrip, optionKey, historyKey, ALERT_LEAD_MIN, DAYS } from '../data/routine'
import { planTrip } from '../data/planner'
import { places, toClock } from '../data/mockEngine'

// Remembers the passenger's weekly routine and choices; raises an alert ALERT_LEAD_MIN before each trip.
export function useRoutines(sim) {
  const [store, setStore] = useState(loadStore)
  const [notes, setNotes] = useState([])
  const [focus, setFocus] = useState(null) // trip to draw on the passenger map
  const fired = useRef(new Set())
  const prevT = useRef(sim.t)

  useEffect(() => { saveStore(store) }, [store])
  const trips = useMemo(() => expandTrips(store.routines), [store.routines])

  // fire the pre-trip alert when the (simulated) clock enters the 30-minute window
  useEffect(() => {
    if (sim.t < prevT.current - 1) fired.current.clear() // clock wrapped around: new day cycle
    prevT.current = sim.t
    for (const trip of trips) {
      const lead = trip.minute - sim.t
      if (trip.day !== sim.day || lead <= 0 || lead > ALERT_LEAD_MIN || fired.current.has(trip.id)) continue
      fired.current.add(trip.id)
      const result = evaluateTrip(trip, sim.states, store.history)
      const note = { id: `${trip.id}-${Date.now()}`, trip, result, at: toClock(sim.t), leadMin: Math.round(lead), acted: null }
      setNotes((n) => [note, ...n].slice(0, 12))
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try { new Notification(`MoveX: ${result.title}`, { body: result.body }) } catch { /* some browsers block constructor */ }
      }
    }
  }, [sim.t, sim.day, sim.states, trips, store.history])

  const addRoutine = useCallback((routine) => setStore((s) => ({ ...s, routines: [...s.routines, { ...routine, id: `r${Date.now()}` }] })), [])
  const removeRoutine = useCallback((id) => setStore((s) => ({ routines: s.routines.filter((r) => r.id !== id), history: Object.fromEntries(Object.entries(s.history).filter(([k]) => !k.startsWith(`${id}|`))) })), [])

  // remember which way the passenger actually travelled, and show it on the map
  const choose = useCallback((note, which) => {
    const opt = which === 'rec' ? note.result.rec : note.result.usual
    if (!opt) return
    const hk = historyKey(note.trip.routineId, note.trip.kind)
    const entry = { key: optionKey(opt), label: `bus ${opt.legs.map((l) => l.routeId).join(' → ')} from ${opt.boardStop}`, at: Date.now() }
    setStore((s) => ({ ...s, history: { ...s.history, [hk]: [...(s.history[hk] ?? []), entry].slice(-30) } }))
    setNotes((n) => n.map((x) => (x.id === note.id ? { ...x, acted: which } : x)))
    setFocus({ trip: { ...opt, destination: note.trip.to }, from: note.trip.from, token: Date.now() })
  }, [])

  const previewTrip = useCallback((trip) => {
    fired.current.delete(trip.id)
    sim.setDay(trip.day)
    sim.jump(trip.minute - ALERT_LEAD_MIN)
    sim.setSpeed(1)
    sim.setPlaying(true)
  }, [sim])

  // one-click demo: a university student with a different schedule each weekday and a learned habit
  const loadDemo = useCallback(() => {
    const home = { lat: 40.404, lon: 49.8712, name: 'Home (Narimanov)' }
    const placeId = 'bsu'
    const place = places.find((p) => p.id === placeId)
    const routine = {
      id: `demo${Date.now()}`, name: 'University', home, placeId,
      go: { 0: '08:45', 1: '11:00', 2: '08:30', 3: '10:00', 4: '08:45' },
      back: { 0: '18:30', 1: '19:30', 2: '18:00', 3: '21:00', 4: '17:45' },
    }
    // seed the learned habit: the passenger always used the stop nearest to home
    const history = {}
    for (const [kind, from, to] of [['go', home, place], ['back', place, home]]) {
      const plan = planTrip(from, to, sim.states)
      const usual = plan.nearestStopOption ?? plan.best
      if (!usual) continue
      history[historyKey(routine.id, kind)] = Array.from({ length: 6 }, (_, i) => ({
        key: optionKey(usual), label: `bus ${usual.legs.map((l) => l.routeId).join(' → ')} from ${usual.boardStop}`, at: Date.now() - i * 864e5,
      }))
    }
    setStore((s) => ({ routines: [...s.routines, routine], history: { ...s.history, ...history } }))
  }, [sim.states])

  const dismiss = useCallback((id) => setNotes((n) => n.filter((x) => x.id !== id)), [])
  const clearAll = useCallback(() => setStore({ routines: [], history: {} }), [])

  return { store, trips, notes, focus, addRoutine, removeRoutine, choose, previewTrip, loadDemo, dismiss, clearAll, DAYS }
}
