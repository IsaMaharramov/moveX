import { Play, Pause, Radio } from 'lucide-react'
import { toClock } from '../data/mockEngine'

const JUMPS = [
  { label: '07:30', t: 7 * 60 + 30 },
  { label: '18:00', t: 18 * 60 },
  { label: '19:30 pre-match', t: 19 * 60 + 30 },
  { label: '22:00 full-time', t: 22 * 60 },
]

export default function SimBar({ sim }) {
  const { t, speed, setSpeed, playing, setPlaying, jump, day, setDay } = sim
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-300"><Radio className="h-4 w-4 animate-pulse" /> LIVE SIM</span>
      <span className="rounded-md bg-slate-900 px-3 py-1 font-mono text-lg font-bold text-white">{toClock(t)}</span>
      <select value={day} onChange={(e) => setDay(+e.target.value)} className="rounded-md bg-slate-900 px-2 py-1.5 text-xs font-semibold text-white" aria-label="simulated weekday" title="Simulated weekday (used by My routine)">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => <option key={d} value={i}>{d}</option>)}
      </select>
      <button onClick={() => setPlaying(!playing)} className="rounded-md bg-slate-700 p-1.5 text-white hover:bg-slate-600" aria-label="play pause">
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <div className="flex overflow-hidden rounded-md">
        {[1, 3, 10].map((s) => (
          <button key={s} onClick={() => setSpeed(s)} className={`px-2 py-1 text-xs font-semibold ${speed === s ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}>{s}×</button>
        ))}
      </div>
      <div className="hidden gap-1 xl:flex">
        {JUMPS.map((j) => (
          <button key={j.label} onClick={() => jump(j.t)} className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700">{j.label}</button>
        ))}
      </div>
    </div>
  )
}
