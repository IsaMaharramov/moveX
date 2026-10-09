import { useMemo } from 'react'
import { CalendarClock, Users, Bus, Sparkles, Undo2, Crosshair } from 'lucide-react'
import { toClock, eventLoad, eventStatus, recommendFor, getCrowdLevel, LEVEL_COLOR } from '../data/mockEngine'

const tones = {
  slate: 'bg-slate-700 text-slate-200',
  amber: 'bg-amber-500/20 text-amber-300',
  blue: 'bg-blue-500/20 text-blue-300',
  red: 'bg-red-500/20 text-red-300',
}

export default function EventCard({ ev, t, extras, onDispatch, onRecall, onLocate }) {
  const rec = useMemo(() => recommendFor(ev), [ev])
  const status = eventStatus(ev, t)
  const load = Math.min(1, eventLoad(ev, t) / 1.3)
  const dispatched = ev.routes.map((r) => extras[r] || 0)
  const total = dispatched.reduce((a, b) => a + b, 0)
  const minD = Math.min(...dispatched)
  const level = getCrowdLevel(rec.noDispatchPeak)
  const covered = minD >= rec.k

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-white">{ev.name}</h3>
          <p className="text-xs text-slate-400">{ev.venue}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[status.tone]}`}>{status.label}</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
        <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{toClock(ev.start)}–{toClock(ev.end)}</span>
        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{ev.attendance.toLocaleString()}</span>
        <span className="flex items-center gap-1"><Bus className="h-3.5 w-3.5" />{ev.routes.join(' · ')}</span>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[11px] text-slate-400"><span>Crowd pressure now</span><span>{Math.round(load * 100)}%</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
          <div className="h-full rounded-full transition-all" style={{ width: `${load * 100}%`, background: load > 0.66 ? LEVEL_COLOR.Severe : load > 0.33 ? LEVEL_COLOR.Medium : LEVEL_COLOR.Low }} />
        </div>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-500/10 p-2 text-xs text-blue-200">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
        <span>
          AI forecast: peak delay <b>{rec.noDispatchPeak.toFixed(0)} min ({level})</b> near venue.
          {rec.k > 0
            ? <> Recommended <b>+{rec.k} buses per route</b> → peak drops to {rec.withPeak.toFixed(0)} min.</>
            : ' No extra buses needed.'}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => onDispatch(ev.routes, 2, ev.venue)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500 active:scale-95">
          Dispatch +2 Buses
        </button>
        {rec.k > 0 && !covered && (
          <button onClick={() => onDispatch(ev.routes, rec.k - minD, ev.venue)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 active:scale-95">
            Apply AI plan
          </button>
        )}
        {total > 0 && (
          <button onClick={() => onRecall(ev.routes)} className="flex items-center gap-1 rounded-lg bg-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-600">
            <Undo2 className="h-3.5 w-3.5" /> Recall
          </button>
        )}
        <button onClick={() => onLocate(ev)} className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-700">
          <Crosshair className="h-3.5 w-3.5" /> Locate
        </button>
      </div>
      {total > 0 && (
        <p className="mt-2 text-[11px] text-emerald-400">Extra buses active: {ev.routes.map((r, i) => `${r} +${dispatched[i]}`).join(', ')}{covered && rec.k > 0 ? ' ✓ plan covered' : ''}</p>
      )}
    </div>
  )
}
