import { useEffect, useMemo, useState } from 'react'
import { Download, Loader2, Receipt, Wallet } from 'lucide-react'
import { supabase } from '../supabase'
import DateRangePicker from '../components/DateRangePicker'
import { CountUp, Money, PageTitle, Reveal, formatMoney } from '../components/ui'

function pad(n) { return String(n).padStart(2, '0') }
function dateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return dateStr(d)
}
const round2 = n => Math.round(Number(n) * 100) / 100

// Adds up bills per group (route or shop), biggest total first
function summarise(list, keyOf) {
  const map = new Map()
  for (const b of list) {
    const key = keyOf(b)
    const row = map.get(key) ?? {
      name: key, count: 0, subtotal: 0, discount: 0, cash: 0, credit: 0, total: 0,
    }
    const total = Number(b.total)
    row.count += 1
    row.subtotal += Number(b.subtotal ?? b.total)
    row.discount += Number(b.discount_amount ?? 0)
    row.total += total
    if (b.payment_type === 'credit') row.credit += total
    else row.cash += total
    map.set(key, row)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

export default function Reports() {
  const [from, setFrom] = useState(daysAgo(29))
  const [to, setTo] = useState(daysAgo(0))
  const [routeId, setRouteId] = useState('')   // '' = all routes
  const [shopId, setShopId] = useState('')     // '' = all shops
  const [payment, setPayment] = useState('all') // 'all' | 'cash' | 'credit'

  const [routes, setRoutes] = useState([])
  const [shops, setShops] = useState([])
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('routes').select('id, name').order('name'),
      supabase.from('shops').select('id, name, route_id').order('name'),
    ]).then(([r, s]) => {
      const err = r.error || s.error
      if (err) setError(err.message)
      else { setRoutes(r.data); setShops(s.data) }
    })
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    const start = new Date(from + 'T00:00:00')
    const end = new Date(to + 'T00:00:00')
    end.setDate(end.getDate() + 1)

    const { data, error } = await supabase
      .from('invoices')
      .select(`id, invoice_no, created_at, shop_id, shop_name, route_name, subtotal,
               discount_percent, discount_amount, total, payment_type, status,
               invoice_items(product_name, qty, unit_price, line_total)`)
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())
      .order('created_at', { ascending: false })

    setLoading(false)
    if (error) setError(error.message)
    else setBills(data)
  }

  useEffect(() => { load() }, [from, to])

  const routeName = routes.find(r => String(r.id) === routeId)?.name ?? ''
  const shopOptions = routeId ? shops.filter(s => String(s.route_id) === routeId) : shops

  // Filters use the names saved on each bill, so old bills keep their route
  const filtered = useMemo(() => bills.filter(b => {
    if (b.status === 'cancelled') return false
    if (routeName && b.route_name !== routeName) return false
    if (shopId && String(b.shop_id) !== shopId) return false
    if (payment !== 'all' && b.payment_type !== payment) return false
    return true
  }), [bills, routeName, shopId, payment])

  const totals = useMemo(() => {
    const t = { total: 0, cash: 0, credit: 0, discount: 0, count: filtered.length }
    for (const b of filtered) {
      const amount = Number(b.total)
      t.total += amount
      t.discount += Number(b.discount_amount ?? 0)
      if (b.payment_type === 'credit') t.credit += amount
      else t.cash += amount
    }
    return t
  }, [filtered])

  const byRoute = useMemo(() => summarise(filtered, b => b.route_name || 'No route'), [filtered])
  const byShop = useMemo(() => summarise(filtered, b => b.shop_name || 'No shop'), [filtered])
  const maxShop = Math.max(...byShop.map(s => s.total), 1)

  // Excel: one sheet per view, bills and items for checking
  async function exportReport() {
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      const routeRows = byRoute.map(r => ({
        Route: r.name,
        Bills: r.count,
        Subtotal: round2(r.subtotal),
        Discount: round2(r.discount),
        Cash: round2(r.cash),
        Credit: round2(r.credit),
        Total: round2(r.total),
      }))
      const shopRows = byShop.map(s => ({
        Shop: s.name,
        Bills: s.count,
        Subtotal: round2(s.subtotal),
        Discount: round2(s.discount),
        Cash: round2(s.cash),
        Credit: round2(s.credit),
        Total: round2(s.total),
      }))
      const billRows = filtered.map(b => ({
        Invoice: b.invoice_no,
        Date: new Date(b.created_at).toLocaleString(),
        Shop: b.shop_name ?? '',
        Route: b.route_name ?? '',
        Payment: b.payment_type === 'credit' ? 'Credit' : 'Cash',
        Subtotal: round2(b.subtotal ?? b.total),
        'Discount %': Number(b.discount_percent ?? 0),
        Discount: round2(b.discount_amount ?? 0),
        Total: round2(b.total),
      }))
      const itemRows = filtered.flatMap(b =>
        (b.invoice_items ?? []).map(i => ({
          Invoice: b.invoice_no,
          Shop: b.shop_name ?? '',
          Product: i.product_name,
          Qty: i.qty,
          'Unit price': round2(i.unit_price),
          'Line total': round2(i.line_total),
        }))
      )

      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(routeRows.length ? routeRows : [{ Route: '' }]), 'By route')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(shopRows.length ? shopRows : [{ Shop: '' }]), 'By shop')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(billRows.length ? billRows : [{ Invoice: '' }]), 'Bills')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemRows.length ? itemRows : [{ Invoice: '' }]), 'Items')

      XLSX.writeFile(wb, `RMK-sales-report_${from}_to_${to}.xlsx`)
    } catch (e) {
      setError('Export failed: ' + e.message)
    }
    setExporting(false)
  }

  return (
    <div>
      <PageTitle title="Sales report" subtitle="Filter by date, route, shop or payment type">
        <button onClick={exportReport} disabled={exporting || loading || filtered.length === 0} className="btn btn-lime">
          {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          Export to Excel
        </button>
      </PageTitle>

      {/* Filters */}
      <Reveal delay={0} className="relative z-20">
        <div className="glass p-4 grid md:grid-cols-4 gap-3">
          <DateRangePicker from={from} to={to} onChange={(a, b) => { setFrom(a); setTo(b) }} />
          <div>
            <label className="label">Route</label>
            <select className="field" value={routeId}
              onChange={e => { setRouteId(e.target.value); setShopId('') }}>
              <option value="">All routes</option>
              {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Shop</label>
            <select className="field" value={shopId} onChange={e => setShopId(e.target.value)}>
              <option value="">All shops</option>
              {shopOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Payment</label>
            <select className="field" value={payment} onChange={e => setPayment(e.target.value)}>
              <option value="all">Cash and credit</option>
              <option value="cash">Cash only</option>
              <option value="credit">Credit only</option>
            </select>
          </div>
        </div>
      </Reveal>

      {error && <p className="text-red-300 text-sm mt-4">{error}</p>}

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        <Reveal delay={60} className="col-span-2 lg:col-span-1">
          <div className="glass-accent hover-lift p-5 h-full">
            <p className="text-xs font-semibold text-accent uppercase tracking-wider">Total sales</p>
            <p className="text-3xl font-light tracking-tight mt-3"><CountUp value={totals.total} money /></p>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="glass hover-lift p-5 h-full">
            <p className="label mb-0">Cash</p>
            <p className="text-2xl font-light mt-3"><CountUp value={totals.cash} money /></p>
          </div>
        </Reveal>
        <Reveal delay={180}>
          <div className="glass hover-lift p-5 h-full">
            <div className="flex items-center justify-between">
              <p className="label mb-0">On credit</p>
              <Wallet size={15} className="text-amber-300" />
            </div>
            <p className="text-2xl font-light mt-3 text-amber-300"><CountUp value={totals.credit} money /></p>
          </div>
        </Reveal>
        <Reveal delay={240}>
          <div className="glass hover-lift p-5 h-full">
            <div className="flex items-center justify-between">
              <p className="label mb-0">Bills · discount given</p>
              <Receipt size={15} className="text-white/60" />
            </div>
            <p className="text-2xl font-light mt-3">
              <CountUp value={totals.count} /> <span className="text-sm muted">· <Money value={totals.discount} /></span>
            </p>
          </div>
        </Reveal>
      </div>

      {loading ? (
        <div className="space-y-2 mt-6">
          {[0, 1, 2].map(i => <div key={i} className="glass h-14 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass p-10 text-center mt-6">
          <Receipt size={28} className="mx-auto text-white/30" />
          <p className="muted mt-3">No sales match these filters.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-5 gap-4 mt-6 items-start">
          {/* By shop */}
          <Reveal delay={300} className="lg:col-span-3">
            <section className="glass p-5">
              <h2 className="text-lg font-medium mb-4">By shop</h2>
              <ul className="space-y-3">
                {byShop.map((s, i) => (
                  <li key={s.name} className="anim-fade-up" style={{ '--d': `${340 + i * 50}ms` }}>
                    <div className="flex justify-between gap-3 text-sm mb-1">
                      <span className="font-semibold truncate">{s.name}</span>
                      <span className="shrink-0 text-white/70">
                        <Money value={s.total} className="text-accent font-semibold" /> · {s.count} bill{s.count === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-accent/70 transition-[width] duration-700"
                        style={{ width: `${(s.total / maxShop) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </Reveal>

          {/* By route */}
          <Reveal delay={360} className="lg:col-span-2">
            <section className="glass p-5">
              <h2 className="text-lg font-medium mb-4">By route</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-white/45 text-xs uppercase tracking-wider">
                      <th className="py-2 font-semibold">Route</th>
                      <th className="py-2 font-semibold text-right">Bills</th>
                      <th className="py-2 font-semibold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byRoute.map(r => (
                      <tr key={r.name} className="border-t border-white/5">
                        <td className="py-2.5 font-semibold">{r.name}</td>
                        <td className="py-2.5 text-right text-white/60">{r.count}</td>
                        <td className="py-2.5 text-right">
                          <span className="block">Rs. {formatMoney(r.total)}</span>
                          {r.credit > 0 && <span className="text-[11px] text-amber-300">credit Rs. {formatMoney(r.credit)}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </Reveal>
        </div>
      )}
    </div>
  )
}