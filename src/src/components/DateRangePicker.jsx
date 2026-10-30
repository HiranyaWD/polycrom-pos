import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

// Dates are passed around as 'YYYY-MM-DD' strings (local time)
const pad = n => String(n).padStart(2, '0')
const toStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = s => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const nice = s => parse(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export default function DateRangePicker({ from, to, onChange, label = 'Date range' }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => monthStart(parse(to)))
  const [start, setStart] = useState(null) // first tap while choosing a range
  const [hover, setHover] = useState(null)
  const ref = useRef(null)
  const today = toStr(new Date())

  function monthStart(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1)
  }

  function close() {
    setOpen(false)
    setStart(null)
    setHover(null)
  }

  function toggle() {
    if (open) return close()
    setView(monthStart(parse(to)))
    setOpen(true)
  }

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!open) return
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) close() }
    const onKey = e => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function pick(day) {
    if (!start) {
      setStart(day)
      return
    }
    let a = start
    let b = day
    if (b < a) [a, b] = [b, a]
    onChange(a, b)
    close()
  }

  function quick(a, b) {
    onChange(a, b)
    close()
  }

  // Build the month grid (weeks start on Monday)
  const year = view.getFullYear()
  const month = view.getMonth()
  const offset = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(toStr(new Date(year, month, d)))

  // Range to highlight: the saved one, or a live preview while choosing
  let a = from
  let b = to
  if (start) {
    const other = hover || start
    a = other < start ? other : start
    b = other < start ? start : other
  }

  const canGoNext = new Date(year, month + 1, 1) <= new Date()
  const monthName = view.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const buttonText = from === to ? nice(from) : `${nice(from)}  –  ${nice(to)}`

  const firstOfMonth = toStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const lastMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
  const lastMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0)

  return (
    <div ref={ref} className="relative">
      <label className="label">{label}</label>
      <button
        type="button"
        onClick={toggle}
        className={`field flex items-center gap-3 text-left cursor-pointer ${open ? 'border-accent shadow-[0_0_0_3px_rgba(198,244,50,0.15)]' : ''}`}
      >
        <CalendarDays size={16} className="text-accent shrink-0" />
        <span className="truncate">{buttonText}</span>
      </button>

      {open && (
        <div
          className="anim-pop absolute left-0 top-full mt-2 z-30 w-[330px] max-w-[calc(100vw-2rem)] rounded-3xl p-4 border border-white/10 bg-[rgba(22,27,34,0.94)] backdrop-blur-2xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)]"
          onMouseLeave={() => setHover(null)}
        >
          {/* Month header */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setView(new Date(year, month - 1, 1))}
              aria-label="Previous month"
              className="w-9 h-9 rounded-full grid place-items-center bg-white/5 border border-white/10 hover:bg-white/10"
            >
              <ChevronLeft size={16} />
            </button>
            <p key={monthName} className="anim-page font-semibold">{monthName}</p>
            <button
              type="button"
              onClick={() => setView(new Date(year, month + 1, 1))}
              disabled={!canGoNext}
              aria-label="Next month"
              className="w-9 h-9 rounded-full grid place-items-center bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <p className="text-xs text-center mb-3 text-white/50">
            {start ? <span className="text-accent">Now tap the end date</span> : 'Tap a start date'}
          </p>

          {/* Weekday names */}
          <div className="grid grid-cols-7 mb-1">
            {WEEK.map(w => (
              <span key={w} className="text-[11px] text-center text-white/40 font-semibold py-1">{w}</span>
            ))}
          </div>

          {/* Days */}
          <div key={`${year}-${month}`} className="anim-page grid grid-cols-7 gap-y-1">
            {cells.map((day, i) => {
              if (!day) return <span key={`e${i}`} />
              const future = day > today
              const isEdge = day === a || day === b
              const inRange = day > a && day < b
              const single = a === b

              // Lime band behind the range
              let band = ''
              if (!single && day === a) band = 'bg-accent/15 rounded-l-full'
              else if (!single && day === b) band = 'bg-accent/15 rounded-r-full'
              else if (inRange) band = 'bg-accent/15'

              return (
                <div key={day} className={`flex justify-center ${band}`}>
                  <button
                    type="button"
                    disabled={future}
                    onClick={() => pick(day)}
                    onMouseEnter={() => start && setHover(day)}
                    className={`w-9 h-9 rounded-full text-sm tabular-nums transition ${
                      isEdge
                        ? 'bg-accent text-ink font-bold shadow-[0_0_18px_rgba(198,244,50,0.45)]'
                        : inRange
                          ? 'text-white hover:bg-white/10'
                          : 'text-white/80 hover:bg-white/10'
                    } ${day === today && !isEdge ? 'ring-1 ring-accent/60' : ''} disabled:opacity-25 disabled:hover:bg-transparent disabled:cursor-not-allowed`}
                  >
                    {Number(day.slice(8))}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Quick picks */}
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/10">
            <QuickBtn onClick={() => quick(today, today)}>Today</QuickBtn>
            <QuickBtn onClick={() => quick(firstOfMonth, today)}>This month</QuickBtn>
            <QuickBtn onClick={() => quick(toStr(lastMonthStart), toStr(lastMonthEnd))}>Last month</QuickBtn>
          </div>
        </div>
      )}
    </div>
  )
}

function QuickBtn({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/5 border border-white/10 text-white/75 hover:bg-accent hover:text-ink hover:border-accent transition"
    >
      {children}
    </button>
  )
}