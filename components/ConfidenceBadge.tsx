interface ConfidenceBadgeProps {
  confidence: 'high' | 'medium' | 'low'
}

const config = {
  high: { label: 'High Confidence', bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' },
  medium: { label: 'Medium Confidence', bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' },
  low: { label: 'Low Confidence', bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500' },
}

export default function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const c = config[confidence]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}
