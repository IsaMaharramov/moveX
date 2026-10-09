import { useState } from 'react'
import { CalendarClock, Plus, Trash2, Play, BellRing, Brain, Sparkles, Check, X, Home, GraduationCap, CircleAlert, CircleCheck, Pencil, Cloud, CloudOff, Copy, KeyRound, Loader2 } from 'lucide-react'
import { DAYS, habitOf, historyKey } from '../data/routine'
import { places } from '../data/mockEngine'

function NoteCard({ note, onChoose, onDismiss }) {
  const r = note.result
  const warn = r.tone === 'warn'
  return (
    <div className={`rounded-xl border-2 p-3 shadow-sm ${warn ? 'border-orange-300 bg-orange-50' : r.tone === 'ok' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-2">
        <p className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide ${warn ? 'text-orange-700' : 'text-emerald-700'}`}>
          {warn ? <CircleAlert className="h-4 w-4" /> : <CircleCheck className="h-4 w-4" />} MoveX reminder · {note.at} · trip in {note.leadMin} min
        </p>
        <button onClick={() => onDismiss(note.id)} className="text-slate-400 hover:text-slate-600" aria-label="dismiss"><X className="h-4 w-4" /></button>
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-900">{r.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-700">{r.body}</p>
      {r.rec && !note.acted && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={() => onChoose(note, 'rec')} className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
            <Check className="h-3.5 w-3.5" /> {r.change ? 'Take the new route' : 'Show my route'}
          </button>
          {r.change && (
            <button onClick={() => onChoose(note, 'usual')} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">Keep my usual</button>
          )}
        </div>
      )}
      {note.acted && <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-indigo-700"><Brain className="h-3.5 w-3.5" /> Saved. MoveX will remember this choice for next time.</p>}
    </div>
  )
}

