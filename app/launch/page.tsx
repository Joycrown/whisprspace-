'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

// 10:00 AM WAT (UTC+1) on 20 March 2026 = 09:00 UTC
const LAUNCH_TIME = new Date('2026-03-20T09:00:00.000Z').getTime()
const START_TIME  = new Date('2026-03-19T00:00:00.000Z').getTime()

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
  total: number
}

function getTimeLeft(): TimeLeft {
  const total = LAUNCH_TIME - Date.now()
  if (total <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 }
  return {
    total,
    days:    Math.floor(total / (1000 * 60 * 60 * 24)),
    hours:   Math.floor((total / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((total / 1000 / 60) % 60),
    seconds: Math.floor((total / 1000) % 60),
  }
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  const display = String(value).padStart(2, '0')
  const [prev, setPrev] = useState(display)
  const [flipping, setFlipping] = useState(false)

  useEffect(() => {
    if (display !== prev) {
      setFlipping(true)
      const t = setTimeout(() => { setPrev(display); setFlipping(false) }, 280)
      return () => clearTimeout(t)
    }
  }, [display, prev])

  return (
    <div className="flex flex-col items-center gap-2 sm:gap-3">
      <div className="relative">
        {/* Brand glow */}
        <div className="absolute inset-0 rounded-2xl blur-xl scale-110"
          style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(249,115,22,0.15))' }} />
        {/* Card */}
        <div
          className={`relative w-[72px] h-[72px] sm:w-[100px] sm:h-[100px] md:w-28 md:h-28 rounded-2xl flex items-center justify-center overflow-hidden transition-all duration-[280ms] ${flipping ? 'scale-[0.93] opacity-70' : 'scale-100 opacity-100'}`}
          style={{
            background: 'linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 0 0 1px rgba(168,85,247,0.12), 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          {/* Top shine */}
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }} />
          {/* Number */}
          <span className="font-mono text-[2.4rem] sm:text-5xl md:text-[3.25rem] font-bold tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #e9d5ff 0%, #fed7aa 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
            {flipping ? prev : display}
          </span>
          {/* Centre divider */}
          <div className="absolute top-1/2 left-4 right-4 h-px bg-black/50" />
        </div>
      </div>
      <span className="text-[9px] sm:text-[11px] uppercase tracking-[0.22em] text-white/35 font-semibold">
        {label}
      </span>
    </div>
  )
}

export default function LaunchPage() {
  const router = useRouter()
  const [timeLeft, setTimeLeft]   = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 })
  const [launched, setLaunched]   = useState(false)
  const [mounted, setMounted]     = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setMounted(true)
    setTimeLeft(getTimeLeft())
    intervalRef.current = setInterval(() => {
      const t = getTimeLeft()
      setTimeLeft(t)
      if (t.total <= 0) {
        setLaunched(true)
        clearInterval(intervalRef.current!)
        setTimeout(() => router.push('/'), 3000)
      }
    }, 1000)
    return () => clearInterval(intervalRef.current!)
  }, [router])

  // Progress 0→1 as time elapses
  const progress = Math.max(0, Math.min(1,
    (LAUNCH_TIME - Date.now()) / (LAUNCH_TIME - START_TIME)
  ))

  return (
    <div
      className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden select-none"
      style={{ background: 'radial-gradient(ellipse at 40% 0%, #1a0826 0%, #0c0810 55%, #000 100%)' }}
    >
      {/* ── Ambient orbs ── */}
      <div className="absolute top-[-80px] left-1/2 -translate-x-1/2 w-[700px] h-[340px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(168,85,247,0.12) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      <div className="absolute bottom-0 right-0 w-[420px] h-[280px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(249,115,22,0.08) 0%, transparent 70%)', filter: 'blur(80px)' }} />
      <div className="absolute top-1/3 left-[-80px] w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(168,85,247,0.06) 0%, transparent 70%)', filter: 'blur(60px)' }} />

      {/* ── Subtle grid ── */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
        }} />

      {/* ── Floating dots ── */}
      {[
        { w: 5, h: 5, top: '12%', left: '7%',  dur: '3.2s', delay: '0s' },
        { w: 3, h: 3, top: '70%', left: '4%',  dur: '4.5s', delay: '1.2s' },
        { w: 6, h: 6, top: '30%', left: '93%', dur: '3.8s', delay: '0.6s' },
        { w: 4, h: 4, top: '78%', left: '89%', dur: '5s',   delay: '2s' },
        { w: 3, h: 3, top: '50%', left: '13%', dur: '4s',   delay: '1.8s' },
        { w: 5, h: 5, top: '18%', left: '78%', dur: '3.5s', delay: '0.9s' },
        { w: 4, h: 4, top: '88%', left: '50%', dur: '6s',   delay: '3s' },
      ].map((p, i) => (
        <div key={i} className="absolute rounded-full animate-pulse pointer-events-none"
          style={{
            width: p.w, height: p.h, top: p.top, left: p.left,
            animationDuration: p.dur, animationDelay: p.delay,
            background: i % 2 === 0
              ? 'rgba(168,85,247,0.35)'
              : 'rgba(249,115,22,0.30)',
            filter: 'blur(1px)',
          }} />
      ))}

      {/* ── Main content ── */}
      <div className={`relative z-10 flex flex-col items-center text-center px-5 transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>

        {/* Logo */}
        <div className="mb-4 sm:mb-10 flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 rounded-2xl blur-2xl scale-150 opacity-60"
              style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.5), rgba(249,115,22,0.3))' }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/ws-icon.png"
              alt="WhisprSpace"
              className="relative w-10 h-auto rounded-xl"
            />
          </div>
          <span className="text-white text-2xl font-bold tracking-wide">WhisprSpace</span>
        </div>

        {!launched ? (
          <>
            {/* Badge */}
            <div className="mb-5 px-4 py-1.5 rounded-full inline-flex items-center gap-2"
              style={{
                background: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(249,115,22,0.08))',
                border: '1px solid rgba(168,85,247,0.25)',
              }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: 'linear-gradient(90deg, #a855f7, #f97316)' }} />
              <span className="text-[11px] uppercase tracking-[0.18em] font-semibold"
                style={{
                  background: 'linear-gradient(90deg, #d8b4fe, #fdba74)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                Launching soon
              </span>
            </div>

            <h1 className="mb-3 text-[2rem] sm:text-5xl md:text-[3.5rem] font-bold text-white leading-[1.15] tracking-tight max-w-lg">
              The whispr{' '}
              <span style={{
                background: 'linear-gradient(90deg, #c084fc, #fb923c)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                begins soon
              </span>
            </h1>

            <p className="mb-10 sm:mb-12 text-sm sm:text-[15px] text-white/38 max-w-[320px] leading-relaxed flex flex-col items-center gap-1">
              <span>Anonymous. Unfiltered. Real conversations.</span>
              <span className="text-white/55">20 Mar 2026 · 10:00 AM</span>
            </p>

            {/* Countdown */}
            <div className="flex items-start gap-2.5 sm:gap-4 md:gap-6">
              <CountdownUnit value={timeLeft.days}    label="Days" />
              <span className="text-white/15 text-4xl sm:text-5xl font-extralight mt-3.5 sm:mt-5">:</span>
              <CountdownUnit value={timeLeft.hours}   label="Hours" />
              <span className="text-white/15 text-4xl sm:text-5xl font-extralight mt-3.5 sm:mt-5">:</span>
              <CountdownUnit value={timeLeft.minutes} label="Minutes" />
              <span className="text-white/15 text-4xl sm:text-5xl font-extralight mt-3.5 sm:mt-5">:</span>
              <CountdownUnit value={timeLeft.seconds} label="Seconds" />
            </div>

            {/* Progress bar */}
            <div className="mt-10 sm:mt-14 w-full max-w-[280px] sm:max-w-xs">
              <div className="flex justify-between mb-2">
                <span className="text-[10px] text-white/20 uppercase tracking-widest">Progress</span>
                <span className="text-[10px] text-white/20 uppercase tracking-widest">
                  {Math.round((1 - progress) * 100)}%
                </span>
              </div>
              <div className="h-[3px] w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${(1 - progress) * 100}%`,
                    background: 'linear-gradient(90deg, #a855f7, #f97316)',
                    boxShadow: '0 0 10px rgba(168,85,247,0.6)',
                  }}
                />
              </div>
            </div>
          </>
        ) : (
          /* Launch moment */
          <div className="flex flex-col items-center gap-5">
            <div className="text-5xl sm:text-7xl font-bold"
              style={{
                background: 'linear-gradient(90deg, #c084fc, #fb923c)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 40px rgba(168,85,247,0.5))',
              }}>
              We&apos;re Live.
            </div>
            <p className="text-white/40 text-base">Taking you in...</p>
          </div>
        )}
      </div>

      {/* ── Bottom strip ── */}
      <div className="absolute bottom-5 left-0 right-0 flex justify-center">
        <p className="text-[9px] text-white/12 tracking-[0.25em] uppercase">
          whisprspace · anonymous social · 2026
        </p>
      </div>
    </div>
  )
}
