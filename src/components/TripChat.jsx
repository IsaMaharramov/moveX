import { useEffect, useRef, useState } from 'react'
import { Send, Bot, Footprints, Bus, ArrowRightLeft, Flag, Loader2, Sparkles } from 'lucide-react'
import CrowdBadge from './CrowdBadge'
import { places } from '../data/mockEngine'
import { planTrip, findPlace } from '../data/planner'
import { routeTimetable, parseTimetableRequest } from '../data/timetable'
import TimetableCard from './TimetableCard'

const CHIPS = ['Give me the intervals of bus 125', 'Port Baku Mall', 'Flag Square', 'Old City', 'Baku State University', 'Bayraq meydanına getmək istəyirəm']

// Offline fallback so the demo never dies: keyword match + the same planner the server uses.
function localAnswer(text, pos, states, sim, geometry) {
  const rid = parseTimetableRequest(text)
  if (rid) {
    const tt = routeTimetable(rid, sim.t, sim.extras, states, geometry)
    return { reply: `Bus ${rid} runs about every ${tt.intervalMin} minutes with ${tt.buses} buses. Full timetable below.`, trip: null, timetable: tt, offline: true }
  }
  const place = findPlace(text, places)
  if (!place) return { reply: `I did not recognise that place. Try one of: ${places.slice(0, 5).map((p) => p.name).join(', ')}.`, trip: null }
  const plan = planTrip({ lat: pos[0], lon: pos[1] }, place, states)
  if (!plan.best) return { reply: `I could not find a bus connection to ${place.name} from here.`, trip: { destination: place, noRoute: true } }
  const b = plan.best
  const via = b.transfer ? `, then change to bus ${b.transfer.routeId} at ${b.transfer.stop}` : ''
  const cmp = plan.nearestStopOption && plan.nearestStopOption.boardStopId !== b.boardStopId && plan.nearestStopOption.totalMin > b.totalMin
    ? ` That beats your nearest stop (${plan.nearestStopOption.boardStop}, ${plan.nearestStopOption.boardLevel} crowding) by ${plan.nearestStopOption.totalMin - b.totalMin} min.` : ''
  return {
    reply: `Take bus ${b.routeId} from ${b.boardStop} (${b.walkToMin} min walk, ${b.boardLevel} crowding)${via}, and get off at ${b.alightStop}. About ${b.totalMin} min in total.${cmp}`,
    trip: { ...b, destination: place, nearestStopOption: plan.nearestStopOption, walkOnlyMin: plan.walkOnlyMin },
    offline: true,
  }
}

function TripSteps({ trip }) {
  if (!trip || trip.noRoute) return null
  const near = trip.nearestStopOption
  const saved = near && near.boardStopId !== trip.boardStopId ? near.totalMin - trip.totalMin : 0
  return (
    <div className="mt-2 space-y-1.5 rounded-lg bg-white/70 p-2.5 text-[11px] text-slate-700 ring-1 ring-slate-200">
      <p className="flex items-center gap-1.5"><Footprints className="h-3.5 w-3.5 text-blue-600" /> Walk {trip.walkToMin} min to <b>{trip.boardStop}</b> <CrowdBadge level={trip.boardLevel} /></p>
      <p className="flex items-center gap-1.5"><Bus className="h-3.5 w-3.5 text-indigo-600" /> Wait ~{trip.waitMin} min, ride bus <b>{trip.legs[0].routeId}</b>{trip.transfer ? ` to ${trip.transfer.stop}` : ` to ${trip.alightStop}`}</p>
      {trip.transfer && <p className="flex items-center gap-1.5"><ArrowRightLeft className="h-3.5 w-3.5 text-orange-600" /> Change to bus <b>{trip.transfer.routeId}</b> (wait ~{trip.transfer.waitMin} min), get off at {trip.alightStop}</p>}
      <p className="flex items-center gap-1.5"><Flag className="h-3.5 w-3.5 text-emerald-600" /> Walk {trip.walkFromMin} min to <b>{trip.destination.name}</b></p>
      <p className="flex items-center justify-between border-t border-slate-200 pt-1.5 font-semibold">
        <span>Total ≈ {trip.totalMin} min</span>
        {saved > 0 && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">saves {saved} min vs nearest stop</span>}
      </p>
    </div>
  )
}

export default function TripChat({ sim, pos, onTrip, geometry }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I am MoveX Assistant. Tell me where you want to go and I will find the best bus, avoiding crowded stops. (English, Azərbaycanca or Русский)' },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [messages, busy])

  const send = async (raw) => {
    const text = (raw ?? input).trim()
    if (!text || busy) return
    setInput('')
    const history = [...messages, { role: 'user', content: text }]
    setMessages(history)
    setBusy(true)
    let result
    try {
      const res = await fetch('/api/passenger-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.slice(1).map(({ role, content }) => ({ role, content })),
          lat: pos[0], lon: pos[1], simMinute: sim.t, extras: sim.extras, geometry,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'failed')
      result = json
    } catch {
      result = localAnswer(text, pos, sim.states, sim, geometry)
    }
    setMessages((m) => [...m, { role: 'assistant', content: result.reply, trip: result.trip, timetable: result.timetable, offline: result.offline }])
    onTrip(result.trip && !result.trip.noRoute ? result.trip : null, result.timetable?.routeId ?? null)
    setBusy(false)
  }

  return (
    <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-indigo-600"><Sparkles className="h-3.5 w-3.5" /> Ask MoveX Assistant</p>
      <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'rounded-br-sm bg-blue-600 text-white' : 'rounded-bl-sm bg-slate-100 text-slate-800'}`}>
              {m.role === 'assistant' && <Bot className="mb-0.5 inline h-3.5 w-3.5 text-indigo-500" />} {m.content}
              <TripSteps trip={m.trip} />
              {m.timetable && <TimetableCard tt={m.timetable} pos={pos} />}
              {m.offline && <p className="mt-1 text-[10px] text-slate-400">offline mode</p>}
            </div>
          </div>
        ))}
        {busy && <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking live crowd levels…</div>}
        <div ref={endRef} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {CHIPS.map((c) => (
          <button key={c} disabled={busy} onClick={() => send(c.includes('getmək') || c.startsWith('Give') ? c : `I want to go to ${c}`)} className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">{c.includes('getmək') ? 'AZ: Bayraq meydanı' : c.startsWith('Give') ? '🕒 Intervals of bus 125' : c}</button>
        ))}
      </div>
      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); send() }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={300} placeholder="Where do you want to go?"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
        <button type="submit" disabled={busy || !input.trim()} className="rounded-lg bg-indigo-600 px-3 text-white hover:bg-indigo-700 disabled:opacity-50" aria-label="send"><Send className="h-4 w-4" /></button>
      </form>
    </div>
  )
}
