import { Rocket, CheckCircle2, CloudRain, Clock, MapPin, Warehouse, WifiOff } from 'lucide-react'

const SEVERITY = {
  CRITICAL: 'bg-red-500/20 text-red-300 ring-red-500/50',
  HIGH: 'bg-orange-500/20 text-orange-300 ring-orange-500/50',
  MODERATE: 'bg-amber-500/20 text-amber-200 ring-amber-500/40',
}

export default function PlanCard({ plan, deployed, onDeploy, footer, offline }) {
  const total = plan.recommended_dispatch.reduce((a, r) => a + r.extra_buses, 0)
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

      {plan.recommended_dispatch.length > 0 ? (
        <>
          <div className="overflow-hidden rounded-lg ring-1 ring-slate-700">
            {plan.recommended_dispatch.map((r) => (
              <div key={r.route} className="flex items-center justify-between gap-2 border-b border-slate-700 bg-slate-800/60 px-3 py-2 last:border-0">
                <div>
                  <p className="text-sm font-bold text-white">Route {r.route} <span className="text-emerald-400">+{r.extra_buses}</span></p>
                  <p className="flex items-center gap-1 text-[11px] text-slate-400"><Warehouse className="h-3 w-3" />{r.depot_origin}</p>
                  <p className="mt-0.5 text-[11px] text-sky-300">Leave depot <b>{r.dispatch_time}</b> → in position <b>{r.in_position_time ?? r.dispatch_time}</b></p>
                </div>
                <span title="Share of this route's peak delay removed by the extra buses (from the simulation)" className="rounded-md bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-300">−{r.estimated_crowd_reduction_pct}% crowd</span>
              </div>
            ))}
          </div>
          <button onClick={onDeploy} disabled={deployed}
            className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold text-white transition active:scale-95 ${deployed ? 'bg-emerald-800' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
            {deployed ? <><CheckCircle2 className="h-4 w-4" /> Deployed to fleet</> : <><Rocket className="h-4 w-4" /> Approve &amp; Deploy to Fleet (+{total} buses)</>}
          </button>
        </>
      ) : (
        <p className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-2.5 text-xs text-emerald-300"><CheckCircle2 className="h-4 w-4" /> No extra buses needed right now.</p>
      )}
      <p className="flex items-center gap-1 text-[10px] text-slate-500">
        {offline && <WifiOff className="h-3 w-3" />}{footer}
      </p>
    </div>
  )
}
