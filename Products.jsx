import { useEffect, useState } from 'react'
import { Plus, Search, PackagePlus, Pencil, Trash2, Boxes, AlertTriangle, PackageX, Wallet } from 'lucide-react'
import { supabase } from '../supabase'
import ProductForm from '../components/ProductForm'
import StockInForm from '../components/StockInForm'
import { CountUp, Money, PageTitle, Reveal, StockChip } from '../components/ui'

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

  // Summary numbers
  const lowCount = products.filter(p => p.qty > 0 && p.qty <= p.low_stock_level).length
  const outCount = products.filter(p => p.qty === 0).length
  const stockValue = products.reduce((s, p) => s + Number(p.cost_price) * p.qty, 0)

  const iconBtn = 'w-8 h-8 rounded-full grid place-items-center border border-white/10 bg-white/5 transition'
  const iconBtnLg = 'w-10 h-10 rounded-full grid place-items-center border border-white/10 bg-white/5 transition'

  return (
    <div>
      <PageTitle title="Products" subtitle="Manage stock, prices and products">
        <button onClick={openAdd} className="btn btn-lime">
          <Plus size={16} /> Add product
        </button>
      </PageTitle>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Reveal delay={0} className="col-span-2 lg:col-span-1">
          <div className="glass-accent hover-lift p-5 h-full">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-accent uppercase tracking-wider">Stock value</p>
              <Wallet size={16} className="text-accent" />
            </div>
            <p className="text-3xl font-light tracking-tight mt-3"><CountUp value={stockValue} money /></p>
            <p className="text-xs text-white/55 mt-1">At cost price</p>
          </div>
        </Reveal>
        <Reveal delay={80}>
          <SummaryCard icon={Boxes} label="Products" value={products.length} />
        </Reveal>
        <Reveal delay={160}>
          <SummaryCard icon={AlertTriangle} label="Low stock" value={lowCount} tone="text-amber-300" />
        </Reveal>
        <Reveal delay={240} className="col-span-2 lg:col-span-1">
          <SummaryCard icon={PackageX} label="Out of stock" value={outCount} tone="text-red-300" />
        </Reveal>
      </div>

      {/* Search */}
      <Reveal delay={300} className="mt-6 mb-4">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            placeholder="Search by name or code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="field rounded-full pl-11"
          />
        </div>
      </Reveal>

      {error && <p className="text-red-300 text-sm mb-3">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="glass h-14 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass p-10 text-center anim-fade-up">
          <Boxes size={28} className="mx-auto text-white/30" />
          <p className="muted mt-3">{search ? 'No products match your search.' : 'No products yet. Add your first one.'}</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <Reveal delay={360} className="hidden md:block">
            <div className="glass overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-white/45 text-xs uppercase tracking-wider">
                    <th className="px-5 py-4 font-semibold">Product</th>
                    <th className="px-5 py-4 font-semibold text-right">Cost</th>
                    <th className="px-5 py-4 font-semibold text-right">Price</th>
                    <th className="px-5 py-4 font-semibold text-center">Stock</th>
                    <th className="px-5 py-4 font-semibold">Last updated</th>
                    <th className="px-5 py-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => (
                    <tr
                      key={p.id}
                      className="anim-fade-up border-t border-white/5 hover:bg-white/[0.04] transition-colors"
                      style={{ '--d': `${400 + Math.min(i, 12) * 40}ms` }}
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-semibold">{p.name}</p>
                        <p className="text-xs muted">{p.code || 'No code'}</p>
                      </td>
                      <td className="px-5 py-3.5 text-right text-white/60"><Money value={p.cost_price} /></td>
                      <td className="px-5 py-3.5 text-right font-semibold"><Money value={p.sell_price} /></td>
                      <td className="px-5 py-3.5 text-center"><StockChip qty={p.qty} low={p.low_stock_level} /></td>
                      <td className="px-5 py-3.5 text-white/50">{new Date(p.updated_at).toLocaleString()}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => setStockProduct(p)} title="Stock in" aria-label="Stock in"
                            className={`${iconBtn} hover:bg-accent hover:text-ink hover:border-accent`}>
                            <PackagePlus size={15} />
                          </button>
                          <button onClick={() => openEdit(p)} title="Edit" aria-label="Edit"
                            className={`${iconBtn} hover:bg-white/15`}>
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => removeProduct(p)} title="Remove" aria-label="Remove"
                            className={`${iconBtn} hover:bg-red-500/20 hover:text-red-300 hover:border-red-400/30`}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((p, i) => (
              <div key={p.id} className="glass p-4 anim-fade-up" style={{ '--d': `${360 + Math.min(i, 10) * 50}ms` }}>
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{p.name}</p>
                    <p className="text-xs muted">{p.code || 'No code'}</p>
                  </div>
                  <StockChip qty={p.qty} low={p.low_stock_level} />
                </div>
                <div className="mt-3 flex justify-between items-center">
                  <div>
                    <Money value={p.sell_price} className="text-lg font-semibold text-accent" />
                    <p className="text-[11px] muted">Updated {new Date(p.updated_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => setStockProduct(p)} aria-label="Stock in"
                      className={`w-10 h-10 rounded-full grid place-items-center border bg-accent/15 text-accent border-accent/30`}>
                      <PackagePlus size={16} />
                    </button>
                    <button onClick={() => openEdit(p)} aria-label="Edit" className={`${iconBtnLg}`}>
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => removeProduct(p)} aria-label="Remove" className={`${iconBtnLg} text-red-300`}>
                      <Trash2 size={15} />
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

function SummaryCard({ icon: Icon, label, value, tone = '' }) {
  return (
    <div className="glass hover-lift p-5 h-full">
      <div className="flex items-center justify-between">
        <p className="label mb-0">{label}</p>
        <span className="w-8 h-8 rounded-full bg-white/5 border border-white/10 grid place-items-center">
          <Icon size={15} className="text-white/70" />
        </span>
      </div>
      <p className={`text-3xl font-light tracking-tight mt-3 ${value > 0 ? tone : ''}`}>
        <CountUp value={value} />
      </p>
    </div>
  )
}