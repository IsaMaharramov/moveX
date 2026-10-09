import { useCallback, useEffect, useState } from 'react'

// Polls the server's autonomous scans. Shared by the dispatch panel, map overlay and passenger alerts.
export function useAutoIntel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (path, init) => {
    try {
      const res = await fetch(path, init)
      const json = await res.json().catch(() => ({}))
      if (res.status === 202) return
      if (!res.ok) throw new Error(json.error || 'Request failed')
      setData(json)
      setError('')
    } catch (e) {
      setError(e.message === 'Failed to fetch' ? 'Cannot reach the MoveX API. Start it with npm run dev.' : e.message)
    }
  }, [])

  useEffect(() => {
    load('/api/auto-dispatch')
    const id = setInterval(() => load('/api/auto-dispatch'), 20000)
    return () => clearInterval(id)
  }, [load])

  const scanNow = useCallback(async (injected) => {
    setLoading(true)
    await load('/api/auto-dispatch/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ injected: injected ?? [] }) })
    setLoading(false)
  }, [load])

  return { data, loading, error, scanNow }
}
