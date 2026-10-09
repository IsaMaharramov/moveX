import { useState } from 'react'
import { Clock, ArrowRight, ArrowLeft } from 'lucide-react'
import CrowdBadge from './CrowdBadge'
import { haversine, stopById } from '../data/mockEngine'

export default function TimetableCard({ tt, pos }) {
  const [dir, setDir] = useState('fwd')
  const me = { lat: pos[0], lon: pos[1] }
  const nearestStopId = [...tt.stops].sort((a, b) => haversine(me, stopById[a.stopId]) - haversine(me, stopById[b.stopId]))[0].stopId
  const key = dir === 'fwd' ? 'fwd' : 'bwd'
  return (
    <div className="mt-2 rounded-lg bg-white/80 p-2.5 text-[11px] text-slate-700 ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
          <span className="rounded-full px-2 py-0.5 text-white" style={{ background: tt.color }}>{tt.routeId}</span>
          every ~{tt.intervalMin} min
        </p>
        <span className="flex items-center gap-1 text-slate-500"><Clock className="h-3 w-3" />{tt.buses} buses{tt.extraBuses ? ` (+${tt.extraBuses} extra)` : ''} · as of {tt.asOf}</span>
      </div>
      <div className="mt-2 flex gap-1">
        <button onClick={() => setDir('fwd')} className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 font-semibold ${dir === 'fwd' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
          <ArrowRight className="h-3 w-3" /> to {tt.towardsFwd}
        </button>
        <button onClick={() => setDir('bwd')} className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 font-semibold ${dir === 'bwd' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
          <ArrowLeft className="h-3 w-3" /> to {tt.towardsBwd}
        </button>
      </div>
      <table className="mt-2 w-full">
        <thead>
          <tr className="text-left text-[10px] uppercase text-slate-400"><th className="py-1 font-semibold">Stop</th><th className="font-semibold">Next buses (time range)</th></tr>
        </thead>
        <tbody>
          {tt.stops.map((s) => (
            <tr key={s.stopId} className={`border-t border-slate-100 align-top ${s.stopId === nearestStopId ? 'bg-indigo-50' : ''}`}>
              <td className="py-1.5 pr-2">
                <p className="font-semibold text-slate-800">{s.name}{s.stopId === nearestStopId && <span className="ml-1 text-[9px] text-indigo-600">(near you)</span>}</p>
                <CrowdBadge level={s.level} />
              </td>
              <td className="py-1.5">
                <div className="flex flex-wrap gap-1">
                  {s[key].slice(0, 3).map((a, i) => (
                    <span key={i} className={`rounded px-1.5 py-0.5 font-mono text-[10.5px] ${a.extra ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`} title={`in ${a.inMin} min`}>
                      {a.from}–{a.to}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1.5 text-[10px] text-slate-400">Range = scheduled pass time until the likely late arrival (from live delay). Green = extra bus.</p>
    </div>
  )
}
