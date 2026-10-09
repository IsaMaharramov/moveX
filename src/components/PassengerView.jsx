import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Polyline } from 'react-leaflet'
import { MapPin, Footprints, AlertTriangle, CheckCircle2, Navigation, Clock, Bus, Sparkles, CalendarClock } from 'lucide-react'
import { HeatCircles, StopMarkers, BusMarkers, FlyTo, ClickToSet, PinMarker, EventMarkers, RouteLines, BaseTiles, AiRings, PoiMarkers, TripLayer, FitTo } from './MapLayers'
import CrowdBadge from './CrowdBadge'
import AiAlertBanner from './AiAlertBanner'
import TripChat from './TripChat'
import RoutinePanel from './RoutinePanel'
import { buildGeometry } from '../data/timetable'
import { walkMinutes, haversine, routes, computeStopAlong, stopById } from '../data/mockEngine'

const routeColor = Object.fromEntries(routes.map((r) => [r.id, r.color]))

export default function PassengerView({ sim, buses, paths, focus, intel, routines, tab, setTab }) {
  const { states, t } = sim
  const [pos, setPos] = useState([40.3968, 49.8532])
  const [target, setTarget] = useState(null)
  const [navigating, setNavigating] = useState(false)
  const [trip, setTrip] = useState(null)
  const [tripToken, setTripToken] = useState(0)
  const stopAlong = useMemo(() => computeStopAlong(paths), [paths])
  const geometry = useMemo(() => buildGeometry(paths, stopAlong), [paths, stopAlong])
  const [ttRoute, setTtRoute] = useState(null)
  const showTrip = (tr, routeId) => { setTrip(tr); setTtRoute(routeId ?? null); setTripToken((n) => n + 1) }
  const tripPoints = ttRoute ? paths[ttRoute].pts.filter((_, i) => i % 6 === 0) : trip && !trip.noRoute ? [pos, [stopById[trip.boardStopId].lat, stopById[trip.boardStopId].lon], [stopById[trip.alightStopId].lat, stopById[trip.alightStopId].lon], [trip.destination.lat, trip.destination.lon]] : null

  const options = useMemo(() => {
    const me = { lat: pos[0], lon: pos[1] }
    return states
      .map((s) => {
        const walk = walkMinutes(me, s.stop)
        return { ...s, walk, total: walk + s.wait, dist: haversine(me, s.stop) }
      })
      .filter((o) => o.dist < 1300)
      .sort((a, b) => a.dist - b.dist)
  }, [states, pos])

  const current = options[0]
  const best = options.slice().sort((a, b) => a.total - b.total)[0]
  const alt = best && current && best.stop.id !== current.stop.id && best.total < current.total ? best : null
  const crowded = current && current.level !== 'Low'

  // a reminder was acted on: put the pin at the trip start and draw the chosen route
  useEffect(() => {
    if (!routines?.focus) return
    setPos([routines.focus.from.lat, routines.focus.from.lon])
    setTrip(routines.focus.trip)
    setTtRoute(null)
    setTripToken((n) => n + 1)
  }, [routines?.focus])

  const pick = (p) => { setPos(p); setNavigating(false); setTrip(null); setTtRoute(null) }

  return (
    <div className="grid h-[calc(100vh-64px)] min-h-[600px] grid-cols-1 lg:grid-cols-[430px_1fr]">
      <aside className="flex min-h-0 flex-col bg-slate-50">
        <div className="flex gap-1 border-b border-slate-200 bg-white p-2">
          {[['plan', 'Assistant', Sparkles], ['routine', 'My routine', CalendarClock]].map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition ${tab === id ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
              <Icon className="h-4 w-4" />{label}
              {id === 'routine' && routines.notes.length > 0 && <span className="rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-white">{routines.notes.length}</span>}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {tab === 'routine' ? <RoutinePanel sim={sim} routines={routines} pos={pos} /> : (
        <>
        <AiAlertBanner plan={intel?.data?.plan} />

        <TripChat sim={sim} pos={pos} onTrip={showTrip} geometry={geometry} />

        <div className="rounded-xl bg-white p-3 text-sm text-slate-600 shadow-sm">
          <MapPin className="mr-1 inline h-4 w-4 text-blue-600" />
          Drag the pin or tap the map to set where you are. Everything updates live.
        </div>

        {!current ? (
          <div className="rounded-xl bg-white p-4 text-sm text-slate-600 shadow-sm">No bus stops within 1.3 km of this point. Move the pin closer to a stop.</div>
        ) : (
          <>
            <div className={`rounded-xl border-2 p-4 shadow-sm ${current.level === 'Severe' ? 'border-red-400 bg-red-50' : current.level === 'Medium' ? 'border-amber-400 bg-amber-50' : 'border-emerald-400 bg-emerald-50'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Your nearest stop</p>
                  <h2 className="text-lg font-bold text-slate-900">{current.stop.name}</h2>
                </div>
                <CrowdBadge level={current.level} />
              </div>
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-600"><Footprints className="h-3.5 w-3.5" /> {current.walk} min walk · ~{current.waiting} people waiting</p>
              {crowded ? (
                <p className="mt-3 flex items-start gap-2 text-sm font-medium text-red-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Buses here are {current.delay.toFixed(0)} min late, so it is very crowded. Expect to wait about {current.wait} min.
                </p>
              ) : (
                <p className="mt-3 flex items-center gap-2 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Calm stop. Expected wait ≈ {current.wait} min.</p>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {current.serving.map((r) => (
                  <span key={r} className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: routeColor[r] }}>{r}</span>
                ))}
              </div>
            </div>

            {alt && (
              <div className="rounded-xl border-2 border-blue-500 bg-white p-4 shadow-md">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">Recommended alternative</p>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">{alt.stop.name}</h3>
                  <CrowdBadge level={alt.level} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-lg bg-slate-100 p-2"><div className="text-[11px] text-slate-500">Stay here</div><b>{current.total} min</b></div>
                  <div className="rounded-lg bg-blue-50 p-2"><div className="text-[11px] text-blue-600">Walk {alt.walk} + wait {alt.wait}</div><b>{alt.total} min</b></div>
                  <div className="rounded-lg bg-emerald-100 p-2"><div className="text-[11px] text-emerald-700">You save</div><b className="text-emerald-700">{current.total - alt.total} min</b></div>
                </div>
                <p className="mt-3 text-xs text-slate-500">Buses here are on time ({alt.delay.toFixed(0)} min delay), so fewer people are waiting and you board faster, even after the walk.</p>
                <button
                  onClick={() => { setNavigating(true); setTarget({ pos: [(pos[0] + alt.stop.lat) / 2, (pos[1] + alt.stop.lon) / 2], zoom: 16, n: Math.random() }) }}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-95"
                >
                  <Navigation className="h-4 w-4" /> {navigating ? 'Navigating…' : 'Take me there'}
                </button>
              </div>
            )}
            {crowded && !alt && (
              <div className="rounded-xl bg-white p-4 text-sm text-slate-600 shadow-sm">No nearby stop is faster right now. Waiting here is your best option.</div>
            )}

            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700"><Clock className="h-4 w-4" /> Nearby stops</h3>
              <div className="space-y-2">
                {options.map((o) => (
                  <button key={o.stop.id} onClick={() => setTarget({ pos: [o.stop.lat, o.stop.lon], zoom: 16, n: Math.random() })}
                    className="flex w-full items-center justify-between rounded-lg bg-white p-3 text-left shadow-sm transition hover:bg-slate-50">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{o.stop.name}</p>
                      <p className="text-[11px] text-slate-500">{o.walk} min walk · wait ≈ {o.wait} min · total {o.total} min</p>
                    </div>
                    <CrowdBadge level={o.level} />
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
        </>
        )}
        </div>
      </aside>

      <div className="relative min-h-[420px]">
        <MapContainer center={pos} zoom={15} className="h-full w-full">
          <BaseTiles />
          <FlyTo target={target} />
          <FlyTo target={focus} />
          <AiRings states={states} routeIds={intel?.data?.plan?.affected_routes} />
          <RouteLines paths={paths} activeRoutes={ttRoute ? [ttRoute] : [...(current?.serving ?? []), ...(alt?.serving ?? [])]} />
          <ClickToSet onPick={pick} />
          <HeatCircles states={states} />
          <EventMarkers t={t} />
          <StopMarkers labels states={states} selectedId={alt?.stop.id ?? current?.stop.id} />
          <BusMarkers buses={buses} />
          <PoiMarkers />
          <TripLayer trip={trip} pos={pos} paths={paths} stopAlong={stopAlong} />
          <FitTo points={tripPoints} token={tripToken} />
          <PinMarker position={pos} onDrag={pick} />
          {navigating && alt && <Polyline positions={[pos, [alt.stop.lat, alt.stop.lon]]} pathOptions={{ color: '#2563eb', weight: 5, dashArray: '2 10', lineCap: 'round' }} />}
        </MapContainer>
        <div className="absolute right-4 top-4 z-[1000] flex items-center gap-2 rounded-lg bg-white/95 px-3 py-2 text-xs shadow">
          <Bus className="h-4 w-4 text-blue-600" /> Live buses · {buses.length}
        </div>
      </div>
    </div>
  )
}
