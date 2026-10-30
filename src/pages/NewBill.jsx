import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Search, Plus, Minus, X, ShoppingCart, Printer, Trash2 } from 'lucide-react'
import { supabase } from '../supabase'
import { CountUp, Money, PageTitle, Reveal, StockChip } from '../components/ui'

export default function NewBill() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([]) // [{ product, qty }]
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name')
    if (error) setError(error.message)
    else setProducts(data)
  }

  useEffect(() => { loadProducts() }, [])

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.code ?? '').toLowerCase().includes(search.toLowerCase())
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

  const total = cart.reduce((sum, i) => sum + Number(i.product.sell_price) * i.qty, 0)
  const itemCount = cart.reduce((sum, i) => sum + i.qty, 0)
  const inCart = id => cart.find(i => i.product.id === id)?.qty ?? 0

  async function saveBill() {
    if (cart.length === 0) return
    setError('')
    setSaving(true)
    const { data, error } = await supabase.rpc('create_invoice', {
      p_items: cart.map(i => ({ product_id: i.product.id, qty: i.qty })),
      p_shop_id: null,
    })
    setSaving(false)

    if (error) {
      setError(error.message)
    } else {
      // go to the invoice and print it automatically
      navigate(`/invoice/${data.id}?print=1`)
    }
  }

  return (
    <div>
      <PageTitle title="New Bill" subtitle="Tap products to add them. Press Enter in search to add the first match." />

      {error && (
        <div className="anim-pop mb-4 rounded-2xl border border-red-400/25 bg-red-500/10 text-red-300 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-4 items-start">
        {/* LEFT: products */}
        <Reveal delay={60} className="lg:col-span-3">
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

            <div className="mt-4 grid sm:grid-cols-2 gap-2 max-h-[62vh] overflow-y-auto pr-1">
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

        {/* RIGHT: current bill */}
        <Reveal delay={140} className="lg:col-span-2 lg:sticky lg:top-24">
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
              <div className="py-12 text-center">
                <ShoppingCart size={30} className="mx-auto text-white/20" />
                <p className="muted text-sm mt-3">No items yet. Tap a product to add it.</p>
              </div>
            ) : (
              <ul className="divide-y divide-white/5 max-h-[42vh] overflow-y-auto pr-1">
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

            {/* Total */}
            <div className="glass-accent mt-4 p-5">
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
                disabled={cart.length === 0 || saving}
                className="btn btn-lime flex-1 py-3 text-base"
              >
                <Printer size={17} />
                {saving ? 'Saving...' : 'Save & print'}
              </button>
            </div>
          </section>
        </Reveal>
      </div>
    </div>
  )
}
