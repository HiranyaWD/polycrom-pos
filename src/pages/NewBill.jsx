import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Search, Plus, Minus, X, ShoppingCart, Printer, Trash2, Store, Clock, Route as RouteIcon } from 'lucide-react'
import { supabase } from '../supabase'
import { CountUp, Money, PageTitle, Reveal, StockChip } from '../components/ui'

// Same rule as the database function create_invoice
const DISCOUNT_THRESHOLD = 100000 // "over 100K" means above this amount
const DISCOUNT_LOW = 10           // normal bills
const DISCOUNT_HIGH = 25          // bills over the threshold

export default function NewBill() {
  const navigate = useNavigate()

  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [categoryId, setCategoryId] = useState('all') // 'all' or a category id
  const [routes, setRoutes] = useState([])
  const [shops, setShops] = useState([])
  const [balances, setBalances] = useState({})
  const [recentIds, setRecentIds] = useState([])
  const [loading, setLoading] = useState(true)

  const [shopId, setShopId] = useState(null)
  const [routeFilter, setRouteFilter] = useState('all') // 'all' or a route id
  const [shopSearch, setShopSearch] = useState('')
  const [paymentType, setPaymentType] = useState('cash') // 'cash' or 'credit'

  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([]) // [{ product, qty }]
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const shop = shops.find(s => s.id === shopId) ?? null
  const routeNameOf = id => routes.find(r => r.id === id)?.name ?? ''

  async function loadAll() {
    const [p, r, s, b, inv, c] = await Promise.all([
      supabase.from('products').select('*').eq('is_active', true).order('name'),
      supabase.from('routes').select('*').eq('is_active', true).order('name'),
      supabase.from('shops').select('*').eq('is_active', true).order('name'),
      supabase.from('shop_balances').select('*'),
      supabase.from('invoices').select('shop_id, created_at')
        .not('shop_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(60),
      supabase.from('categories').select('*').eq('is_active', true).order('name'),
    ])
    setLoading(false)
    const err = p.error || r.error || s.error || b.error || inv.error
    if (err) { setError(err.message); return }

    setProducts(p.data)
    setCategories(c.data ?? [])
    setRoutes(r.data)
    setShops(s.data)
    setBalances(Object.fromEntries(b.data.map(x => [x.shop_id, Number(x.balance)])))
    setRecentIds([...new Set(inv.data.map(x => x.shop_id))])
  }

  useEffect(() => { loadAll() }, [])

  // Shops picked most recently, shown as quick chips
  const recentShops = useMemo(
    () => recentIds.map(id => shops.find(s => s.id === id)).filter(Boolean).slice(0, 6),
    [recentIds, shops]
  )

  const pickerShops = useMemo(() => {
    const q = shopSearch.trim().toLowerCase()
    return shops.filter(s => {
      if (routeFilter !== 'all' && String(s.route_id) !== routeFilter) return false
      if (!q) return true
      return s.name.toLowerCase().includes(q) || routeNameOf(s.route_id).toLowerCase().includes(q)
    })
  }, [shops, routes, routeFilter, shopSearch])

  function pickShop(id) {
    setShopId(id)
    setShopSearch('')
    setError('')
  }

  // Locked while items are in the bill, so a bill cannot change shop after items are added
  function changeShop() {
    if (cart.length > 0) return
    setShopId(null)
    setPaymentType('cash')
  }

  function handleShopSearchKey(e) {
    if (e.key === 'Enter' && pickerShops.length > 0) pickShop(pickerShops[0].id)
  }

  // ---- Products ----
  const filtered = products.filter(p =>
    (categoryId === 'all' || String(p.category_id) === categoryId) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) ||
     (p.code ?? '').toLowerCase().includes(search.toLowerCase()))
  )

  function addToCart(product) {
    setError('')
    setCart(current => {
      const existing = current.find(i => i.product.id === product.id)
      if (existing) {
        if (existing.qty >= product.qty) {
          setError(`Only ${product.qty} ${product.name} in stock`)
          return current
        }
        return current.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      }
      if (product.qty <= 0) {
        setError(`${product.name} is out of stock`)
        return current
      }
      return [...current, { product, qty: 1 }]
    })
  }

  // Press Enter in search → add the first matching product
  function handleSearchKey(e) {
    if (e.key === 'Enter' && search.trim()) {
      const first = filtered.find(p => p.qty > 0)
      if (first) {
        addToCart(first)
        setSearch('')
      }
    }
  }

  function setQty(productId, value) {
    setError('')
    setCart(current => current.map(i => {
      if (i.product.id !== productId) return i
      let qty = Math.floor(Number(value)) || 1
      if (qty < 1) qty = 1
      if (qty > i.product.qty) {
        setError(`Only ${i.product.qty} ${i.product.name} in stock`)
        qty = i.product.qty
      }
      return { ...i, qty }
    }))
  }

  function removeFromCart(productId) {
    setCart(current => current.filter(i => i.product.id !== productId))
  }

  const inCart = id => cart.find(i => i.product.id === id)?.qty ?? 0
  const itemCount = cart.reduce((sum, i) => sum + i.qty, 0)

  // ---- Totals (preview only; the database works the same way when saving) ----
  const subtotal = cart.reduce((sum, i) => sum + Number(i.product.sell_price) * i.qty, 0)
  const discountPct = subtotal > DISCOUNT_THRESHOLD ? DISCOUNT_HIGH : DISCOUNT_LOW
  const discount = Math.round(subtotal * discountPct) / 100
  const total = subtotal - discount

  const owed = shop ? (balances[shop.id] ?? 0) : 0
  const creditLimit = shop?.credit_limit != null ? Number(shop.credit_limit) : null
  const overLimit = paymentType === 'credit' && creditLimit !== null && owed + total > creditLimit

  // ---- Save ----
  async function saveBill() {
    if (!shop || cart.length === 0) return
    setError('')
    setSaving(true)
    const { data, error } = await supabase.rpc('create_invoice', {
      p_items: cart.map(i => ({ product_id: i.product.id, qty: i.qty })),
      p_shop_id: shop.id,
      p_payment_type: paymentType,
    })
    setSaving(false)

    if (error) {
      setError(error.message)
      loadAll() // refresh stock and balances in case they changed
    } else {
      // go to the invoice and print it automatically
      navigate(`/invoice/${data.id}?print=1`)
    }
  }

  return (
    <div>
      <PageTitle
        title="New Bill"
        subtitle={shop ? 'Tap products to add them. Press Enter in search to add the first match.' : 'Choose the shop first. Every bill is for one shop.'}
      />

      {error && (
        <div className="anim-pop mb-4 rounded-2xl border border-red-400/25 bg-red-500/10 text-red-300 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-4 items-start">
        {/* LEFT: shop, then products */}
        <div className="lg:col-span-3 space-y-4">
          <Reveal delay={40}>
            {shop ? (
              <section className="glass-accent p-5 anim-pop flex items-start gap-4">
                <span className="w-11 h-11 rounded-full bg-accent text-ink grid place-items-center shrink-0">
                  <Store size={20} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-accent uppercase tracking-wider">Shop</p>
                  <p className="text-xl font-semibold truncate">{shop.name}</p>
                  <p className="text-xs muted truncate">
                    {routeNameOf(shop.route_id) || 'No route'} · {shop.phone || 'No phone'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <span className="text-white/70">Owed <Money value={owed} className={owed > 0 ? 'text-amber-300 font-semibold' : ''} /></span>
                    {creditLimit !== null && (
                      <span className="text-white/70">Limit <Money value={creditLimit} /></span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <button onClick={changeShop} disabled={cart.length > 0} className="btn btn-ghost text-sm">
                    Change
                  </button>
                  {cart.length > 0 && <p className="text-[11px] muted mt-1 max-w-[9rem]">Clear the bill to change shop</p>}
                </div>
              </section>
            ) : (
              <section className="glass p-5">
                <h2 className="text-lg font-medium flex items-center gap-2 mb-4">
                  <Store size={18} className="text-accent" /> Choose shop
                </h2>

                {loading ? (
                  <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
                ) : shops.length === 0 ? (
                  <p className="muted text-sm">No shops yet. Add shops and routes in Settings first.</p>
                ) : (
                  <>
                    {recentShops.length > 0 && (
                      <div className="mb-4">
                        <p className="label mb-2 flex items-center gap-1.5"><Clock size={12} /> Recent</p>
                        <div className="flex flex-wrap gap-2">
                          {recentShops.map(s => (
                            <button key={s.id} onClick={() => pickShop(s.id)}
                              className="px-3.5 py-2 rounded-full text-sm font-semibold bg-white/5 border border-white/10 hover:bg-accent hover:text-ink hover:border-accent transition">
                              {s.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="label mb-2 flex items-center gap-1.5"><RouteIcon size={12} /> Route</p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <RouteChip active={routeFilter === 'all'} onClick={() => setRouteFilter('all')}>All</RouteChip>
                      {routes.map(r => (
                        <RouteChip key={r.id} active={routeFilter === String(r.id)} onClick={() => setRouteFilter(String(r.id))}>
                          {r.name}
                        </RouteChip>
                      ))}
                    </div>

                    <div className="relative mb-3">
                      <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                      <input
                        placeholder="Type a shop name... (Enter picks the first)"
                        value={shopSearch}
                        onChange={e => setShopSearch(e.target.value)}
                        onKeyDown={handleShopSearchKey}
                        className="field rounded-full pl-11"
                      />
                    </div>

                    {pickerShops.length === 0 ? (
                      <p className="muted text-sm py-4 text-center">No shops match.</p>
                    ) : (
                      <ul className="grid sm:grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto pr-1">
                        {pickerShops.map(s => {
                          const sOwed = balances[s.id] ?? 0
                          return (
                            <li key={s.id}>
                              <button onClick={() => pickShop(s.id)}
                                className="w-full text-left rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/20 px-4 py-3 transition active:scale-[0.98]">
                                <p className="font-semibold truncate">{s.name}</p>
                                <p className="text-xs muted flex justify-between gap-2 mt-0.5">
                                  <span className="truncate">{routeNameOf(s.route_id) || 'No route'}</span>
                                  {sOwed > 0 && <span className="text-amber-300 shrink-0">Owes <Money value={sOwed} /></span>}
                                </p>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </>
                )}
              </section>
            )}
          </Reveal>

          {/* Products: only after a shop is chosen */}
          {!shop ? (
            <Reveal delay={120}>
              <div className="glass p-8 text-center">
                <Store size={28} className="mx-auto text-white/25" />
                <p className="muted mt-3">Choose a shop to start adding products.</p>
              </div>
            </Reveal>
          ) : (
            <Reveal delay={120}>
              <section className="glass p-4 sm:p-5">
                <div className="relative">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    autoFocus
                    placeholder="Search product by name or code..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={handleSearchKey}
                    className="field rounded-full pl-11 py-3"
                  />
                </div>

                {/* Category buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
              <RouteChip active={categoryId === 'all'} onClick={() => setCategoryId('all')}>All</RouteChip>
              {categories.map(c => (
                <RouteChip key={c.id} active={categoryId === String(c.id)} onClick={() => setCategoryId(String(c.id))}>
                  {c.name}
                </RouteChip>
              ))}
            </div>

            <div className="mt-3 grid sm:grid-cols-2 gap-2 max-h-[52vh] overflow-y-auto pr-1">
                  {filtered.length === 0 && <p className="muted text-sm p-3">No products found.</p>}
                  {filtered.map(p => {
                    const qtyInCart = inCart(p.id)
                    const out = p.qty <= 0
                    return (
                      <button
                        key={p.id}
                        onClick={() => addToCart(p)}
                        disabled={out}
                        className={`group relative text-left rounded-2xl border px-4 py-3 transition active:scale-[0.98] disabled:opacity-35 disabled:active:scale-100 ${
                          qtyInCart
                            ? 'bg-accent/10 border-accent/40'
                            : 'bg-white/[0.04] border-white/8 hover:bg-white/[0.08] hover:border-white/15'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{p.name}</p>
                            <p className="text-xs muted">{p.code || 'No code'}</p>
                          </div>
                          {qtyInCart > 0 ? (
                            <span key={qtyInCart} className="anim-pop chip bg-accent text-ink">×{qtyInCart}</span>
                          ) : (
                            <span className="w-7 h-7 shrink-0 rounded-full bg-white/5 border border-white/10 grid place-items-center group-hover:bg-accent group-hover:text-ink group-hover:border-accent transition">
                              <Plus size={14} />
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex justify-between items-center">
                          <Money value={p.sell_price} className="font-semibold text-accent" />
                          <span className="flex items-center gap-1.5 text-xs muted">
                            Stock <StockChip qty={p.qty} low={p.low_stock_level} />
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            </Reveal>
          )}
        </div>

        {/* RIGHT: current bill */}
        <Reveal delay={160} className="lg:col-span-2 lg:sticky lg:top-24">
          <section className="glass p-5 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium flex items-center gap-2">
                <ShoppingCart size={18} className="text-accent" /> Current bill
              </h2>
              {cart.length > 0 && (
                <span className="chip bg-white/10 text-white/80">{itemCount} item{itemCount === 1 ? '' : 's'}</span>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="py-10 text-center">
                <ShoppingCart size={30} className="mx-auto text-white/20" />
                <p className="muted text-sm mt-3">
                  {shop ? 'No items yet. Tap a product to add it.' : 'Choose a shop, then add products.'}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-white/5 max-h-[32vh] overflow-y-auto pr-1">
                {cart.map(i => (
                  <li key={i.product.id} className="anim-fade-up py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{i.product.name}</p>
                      <p className="text-xs muted"><Money value={i.product.sell_price} /> each</p>
                    </div>
                    <div className="flex items-center gap-1 rounded-full bg-white/5 border border-white/10 p-1">
                      <button onClick={() => setQty(i.product.id, i.qty - 1)} aria-label="Less"
                        className="w-7 h-7 rounded-full grid place-items-center hover:bg-white/10">
                        <Minus size={13} />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={i.qty}
                        onChange={e => setQty(i.product.id, e.target.value)}
                        className="w-10 bg-transparent text-center font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button onClick={() => setQty(i.product.id, i.qty + 1)} aria-label="More"
                        className="w-7 h-7 rounded-full grid place-items-center hover:bg-accent hover:text-ink">
                        <Plus size={13} />
                      </button>
                    </div>
                    <Money value={Number(i.product.sell_price) * i.qty} className="w-24 text-right font-semibold" />
                    <button onClick={() => removeFromCart(i.product.id)} aria-label="Remove"
                      className="w-7 h-7 rounded-full grid place-items-center text-white/40 hover:text-red-300 hover:bg-red-500/15">
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Payment: paid now or on credit */}
            <div className="mt-4">
              <p className="label mb-2">Payment</p>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-full bg-white/5 border border-white/10">
                {[['cash', 'Paid now'], ['credit', 'On credit']].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPaymentType(value)}
                    className={`py-2 rounded-full text-sm font-semibold transition ${
                      paymentType === value ? 'bg-accent text-ink' : 'text-white/65 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {paymentType === 'credit' && shop && (
                <p className="text-xs muted mt-2">
                  Added to {shop.name}'s credit. Owed after this bill: <Money value={owed + total} />
                </p>
              )}
              {overLimit && (
                <p className="text-xs text-red-300 mt-2">
                  Over the credit limit. Choose Paid now, or raise the limit in Settings.
                </p>
              )}
            </div>

            {/* Totals */}
            <div className="mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-white/65">
                <span>Subtotal</span><Money value={subtotal} />
              </div>
              <div className="flex justify-between text-accent">
                <span>Discount {cart.length > 0 && `(${discountPct}%)`}</span>
                <span>-<Money value={discount} /></span>
              </div>
              <p className="text-[11px] muted">
                {subtotal > DISCOUNT_THRESHOLD
                  ? `Over Rs. ${DISCOUNT_THRESHOLD.toLocaleString()}: ${DISCOUNT_HIGH}% discount`
                  : `Up to Rs. ${DISCOUNT_THRESHOLD.toLocaleString()}: ${DISCOUNT_LOW}% discount`}
              </p>
            </div>

            <div className="glass-accent mt-3 p-5">
              <p className="text-xs font-semibold text-accent uppercase tracking-wider">Total</p>
              <p className="text-4xl font-light tracking-tight mt-1">
                <CountUp value={total} money />
              </p>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { setCart([]); setError('') }}
                disabled={cart.length === 0}
                className="btn btn-ghost"
                aria-label="Clear bill"
              >
                <Trash2 size={15} /> Clear
              </button>
              <button
                onClick={saveBill}
                disabled={!shop || cart.length === 0 || saving || overLimit}
                className="btn btn-lime flex-1 py-3 text-base"
              >
                <Printer size={17} />
                {saving ? 'Saving...' : !shop ? 'Choose a shop' : 'Save & print'}
              </button>
            </div>
          </section>
        </Reveal>
      </div>
    </div>
  )
}

function RouteChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
        active
          ? 'bg-accent text-ink border-accent shadow-[0_0_16px_rgba(198,244,50,0.35)]'
          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  )
}