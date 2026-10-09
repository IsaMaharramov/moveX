import { useMemo } from 'react'
import { forecastSeries, DAY_START, DAY_END, toClock } from '../data/mockEngine'

const W = 400
const H = 150
const P = { l: 28, r: 8, t: 10, b: 22 }
const YMAX = 20

export default function ForecastChart({ extras, t }) {
  const base = useMemo(() => forecastSeries({}), [])
  const current = useMemo(() => forecastSeries(extras), [extras])
  const x = (v) => P.l + ((v - DAY_START) / (DAY_END - DAY_START)) * (W - P.l - P.r)
  const y = (v) => P.t + (1 - Math.min(v, YMAX) / YMAX) * (H - P.t - P.b)
  const line = (s) => s.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.delay).toFixed(1)}`).join(' ')
  const area = `${line(current)} L${x(DAY_END)},${y(0)} L${x(DAY_START)},${y(0)} Z`
  const hours = [18, 19, 20, 21, 22, 23]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <line x1={P.l} x2={W - P.r} y1={y(10)} y2={y(10)} stroke="#ef4444" strokeDasharray="3 3" opacity=".5" />
      <line x1={P.l} x2={W - P.r} y1={y(5)} y2={y(5)} stroke="#f59e0b" strokeDasharray="3 3" opacity=".5" />
      <text x={2} y={y(10) + 3} fontSize="8" fill="#ef4444">10m</text>
      <text x={4} y={y(5) + 3} fontSize="8" fill="#f59e0b">5m</text>
      {hours.map((h) => (
        <text key={h} x={x(h * 60)} y={H - 6} fontSize="8" textAnchor="middle" fill="#94a3b8">{h}:00</text>
      ))}
      <path d={area} fill="#3b82f6" opacity=".18" />
      <path d={line(base)} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 3" />
      <path d={line(current)} fill="none" stroke="#60a5fa" strokeWidth="2.2" />
      <line x1={x(t)} x2={x(t)} y1={P.t} y2={H - P.b} stroke="#fff" strokeWidth="1.2" />
      <text x={x(t)} y={P.t - 1} fontSize="8" textAnchor="middle" fill="#fff">{toClock(t)}</text>
    </svg>
  )
}
