import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Search, Eye, Ban, Receipt, XCircle, Wallet, FileSpreadsheet, Loader2 } from 'lucide-react'
import { exportBills } from '../lib/exportExcel'
import { supabase } from '../supabase'
import { CountUp, Money, PageTitle, Reveal, StatusChip } from '../components/ui'
import DateRangePicker from '../components/DateRangePicker'

function dateStr(d) {
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return dateStr(d)
}

const presets = [
  { label: 'Today', from: 0, to: 0 },
  { label: 'Yesterday', from: 1, to: 1 },
  { label: '7 days', from: 6, to: 0 },
  { label: '30 days', from: 29, to: 0 },
]

// Small chip: Cash (paid now) or Credit (shop pays later)
function PaymentChip({ type }) {
  return type === 'credit'
    ? <span className="chip bg-amber-400/15 text-amber-300">Credit</span>
    : <span className="chip bg-white/10 text-white/75">Cash</span>
}

export default function Bills() {
  const navigate = useNavigate()
  const [bills, setBills] = useState([])
  const [shops, setShops] = useState([])
  const [from, setFrom] = useState(daysAgo(0))
  const [to, setTo] = useState(daysAgo(0))
  const [search, setSearch] = useState('')
  const [shopFilter, setShopFilter] = useState('') // '' = all shops, otherwise a shop id
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      await exportBills(filtered, from, to)
    } catch (e) {
      setError('Export failed: ' + e.message)
    }
    setExporting(false)
  }

  // Shop names for the filter (hidden shops too, so old bills can be found)
  useEffect(() => {
    supabase.from('shops').select('id, name').order('name')
      .then(({ data }) => setShops(data ?? []))
  }, [])

  async function loadBills() {
    setLoading(true)
    setError('')

    // start of "from" day and start of the day after "to", in local time
    const start = new Date(from + 'T00:00:00')
    const end = new Date(to + 'T00:00:00')
    end.setDate(end.getDate() + 1)

    const { data, error } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())
      .order('created_at', { ascending: false })

    setLoading(false)
    if (error) setError(error.message)
    else setBills(data)
  }

  useEffect(() => { loadBills() }, [from, to])

  async function cancelBill(bill) {
    if (!confirm(`Cancel bill ${bill.invoice_no}?\n\nStock will be returned, and any credit owed by the shop will be removed. This cannot be undone.`)) return
    const { error } = await supabase.rpc('cancel_invoice', { p_invoice_id: bill.id })
    if (error) setError(error.message)
    else loadBills()
  }

  function applyPreset(p) {
    setFrom(daysAgo(p.from))
    setTo(daysAgo(p.to))
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return bills.filter(b => {
      if (shopFilter && String(b.shop_id) !== shopFilter) return false
      if (!q) return true
      return (
        b.invoice_no.toLowerCase().includes(q) ||
        (b.shop_name ?? '').toLowerCase().includes(q)
      )
    })
  }, [bills, search, shopFilter])

  const active = filtered.filter(b => b.status !== 'cancelled')
  const cancelledCount = filtered.length - active.length
  const salesTotal = active.reduce((sum, b) => sum + Number(b.total), 0)
  const creditTotal = active
    .filter(b => b.payment_type === 'credit')
    .reduce((sum, b) => sum + Number(b.total), 0)

  const itemsCount = b => b.invoice_items.reduce((s, i) => s + i.qty, 0)
  const iconBtn = 'w-8 h-8 rounded-full grid place-items-center border border-white/10 bg-white/5 transition'

  return (
    <div>
      <PageTitle title="Bills" subtitle="History, reprints and cancellations">
        <button onClick={handleExport} disabled={exporting || loading || filtered.length === 0} className="btn btn-ghost">
          {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
          Export to Excel
        </button>
      </PageTitle>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Reveal delay={0} className="col-span-2 lg:col-span-1">
          <div className="glass-accent hover-lift p-5 h-full">
            <p className="text-xs font-semibold text-accent uppercase tracking-wider">Total sales</p>
            <p className="text-4xl font-light tracking-tight mt-3"><CountUp value={salesTotal} money /></p>
            <p className="text-xs text-white/55 mt-1">Cash and credit, not cancelled</p>
          </div>
        </Reveal>
        <Reveal delay={80}>
          <div className="glass hover-lift p-5 h-full">
            <div className="flex items-center justify-between">
              <p className="label mb-0">On credit</p>
              <Wallet size={16} className="text-amber-300" />
            </div>
            <p className="text-3xl font-light mt-3 text-amber-300"><CountUp value={creditTotal} money /></p>
            <p className="text-xs text-white/55 mt-1">Shops to pay later</p>
          </div>
        </Reveal>
        <Reveal delay={160}>
          <div className="glass hover-lift p-5 h-full">
            <div className="flex items-center justify-between">
              <p className="label mb-0">Cancelled</p>
              <XCircle size={16} className="text-white/60" />
            </div>
            <p className={`text-3xl font-light mt-3 ${cancelledCount ? 'text-red-300' : ''}`}><CountUp value={cancelledCount} /></p>
          </div>
        </Reveal>
      </div>

      {/* Filters */}
      {/* relative z-20 keeps the calendar popup above the table below */}
      <Reveal delay={240} className="mt-4 relative z-20">
        <div className="glass p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {presets.map(p => {
              const isActive = from === daysAgo(p.from) && to === daysAgo(p.to)
              return (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
                    isActive ? 'bg-accent text-ink border-accent' : 'bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <DateRangePicker
              from={from}
              to={to}
              onChange={(a, b) => { setFrom(a); setTo(b) }}
            />
            <div>
              <label className="label">Shop</label>
              <select value={shopFilter} onChange={e => setShopFilter(e.target.value)} className="field">
                <option value="">All shops</option>
                {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Search</label>
              <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                <input placeholder="Invoice no or shop name" value={search}
                  onChange={e => setSearch(e.target.value)} className="field pl-11" />
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {error && <p className="text-red-300 text-sm mt-4">{error}</p>}

      <div className="mt-4">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map(i => <div key={i} className="glass h-14 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass p-10 text-center anim-fade-up">
            <Receipt size={28} className="mx-auto text-white/30" />
            <p className="muted mt-3">No bills for these filters.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <Reveal delay={300} className="hidden md:block">
              <div className="glass overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-white/45 text-xs uppercase tracking-wider">
                      <th className="px-5 py-4 font-semibold">Invoice</th>
                      <th className="px-5 py-4 font-semibold">Shop</th>
                      <th className="px-5 py-4 font-semibold">Date</th>
                      <th className="px-5 py-4 font-semibold">Payment</th>
                      <th className="px-5 py-4 font-semibold">Status</th>
                      <th className="px-5 py-4 font-semibold text-right">Total</th>
                      <th className="px-5 py-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((b, i) => {
                      const cancelled = b.status === 'cancelled'
                      return (
                        <tr
                          key={b.id}
                          className={`anim-fade-up border-t border-white/5 hover:bg-white/[0.04] transition-colors ${cancelled ? 'opacity-50' : ''}`}
                          style={{ '--d': `${340 + Math.min(i, 12) * 40}ms` }}
                        >
                          <td className="px-5 py-3.5 font-semibold"># {b.invoice_no}</td>
                          <td className="px-5 py-3.5">
                            <p className="truncate max-w-[14rem]">{b.shop_name || <span className="muted">No shop</span>}</p>
                            <p className="text-xs muted">{b.route_name || ''}</p>
                          </td>
                          <td className="px-5 py-3.5 text-white/60 whitespace-nowrap">{new Date(b.created_at).toLocaleString()}</td>
                          <td className="px-5 py-3.5"><PaymentChip type={b.payment_type} /></td>
                          <td className="px-5 py-3.5"><StatusChip status={b.status} /></td>
                          <td className="px-5 py-3.5 text-right">
                            <Money value={b.total} className={`font-semibold ${cancelled ? 'line-through' : 'text-accent'}`} />
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex justify-end gap-1.5">
                              <button onClick={() => navigate(`/invoice/${b.id}`)} title="View / print" aria-label="View"
                                className={`${iconBtn} hover:bg-accent hover:text-ink hover:border-accent`}>
                                <Eye size={15} />
                              </button>
                              {!cancelled && (
                                <button onClick={() => cancelBill(b)} title="Cancel bill" aria-label="Cancel bill"
                                  className={`${iconBtn} hover:bg-red-500/20 hover:text-red-300 hover:border-red-400/30`}>
                                  <Ban size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Reveal>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {filtered.map((b, i) => {
                const cancelled = b.status === 'cancelled'
                return (
                  <div key={b.id} className={`glass p-4 anim-fade-up ${cancelled ? 'opacity-60' : ''}`}
                    style={{ '--d': `${300 + Math.min(i, 10) * 50}ms` }}>
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold"># {b.invoice_no}</p>
                        <p className="text-sm truncate">{b.shop_name || <span className="muted">No shop</span>}</p>
                        <p className="text-xs muted">{new Date(b.created_at).toLocaleString()} · {itemsCount(b)} items</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <StatusChip status={b.status} />
                        <PaymentChip type={b.payment_type} />
                      </div>
                    </div>
                    <div className="mt-3 flex justify-between items-center">
                      <Money value={b.total} className={`text-lg font-semibold ${cancelled ? 'line-through' : 'text-accent'}`} />
                      <div className="flex gap-2">
                        <button onClick={() => navigate(`/invoice/${b.id}`)} className="btn btn-ghost px-4 py-2">
                          <Eye size={15} /> View
                        </button>
                        {!cancelled && (
                          <button onClick={() => cancelBill(b)} className="btn btn-danger px-4 py-2">
                            <Ban size={14} /> Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}