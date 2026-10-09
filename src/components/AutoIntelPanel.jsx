import { useCallback, useEffect, useRef, useState } from 'react'
import { Radar, RefreshCw, Loader2, CheckCircle2, XCircle, ExternalLink, Newspaper, CloudSun, CalendarDays, FlaskConical, Zap, ChevronDown } from 'lucide-react'
import PlanCard from './PlanCard'
import AIDispatchPanel from './AIDispatchPanel'

const TYPE_ICON = { weather: CloudSun, calendar: CalendarDays, news: Newspaper }

const TESTS = [
  { label: '🌧️ Storm', items: [{ type: 'weather', title: 'Weather alert: severe storm with heavy rain, 20 mm/h, expected in Baku from 17:00 to 23:00 tonight' }] },
  { label: '⚽ Big match', items: [{ type: 'news', title: 'Tofiq Bahramov Stadium sold out: 29,000 fans expected for tonight\'s national team match, kick-off 20:45' }] },
  { label: '🚧 Road closure', items: [{ type: 'news', title: 'Heydar Aliyev Avenue partially closed for emergency repairs, buses diverted, delays expected at 28 May and Narimanov' }] },
  { label: '🎒 Sept 15', items: [{ type: 'calendar', title: 'September 15, first day of school: 1.5 million pupils and parents travelling city-wide, severe gridlock expected' }] },
]

const ago = (iso) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso)) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  return `${Math.round(s / 3600)} h ago`
}

export default function AutoIntelPanel({ sim, intel }) {
  const { data, loading, error, scanNow } = intel
  const [autoDeploy, setAutoDeploy] = useState(false)
  const [deployedId, setDeployedId] = useState(null)
  const [showSignals, setShowSignals] = useState(false)
  const [, force] = useState(0)
  const lastAutoId = useRef(null)

  // keep the "x min ago" labels fresh
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 15000)
    return () => clearInterval(id)
  }, [])

  const plan = data?.plan
  const deploy = useCallback(() => {
    if (!data?.plan) return
    sim.deployPlan(data.plan.recommended_dispatch, data.plan.scenario_title)
    setDeployedId(data.scanId)
  }, [data, sim])

  // Autopilot: deploy new plans without asking, once per scan
  useEffect(() => {
    if (autoDeploy && data?.plan?.recommended_dispatch.length && lastAutoId.current !== data.scanId && deployedId !== data.scanId) {
      lastAutoId.current = data.scanId
      deploy()
    }
  }, [autoDeploy, data, deployedId, deploy])

  const used = data?.signals.filter((s) => s.used) ?? []
  const shown = showSignals ? data?.signals ?? [] : used

  return (
    <section className="rounded-xl border border-indigo-500/40 bg-gradient-to-b from-indigo-950/60 to-slate-800/70 p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-indigo-200">
          <Radar className="h-4 w-4 text-indigo-300" /> Autonomous Event Intelligence
        </h2>
        <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />AUTO</span>
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        The server scans weather, the Azerbaijani calendar and live news every {data?.scanEveryMinutes ?? 15} min and drafts a plan. Nobody has to type anything.
      </p>

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
        <span>{data ? `Last scan ${ago(data.scannedAt)} · ${data.bakuTime.slice(11)} Baku` : 'First scan running…'}</span>
        <button onClick={() => scanNow()} disabled={loading} className="flex items-center gap-1 rounded-md bg-slate-700 px-2 py-1 font-semibold text-slate-100 hover:bg-slate-600 disabled:opacity-50">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Scan now
        </button>
      </div>

      {!data && !error && (
        <div className="mt-3 space-y-2" aria-label="loading">
          <p className="flex items-center gap-2 text-xs text-indigo-200"><Loader2 className="h-4 w-4 animate-spin" /> Collecting weather, calendar and news from 8 sources…</p>
          {[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-800" />)}
        </div>
      )}

      {data && (
        <div className="mt-2 flex flex-wrap gap-1">
          {data.sources.map((s) => (
            <span key={s.name} title={s.error || `${s.count} relevant items`} className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${s.ok ? 'bg-slate-800 text-slate-300' : 'bg-red-500/15 text-red-300'}`}>
              {s.ok ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <XCircle className="h-3 w-3" />}{s.name} · {s.count}
            </span>
          ))}
        </div>
      )}

      {data?.weather && (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-sky-500/10 p-2 text-[11px] text-sky-200"><CloudSun className="h-4 w-4 shrink-0" />{data.weather.text}, now {Math.round(data.weather.currentTempC)}°C</p>
      )}

      {error && <p className="mt-2 rounded-lg bg-red-500/10 p-2 text-xs text-red-300">{error}</p>}
      {data?.error && <p className="mt-2 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-300">{data.error}</p>}

      {data && (
        <div className="mt-3">
          <button onClick={() => setShowSignals(!showSignals)} className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <span>{showSignals ? `All collected signals (${data.signals.length})` : `Signals that drove this plan (${used.length})`}</span>
            <ChevronDown className={`h-4 w-4 transition ${showSignals ? 'rotate-180' : ''}`} />
          </button>
          <ul className="mt-1.5 space-y-1.5">
            {shown.length === 0 && <li className="text-[11px] text-slate-500">No transport-relevant signals found.</li>}
            {shown.map((s) => {
              const Icon = TYPE_ICON[s.type] ?? Newspaper
              return (
                <li key={s.id} className={`flex gap-2 rounded-lg p-2 text-[11px] ${s.used ? 'bg-indigo-500/10 ring-1 ring-indigo-500/30' : 'bg-slate-800/60'}`}>
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-300" />
                  <div className="min-w-0">
                    <p className="text-slate-100">{s.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                      {s.test && <span className="rounded bg-fuchsia-500/20 px-1 text-fuchsia-300">TEST</span>}
                      {s.source}{s.published && ` · ${ago(s.published)}`}
                      {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 text-indigo-300 hover:underline"><ExternalLink className="h-3 w-3" />open</a>}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {plan && (
        <div className="mt-3">
          <PlanCard
            plan={plan}
            deployed={deployedId === data.scanId}
            onDeploy={deploy}
            footer={`Autonomous analysis by ${data.model}${data.cached ? ' · no new signals since last analysis' : ''}`}
          />
        </div>
      )}

      <label className="mt-3 flex cursor-pointer items-center justify-between rounded-lg bg-slate-800 p-2.5 text-xs text-slate-200">
        <span className="flex items-center gap-2"><Zap className="h-4 w-4 text-amber-300" /> Autopilot: deploy plans automatically</span>
        <input type="checkbox" checked={autoDeploy} onChange={(e) => setAutoDeploy(e.target.checked)} className="h-4 w-4 accent-indigo-500" />
      </label>

      <div className="mt-3 rounded-lg border border-dashed border-fuchsia-500/40 p-2.5">
        <p className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-fuchsia-300"><FlaskConical className="h-3 w-3" /> Test: inject a signal into the live feed</p>
        <div className="flex flex-wrap gap-1.5">
          {TESTS.map((t) => (
            <button key={t.label} disabled={loading} onClick={() => scanNow(t.items)} className="rounded-md bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-100 ring-1 ring-slate-700 hover:ring-fuchsia-400 disabled:opacity-50">{t.label}</button>
          ))}
        </div>
      </div>

      <details className="mt-3 rounded-lg bg-slate-900/50 p-2.5">
        <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-slate-400">Manual analysis &amp; demo presets</summary>
        <div className="mt-2"><AIDispatchPanel sim={sim} /></div>
      </details>
    </section>
  )
}
