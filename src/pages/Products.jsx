import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import ProductForm from '../components/ProductForm'
import StockInForm from '../components/StockInForm'
 
export default function Products() {
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [stockProduct, setStockProduct] = useState(null)
 
  function openAdd() { setEditing(null); setFormOpen(true) }
  function openEdit(p) { setEditing(p); setFormOpen(true) }
 
  async function removeProduct(p) {
    if (!confirm(`Remove "${p.name}"?\n\nIt will be hidden from the product list and new bills. Old bills will still show it.`)) return
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', p.id)
    if (error) setError(error.message)
    else loadProducts()
  }
 
  async function loadProducts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name')
    setLoading(false)
    if (error) setError(error.message)
    else setProducts(data)
  }
 
  useEffect(() => { loadProducts() }, [])
 
  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.code ?? '').toLowerCase().includes(search.toLowerCase())
  )
 
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Products</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <input
            placeholder="Search by name or code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 sm:w-72 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={openAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg whitespace-nowrap"
          >
            + Add
          </button>
        </div>
      </div>
 
      {error && <p className="text-red-600 text-sm">{error}</p>}
 
      {loading ? (
        <p className="text-gray-500">Loading products...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500">No products found.</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-left">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3 text-right">Cost</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3">Last updated</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-3 text-gray-500">{p.code || '-'}</td>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-right">{Number(p.cost_price).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">{Number(p.sell_price).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <StockBadge qty={p.qty} low={p.low_stock_level} />
                    </td>
                    <td className="px-4 py-3 text-gray-500">{new Date(p.updated_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => setStockProduct(p)} className="text-green-600 hover:underline mr-3">
                        + Stock
                      </button>
                      <button onClick={() => openEdit(p)} className="text-blue-600 hover:underline mr-3">
                        Edit
                      </button>
                      <button onClick={() => removeProduct(p)} className="text-red-600 hover:underline">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
 
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(p => (
              <div key={p.id} className="bg-white rounded-xl shadow p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.code || 'No code'}</p>
                  </div>
                  <StockBadge qty={p.qty} low={p.low_stock_level} />
                </div>
                <div className="mt-2 text-sm text-gray-600 flex justify-between items-center">
                  <span>Rs. {Number(p.sell_price).toFixed(2)}</span>
                  <span className="text-xs">{new Date(p.updated_at).toLocaleDateString()}</span>
                  <div className="flex gap-3">
                    <button onClick={() => setStockProduct(p)} className="text-green-600 text-sm">
                      + Stock
                    </button>
                    <button onClick={() => openEdit(p)} className="text-blue-600 text-sm">
                      Edit
                    </button>
                    <button onClick={() => removeProduct(p)} className="text-red-600 text-sm">
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
 
      {formOpen && (
        <ProductForm
          product={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); loadProducts() }}
        />
      )}
 
      {stockProduct && (
        <StockInForm
          product={stockProduct}
          onClose={() => setStockProduct(null)}
          onSaved={() => { setStockProduct(null); loadProducts() }}
        />
      )}
    </div>
  )
}
 
function StockBadge({ qty, low }) {
  const isLow = qty <= low
  return (
    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
      qty === 0 ? 'bg-red-100 text-red-700'
      : isLow ? 'bg-amber-100 text-amber-700'
      : 'bg-green-100 text-green-700'
    }`}>
      {qty}
    </span>
  )
}
 