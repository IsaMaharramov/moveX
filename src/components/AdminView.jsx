import { useMemo, useState } from 'react'
import { MapContainer } from 'react-leaflet'
import { AlertTriangle, CheckCircle2, Bus, Gauge, Users, TrendingDown, Siren, Info, Radar, LayoutList, LineChart, Clock3, ShieldCheck } from 'lucide-react'
import { HeatCircles, StopMarkers, BusMarkers, RouteLines, EventMarkers, FlyTo, BaseTiles, ZoomTracker, AiRings } from './MapLayers'
import EventCard from './EventCard'
import AutoIntelPanel from './AutoIntelPanel'
import ForecastChart from './ForecastChart'
import { events, BASE_BUSES, routes, toClock } from '../data/mockEngine'

function Kpi({ icon: Icon, label, value, sub, tone = 'text-white' }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-400"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tone}`}>{value}</div>
      <div className="text-[11px] text-slate-500">{sub}</div>
    </div>
  )
}

function Impact({ icon: Icon, value, label }) {
  return (
    <div className="rounded-lg bg-slate-900/70 p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-emerald-400" />
      <div className="mt-1 text-xl font-bold text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  )
}

export default function AdminView({ sim, paths, buses, focus, intel, tab, setTab }) {
  const { t, states, extras, dispatch, recall, log } = sim
  const [target, setTarget] = useState(null)
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [zoom, setZoom] = useState(13)

  const kpi = useMemo(() => {
    const avg = states.reduce((s, x) => s + x.delay, 0) / states.length
    const severe = states.filter((s) => s.level === 'Severe')
    const waiting = states.reduce((s, x) => s + x.waiting, 0)
    const saved = states.reduce((s, x) => s + (x.raw - x.delay), 0) / states.length
    const extraBuses = Object.values(extras).filter((v) => v > 0).reduce((a, b) => a + b, 0)
    const pulledBuses = -Object.values(extras).filter((v) => v < 0).reduce((a, b) => a + b, 0)
    // passenger-minutes saved per wait cycle, and severe stops avoided thanks to extra buses
    const passengerMin = Math.round(states.reduce((s, x) => s + (x.raw - x.delay) * x.waiting, 0))
    const avoided = states.filter((s) => s.raw >= 10 && s.delay < 10).length
    return { avg, severe, waiting, saved, extraBuses, pulledBuses, passengerMin, avoided }
  }, [states, extras])

  const locate = (ev) => setTarget({ pos: [ev.lat, ev.lon], zoom: 15, n: Math.random() })
  const worst = [...states].sort((a, b) => b.delay - a.delay).filter((s) => s.level !== 'Low').slice(0, 5)
  const aiRoutes = intel.data?.plan?.affected_routes

  const tabs = [
    { id: 'ai', label: 'AI Intelligence', icon: Radar, badge: intel.data?.plan?.recommended_dispatch.length ? intel.data.plan.risk_severity : null },
    { id: 'ops', label: 'Operations', icon: LayoutList, badge: kpi.severe.length || null },
    { id: 'stats', label: 'Impact', icon: LineChart },
  ]

  return (
    <div className="grid h-[calc(100vh-64px)] min-h-[600px] grid-cols-1 lg:grid-cols-[1fr_450px]">
      <div className="flex min-h-0 flex-col">
        <div className="grid grid-cols-2 gap-3 p-3 md:grid-cols-5">
          <Kpi icon={Bus} label="Buses on road" value={routes.length * BASE_BUSES + kpi.extraBuses - kpi.pulledBuses} sub={`+${kpi.extraBuses} added${kpi.pulledBuses ? ` · −${kpi.pulledBuses} pulled` : ''}`} />
          <Kpi icon={Gauge} label="Avg delay" value={`${kpi.avg.toFixed(1)}m`} sub="across all stops" tone={kpi.avg >= 5 ? 'text-amber-400' : 'text-emerald-400'} />
          <Kpi icon={Siren} label="Severe stops" value={kpi.severe.length} sub="need action" tone={kpi.severe.length ? 'text-red-400' : 'text-emerald-400'} />
          <Kpi icon={Users} label="Est. waiting" value={kpi.waiting.toLocaleString()} sub="passengers at stops" />
          <Kpi icon={TrendingDown} label="Delay saved" value={`${kpi.saved.toFixed(1)}m`} sub="avg per stop via dispatch" tone="text-emerald-400" />
        </div>
        <div className="relative min-h-[360px] flex-1">
          <MapContainer center={[40.388, 49.853]} zoom={13} className="h-full w-full" zoomControl>
            <BaseTiles />
            <ZoomTracker onZoom={setZoom} />
            <FlyTo target={target} />
            <FlyTo target={focus} />
            <RouteLines paths={paths} activeRoutes={selectedRoute ? [selectedRoute] : null} />
            <HeatCircles states={states} />
            <AiRings states={states} routeIds={aiRoutes} />
            <EventMarkers t={t} onSelect={locate} />
            <StopMarkers states={states} labels={zoom >= 14} />
            <BusMarkers buses={selectedRoute ? buses.filter((b) => b.route === selectedRoute) : buses} />
          </MapContainer>
          <div className="absolute bottom-4 left-4 z-[1000] rounded-lg bg-slate-900/90 p-3 text-xs text-slate-200 shadow-lg ring-1 ring-slate-700">
            <div className="mb-1 font-semibold">Crowd level (from bus delay)</div>
            <div className="flex gap-3">
              <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />Low &lt;5m</span>
              <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />Medium 5–9m</span>
              <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-red-500" />Severe 10m+</span>
            </div>
            {aiRoutes?.length > 0 && <div className="mt-1 flex items-center gap-1 text-indigo-300"><i className="inline-block h-2.5 w-2.5 rounded-full border-2 border-dashed border-indigo-400" />Dashed ring: stops flagged by the AI plan</div>}
            <div className="mt-2 flex flex-wrap gap-1">
              {routes.map((r) => (
                <button key={r.id} onClick={() => setSelectedRoute(selectedRoute === r.id ? null : r.id)}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold text-white ${selectedRoute && selectedRoute !== r.id ? 'opacity-40' : ''}`} style={{ background: r.color }}>{r.id}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <aside className="flex min-h-0 flex-col border-l border-slate-800 bg-slate-900 text-slate-100">
        <div className="flex gap-1 border-b border-slate-800 p-2">
          {tabs.map((x) => (
            <button key={x.id} onClick={() => setTab(x.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition ${tab === x.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
              <x.icon className="h-4 w-4" />{x.label}
              {x.badge && <span className={`rounded-full px-1.5 text-[10px] font-bold ${x.badge === 'CRITICAL' || typeof x.badge === 'number' ? 'bg-red-500 text-white' : 'bg-amber-500 text-slate-900'}`}>{x.badge}</span>}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {tab === 'ai' && <AutoIntelPanel sim={sim} intel={intel} />}

          {tab === 'ops' && (
            <>
              <section>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-300"><AlertTriangle className="h-4 w-4 text-red-400" /> Live alerts</h2>
                {worst.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" /> All stops running normally.</div>
                ) : (
                  <div className="space-y-2">
                    {worst.map((s) => (
                      <div key={s.stop.id} className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 ${s.level === 'Severe' ? 'border-red-500/40 bg-red-500/10' : 'border-amber-500/40 bg-amber-500/10'}`}>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{s.stop.name}</p>
                          <p className="text-[11px] text-slate-400">{s.delay.toFixed(0)} min late · ~{s.waiting} waiting · routes {s.serving.join(', ')}</p>
                        </div>
                        <button onClick={() => dispatch(s.serving, 1, s.stop.name)} className="shrink-0 rounded-md bg-blue-600 px-2 py-1 text-[11px] font-semibold hover:bg-blue-500">+1 bus</button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <section>
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-300">City events · predicted impact</h2>
                <div className="space-y-3">
                  {events.map((ev) => (
                    <EventCard key={ev.id} ev={ev} t={t} extras={extras} onDispatch={dispatch} onRecall={recall} onLocate={locate} />
                  ))}
                </div>
              </section>
            </>
          )}

          {tab === 'stats' && (
            <>
              <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-emerald-300"><ShieldCheck className="h-4 w-4" /> Impact of dispatch right now</h2>
                <div className="grid grid-cols-3 gap-2">
                  <Impact icon={Clock3} value={kpi.passengerMin.toLocaleString()} label="passenger-min saved" />
                  <Impact icon={Siren} value={kpi.avoided} label="severe stops avoided" />
                  <Impact icon={Bus} value={kpi.extraBuses} label="extra buses used" />
                </div>
                {kpi.extraBuses === 0 && <p className="mt-2 text-[11px] text-slate-400">No dispatch yet. Deploy an AI plan or an event plan and watch these numbers climb.</p>}
              </section>
              <section className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-300">Peak delay forecast</h2>
                <p className="mb-1 text-[11px] text-slate-400"><span className="text-red-400">- - no action</span> · <span className="text-blue-400">with current dispatch</span></p>
                <ForecastChart extras={extras} t={t} />
              </section>
              <section>
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-300">Activity log</h2>
                {log.length === 0 ? <p className="text-xs text-slate-500">Waiting for events…</p> : (
                  <ul className="space-y-1.5">
                    {log.slice(0, 14).map((l) => (
                      <li key={l.id} className="flex gap-2 text-xs">
                        <span className="shrink-0 font-mono text-slate-500">{toClock(l.t)}</span>
                        <span className={l.kind === 'alert' ? 'text-red-300' : l.kind === 'ok' ? 'text-emerald-300' : l.kind === 'dispatch' ? 'text-blue-300' : 'text-slate-300'}>{l.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <p className="flex gap-2 rounded-lg bg-slate-800 p-3 text-[11px] text-slate-400">
                <Info className="h-4 w-4 shrink-0" />
                Prototype uses a simulated fleet. In production, AYNA GPS and delay feeds replace the simulator. Crowd level is inferred strictly from bus delay.
              </p>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
