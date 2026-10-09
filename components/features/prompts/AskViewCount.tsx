import { Eye } from 'lucide-react'

export const formatCompactCount = (value: number) =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.max(0, value))

export default function AskViewCount({ count, className = '' }: { count: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} aria-label={`${count} views`}>
      <Eye className="h-3.5 w-3.5" />
      {formatCompactCount(count)}
    </span>
  )
}
