import { useState, useEffect } from 'react'
import { routes, stopById, buildPath, fallbackPaths } from '../data/mockEngine'

// Snaps each route to real roads via the public OSRM server.
// Falls back to straight lines (offline) and caches results in localStorage.
export function useRoadPaths() {
  const [paths, setPaths] = useState(fallbackPaths)

  useEffect(() => {
    const ctrl = new AbortController()
    routes.forEach(async (r) => {
      const key = `ayna-route-v1-${r.id}`
      try {
        let coords = JSON.parse(localStorage.getItem(key) || 'null')
        if (!coords) {
          const q = r.stopIds.map((id) => `${stopById[id].lon},${stopById[id].lat}`).join(';')
          const timer = setTimeout(() => ctrl.abort(), 8000)
          const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${q}?overview=full&geometries=geojson`, { signal: ctrl.signal })
          clearTimeout(timer)
          const json = await res.json()
          coords = json.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon])
          localStorage.setItem(key, JSON.stringify(coords))
        }
        setPaths((p) => ({ ...p, [r.id]: buildPath(coords) }))
      } catch {
        // keep straight-line fallback
      }
    })
    return () => ctrl.abort()
  }, [])

  return paths
}
