import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadStore, saveStore, getUserId, setUserId, expandTrips, evaluateTrip, optionKey, historyKey, ALERT_LEAD_MIN, DAYS } from '../data/routine'
import { planTrip } from '../data/planner'
import { places, toClock } from '../data/mockEngine'

const CODE_OK = /^[A-Za-z0-9-]{12,64}$/

// Remembers the passenger's weekly routine and choices; raises an alert ALERT_LEAD_MIN before each trip.
// Data lives in the browser (instant) AND in a server database keyed by the sync code, so a cleared
// browser or a new device can get it back. Only the user changes or deletes it.
export function useRoutines(sim) {
  const [userId, setUser] = useState(getUserId)
  const [store, setStore] = useState(loadStore)
  const [sync, setSync] = useState('loading') // loading | saved | saving | offline
  const [syncError, setSyncError] = useState('')
  const [notes, setNotes] = useState([])
  const [focus, setFocus] = useState(null) // trip to draw on the passenger map
  const fired = useRef(new Set())
  const prevT = useRef(sim.t)
  const ready = useRef(false) // server copy has been read at least once
  const pushed = useRef(0) // updatedAt of the last copy known to be on the server
  const storeRef = useRef(store)
  useEffect(() => { storeRef.current = store })

  // every user change goes through here so updatedAt always reflects the newest edit
  const mutate = useCallback((fn) => setStore((s) => ({ ...fn(s), updatedAt: Date.now() })), [])

  // 1) read the server copy for this sync code
  useEffect(() => {
    let cancelled = false
    ready.current = false
    setSync('loading')
    fetch(`/api/routines/${userId}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        const local = storeRef.current
        if (j.found && (j.updatedAt > local.updatedAt || (local.routines.length === 0 && j.data.routines.length > 0))) {
          setStore({ ...j.data, updatedAt: j.updatedAt }) // server copy is newer (or this browser is empty)
          pushed.current = j.updatedAt
        } else {
          if (j.found) pushed.current = j.updatedAt
          // this browser has data the server has not seen yet: push it now
          if (local.routines.length > 0 && (!j.found || local.updatedAt >= j.updatedAt)) mutate((s) => s)
        }
        ready.current = true
        setSync('saved')
      })
      .catch(() => { if (!cancelled) { ready.current = true; setSync('offline') } })
    return () => { cancelled = true }
  }, [userId, mutate])

  // 2) save: browser immediately, server shortly after the last change
  useEffect(() => {
    saveStore(store)
    if (!ready.current || store.updatedAt === 0 || store.updatedAt === pushed.current) return undefined
    setSync('saving')
    const id = setTimeout(() => {
      fetch(`/api/routines/${userId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { routines: store.routines, history: store.history }, updatedAt: store.updatedAt }) })
        .then((r) => { if (!r.ok) throw new Error('save failed'); pushed.current = store.updatedAt; setSync('saved') })
        .catch(() => setSync('offline'))
    }, 500)
    return () => clearTimeout(id)
  }, [store, userId])

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

  const addRoutine = useCallback((routine) => mutate((s) => ({ ...s, routines: [...s.routines, { ...routine, id: `r${Date.now()}` }] })), [mutate])
  const updateRoutine = useCallback((id, patch) => mutate((s) => ({ ...s, routines: s.routines.map((r) => (r.id === id ? { ...r, ...patch, id } : r)) })), [mutate])
  const removeRoutine = useCallback((id) => mutate((s) => ({ routines: s.routines.filter((r) => r.id !== id), history: Object.fromEntries(Object.entries(s.history).filter(([k]) => !k.startsWith(`${id}|`))) })), [mutate])

  // remember which way the passenger actually travelled, and show it on the map
  const choose = useCallback((note, which) => {
    const opt = which === 'rec' ? note.result.rec : note.result.usual
    if (!opt) return
    const hk = historyKey(note.trip.routineId, note.trip.kind)
    const entry = { key: optionKey(opt), label: `bus ${opt.legs.map((l) => l.routeId).join(' → ')} from ${opt.boardStop}`, at: Date.now() }
    mutate((s) => ({ ...s, history: { ...s.history, [hk]: [...(s.history[hk] ?? []), entry].slice(-30) } }))
    setNotes((n) => n.map((x) => (x.id === note.id ? { ...x, acted: which } : x)))
    setFocus({ trip: { ...opt, destination: note.trip.to }, from: note.trip.from, token: Date.now() })
  }, [mutate])

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
    mutate((s) => ({ routines: [...s.routines, routine], history: { ...s.history, ...history } }))
  }, [sim.states, mutate])

  // use a sync code from another browser/device: replaces what this browser shows with the saved copy
  const restore = useCallback(async (code) => {
    const clean = code.trim()
    setSyncError('')
    if (!CODE_OK.test(clean)) { setSyncError('That code does not look right.'); return false }
    try {
      const j = await (await fetch(`/api/routines/${clean}`)).json()
      if (!j.found) { setSyncError('No saved routines found for that code.'); return false }
      setUserId(clean)
      setStore({ ...j.data, updatedAt: j.updatedAt })
      pushed.current = j.updatedAt
      ready.current = true
      setUser(clean)
      return true
    } catch {
      setSyncError('Cannot reach the server right now.')
      return false
    }
  }, [])

  const dismiss = useCallback((id) => setNotes((n) => n.filter((x) => x.id !== id)), [])
  const clearAll = useCallback(() => mutate(() => ({ routines: [], history: {} })), [mutate])

  return { store, trips, notes, focus, userId, sync, syncError, addRoutine, updateRoutine, removeRoutine, choose, previewTrip, loadDemo, restore, dismiss, clearAll, DAYS }
}
