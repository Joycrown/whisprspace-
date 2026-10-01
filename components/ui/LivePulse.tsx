interface LivePulseProps {
  label?: string
  className?: string
}

export default function LivePulse({ label = 'Live', className = '' }: LivePulseProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-[#F97316]/35 bg-[#F97316]/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#FDBA74] ${className}`}>
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#F97316] opacity-75 motion-reduce:animate-none" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#F97316]" />
      </span>
      {label}
    </span>
  )
}
