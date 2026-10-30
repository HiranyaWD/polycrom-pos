import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Search, Eye, Ban, Receipt, XCircle, FileSpreadsheet, Loader2 } from 'lucide-react'
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

export default function Bills() {
  const navigate = useNavigate()
  const [bills, setBills] = useState([])
  const [from, setFrom] = useState(daysAgo(0))
  const [to, setTo] = useState(daysAgo(0))
  const [search, setSearch] = useState('')
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
    if (!confirm(`Cancel bill ${bill.invoice_no}?\n\nStock will be returned. This cannot be undone.`)) return
    const { error } = await supabase.rpc('cancel_invoice', { p_invoice_id: bill.id })
    if (error) setError(error.message)
    else loadBills()
  }

  function applyPreset(p) {
    setFrom(daysAgo(p.from))
    setTo(daysAgo(p.to))
  }

  const filtered = bills.filter(b =>
    b.invoice_no.toLowerCase().includes(search.toLowerCase())
  )

  const paid = filtered.filter(b => b.status === 'paid')
  const cancelledCount = filtered.length - paid.length
  const paidTotal = paid.reduce((sum, b) => sum + Number(b.total), 0)

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
            <p className="text-4xl font-light tracking-tight mt-3"><CountUp value={paidTotal} money /></p>
            <p className="text-xs text-white/55 mt-1">Paid bills in this period</p>
          </div>
        </Reveal>
        <Reveal delay={80}>
          <div className="glass hover-lift p-5 h-full">
            <div className="flex items-center justify-between">
              <p className="label mb-0">Paid bills</p>
              <Receipt size={16} className="text-white/60" />
            </div>
            <p className="text-3xl font-light mt-3"><CountUp value={paid.length} /></p>
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
              const active = from === daysAgo(p.from) && to === daysAgo(p.to)
              return (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
                    active ? 'bg-accent text-ink border-accent' : 'bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <DateRangePicker
              from={from}
              to={to}
              onChange={(a, b) => { setFrom(a); setTo(b) }}
            />
            <div>
              <label className="label">Search</label>
              <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                <input placeholder="Invoice no, e.g. PC-000012" value={search}
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
            <p className="muted mt-3">No bills for these dates.</p>
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
                      <th className="px-5 py-4 font-semibold">Date</th>
                      <th className="px-5 py-4 font-semibold">Items</th>
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
                          <td className="px-5 py-3.5 text-white/60">{new Date(b.created_at).toLocaleString()}</td>
                          <td className="px-5 py-3.5 text-white/60">{itemsCount(b)} items</td>
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
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold"># {b.invoice_no}</p>
                        <p className="text-xs muted">{new Date(b.created_at).toLocaleString()} · {itemsCount(b)} items</p>
                      </div>
                      <StatusChip status={b.status} />
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