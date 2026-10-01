'use client'

import { useState } from 'react'
import { ShieldAlert } from 'lucide-react'

export default function SensitiveGate({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false)

  if (revealed) return <>{children}</>

  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none max-h-72 select-none overflow-hidden blur-md">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-[#2A2A38] bg-[#12121A]/95 p-5 text-center shadow-2xl backdrop-blur">
          <ShieldAlert className="mx-auto h-6 w-6 text-[#FDBA74]" />
          <p className="mt-3 text-sm font-medium text-[#F2F2F6]">This story touches on sensitive themes</p>
          <p className="mt-1.5 text-xs leading-5 text-[#8F8FA3]">
            It may include self-harm, abuse or loss. If you’re struggling, you deserve support, and talking to someone you trust or a local helpline can help.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={() => setRevealed(true)}
              className="h-10 rounded-xl bg-white/[0.08] text-sm text-[#F2F2F6] hover:bg-white/[0.12]"
            >
              Read the story
            </button>
            <a
              href="https://findahelpline.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#C4B5FD] underline-offset-2 hover:underline"
            >
              Find a helpline near you
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
