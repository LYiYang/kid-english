interface ProgressBarProps {
  value: number
  max: number
  label?: string
  className?: string
}

export default function ProgressBar({ value, max, label, className = '' }: ProgressBarProps) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className={`progress-wrap ${className}`}>
      {label && <span className="progress-label">{label}</span>}
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
