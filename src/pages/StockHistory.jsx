import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Search, PackagePlus, UserRound, Boxes } from 'lucide-react'
import { supabase } from '../supabase'
import DateRangePicker from '../components/DateRangePicker'
import { CountUp, PageTitle, Reveal } from '../components/ui'

const PAGE = 200

function pad(n) { return String(n).padStart(2, '0') }
function dateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return dateStr(d)
}

// "02 Nov 2026" and "20:50" shown separately
function dayText(value) {
  return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}
function timeText(value) {
  return new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export default function StockHistory() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')

  const [from, setFrom] = useState(daysAgo(29))
  const [to, setTo] = useState(daysAgo(0))
  const [search, setSearch] = useState('')

  // Loads stock-ins for the selected dates, newest first
  async function load(offset = 0) {
    setLoading(true)
    setError('')

    const start = new Date(from + 'T00:00:00')
    const end = new Date(to + 'T00:00:00')
    end.setDate(end.getDate() + 1)

    const { data, error } = await supabase
      .from('stock_ins')
      .select('id, qty_added, note, added_by, created_at, products(id, name, code)')
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE - 1)

    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setRows(prev => (offset === 0 ? data : [...prev, ...data]))
    setHasMore(data.length === PAGE)
  }

  useEffect(() => { load(0) }, [from, to])

  // Filter by product name, code or note (done on the loaded rows)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      (r.products?.name ?? '').toLowerCase().includes(q) ||
      (r.products?.code ?? '').toLowerCase().includes(q) ||
      (r.added_by ?? '').toLowerCase().includes(q) ||
      (r.note ?? '').toLowerCase().includes(q)
    )
  }, [rows, search])

  const totalQty = filtered.reduce((s, r) => s + Number(r.qty_added || 0), 0)

  // Group rows by day for easier reading
  const groups = useMemo(() => {
    const map = new Map()
    for (const r of filtered) {
      const key = dayText(r.created_at)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(r)
    }
    return [...map.entries()]
  }, [filtered])

  return (
    <div>
      <PageTitle title="Stock history" subtitle="Every stock-in: what was added, how much, and when">
        <Link to="/products" className="btn btn-ghost">
          <ArrowLeft size={16} /> Back to products
        </Link>
      </PageTitle>

      {/* Summary + filters */}
      <div className="grid md:grid-cols-3 gap-4">
        <Reveal delay={0}>
          <div className="glass-accent hover-lift p-5 h-full">
            <p className="text-xs font-semibold text-accent uppercase tracking-wider">Units added</p>
            <p className="text-4xl font-light tracking-tight mt-3"><CountUp value={totalQty} /></p>
            <p className="text-xs text-white/55 mt-1">{filtered.length} stock-in{filtered.length === 1 ? '' : 's'} shown</p>
          </div>
        </Reveal>

        <Reveal delay={80} className="md:col-span-2">
          <div className="glass p-5 space-y-4 relative z-20">
            <div className="grid sm:grid-cols-2 gap-3">
              <DateRangePicker
                from={from}
                to={to}
                onChange={(a, b) => { setFrom(a); setTo(b) }}
              />
              <div>
                <label className="label">Search product or person</label>
                <div className="relative">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    placeholder="e.g. Bulb, PC-001, staff name"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="field pl-11"
                  />
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      {error && <p className="text-red-300 text-sm mt-4">{error}</p>}

      <div className="mt-6 space-y-6">
        {loading && rows.length === 0 ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map(i => <div key={i} className="glass h-14 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass p-10 text-center anim-fade-up">
            <Boxes size={28} className="mx-auto text-white/30" />
            <p className="muted mt-3">No stock-ins for these dates.</p>
          </div>
        ) : (
          groups.map(([day, list], gi) => (
            <Reveal key={day} delay={Math.min(gi, 6) * 80}>
              <p className="label mb-2">{day}</p>

              {/* Desktop table */}
              <div className="hidden md:block glass overflow-hidden">
                <table className="w-full text-sm table-fixed">
                  {/* Fixed widths so every day's table lines up */}
                  <colgroup>
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '36%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '30%' }} />
                  </colgroup>
                  <thead>
                    <tr className="text-left text-white/45 text-xs uppercase tracking-wider">
                      <th className="px-5 py-3 font-semibold">Time</th>
                      <th className="px-5 py-3 font-semibold">Product</th>
                      <th className="px-5 py-3 font-semibold text-right">Added</th>
                      <th className="px-5 py-3 font-semibold">Added by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map(r => (
                      <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.04]">
                        <td className="px-5 py-3 text-white/60 whitespace-nowrap">{timeText(r.created_at)}</td>
                        <td className="px-5 py-3">
                          <p className="font-semibold">{r.products?.name ?? 'Removed product'}</p>
                          <p className="text-xs muted">{r.products?.code || 'No code'}</p>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="chip bg-accent/15 text-accent text-sm">+{r.qty_added}</span>
                        </td>
                        <td className="px-5 py-3 text-white/60">{r.added_by || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {list.map(r => (
                  <div key={r.id} className="glass p-4 flex items-start gap-3">
                    <span className="w-9 h-9 shrink-0 rounded-full bg-accent/15 text-accent grid place-items-center">
                      <PackagePlus size={16} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-3">
                        <p className="font-semibold truncate">{r.products?.name ?? 'Removed product'}</p>
                        <span className="chip bg-accent/15 text-accent shrink-0">+{r.qty_added}</span>
                      </div>
                      <p className="text-xs muted mt-0.5">{timeText(r.created_at)} · {r.products?.code || 'No code'}</p>
                      <p className="text-xs text-white/60 mt-1 flex items-center gap-1">
                        <UserRound size={12} /> {r.added_by || 'Unknown'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          ))
        )}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-6">
          <button onClick={() => load(rows.length)} disabled={loading} className="btn btn-ghost">
            {loading ? 'Loading...' : 'Load older stock-ins'}
          </button>
        </div>
      )}
    </div>
  )
}