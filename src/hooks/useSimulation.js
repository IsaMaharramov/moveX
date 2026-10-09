import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { START_T, DAY_START, DAY_END, BASE_BUSES, stopStates, toClock } from '../data/mockEngine'

const TICK_MS = 200

export function useSimulation() {
  const [t, setT] = useState(START_T)
  const [speed, setSpeed] = useState(1)
  const [playing, setPlaying] = useState(true)
  const [day, setDay] = useState(() => (new Date().getDay() + 6) % 7) // 0 = Monday
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

  // Apply plan items: [{ route, delta }] where delta > 0 adds buses and delta < 0 pulls buses off (min 1 bus stays).
  const deployPlan = useCallback((items, label) => {
    setExtras((e) => {
      const next = { ...e }
      items.forEach((i) => { next[i.route] = Math.max(-(BASE_BUSES - 1), (next[i.route] || 0) + i.delta) })
      return next
    })
    const added = items.filter((i) => i.delta > 0)
    const pulled = items.filter((i) => i.delta < 0)
    const list = (arr) => arr.map((i) => i.route).join(arr.length === 2 ? ' & ' : ', ')
    const parts = []
    if (added.length) parts.push(`+${added.reduce((a, i) => a + i.delta, 0)} Buses Injected into Route${added.length > 1 ? 's' : ''} ${list(added)}`)
    if (pulled.length) parts.push(`${-pulled.reduce((a, i) => a + i.delta, 0)} Bus${pulled.length > 1 || pulled[0].delta < -1 ? 'es' : ''} Pulled from Route${pulled.length > 1 ? 's' : ''} ${list(pulled)}`)
    const text = parts.join(' · ')
    setLog((l) => [{ id: `ai-${Date.now()}`, kind: 'dispatch', text: `AI plan applied: ${label}. ${text}`, t }, ...l].slice(0, 40))
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

  return { t, clock: toClock(t), speed, setSpeed, playing, setPlaying, jump, reset, day, setDay, extras, dispatch, deployPlan, recall, states, log, toast }
}
