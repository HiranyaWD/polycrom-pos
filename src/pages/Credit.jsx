import { useEffect, useMemo, useState } from 'react'
import { Wallet, Plus, Store, History, X, CheckCircle2 } from 'lucide-react'
import { supabase } from '../supabase'
import { CountUp, Modal, Money, PageTitle, Reveal, formatMoney } from '../components/ui'

// Shops that owe money, their unpaid credit bills, and their payments
export default function Credit() {
  const [shops, setShops] = useState([])
  const [routes, setRoutes] = useState([])
  const [balances, setBalances] = useState({})
  const [selectedId, setSelectedId] = useState(null)
  const [unpaidBills, setUnpaidBills] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [paying, setPaying] = useState(false)
  const [busyBill, setBusyBill] = useState(null)

  async function loadAll() {
    const [s, r, b] = await Promise.all([
      supabase.from('shops').select('*').eq('is_active', true).order('name'),
      supabase.from('routes').select('*'),
      supabase.from('shop_balances').select('*'),
    ])
    setLoading(false)
    const err = s.error || r.error || b.error
    if (err) { setError(err.message); return }
    setShops(s.data)
    setRoutes(r.data)
    setBalances(Object.fromEntries(b.data.map(x => [x.shop_id, Number(x.balance)])))
  }

  // Credit bills that still have money owed, oldest first
  async function loadShopDetails(shopId) {
    const [bills, pays] = await Promise.all([
      supabase.from('invoices')
        .select('id, invoice_no, created_at, total, paid_amount')
        .eq('shop_id', shopId)
        .eq('status', 'paid')
        .order('created_at', { ascending: true }),
      supabase.from('shop_payments')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })
        .limit(30),
    ])
    const err = bills.error || pays.error
    if (err) { setError(err.message); return }
    setUnpaidBills(bills.data.filter(b => Number(b.paid_amount) < Number(b.total)))
    setPayments(pays.data)
  }

  useEffect(() => { loadAll() }, [])

  useEffect(() => {
    if (selectedId) loadShopDetails(selectedId)
    else { setUnpaidBills([]); setPayments([]) }
  }, [selectedId])

  const owing = useMemo(
    () => shops
      .filter(s => (balances[s.id] ?? 0) > 0)
      .sort((a, b) => (balances[b.id] ?? 0) - (balances[a.id] ?? 0)),
    [shops, balances]
  )

  const totalOwed = owing.reduce((sum, s) => sum + (balances[s.id] ?? 0), 0)
  const selected = shops.find(s => s.id === selectedId) ?? null
  const routeNameOf = id => routes.find(r => r.id === id)?.name ?? ''
  const selectedOwed = selected ? (balances[selected.id] ?? 0) : 0

  async function refresh() {
    await loadAll()
    if (selectedId) await loadShopDetails(selectedId)
  }

  // Marks a whole bill as paid: it becomes a Cash bill and leaves the shop's balance
  async function markBillPaid(bill) {
    const outstanding = Number(bill.total) - Number(bill.paid_amount)
    if (!confirm(`Mark bill ${bill.invoice_no} as paid?\n\nRs. ${formatMoney(outstanding)} will be recorded as received, and the bill will show as Cash.`)) return
    setBusyBill(bill.id)
    setError('')
    const { error } = await supabase.rpc('mark_bill_paid', { p_invoice_id: bill.id })
    setBusyBill(null)
    if (error) setError(error.message)
    else refresh()
  }

  return (
    <div>
      <PageTitle title="Credit" subtitle="Shops that owe money, their unpaid bills and payments" />

      {error && <p className="text-red-300 text-sm mb-4">{error}</p>}

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Reveal delay={0}>
          <div className="glass-accent hover-lift p-5 h-full">
            <p className="text-xs font-semibold text-accent uppercase tracking-wider">Total owed</p>
            <p className="text-4xl font-light tracking-tight mt-3"><CountUp value={totalOwed} money /></p>
            <p className="text-xs text-white/55 mt-1">{owing.length} shop{owing.length === 1 ? '' : 's'} owe money</p>
          </div>
        </Reveal>
      </div>

      <div className="grid lg:grid-cols-5 gap-4 items-start">
        {/* LEFT: shops that owe */}
        <Reveal delay={60} className="lg:col-span-2">
          <section className="glass p-5">
            <h2 className="text-lg font-medium flex items-center gap-2 mb-4">
              <Wallet size={18} className="text-accent" /> Owing shops
            </h2>

            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map(i => <div key={i} className="glass h-14 animate-pulse" />)}
              </div>
            ) : owing.length === 0 ? (
              <p className="muted text-sm py-6 text-center">No shop owes money right now.</p>
            ) : (
              <ul className="space-y-2 max-h-[62vh] overflow-y-auto pr-1">
                {owing.map(s => (
                  <li key={s.id}>
                    <button
                      onClick={() => setSelectedId(s.id)}
                      className={`w-full text-left rounded-2xl border px-4 py-3 transition ${
                        selectedId === s.id
                          ? 'bg-accent/10 border-accent/40'
                          : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08]'
                      }`}
                    >
                      <div className="flex justify-between items-center gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{s.name}</p>
                          <p className="text-xs muted truncate">{routeNameOf(s.route_id) || 'No route'}</p>
                        </div>
                        <Money value={balances[s.id]} className="text-amber-300 font-semibold shrink-0" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Reveal>

        {/* RIGHT: selected shop */}
        <Reveal delay={140} className="lg:col-span-3">
          {!selected ? (
            <div className="glass p-10 text-center">
              <Store size={28} className="mx-auto text-white/25" />
              <p className="muted mt-3">Pick a shop to see its unpaid bills and record a payment.</p>
            </div>
          ) : (
            <section className="glass p-5 space-y-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-accent uppercase tracking-wider">Shop</p>
                  <p className="text-2xl font-semibold truncate">{selected.name}</p>
                  <p className="text-xs muted">
                    {routeNameOf(selected.route_id) || 'No route'} · {selected.phone || 'No phone'}
                  </p>
                </div>
                <button onClick={() => setPaying(true)} disabled={selectedOwed <= 0} className="btn btn-lime">
                  <Plus size={15} /> Record payment
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
                  <p className="label mb-1">Owed now</p>
                  <p className={`text-2xl font-light ${selectedOwed > 0 ? 'text-amber-300' : ''}`}>
                    <Money value={selectedOwed} />
                  </p>
                </div>
                <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
                  <p className="label mb-1">Credit limit</p>
                  <p className="text-2xl font-light">
                    {selected.credit_limit != null ? <Money value={selected.credit_limit} /> : 'No limit'}
                  </p>
                </div>
              </div>

              {/* Unpaid bills */}
              <div>
                <p className="label mb-2">Unpaid bills</p>
                {unpaidBills.length === 0 ? (
                  <p className="muted text-sm">No unpaid bills.</p>
                ) : (
                  <ul className="space-y-2">
                    {unpaidBills.map(b => {
                      const outstanding = Number(b.total) - Number(b.paid_amount)
                      return (
                        <li key={b.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.04] border border-white/10 px-4 py-3">
                          <div className="min-w-0">
                            <p className="font-semibold"># {b.invoice_no}</p>
                            <p className="text-xs muted">
                              {new Date(b.created_at).toLocaleDateString()} · bill <Money value={b.total} /> · still owed <Money value={outstanding} className="text-amber-300" />
                            </p>
                          </div>
                          <button
                            onClick={() => markBillPaid(b)}
                            disabled={busyBill === b.id}
                            className="btn btn-ghost px-3 py-2 text-sm shrink-0"
                          >
                            <CheckCircle2 size={15} /> {busyBill === b.id ? 'Saving...' : 'Mark paid'}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              {/* Payment history */}
              <div>
                <p className="label mb-2 flex items-center gap-1.5"><History size={12} /> Recent payments</p>
                {payments.length === 0 ? (
                  <p className="muted text-sm">No payments recorded yet.</p>
                ) : (
                  <ul className="divide-y divide-white/5">
                    {payments.map(p => (
                      <li key={p.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <p className="text-white/80">
                            {new Date(p.created_at).toLocaleString(undefined, {
                              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                            })}
                          </p>
                          <p className="text-xs muted truncate">
                            {p.received_by || 'Unknown'}{p.note ? ` · ${p.note}` : ''}
                          </p>
                        </div>
                        <span className="chip bg-accent/15 text-accent shrink-0">Rs. {formatMoney(p.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}
        </Reveal>
      </div>

      {paying && selected && (
        <PaymentForm
          shop={selected}
          owed={selectedOwed}
          onClose={() => setPaying(false)}
          onSaved={() => { setPaying(false); refresh() }}
        />
      )}
    </div>
  )
}

// Record money a shop has paid back. It is applied to the oldest unpaid bills first.
function PaymentForm({ shop, owed, onClose, onSaved }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const value = Number(amount)
    if (!(value > 0)) { setError('Enter an amount more than 0'); return }
    if (value > owed + 0.001) {
      setError(`${shop.name} only owes Rs. ${formatMoney(owed)}. Enter a smaller amount.`)
      return
    }

    setSaving(true)
    const { error } = await supabase.rpc('record_shop_payment', {
      p_shop_id: shop.id,
      p_amount: value,
      p_note: note.trim() || null,
    })
    setSaving(false)

    if (error) setError(error.message)
    else onSaved()
  }

  return (
    <Modal onClose={onClose} className="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-light tracking-tight">Record payment</h2>
            <p className="text-sm muted">{shop.name} owes Rs. {formatMoney(owed)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="w-9 h-9 rounded-full bg-white/5 border border-white/10 grid place-items-center hover:bg-white/10">
            <X size={16} />
          </button>
        </div>

        <div>
          <label className="label">Amount received *</label>
          <input autoFocus required type="number" min="0" step="0.01" className="field text-lg"
            value={amount} onChange={e => setAmount(e.target.value)} />
          <button type="button" onClick={() => setAmount(String(owed))} className="text-xs text-accent mt-2 hover:underline">
            Fill full amount (Rs. {formatMoney(owed)})
          </button>
        </div>

        <div>
          <label className="label">Note (optional)</label>
          <input className="field" placeholder="e.g. cheque, bank transfer" value={note}
            onChange={e => setNote(e.target.value)} />
        </div>

        {error && <p className="text-sm text-red-300">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-lime flex-1">
            {saving ? 'Saving...' : 'Save payment'}
          </button>
        </div>
      </form>
    </Modal>
  )
}