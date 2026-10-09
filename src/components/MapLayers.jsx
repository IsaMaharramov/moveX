import { useEffect, useRef, useState } from 'react'
import { Marker, Polyline, Circle, Tooltip, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { LEVEL_COLOR, routes, events, eventLoad, places, stopById, pointAt } from '../data/mockEngine'

const cache = new Map()
function icon(key, html, size) {
  if (!cache.has(key)) {
    cache.set(key, L.divIcon({ className: '', html, iconSize: size, iconAnchor: [size[0] / 2, size[1] / 2] }))
  }
  return cache.get(key)
}

const PROVIDERS = [
  { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '&copy; OpenStreetMap contributors' },
  { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', attr: 'Tiles &copy; Esri' },
  { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attr: '&copy; OpenStreetMap &copy; CARTO' },
]

// Real street map. If a tile provider refuses requests, silently falls through to the next one.
export function BaseTiles() {
  const [i, setI] = useState(0)
  const errors = useRef(0)
  const p = PROVIDERS[i]
  return (
    <TileLayer
      key={i}
      url={p.url}
      attribution={p.attr}
      maxZoom={19}
      eventHandlers={{
        tileerror: () => {
          errors.current += 1
          if (errors.current >= 4 && i < PROVIDERS.length - 1) { errors.current = 0; setI(i + 1) }
        },
      }}
    />
  )
}

export function ZoomTracker({ onZoom }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) })
  return null
}

export function FlyTo({ target }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo(target.pos, target.zoom ?? 15, { duration: 1.1 })
  }, [target, map])
  return null
}

export function ClickToSet({ onPick }) {
  useMapEvents({ click: (e) => onPick([e.latlng.lat, e.latlng.lng]) })
  return null
}

export function HeatCircles({ states }) {
  return states.map((s) => (
    <Circle
      key={s.stop.id}
      center={[s.stop.lat, s.stop.lon]}
      radius={110 + s.delay * 30}
      pathOptions={{ color: LEVEL_COLOR[s.level], weight: 0, fillOpacity: s.level === 'Low' ? 0.12 : 0.3 }}
      interactive={false}
    />
  ))
}

export function StopMarkers({ states, selectedId, onSelect, labels = false }) {
  return states.map((s) => {
    const c = LEVEL_COLOR[s.level]
    const sel = selectedId === s.stop.id
    const html = `<div style="position:relative;width:22px;height:22px">
      ${s.level === 'Severe' ? `<span class="animate-ping" style="position:absolute;inset:0;border-radius:9999px;background:${c};opacity:.6"></span>` : ''}
      <div style="position:absolute;inset:3px;border-radius:9999px;background:${c};border:3px solid ${sel ? '#2563eb' : '#fff'};box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>
      ${labels || sel ? `<div style="position:absolute;top:24px;left:50%;transform:translateX(-50%);white-space:nowrap;background:rgba(255,255,255,.95);color:#0f172a;font:600 11px system-ui;padding:1px 6px;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,.35)">🚏 ${s.stop.name}</div>` : ''}</div>`
    return (
      <Marker key={s.stop.id} position={[s.stop.lat, s.stop.lon]} icon={icon(`stop-${s.level}-${sel}-${labels}-${s.stop.id}`, html, [22, 22])} eventHandlers={{ click: () => onSelect?.(s.stop.id) }}>
        <Tooltip direction="top" offset={[0, -10]}>
          <b>{s.stop.name}</b><br />
          {s.level} · {s.delay.toFixed(1)} min delay<br />
          ~{s.waiting} waiting · wait ≈ {s.wait} min
        </Tooltip>
      </Marker>
    )
  })
}

export function BusMarkers({ buses }) {
  return buses.map((b) => {
    const lc = LEVEL_COLOR[b.level]
    const html = `<div class="bus-icon" style="display:flex;align-items:center;gap:2px;padding:2px 6px;border-radius:9999px;background:${b.color};border:2.5px solid ${lc};color:#fff;font:700 11px system-ui;box-shadow:0 1px 5px rgba(0,0,0,.5);white-space:nowrap">${b.extra ? '<span style="background:#fff;color:#111;border-radius:9999px;padding:0 4px;font-size:10px">+</span>' : ''}🚌 ${b.route}</div>`
    return (
      <Marker key={b.key} position={b.pos} icon={icon(`bus-${b.route}-${b.level}-${b.extra}`, html, [56, 22])} zIndexOffset={500}>
        <Tooltip direction="top" offset={[0, -10]}>
          <b>Route {b.route}</b>{b.extra ? ' · extra bus' : ''}<br />
          {b.delay < 1 ? 'On time' : `${b.delay.toFixed(0)} min late`} · near {b.nextStop}
        </Tooltip>
      </Marker>
    )
  })
}

export function RouteLines({ paths, activeRoutes }) {
  return routes.map((r) => {
    const active = !activeRoutes || activeRoutes.includes(r.id)
    return <Polyline key={r.id} positions={paths[r.id].pts} pathOptions={{ color: r.color, weight: active ? 5 : 3, opacity: active ? 0.55 : 0.18 }} interactive={false} />
  })
}

