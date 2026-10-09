const styles = {
  Low: 'bg-emerald-100 text-emerald-800 ring-emerald-300',
  Medium: 'bg-amber-100 text-amber-800 ring-amber-300',
  Severe: 'bg-red-100 text-red-800 ring-red-300',
}

export default function CrowdBadge({ level }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${styles[level]}`}>
      {level}
    </span>
  )
}
