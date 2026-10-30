import { useEffect, useRef, useState } from 'react'

// Shared UI pieces used across pages

// Soft colored glows behind the glass cards (slowly floating)
export function Backdrop() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none print:hidden" aria-hidden="true">
      <div className="float-a absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full bg-[#c6f432]/15 blur-[120px]" />
      <div className="float-b absolute top-1/3 -right-40 w-[560px] h-[560px] rounded-full bg-[#3b82f6]/15 blur-[140px]" />
      <div className="float-c absolute -bottom-48 left-1/4 w-[520px] h-[520px] rounded-full bg-[#14b8a6]/10 blur-[130px]" />
    </div>
  )
}

export function formatMoney(n) {
  return Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// "Rs." small and faded, number big, like the reference design
export function Money({ value, className = '' }) {
  return (
    <span className={`whitespace-nowrap tabular-nums ${className}`}>
      <span className="opacity-50 text-[0.6em] font-medium mr-1 align-[0.15em]">Rs.</span>
      {formatMoney(value)}
    </span>
  )
}

// Animates a number to the target value (from 0 the first time, then from the previous value)
export function useCountUp(target, duration = 1000) {
  const [value, setValue] = useState(0)
  const current = useRef(0)

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      current.current = target
      setValue(target)
      return
    }
    const from = current.current
    let frame
    const start = performance.now()
    const tick = now => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      const v = from + (target - from) * eased
      current.current = v
      setValue(v)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return value
}

// Slides a block in, with a delay so items appear one after another
export function Reveal({ delay = 0, className = '', children }) {
  return (
    <div className={`anim-fade-up ${className}`} style={{ '--d': `${delay}ms` }}>
      {children}
    </div>
  )
}

// Popup wrapper: dark blurred background + glass box that pops in
export function Modal({ children, onClose, className = 'max-w-md' }) {
  return (
    <div
      className="modal-backdrop anim-page"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div className={`modal anim-pop ${className}`}>{children}</div>
    </div>
  )
}

export function CountUp({ value, money = false, className = '' }) {
  const v = useCountUp(Number(value) || 0)
  if (money) return <Money value={v} className={className} />
  return <span className={`tabular-nums ${className}`}>{Math.round(v).toLocaleString()}</span>
}

export function PageTitle({ title, subtitle, children }) {
  return (
    <div className="anim-fade-up flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-4xl md:text-5xl font-light tracking-tight">{title}</h1>
        {subtitle && <p className="muted mt-1 text-sm">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}

export function StatusChip({ status }) {
  return status === 'paid'
    ? <span className="chip bg-accent/15 text-accent">Paid</span>
    : <span className="chip bg-red-500/15 text-red-300">Cancelled</span>
}

export function StockChip({ qty, low }) {
  if (qty === 0) return <span className="chip bg-red-500/15 text-red-300">Out</span>
  if (qty <= low) return <span className="chip bg-amber-400/15 text-amber-300">{qty}</span>
  return <span className="chip bg-accent/15 text-accent">{qty}</span>
}