export function EventMarkers({ t, onSelect }) {
  return events.map((ev) => {
    const load = eventLoad(ev, t)
    const html = `<div style="display:flex;flex-direction:column;align-items:center"><div style="font-size:24px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.6))">🎟️</div></div>`
    return (
      <span key={ev.id}>
        <Circle center={[ev.lat, ev.lon]} radius={350} pathOptions={{ color: '#facc15', weight: 2, dashArray: '6 6', fillColor: '#facc15', fillOpacity: Math.min(0.3, 0.04 + load * 0.2) }} interactive={false} />
        <Marker position={[ev.lat, ev.lon]} icon={icon(`ev-${ev.id}`, html, [28, 28])} eventHandlers={{ click: () => onSelect?.(ev) }} zIndexOffset={800}>
          <Tooltip direction="top" offset={[0, -14]}><b>{ev.name}</b><br />{ev.venue}</Tooltip>
        </Marker>
      </span>
    )
  })
}

export function PinMarker({ position, onDrag }) {
  const html = `<div style="font-size:30px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.6))">📍</div>`
  return (
    <Marker
      position={position}
      draggable
      icon={icon('pin', html, [30, 34])}
      zIndexOffset={1000}
      eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); onDrag([p.lat, p.lng]) } }}
    >
      <Tooltip direction="top" offset={[0, -16]}>You are here (drag me)</Tooltip>
    </Marker>
  )
}

// Dashed rings around stops that the latest AI plan marks as affected.
export function AiRings({ states, routeIds }) {
  if (!routeIds?.length) return null
  return states
    .filter((s) => s.serving.some((r) => routeIds.includes(r)))
    .map((s) => (
      <Circle key={s.stop.id} center={[s.stop.lat, s.stop.lon]} radius={230}
        pathOptions={{ color: '#6366f1', weight: 2, dashArray: '5 6', fillColor: '#6366f1', fillOpacity: 0.06 }} interactive={false} />
    ))
}

// ---- Passenger trip planning layers ----
const emoji = (e, size = 26) => icon(`emoji-${e}`, `<div style="font-size:${size}px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.55))">${e}</div>`, [size + 4, size + 4])

export function PoiMarkers({ onPick }) {
  return places.map((p) => (
    <Marker key={p.id} position={[p.lat, p.lon]} icon={icon('poi', '<div style="width:12px;height:12px;border-radius:3px;background:#6366f1;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.5)"></div>', [12, 12])} eventHandlers={{ click: () => onPick?.(p) }}>
      <Tooltip direction="top" offset={[0, -6]}>📍 {p.name}</Tooltip>
    </Marker>
  ))
}

function sliceRoute(path, d1, d2) {
  const lo = Math.min(d1, d2)
  const hi = Math.max(d1, d2)
  const mid = path.pts.filter((_, i) => path.cum[i] > lo && path.cum[i] < hi)
  const line = [pointAt(path, lo), ...mid, pointAt(path, hi)]
  return d1 <= d2 ? line : line.reverse()
}

export function FitTo({ points, token }) {
  const map = useMap()
  useEffect(() => {
    if (points?.length > 1) map.fitBounds(points, { padding: [60, 60], maxZoom: 16, duration: 0.9 })
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export function TripLayer({ trip, pos, paths, stopAlong }) {
  if (!trip || trip.noRoute || !trip.legs) return null
  const board = stopById[trip.boardStopId]
  const alight = stopById[trip.alightStopId]
  const dest = [trip.destination.lat, trip.destination.lon]
  return (
    <>
      <Polyline positions={[pos, [board.lat, board.lon]]} pathOptions={{ color: '#2563eb', weight: 5, dashArray: '2 9', lineCap: 'round' }} interactive={false} />
      {trip.legs.map((l) => {
        const color = routes.find((r) => r.id === l.routeId).color
        const line = sliceRoute(paths[l.routeId], stopAlong[l.routeId][l.fromStopId], stopAlong[l.routeId][l.toStopId])
        return (
          <span key={l.routeId + l.fromStopId}>
            <Polyline positions={line} pathOptions={{ color: '#fff', weight: 11, opacity: 0.9 }} interactive={false} />
            <Polyline positions={line} pathOptions={{ color, weight: 7, opacity: 1 }} interactive={false} />
          </span>
        )
      })}
      <Polyline positions={[[alight.lat, alight.lon], dest]} pathOptions={{ color: '#2563eb', weight: 5, dashArray: '2 9', lineCap: 'round' }} interactive={false} />
      {trip.transfer && (
        <Marker position={[stopById[trip.transfer.stopId].lat, stopById[trip.transfer.stopId].lon]} icon={emoji('🔄', 22)} zIndexOffset={900}>
          <Tooltip direction="top" offset={[0, -10]} permanent>Change to {trip.transfer.routeId}</Tooltip>
        </Marker>
      )}
      <Marker position={[alight.lat, alight.lon]} icon={emoji('⬇️', 22)} zIndexOffset={900}><Tooltip direction="top" offset={[0, -10]} permanent>Get off: {alight.name}</Tooltip></Marker>
      <Marker position={dest} icon={emoji('🏁', 30)} zIndexOffset={900}><Tooltip direction="top" offset={[0, -14]} permanent>{trip.destination.name}</Tooltip></Marker>
    </>
  )
}
