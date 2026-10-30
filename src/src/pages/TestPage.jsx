import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState(null)
  const [products, setProducts] = useState([])
  const [bills, setBills] = useState([])
  const [message, setMessage] = useState('')

  const [selectedProduct, setSelectedProduct] = useState('')
  const [qty, setQty] = useState(1)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
    })
  }, [])

  useEffect(() => {
    if (user) {
      loadProducts()
      loadBills()
    }
  }, [user])

  async function handleLogin(e) {
    e.preventDefault()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMessage('Login failed: ' + error.message)
    else setUser(data.user)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
  }

  async function loadProducts() {
    const { data, error } = await supabase
      .from('products').select('*').eq('is_active', true).order('id')
    if (error) setMessage('Load products failed: ' + error.message)
    else setProducts(data)
  }

  async function loadBills() {
    const { data, error } = await supabase
      .from('invoices').select('*, invoice_items(*)')
      .order('created_at', { ascending: false })
    if (error) setMessage('Load bills failed: ' + error.message)
    else setBills(data)
  }

  async function addTestProduct() {
    const { error } = await supabase
      .from('products').insert({ name: 'Test item ' + Date.now() % 1000, sell_price: 100, qty: 10 })
    if (error) setMessage('Insert failed: ' + error.message)
    else { setMessage('Product added'); loadProducts() }
  }

  // ADD STOCK (+10 to selected product)
  async function addStock() {
    if (!selectedProduct) return setMessage('Pick a product first')
    const { error } = await supabase.rpc('add_stock', {
      p_product_id: Number(selectedProduct),
      p_qty: 10,
      p_note: 'Test stock in'
    })
    if (error) setMessage('Add stock failed: ' + error.message)
    else { setMessage('Added 10 to stock'); loadProducts() }
  }

  // CREATE BILL
  async function createBill() {
    if (!selectedProduct) return setMessage('Pick a product first')
    const { data, error } = await supabase.rpc('create_invoice', {
      p_items: [{ product_id: Number(selectedProduct), qty: Number(qty) }],
      p_shop_id: null
    })
    if (error) setMessage('Bill failed: ' + error.message)
    else {
      setMessage(`Bill ${data.invoice_no} saved. Total Rs. ${data.total}`)
      loadProducts()
      loadBills()
    }
  }

  // CANCEL BILL
  async function cancelBill(id) {
    const { error } = await supabase.rpc('cancel_invoice', { p_invoice_id: id })
    if (error) setMessage('Cancel failed: ' + error.message)
    else { setMessage('Bill cancelled, stock returned'); loadProducts(); loadBills() }
  }

  if (!user) {
    return (
      <form onSubmit={handleLogin} style={{ padding: 20 }}>
        <h2>Login</h2>
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} /><br />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} /><br />
        <button type="submit">Login</button>
        <p>{message}</p>
      </form>
    )
  }

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <p>Logged in as {user.email} <button onClick={handleLogout}>Logout</button></p>
      <p style={{ color: 'blue' }}><b>{message}</b></p>

      <h3>Products</h3>
      <button onClick={addTestProduct}>Add test product</button>
      <table border="1" cellPadding="6" style={{ marginTop: 10 }}>
        <thead><tr><th>ID</th><th>Name</th><th>Price</th><th>Qty</th><th>Updated</th></tr></thead>
        <tbody>
          {products.map(p => (
            <tr key={p.id}>
              <td>{p.id}</td><td>{p.name}</td><td>{p.sell_price}</td><td>{p.qty}</td>
              <td>{new Date(p.updated_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Stock in / New bill</h3>
      <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
        <option value="">-- pick product --</option>
        {products.map(p => (
          <option key={p.id} value={p.id}>{p.name} (stock {p.qty})</option>
        ))}
      </select>{' '}
      Qty: <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} style={{ width: 60 }} />{' '}
      <button onClick={createBill}>Create bill</button>{' '}
      <button onClick={addStock}>Add 10 stock</button>

      <h3>Bill history</h3>
      <table border="1" cellPadding="6">
        <thead><tr><th>No</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {bills.map(b => (
            <tr key={b.id}>
              <td>{b.invoice_no}</td>
              <td>{new Date(b.created_at).toLocaleString()}</td>
              <td>{b.invoice_items.map(i => `${i.product_name} x${i.qty}`).join(', ')}</td>
              <td>{b.total}</td>
              <td>{b.status}</td>
              <td>{b.status === 'paid' && <button onClick={() => cancelBill(b.id)}>Cancel</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}