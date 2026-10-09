import { useState } from 'react'
import { Rocket, CheckCircle2, CloudRain, Clock, MapPin, Warehouse, WifiOff, Minus, Plus, ArrowDownToLine } from 'lucide-react'

const SEVERITY = {
  CRITICAL: 'bg-red-500/20 text-red-300 ring-red-500/50',
  HIGH: 'bg-orange-500/20 text-orange-300 ring-orange-500/50',
  MODERATE: 'bg-amber-500/20 text-amber-200 ring-amber-500/40',
}

// onApply(items): items = [{ route, delta }]  (delta > 0 adds buses, delta < 0 pulls buses off)
// done: Set of route ids already applied for this plan
export default function PlanCard({ plan, done, onApply, footer, offline }) {
  const [counts, setCounts] = useState({})
  const items = plan.recommended_dispatch
  const countOf = (r) => counts[r.route] ?? r.extra_buses
  const maxOf = (r) => (r.action === 'REMOVE' ? 2 : 6)
  const delta = (r) => (r.action === 'REMOVE' ? -countOf(r) : countOf(r))
  const step = (r, d) => setCounts((c) => ({ ...c, [r.route]: Math.min(maxOf(r), Math.max(1, countOf(r) + d)) }))
  const pending = items.filter((r) => !done.has(r.route))
  const addTotal = pending.filter((r) => r.action !== 'REMOVE').reduce((a, r) => a + countOf(r), 0)
  const removeTotal = pending.filter((r) => r.action === 'REMOVE').reduce((a, r) => a + countOf(r), 0)

  return (
    <div className="space-y-3 rounded-xl border border-slate-600 bg-slate-900/80 p-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-white">{plan.scenario_title}</h3>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${SEVERITY[plan.risk_severity]}`}>{plan.risk_severity}</span>
      </div>
      <div className="space-y-1 text-[11px] text-slate-300">
        <p className="flex gap-1.5"><CloudRain className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300" />{plan.weather_factor}</p>
        <p className="flex gap-1.5"><Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />Peak window: {plan.egress_peak_window}</p>
        {plan.affected_zones.length > 0 && <p className="flex gap-1.5"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" />{plan.affected_zones.join(' · ')}</p>}
      </div>
      <p className="text-xs leading-relaxed text-slate-200">{plan.briefing}</p>
      <p className="rounded-lg bg-slate-800 p-2 text-[11px] leading-relaxed text-slate-400"><b className="text-slate-300">Why: </b>{plan.tactical_rationale}</p>

      {items.length > 0 ? (
        <>
          <div className="overflow-hidden rounded-lg ring-1 ring-slate-700">
            {items.map((r) => {
              const remove = r.action === 'REMOVE'
              const isDone = done.has(r.route)
              const pct = r.estimated_crowd_reduction_pct
              return (
                <div key={r.route} className={`border-b border-slate-700 px-3 py-2.5 last:border-0 ${remove ? 'bg-amber-500/5' : 'bg-slate-800/60'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-bold text-white">
                        Route {r.route}
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${remove ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>{remove ? 'REDUCE' : 'ADD'}</span>
                      </p>
                      <p className="flex items-center gap-1 text-[11px] text-slate-400"><Warehouse className="h-3 w-3 shrink-0" />{r.depot_origin}</p>
                      <p className="mt-0.5 text-[11px] text-sky-300">
                        {remove ? <>Release at <b>{r.dispatch_time}</b></> : <>Leave depot <b>{r.dispatch_time}</b> → in position <b>{r.in_position_time ?? r.dispatch_time}</b></>}
                      </p>
                      {r.late && <p className="mt-0.5 text-[11px] font-semibold text-red-400">Late start: the surge is close, send these buses now.</p>}
                      {r.reason && <p className="mt-0.5 text-[11px] italic text-slate-500">{r.reason}</p>}
                    </div>
                    <span title={remove ? 'Estimated extra crowding per bus on this route (simulation)' : "Share of this route's peak delay removed by the extra buses (simulation)"}
                      className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold ${remove ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                      {pct > 0 ? `−${pct}%` : `+${-pct}%`} crowd
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button onClick={() => step(r, -1)} disabled={isDone || countOf(r) <= 1} className="rounded-md bg-slate-700 p-1 text-white hover:bg-slate-600 disabled:opacity-30" aria-label="fewer"><Minus className="h-3.5 w-3.5" /></button>
                      <span className={`w-14 text-center text-sm font-bold ${remove ? 'text-amber-300' : 'text-emerald-300'}`}>{remove ? '−' : '+'}{countOf(r)} bus{countOf(r) > 1 ? 'es' : ''}</span>
                      <button onClick={() => step(r, 1)} disabled={isDone || countOf(r) >= maxOf(r)} className="rounded-md bg-slate-700 p-1 text-white hover:bg-slate-600 disabled:opacity-30" aria-label="more"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                    <button onClick={() => onApply([{ route: r.route, delta: delta(r) }])} disabled={isDone}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition active:scale-95 ${isDone ? 'bg-slate-700 text-slate-400' : remove ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
                      {isDone ? <><CheckCircle2 className="h-3.5 w-3.5" /> Applied</> : remove ? <><ArrowDownToLine className="h-3.5 w-3.5" /> Pull buses</> : <><Rocket className="h-3.5 w-3.5" /> Deploy</>}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <button onClick={() => onApply(pending.map((r) => ({ route: r.route, delta: delta(r) })))} disabled={pending.length === 0}
            className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold text-white transition active:scale-95 ${pending.length === 0 ? 'bg-emerald-900' : 'bg-indigo-600 hover:bg-indigo-500'}`}>
            {pending.length === 0
              ? <><CheckCircle2 className="h-4 w-4" /> Whole plan applied</>
              : <><Rocket className="h-4 w-4" /> Apply all remaining ({[addTotal && `+${addTotal}`, removeTotal && `−${removeTotal}`].filter(Boolean).join(' / ')} buses)</>}
          </button>
        </>
      ) : (
        <p className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-2.5 text-xs text-emerald-300"><CheckCircle2 className="h-4 w-4" /> No fleet changes needed right now.</p>
      )}
      <p className="flex items-center gap-1 text-[10px] text-slate-500">
        {offline && <WifiOff className="h-3 w-3" />}{footer}
      </p>
    </div>
  )
}
