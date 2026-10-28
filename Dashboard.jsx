import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Plus, Package, ArrowUpRight, AlertTriangle, TrendingUp, TrendingDown, Receipt, Wallet, CalendarDays, DatabaseBackup } from 'lucide-react'
import { getLastBackup, daysSince } from '../lib/exportExcel'
import { supabase } from '../supabase'
import { CountUp, Money, PageTitle, Reveal, StatusChip, StockChip } from '../components/ui'

function dayKey(date) {
  const d = new Date(date)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [weekBills, setWeekBills] = useState([])
  const [recentBills, setRecentBills] = useState([])
  const [products, setProducts] = useState([])

  useEffect(() => {
    async function load() {
      // start of the day 6 days ago (local time) → last 7 days including today
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      start.setDate(start.getDate() - 6)

      const [week, recent, prods] = await Promise.all([
        supabase.from('invoices').select('id, total, created_at')
          .eq('status', 'paid')
          .gte('created_at', start.toISOString()),
        supabase.from('invoices').select('id, invoice_no, total, status, created_at')
          .order('created_at', { ascending: false })
          .limit(6),
        supabase.from('products').select('id, name, qty, low_stock_level')
          .eq('is_active', true),
      ])

      const firstError = week.error || recent.error || prods.error
      if (firstError) setError(firstError.message)
      else {
        setWeekBills(week.data)
        setRecentBills(recent.data)
        setProducts(prods.data)
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <DashboardSkeleton />
  if (error) return <p className="text-red-300">{error}</p>

  // Last 7 days
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = dayKey(d)
    const bills = weekBills.filter(b => dayKey(b.created_at) === key)
    days.push({
      key,
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
      total: bills.reduce((s, b) => s + Number(b.total), 0),
      count: bills.length,
    })
  }
  const today = days[6]
  const yesterday = days[5]
  const maxDay = Math.max(...days.map(d => d.total), 1)
  const weekTotal = days.reduce((s, d) => s + d.total, 0)
  const avgBill = today.count ? today.total / today.count : 0

  // % change vs yesterday
  const change = yesterday.total > 0 ? ((today.total - yesterday.total) / yesterday.total) * 100 : null

  // Low stock
  const lowStock = products
    .filter(p => p.qty <= p.low_stock_level)
    .sort((a, b) => a.qty - b.qty)

  const dateText = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div>
      <PageTitle title="Dashboard" subtitle={dateText}>
        <button onClick={() => navigate('/new-bill')} className="btn btn-lime">
          <Plus size={16} /> New bill
        </button>
        <button onClick={() => navigate('/products')} className="btn btn-ghost">
          <Package size={16} /> Products
        </button>
      </PageTitle>

      <BackupReminder />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Highlighted: today's sales */}
        <Reveal delay={0} className="col-span-2 lg:col-span-1">
          <div className="glass-accent hover-lift p-5 h-full relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-accent/25 blur-3xl" aria-hidden="true" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-accent uppercase tracking-wider">Today's sales</p>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-accent">
                  <span className="live-dot" /> Live
                </span>
              </div>
              <p className="text-4xl font-light tracking-tight mt-3">
                <CountUp value={today.total} money />
              </p>
              <div className="mt-3">
                {change === null ? (
                  <span className="text-xs text-white/55">No sales yesterday to compare</span>
                ) : (
                  <span className={`chip gap-1 ${change >= 0 ? 'bg-accent text-ink' : 'bg-red-500/20 text-red-300'}`}>
                    {change >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {change >= 0 ? '+' : ''}{change.toFixed(1)}% vs yesterday
                  </span>
                )}
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <KpiCard icon={Receipt} label="Bills today" value={<CountUp value={today.count} />} />
        </Reveal>
        <Reveal delay={160}>
          <KpiCard icon={Wallet} label="Average bill" value={<CountUp value={avgBill} money />} />
        </Reveal>
        <Reveal delay={240} className="col-span-2 lg:col-span-1">
          <KpiCard icon={CalendarDays} label="Last 7 days" value={<CountUp value={weekTotal} money className="text-accent" />} />
        </Reveal>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        {/* 7-day chart */}
        <Reveal delay={320} className="lg:col-span-2">
          <section className="glass p-6 h-full">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Sales, last 7 days</h2>
              <span className="flex items-center gap-2 text-xs muted">
                <span className="w-2.5 h-2.5 rounded-full bg-accent" /> Today
              </span>
            </div>

            <div className="flex items-end gap-2 sm:gap-4 h-48 mt-6">
              {days.map((d, i) => {
                const isToday = i === 6
                return (
                  <div key={d.key} className="group flex-1 h-full flex flex-col items-center justify-end gap-2">
                    <span className={`text-[10px] sm:text-xs tabular-nums transition ${
                      isToday ? 'text-accent font-semibold' : 'text-white/35 group-hover:text-white'
                    }`}>
                      {d.total > 0 ? Math.round(d.total).toLocaleString() : ''}
                    </span>
                    <div className="w-full max-w-11 flex-1 flex items-end rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`anim-grow w-full rounded-full transition ${
                          isToday
                            ? 'bg-accent shadow-[0_0_24px_rgba(198,244,50,0.55)]'
                            : 'bg-white/20 group-hover:bg-white/40'
                        }`}
                        style={{
                          height: `${(d.total / maxDay) * 100}%`,
                          minHeight: d.total > 0 ? 6 : 0,
                          '--d': `${400 + i * 70}ms`,
                        }}
                      />
                    </div>
                    <span className={`text-xs ${isToday ? 'text-white font-semibold' : 'text-white/45'}`}>{d.label}</span>
                  </div>
                )
              })}
            </div>
          </section>
        </Reveal>

        {/* Low stock */}
        <Reveal delay={400}>
          <section className="glass p-6 h-full flex flex-col">
            <div className="flex items-start justify-between">
              <div>
                <p className="label">Low stock items</p>
                <p className={`text-4xl font-light ${lowStock.length ? 'text-amber-300' : ''}`}>
                  <CountUp value={lowStock.length} />
                </p>
              </div>
              <Link
                to="/products"
                aria-label="Open products"
                className="w-9 h-9 rounded-full bg-white/5 border border-white/10 grid place-items-center transition hover:bg-accent hover:text-ink hover:rotate-45"
              >
                <ArrowUpRight size={16} />
              </Link>
            </div>

            <div className="mt-5 flex-1">
              {lowStock.length === 0 ? (
                <p className="text-sm muted">All products have enough stock.</p>
              ) : (
                <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {lowStock.map((p, i) => (
                    <li
                      key={p.id}
                      className="anim-fade-up flex items-center justify-between gap-3 rounded-2xl bg-white/[0.04] border border-white/5 px-3 py-2.5"
                      style={{ '--d': `${500 + i * 60}ms` }}
                    >
                      <span className="flex items-center gap-2 text-sm truncate">
                        <AlertTriangle size={14} className={p.qty === 0 ? 'text-red-300 shrink-0' : 'text-amber-300 shrink-0'} />
                        <span className="truncate">{p.name}</span>
                      </span>
                      <StockChip qty={p.qty} low={p.low_stock_level} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </Reveal>
      </div>

      {/* Recent bills */}
      <Reveal delay={480}>
        <section className="glass p-6 mt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Recent bills</h2>
            <Link to="/bills" className="text-sm text-accent hover:underline">View all</Link>
          </div>

          {recentBills.length === 0 ? (
            <p className="text-sm muted">No bills yet.</p>
          ) : (
            <ul className="grid sm:grid-cols-2 gap-2">
              {recentBills.map((b, i) => (
                <li key={b.id} className="anim-fade-up" style={{ '--d': `${560 + i * 60}ms` }}>
                  <button
                    onClick={() => navigate(`/invoice/${b.id}`)}
                    className={`hover-lift w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left bg-white/[0.04] border border-white/5 hover:bg-white/[0.08] ${
                      b.status === 'cancelled' ? 'opacity-50' : ''
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 shrink-0 rounded-full bg-white/5 border border-white/10 grid place-items-center">
                        <Receipt size={15} className="text-white/70" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold truncate"># {b.invoice_no}</span>
                        <span className="block text-xs muted">{new Date(b.created_at).toLocaleString()}</span>
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <StatusChip status={b.status} />
                      <Money
                        value={b.total}
                        className={`font-semibold ${b.status === 'paid' ? 'text-accent' : 'line-through'}`}
                      />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Reveal>
    </div>
  )
}

function KpiCard({ icon: Icon, label, value }) {
  return (
    <div className="glass hover-lift p-5 h-full">
      <div className="flex items-center justify-between">
        <p className="label mb-0">{label}</p>
        <span className="w-8 h-8 rounded-full bg-white/5 border border-white/10 grid place-items-center">
          <Icon size={15} className="text-white/70" />
        </span>
      </div>
      <p className="text-3xl font-light tracking-tight mt-3">{value}</p>
    </div>
  )
}

// Shimmering placeholders while data loads
function DashboardSkeleton() {
  const block = 'glass animate-pulse'
  return (
    <div>
      <div className="h-12 w-56 rounded-2xl bg-white/5 animate-pulse mb-6" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => <div key={i} className={`${block} h-32 ${i === 0 ? 'col-span-2 lg:col-span-1' : ''}`} />)}
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <div className={`${block} h-72 lg:col-span-2`} />
        <div className={`${block} h-72`} />
      </div>
    </div>
  )
}

// Shows a small banner if no backup was downloaded on this device in the last 7 days
function BackupReminder() {
  const age = daysSince(getLastBackup())
  if (age !== null && age < 7) return null
  return (
    <Link
      to="/backup"
      className="anim-fade-up mb-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 hover:bg-amber-400/15 transition"
    >
      <span className="flex items-center gap-3 text-sm text-amber-200">
        <DatabaseBackup size={18} className="text-amber-300 shrink-0" />
        {age === null ? 'No backup downloaded on this device yet.' : `Last backup was ${age} days ago.`}
      </span>
      <span className="text-sm font-semibold text-amber-300 whitespace-nowrap">Back up now →</span>
    </Link>
  )
}