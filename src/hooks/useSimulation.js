import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { START_T, DAY_START, DAY_END, stopStates, toClock } from '../data/mockEngine'

const TICK_MS = 200

export function useSimulation() {
  const [t, setT] = useState(START_T)
  const [speed, setSpeed] = useState(1)
  const [playing, setPlaying] = useState(true)
  const [extras, setExtras] = useState({})
  const [log, setLog] = useState([])
  const [toast, setToast] = useState(null)
  const prevSevere = useRef(null)

  useEffect(() => {
    if (!playing) return undefined
    const id = setInterval(() => {
      setT((cur) => {
        const next = cur + (speed * TICK_MS) / 1000
        return next >= DAY_END ? DAY_START : next
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [playing, speed])

  const states = useMemo(() => stopStates(t, extras), [t, extras])

  // Auto-generated alerts when a stop enters / leaves the Severe level.
  useEffect(() => {
    const severe = new Set(states.filter((s) => s.level === 'Severe').map((s) => s.stop.id))
    if (prevSevere.current) {
      const entries = []
      for (const s of states) {
        const was = prevSevere.current.has(s.stop.id)
        const now = severe.has(s.stop.id)
        if (now && !was) entries.push({ kind: 'alert', text: `${s.stop.name}: severe crowding, buses ${s.delay.toFixed(0)} min late` })
        if (!now && was) entries.push({ kind: 'ok', text: `${s.stop.name}: crowding eased` })
      }
      if (entries.length) setLog((l) => [...entries.map((e, i) => ({ ...e, id: `${t}-${i}-${e.text}`, t })), ...l].slice(0, 40))
    }
    prevSevere.current = severe
  }, [states, t])

  const pushToast = useCallback((text) => {
    const id = Date.now()
    setToast({ id, text })
    setTimeout(() => setToast((cur) => (cur && cur.id === id ? null : cur)), 3500)
  }, [])

  const dispatch = useCallback((routeIds, n, label) => {
    setExtras((e) => {
      const next = { ...e }
      routeIds.forEach((r) => { next[r] = (next[r] || 0) + n })
      return next
    })
    const text = `Dispatched +${n} buses on ${routeIds.join(', ')}${label ? ` for ${label}` : ''}`
    setLog((l) => [{ id: `d-${Date.now()}`, kind: 'dispatch', text, t }, ...l].slice(0, 40))
    pushToast(text)
  }, [t, pushToast])

  // Deploy an AI plan: [{ route, extra_buses }] -> extra buses on the simulated fleet.
  const deployPlan = useCallback((items, label) => {
    setExtras((e) => {
      const next = { ...e }
      items.forEach((i) => { next[i.route] = (next[i.route] || 0) + i.extra_buses })
      return next
    })
    const total = items.reduce((a, i) => a + i.extra_buses, 0)
    const routesText = items.map((i) => i.route).join(items.length === 2 ? ' & ' : ', ')
    const text = `+${total} Buses Injected into Route${items.length > 1 ? 's' : ''} ${routesText}`
    setLog((l) => [{ id: `ai-${Date.now()}`, kind: 'dispatch', text: `AI plan deployed: ${label}. ${text}`, t }, ...l].slice(0, 40))
    pushToast(text)
  }, [t, pushToast])

  const recall = useCallback((routeIds) => {
    setExtras((e) => {
      const next = { ...e }
      routeIds.forEach((r) => delete next[r])
      return next
    })
    setLog((l) => [{ id: `r-${Date.now()}`, kind: 'info', text: `Recalled extra buses from ${routeIds.join(', ')}`, t }, ...l].slice(0, 40))
  }, [t])

  const reset = useCallback(() => { setExtras({}); setLog([]) }, [])

  const jump = useCallback((minutes) => setT(minutes), [])

  return { t, clock: toClock(t), speed, setSpeed, playing, setPlaying, jump, reset, extras, dispatch, deployPlan, recall, states, log, toast }
}
