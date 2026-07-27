'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { LifeBuoy, X, Send, CheckCircle, AlertCircle, Loader2, Paperclip, FileImage, Trash2, MessageCircle } from 'lucide-react'
import { motion, AnimatePresence, useMotionValue } from 'framer-motion'
import Image from 'next/image'

type State = 'idle' | 'sending' | 'sent' | 'error'

interface AttachedFile {
  file: File
  preview: string | null // object URL for images
}

const MAX_FILES = 3
const MAX_FILE_MB = 5
const ALLOWED_TYPES = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/pdf',
  'video/mp4', 'video/quicktime', 'video/webm',
]
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

// Draggable FAB config
const POSITION_KEY = 'support_fab_pos'
// The FAB is a circular icon-only chat button (w-14 h-14 = 56px). Fallbacks used
// only before the real element is measured (below).
const FAB_WIDTH = 56
const FAB_HEIGHT = 56
const EDGE_MARGIN = 16
// Movement (px) above which a pointer gesture counts as a drag, not a tap.
const DRAG_THRESHOLD = 6

interface Pos { x: number; y: number }
interface Size { w: number; h: number }

/** Clamp a position so the button (of the given size) stays fully in the viewport. */
function clampToViewport(pos: Pos, size: Size): Pos {
  if (typeof window === 'undefined') return pos
  const maxX = window.innerWidth - size.w - EDGE_MARGIN
  const maxY = window.innerHeight - size.h - EDGE_MARGIN
  return {
    x: Math.min(Math.max(pos.x, EDGE_MARGIN), Math.max(EDGE_MARGIN, maxX)),
    y: Math.min(Math.max(pos.y, EDGE_MARGIN), Math.max(EDGE_MARGIN, maxY)),
  }
}

/**
 * Default BOTTOM-LEFT position, inset from the edges. Uses the measured size so
 * the button never sits flush against or off an edge.
 */
function defaultPos(size: Size): Pos {
  if (typeof window === 'undefined') return { x: 0, y: 0 }
  const isDesktop = window.innerWidth >= 768
  // Desktop clears the ~80px left icon rail; mobile insets from the left edge.
  const leftInset = isDesktop ? 96 : 16
  // Lift above the mobile bottom nav / message input so it never covers anything.
  const bottomInset = isDesktop ? 24 : 96
  const x = leftInset
  const y = window.innerHeight - size.h - bottomInset
  return clampToViewport({ x, y }, size)
}

