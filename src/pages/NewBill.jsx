import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '../supabase'
 
export default function NewBill() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([]) // [{ product, qty }]
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
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
    setSuccess(null)
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
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">New Bill</h1>
 
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-4">
          Bill <b>{success.invoice_no}</b> saved. Total Rs. {Number(success.total).toFixed(2)}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>
      )}
 
      <div className="grid md:grid-cols-2 gap-4">
        {/* LEFT: product search */}
        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <input
            autoFocus
            placeholder="Search product by name or code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="max-h-[60vh] overflow-y-auto divide-y">
            {filtered.length === 0 && <p className="text-gray-500 text-sm py-3">No products found.</p>}
            {filtered.map(p => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={p.qty <= 0}
                className="w-full flex justify-between items-center py-3 px-2 text-left hover:bg-blue-50 rounded-lg disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <div>
                  <p className="font-medium text-gray-800">{p.name}</p>
                  <p className="text-xs text-gray-500">
                    {p.code || 'No code'} · Stock {p.qty}
                  </p>
                </div>
                <span className="text-sm font-medium">Rs. {Number(p.sell_price).toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>
 
        {/* RIGHT: cart */}
        <div className="bg-white rounded-xl shadow p-4 flex flex-col">
          <h2 className="font-bold text-gray-800 mb-3">Bill items</h2>
 
          {cart.length === 0 ? (
            <p className="text-gray-500 text-sm flex-1">Tap a product to add it.</p>
          ) : (
            <div className="flex-1 divide-y">
              {cart.map(i => (
                <div key={i.product.id} className="py-3 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{i.product.name}</p>
                    <p className="text-xs text-gray-500">Rs. {Number(i.product.sell_price).toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setQty(i.product.id, i.qty - 1)} className="w-8 h-8 border rounded-lg">−</button>
                    <input
                      type="number"
                      min="1"
                      value={i.qty}
                      onChange={e => setQty(i.product.id, e.target.value)}
                      className="w-14 text-center border rounded-lg py-1"
                    />
                    <button onClick={() => setQty(i.product.id, i.qty + 1)} className="w-8 h-8 border rounded-lg">+</button>
                  </div>
                  <span className="w-24 text-right font-medium">
                    {(Number(i.product.sell_price) * i.qty).toFixed(2)}
                  </span>
                  <button onClick={() => removeFromCart(i.product.id)} className="text-red-500 text-sm">✕</button>
                </div>
              ))}
            </div>
          )}
 
          <div className="border-t pt-4 mt-4 space-y-3">
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>Rs. {total.toFixed(2)}</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setCart([]); setError('') }}
                disabled={cart.length === 0}
                className="flex-1 border border-gray-300 rounded-lg py-2.5 hover:bg-gray-50 disabled:opacity-50"
              >
                Clear
              </button>
              <button
                onClick={saveBill}
                disabled={cart.length === 0 || saving}
                className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg py-2.5 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save bill'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}