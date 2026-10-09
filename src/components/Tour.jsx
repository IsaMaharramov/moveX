import { ChevronLeft, ChevronRight, X, Presentation } from 'lucide-react'

export default function Tour({ steps, index, onGo, onClose }) {
  const step = steps[index]
  return (
    <div className="fixed bottom-6 right-6 z-[2500] w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-blue-600"><Presentation className="h-4 w-4" /> Demo story · {index + 1}/{steps.length}</span>
        <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="close"><X className="h-4 w-4" /></button>
      </div>
      <h3 className="mt-2 text-lg font-bold text-slate-900">{step.title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.text}</p>
      {step.bullets && (
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          {step.bullets.map((b) => <li key={b} className="flex gap-2"><span className="text-emerald-500">✔</span>{b}</li>)}
        </ul>
      )}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-1.5">
          {steps.map((s, i) => <button key={s.title} onClick={() => onGo(i)} className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-blue-600' : 'w-2 bg-slate-300'}`} aria-label={`step ${i + 1}`} />)}
        </div>
        <div className="flex gap-2">
          <button disabled={index === 0} onClick={() => onGo(index - 1)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => (index === steps.length - 1 ? onClose() : onGo(index + 1))} className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            {index === steps.length - 1 ? 'Finish' : 'Next'} <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