export default function SupportButton() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState<AttachedFile[]>([])
  const [state, setState] = useState<State>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Draggable FAB position ────────────────────────────────────────────────
  // left/top hold the committed position; x/y are the live drag transform, reset
  // to 0 after each drag so there's no double-offset jump.
  const [pos, setPos] = useState<Pos | null>(null) // null until mounted (SSR-safe)
  const containerRef = useRef<HTMLDivElement>(null)
  const sizeRef = useRef<Size>({ w: FAB_WIDTH, h: FAB_HEIGHT })
  const dragX = useMotionValue(0)
  const dragY = useMotionValue(0)
  const draggedRef = useRef(false)

  // Init from localStorage (or default), then keep on-screen across resizes.
  useEffect(() => {
    // Measure the real pill so positioning accounts for its full width.
    const measured = containerRef.current?.getBoundingClientRect()
    const size: Size = {
      w: measured?.width || FAB_WIDTH,
      h: measured?.height || FAB_HEIGHT,
    }
    sizeRef.current = size

    let initial: Pos | null = null
    try {
      const raw = localStorage.getItem(POSITION_KEY)
      if (raw) initial = JSON.parse(raw) as Pos
    } catch {
      // ignore malformed
    }
    setPos(clampToViewport(initial ?? defaultPos(size), size))

    const onResize = () => setPos((p) => (p ? clampToViewport(p, sizeRef.current) : p))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const persistPos = useCallback((p: Pos) => {
    try {
      localStorage.setItem(POSITION_KEY, JSON.stringify(p))
    } catch {
      // ignore quota/private-mode errors
    }
  }, [])

  const reset = () => {
    setName(''); setEmail(''); setMessage('')
    files.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview) })
    setFiles([])
    setState('idle'); setErrorMsg('')
  }

  const handleClose = () => { setOpen(false); if (state === 'sent') reset() }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    e.target.value = ''
    const newFiles: AttachedFile[] = []
    let sizeError = ''

    for (const file of selected) {
      if (files.length + newFiles.length >= MAX_FILES) {
        setErrorMsg(`You can attach up to ${MAX_FILES} files.`)
        break
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        setErrorMsg(`${file.name}: unsupported file type.`)
        continue
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        sizeError = `${file.name} exceeds ${MAX_FILE_MB} MB.`
        continue
      }
      const preview = IMAGE_TYPES.includes(file.type) ? URL.createObjectURL(file) : null
      newFiles.push({ file, preview })
    }

    if (sizeError && !errorMsg) setErrorMsg(sizeError)
    if (newFiles.length > 0) {
      setErrorMsg('')
      setFiles(prev => [...prev, ...newFiles])
    }
  }

  const removeFile = (idx: number) => {
    setFiles(prev => {
      const copy = [...prev]
      const removed = copy.splice(idx, 1)[0]
      if (removed.preview) URL.revokeObjectURL(removed.preview)
      return copy
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (state === 'sending') return
    setState('sending')
    setErrorMsg('')
    try {
      const fd = new FormData()
      fd.append('name', name)
      fd.append('email', email)
      fd.append('message', message)
      files.forEach(f => fd.append('attachments', f.file, f.file.name))

      const res = await fetch('/api/support/contact', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error || 'Something went wrong.'); setState('error'); return }
      setState('sent')
    } catch {
      setErrorMsg('Network error. Please try again.')
      setState('error')
    }
  }

  return (
    <>
      {/* Backdrop — dimmed on mobile (modal feel), transparent click-catcher on desktop */}
      {open && (
        <div className="fixed inset-0 z-[799] bg-black/60 sm:bg-transparent" onClick={handleClose} />
      )}

      {/* Draggable FAB container — position is user-controlled + persisted, so it
          can be moved off a send button. Hidden until mounted to avoid an SSR flash
          at the wrong spot. Dragging is disabled while the panel is open. */}
      <motion.div
        ref={containerRef}
        drag={!open}
        dragMomentum={false}
        dragElastic={0}
        style={{
          position: 'fixed',
          left: pos?.x ?? 0,
          top: pos?.y ?? 0,
          x: dragX,
          y: dragY,
          visibility: pos ? 'visible' : 'hidden',
        }}
        className="z-[800] flex flex-col items-start gap-3"
        onDragStart={() => { draggedRef.current = false }}
        onDrag={(_e, info) => {
          if (Math.hypot(info.offset.x, info.offset.y) > DRAG_THRESHOLD) {
            draggedRef.current = true
          }
        }}
        onDragEnd={(_e, info) => {
          if (!pos) return
          const next = clampToViewport(
            { x: pos.x + info.offset.x, y: pos.y + info.offset.y },
            sizeRef.current
          )
          setPos(next)
          persistPos(next)
          // Reset the live transform so the committed left/top isn't double-applied.
          dragX.set(0)
          dragY.set(0)
        }}
      >
        {/* FAB — icon-only chat bubble. A tap toggles the panel; dragging the
            container repositions it. The drag-vs-tap guard ignores the click that
            fires after a drag. The panel is rendered separately below so it can be
            a centered modal on mobile (not anchored to the corner FAB). */}
        <motion.button
          onClick={() => {
            if (draggedRef.current) {
              draggedRef.current = false
              return
            }
            setOpen(v => !v)
          }}
          whileTap={{ scale: 0.92 }}
          aria-label="Contact support"
          title="Contact support"
          className={`flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-colors duration-200 cursor-grab active:cursor-grabbing touch-none select-none ${
            open
              ? 'bg-[#2A2A38] text-white border border-[#3A3A4E]'
              : 'bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-500 hover:to-purple-600 shadow-purple-900/40'
          }`}
        >
          {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        </motion.button>
      </motion.div>

      {/* Support panel — centered modal on mobile, anchored near the FAB on desktop */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[801] flex items-center justify-center p-4 sm:items-end sm:justify-start sm:p-6 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="pointer-events-auto w-full max-w-sm sm:w-80 max-h-[85vh] overflow-y-auto bg-[#1A1A24] border border-[#2A2A38] rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-4 py-3.5 border-b border-[#2A2A38] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center">
                    <LifeBuoy className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white leading-none">Contact Support</p>
                    <p className="text-[10px] text-[#5C5C6E] mt-0.5">We reply within 24 hours</p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="text-[#3A3A4E] hover:text-[#8F8FA3] transition-colors p-1 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Sent state */}
              {state === 'sent' ? (
                <div className="p-6 flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Message sent!</p>
                    <p className="text-xs text-[#5C5C6E] mt-1 leading-relaxed">
                      We&apos;ve received your message and will get back to you{email ? ` at ${email}` : ''} within 24 hours.
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="mt-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : (
                /* Form */
                <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
                  <div className="flex gap-2">
                    <div className="flex-1 flex flex-col gap-1">
                      <label className="text-[10px] font-medium text-[#5C5C6E] uppercase tracking-wide">
                        Name
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Your name"
                        maxLength={80}
                        className="w-full bg-[#12121A] border border-[#2A2A38] rounded-lg px-3 py-2 text-sm text-white placeholder-[#3A3A4E] focus:outline-none focus:border-purple-500/50 transition-colors"
                      />
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                      <label className="text-[10px] font-medium text-[#5C5C6E] uppercase tracking-wide">
                        Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="For reply"
                        maxLength={120}
                        className="w-full bg-[#12121A] border border-[#2A2A38] rounded-lg px-3 py-2 text-sm text-white placeholder-[#3A3A4E] focus:outline-none focus:border-purple-500/50 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-[#5C5C6E] uppercase tracking-wide">
                      Message <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder="Describe your issue or question…"
                      required
                      maxLength={2000}
                      rows={4}
                      className="w-full bg-[#12121A] border border-[#2A2A38] rounded-lg px-3 py-2 text-sm text-white placeholder-[#3A3A4E] focus:outline-none focus:border-purple-500/50 transition-colors resize-none"
                    />
                    <p className="text-[10px] text-[#3A3A4E] text-right">{message.length}/2000</p>
                  </div>

                  {/* Attachments */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-medium text-[#5C5C6E] uppercase tracking-wide">
                        Attachments
                        <span className="normal-case ml-1 text-[#3A3A4E]">(optional, max {MAX_FILES} files · {MAX_FILE_MB} MB each)</span>
                      </label>
                      {files.length < MAX_FILES && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
                        >
                          <Paperclip className="w-3 h-3" />
                          Add file
                        </button>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.pdf,video/mp4,video/quicktime,video/webm"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {/* File list */}
                    {files.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        {files.map((f, i) => (
                          <div key={i} className="flex items-center gap-2 bg-[#12121A] border border-[#2A2A38] rounded-lg px-2.5 py-1.5">
                            {f.preview ? (
                              <div className="relative w-8 h-8 rounded overflow-hidden flex-shrink-0">
                                <Image src={f.preview} alt={f.file.name} fill className="object-cover" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded bg-[#2A2A38] flex items-center justify-center flex-shrink-0">
                                <FileImage className="w-4 h-4 text-[#5C5C6E]" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-white truncate">{f.file.name}</p>
                              <p className="text-[10px] text-[#5C5C6E]">{(f.file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFile(i)}
                              className="text-[#3A3A4E] hover:text-red-400 transition-colors flex-shrink-0 p-0.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Drop zone shown when no files yet */}
                    {files.length === 0 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full border border-dashed border-[#2A2A38] hover:border-purple-500/40 rounded-lg py-2.5 flex items-center justify-center gap-2 text-[11px] text-[#5C5C6E] hover:text-purple-400 transition-colors"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        Add a screenshot or file
                      </button>
                    )}
                  </div>

                  {state === 'error' && (
                    <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {errorMsg}
                    </div>
                  )}

                  {/* Show file validation errors even when not in error state */}
                  {state !== 'error' && errorMsg && (
                    <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {errorMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={state === 'sending' || !message.trim()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
                  >
                    {state === 'sending' ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                    ) : (
                      <><Send className="w-4 h-4" /> Send message</>
                    )}
                  </button>

                  <p className="text-[10px] text-[#3A3A4E] text-center">
                    Or email us directly at{' '}
                    <span className="text-[#5C5C6E] select-all">support@whisprspace.com</span>
                  </p>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
