import { useState, useMemo } from 'react'
import { Bus, LayoutDashboard, User, Presentation } from 'lucide-react'
import AdminView from './components/AdminView'
import PassengerView from './components/PassengerView'
import SimBar from './components/SimBar'
import Tour from './components/Tour'
import { useSimulation } from './hooks/useSimulation'
import { useRoadPaths } from './hooks/useRoadPaths'
import { computeBuses, computeStopAlong } from './data/mockEngine'

const STADIUM = { pos: [40.3956, 49.853], zoom: 15 }
const MATCH_ROUTES = ['125', 'H1', '65']

const STEPS = [
  { title: 'The problem', view: 'admin', t: 19 * 60 + 40, reset: true, focus: STADIUM,
    text: '29,000 fans are heading to Tofiq Bahramov Stadium. Buses nearby are already running late and stops are overcrowded, and AYNA only finds out once passengers complain.' },
  { title: 'Delay = crowd signal', view: 'admin', t: 19 * 60 + 50, focus: STADIUM,
    text: 'AYNA already knows how late each bus is. We turn that delay into a live crowd map: under 5 min is Low, 5–9 is Medium, 10+ is Severe. No new sensors needed.' },
  { title: 'AI predicts, before it happens', view: 'admin', t: 19 * 60 + 50, focus: STADIUM,
    text: 'The platform knows about the match and forecasts the surge. See the AI forecast on the event card and the peak-delay chart: it recommends exactly how many extra buses to send.' },
  { title: 'One click: +2 buses', view: 'admin', t: 19 * 60 + 55, focus: STADIUM, dispatch: true,
    text: 'We just dispatched extra buses on routes 125, H1 and 65. Watch the "+" buses appear, delays drop and the red stops turn green. The KPI cards show the saved time.' },
  { title: 'Passengers get smart advice', view: 'passenger', t: 20 * 60 + 15, reset: true, focus: STADIUM,
    text: 'A commuter near the stadium sees that their stop is crowded and gets a nearby, calmer stop with the walking time and the minutes they save. Crowds spread out on their own.' },
  { title: 'Why AYNA wins', view: 'admin', t: 22 * 60 + 5, reset: true, focus: STADIUM,
    text: 'One platform, two sides of the same problem.',
    bullets: ['Proactive dispatch instead of reactive firefighting', 'Shorter waits and safer, calmer stops for passengers', 'Built on data AYNA already has (GPS and delays)'] },
]

export default function App() {
  const [view, setView] = useState('admin')
  const [tour, setTour] = useState(null)
  const [focus, setFocus] = useState(null)
  const sim = useSimulation()
  const paths = useRoadPaths()
  const stopAlong = useMemo(() => computeStopAlong(paths), [paths])
  const buses = useMemo(
    () => computeBuses(sim.t, sim.extras, paths, stopAlong, sim.states),
    [sim.t, sim.extras, paths, stopAlong, sim.states],
  )

  const goStep = (i) => {
    const s = STEPS[i]
    setTour(i)
    setView(s.view)
    if (s.reset) sim.reset()
    sim.jump(s.t)
    sim.setSpeed(1)
    sim.setPlaying(true)
    setFocus({ ...s.focus, n: Math.random() })
    if (s.dispatch) sim.dispatch(MATCH_ROUTES, 3, 'Tofiq Bahramov Stadium')
  }

  const tab = (id) =>
    `flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${view === id ? 'bg-white text-blue-700' : 'text-blue-100 hover:bg-blue-500'}`

  return (
    <div className="min-h-screen bg-slate-900">
      <nav className="flex min-h-16 flex-wrap items-center justify-between gap-3 bg-blue-700 px-4 py-2 shadow">
        <div className="flex items-center gap-2 text-lg font-bold text-white"><Bus className="h-6 w-6" /> AYNA <span className="hidden font-normal text-blue-200 sm:inline">Smart Transit · Baku</span></div>
        <SimBar sim={sim} />
        <div className="flex gap-2">
          <button className={tab('admin')} onClick={() => setView('admin')}><LayoutDashboard className="h-4 w-4" /> AYNA Dispatch</button>
          <button className={tab('passenger')} onClick={() => setView('passenger')}><User className="h-4 w-4" /> Passenger</button>
          <button onClick={() => goStep(0)} className="flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-amber-300"><Presentation className="h-4 w-4" /> Demo story</button>
        </div>
      </nav>
      {view === 'admin' ? <AdminView sim={sim} paths={paths} buses={buses} focus={focus} /> : <PassengerView sim={sim} buses={buses} paths={paths} focus={focus} />}
      {tour !== null && <Tour steps={STEPS} index={tour} onGo={goStep} onClose={() => setTour(null)} />}
      {sim.toast && (
        <div className="fixed bottom-6 left-1/2 z-[2000] -translate-x-1/2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {sim.toast.text}
        </div>
      )}
    </div>
  )
}
