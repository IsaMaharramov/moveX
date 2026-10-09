import { BellRing, ShieldCheck } from 'lucide-react'

// What passengers see: the AI plan turned into a plain-language heads-up.
export default function AiAlertBanner({ plan }) {
  if (!plan) return null
  const quiet = plan.recommended_dispatch.length === 0 && plan.affected_routes.length === 0
  if (quiet) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
        <ShieldCheck className="h-5 w-5 shrink-0" /> MoveX: no major disruptions expected today.
      </div>
    )
  }
  const strong = plan.risk_severity !== 'MODERATE'
  return (
    <div className={`rounded-xl p-3 ring-1 ${strong ? 'bg-orange-50 ring-orange-300' : 'bg-amber-50 ring-amber-200'}`}>
      <p className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide ${strong ? 'text-orange-700' : 'text-amber-700'}`}>
        <BellRing className="h-4 w-4" /> MoveX alert · {plan.risk_severity}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{plan.scenario_title}</p>
      <p className="mt-0.5 text-xs text-slate-600">
        Expect crowded buses{plan.egress_peak_window ? ` around ${plan.egress_peak_window}` : ''}
        {plan.affected_routes.length > 0 && <> on routes <b>{plan.affected_routes.join(', ')}</b></>}.
        {plan.affected_zones.length > 0 && <> Busiest: {plan.affected_zones.join(', ')}.</>} Check a quieter nearby stop below.
      </p>
    </div>
  )
}