function AddForm({ pos, initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name ?? 'University')
  const [placeId, setPlaceId] = useState(initial?.placeId ?? 'bsu')
  const [go, setGo] = useState(initial?.go ?? {})
  const [back, setBack] = useState(initial?.back ?? {})
  const [useMyPin, setUseMyPin] = useState(!initial)
  const set = (setter) => (i, v) => setter((o) => { const n = { ...o }; if (v) n[i] = v; else delete n[i]; return n })
  const valid = Object.keys(go).length + Object.keys(back).length > 0

  return (
    <div className="space-y-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-indigo-200">
      <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800">{initial ? <Pencil className="h-4 w-4 text-indigo-600" /> : <Plus className="h-4 w-4 text-indigo-600" />} {initial ? 'Edit routine' : 'New weekly routine'}</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <label className="text-slate-600">Name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5" /></label>
        <label className="text-slate-600">Where do you go?
          <select value={placeId} onChange={(e) => setPlaceId(e.target.value)} className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5">
            {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>
      {initial ? (
        <label className="flex items-center gap-2 text-[11px] text-slate-600"><input type="checkbox" checked={useMyPin} onChange={(e) => setUseMyPin(e.target.checked)} className="accent-indigo-600" /><Home className="h-3.5 w-3.5" /> Move my home to where the pin is now (currently: {initial.home.name || 'Home'})</label>
      ) : (
        <p className="flex items-center gap-1 text-[11px] text-slate-500"><Home className="h-3.5 w-3.5" /> Starting point = where your pin is on the map now.</p>
      )}
      <table className="w-full text-xs">
        <thead><tr className="text-left text-[10px] uppercase text-slate-400"><th className="py-1">Day</th><th>Leave home</th><th>Leave there (back)</th></tr></thead>
        <tbody>
          {DAYS.map((d, i) => (
            <tr key={d} className="border-t border-slate-100">
              <td className="py-1 font-semibold text-slate-700">{d}</td>
              <td><input type="time" value={go[i] ?? ''} onChange={(e) => set(setGo)(i, e.target.value)} className="rounded border border-slate-300 px-1 py-0.5" /></td>
              <td><input type="time" value={back[i] ?? ''} onChange={(e) => set(setBack)(i, e.target.value)} className="rounded border border-slate-300 px-1 py-0.5" /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-slate-400">Leave a time empty on days you do not travel. You get a reminder 30 min before each trip.</p>
      <div className="flex gap-2">
        <button disabled={!valid || !name.trim()} onClick={() => onSave({ name: name.trim(), placeId, go, back, home: useMyPin ? { lat: pos[0], lon: pos[1], name: 'Home' } : initial.home })} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{initial ? 'Save changes' : 'Save routine'}</button>
        <button onClick={onCancel} className="rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100">Cancel</button>
      </div>
    </div>
  )
}

export default function RoutinePanel({ sim, routines, pos }) {
  const { store, trips, notes, userId, sync, syncError, addRoutine, updateRoutine, removeRoutine, choose, previewTrip, loadDemo, restore, dismiss, clearAll } = routines
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [code, setCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [perm, setPerm] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)

  const askPermission = async () => {
    if (typeof Notification === 'undefined') return
    setPerm(await Notification.requestPermission())
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-indigo-50 p-3 text-xs text-indigo-900 ring-1 ring-indigo-200">
        <p className="flex items-center gap-1.5 font-bold"><Brain className="h-4 w-4" /> MoveX learns your week</p>
        <p className="mt-1 text-indigo-800">Save when you travel each weekday. 30 minutes before, MoveX checks live crowding on your usual stop and tells you if another route is better. It remembers which one you pick.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {perm !== 'granted' && perm !== 'unsupported' && <button onClick={askPermission} className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 font-semibold text-indigo-700 ring-1 ring-indigo-300"><BellRing className="h-3.5 w-3.5" /> Enable phone notifications</button>}
          {perm === 'granted' && <span className="flex items-center gap-1 text-emerald-700"><BellRing className="h-3.5 w-3.5" /> Notifications on</span>}
          <span className="text-indigo-700">Simulated day: <b>{DAYS[sim.day]}</b> {sim.clock}</span>
        </div>
      </div>

      {notes.length > 0 && (
        <section className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-600"><BellRing className="h-4 w-4" /> Reminders</h3>
          {notes.map((n) => <NoteCard key={n.id} note={n} onChoose={choose} onDismiss={dismiss} />)}
        </section>
      )}

      <section className="rounded-xl bg-white p-3 text-xs shadow-sm ring-1 ring-slate-200">
        <p className="flex items-center gap-1.5 font-bold text-slate-800">
          {sync === 'offline' ? <CloudOff className="h-4 w-4 text-amber-600" /> : sync === 'saved' ? <Cloud className="h-4 w-4 text-emerald-600" /> : <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          {sync === 'saved' ? 'Saved on this device and on the server' : sync === 'saving' ? 'Saving…' : sync === 'offline' ? 'Saved on this device (server not reachable)' : 'Checking saved routines…'}
        </p>
        <p className="mt-1 text-slate-500">Your routines stay until you delete them. Use your sync code to get them back on another browser or after clearing site data.</p>
        <div className="mt-2 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700">{userId}</code>
          <button onClick={async () => { try { await navigator.clipboard.writeText(userId); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* clipboard blocked */ } }} className="flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 font-semibold text-slate-700 hover:bg-slate-200"><Copy className="h-3.5 w-3.5" />{copied ? 'Copied' : 'Copy'}</button>
        </div>
        <form className="mt-2 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (code.trim() && window.confirm('Replace what this browser shows with the routines saved under that code?') && await restore(code)) setCode('') }}>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste a sync code to restore" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1" />
          <button type="submit" disabled={!code.trim()} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2 py-1 font-semibold text-white disabled:opacity-50"><KeyRound className="h-3.5 w-3.5" /> Restore</button>
        </form>
        {syncError && <p className="mt-1 text-red-600">{syncError}</p>}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-600"><CalendarClock className="h-4 w-4" /> My routines</h3>
          <div className="flex gap-1.5">
            <button onClick={loadDemo} className="flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-200"><Sparkles className="h-3.5 w-3.5" /> Load demo</button>
            <button onClick={() => setAdding(true)} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700"><Plus className="h-3.5 w-3.5" /> Add</button>
          </div>
        </div>
        {adding && <AddForm pos={pos} onSave={(r) => { addRoutine(r); setAdding(false) }} onCancel={() => setAdding(false)} />}
        {store.routines.length === 0 && !adding && <p className="rounded-lg bg-white p-3 text-xs text-slate-500 shadow-sm">No routines yet. Tap <b>Load demo</b> for an example student week, or <b>Add</b> your own.</p>}

        {store.routines.map((r) => {
          const mine = trips.filter((t) => t.routineId === r.id)
          const goHabit = habitOf(store.history[historyKey(r.id, 'go')])
          const backHabit = habitOf(store.history[historyKey(r.id, 'back')])
          const place = places.find((p) => p.id === r.placeId)
          if (editingId === r.id) return <AddForm key={r.id} pos={pos} initial={r} onSave={(patch) => { updateRoutine(r.id, patch); setEditingId(null) }} onCancel={() => setEditingId(null)} />
          return (
            <div key={r.id} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900"><GraduationCap className="h-4 w-4 text-indigo-600" />{r.name} <span className="text-xs font-normal text-slate-500">→ {place?.name}</span></p>
                <div className="flex gap-2">
                  <button onClick={() => { setAdding(false); setEditingId(r.id) }} className="text-slate-400 hover:text-indigo-600" aria-label="edit routine" title="Edit"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => { if (window.confirm(`Delete the routine "${r.name}" and what MoveX learned about it?`)) removeRoutine(r.id) }} className="text-slate-400 hover:text-red-500" aria-label="delete routine" title="Delete"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px]">
                {DAYS.map((d, i) => (
                  <div key={d} className={`rounded-md p-1 ${r.go?.[i] || r.back?.[i] ? 'bg-indigo-50 text-indigo-900' : 'bg-slate-50 text-slate-300'}`}>
                    <div className="font-bold">{d}</div>
                    <div>{r.go?.[i] ?? '–'}</div>
                    <div className="text-slate-500">{r.back?.[i] ?? '–'}</div>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-slate-400">Top row: leave home · bottom row: leave {place?.name?.split(' ')[0]}</p>
              {(goHabit || backHabit) && (
                <div className="mt-2 space-y-0.5 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">
                  <p className="flex items-center gap-1 font-semibold text-slate-700"><Brain className="h-3.5 w-3.5 text-indigo-600" /> Learned habits</p>
                  {goHabit && <p>Going: {goHabit.label} <span className="text-slate-400">({goHabit.count}/{goHabit.total} trips)</span></p>}
                  {backHabit && <p>Back: {backHabit.label} <span className="text-slate-400">({backHabit.count}/{backHabit.total} trips)</span></p>}
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                {mine.sort((a, b) => a.day - b.day || a.minute - b.minute).map((t) => (
                  <button key={t.id} onClick={() => previewTrip(t)} title="Jump the simulation to 30 min before this trip"
                    className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-indigo-100 hover:text-indigo-800">
                    <Play className="h-3 w-3" />{DAYS[t.day]} {t.time} {t.kind === 'go' ? '↗' : '↩'}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-slate-400">Tap a time to preview its reminder in the simulation.</p>
            </div>
          )
        })}
        {store.routines.length > 0 && <button onClick={() => { if (window.confirm('Delete ALL routines and learned habits? This cannot be undone.')) clearAll() }} className="text-[11px] text-slate-400 underline hover:text-red-500">Delete all routines and history</button>}
      </section>
    </div>
  )
}
