import { useEffect, useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { supabase } from '../supabase'
import { Modal } from './ui'

export default function ProductForm({ product, onClose, onSaved, onRemoved }) {
  const isEdit = !!product
  const [form, setForm] = useState({
    name: product?.name ?? '',
    code: product?.code ?? '',
    category_id: product?.category_id != null ? String(product.category_id) : '',
    cost_price: product?.cost_price ?? '',
    sell_price: product?.sell_price ?? '',
    low_stock_level: product?.low_stock_level ?? 5,
    qty: 0,
  })
  const [categories, setCategories] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('categories').select('*').order('name')
      .then(({ data }) => setCategories(data ?? []))
  }, [])

  // Active categories, plus the product's current one even if it is hidden
  const choices = categories.filter(c => c.is_active || String(c.id) === form.category_id)

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  const cost = Number(form.cost_price) || 0
  const price = Number(form.sell_price) || 0
  const margin = price - cost

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.category_id) {
      setError('Choose a category')
      return
    }

    if (price < cost) {
      if (!confirm('Selling price is lower than cost price. Save anyway?')) return
    }

    setSaving(true)
    const data = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      category_id: Number(form.category_id),
      cost_price: cost,
      sell_price: price,
      low_stock_level: Number(form.low_stock_level) || 0,
    }

    let result
    if (isEdit) {
      result = await supabase.from('products').update(data).eq('id', product.id)
    } else {
      result = await supabase.from('products').insert(data).select().single()
      // log opening stock through add_stock so it appears in stock history
      if (!result.error && Number(form.qty) > 0) {
        const stock = await supabase.rpc('add_stock', {
          p_product_id: result.data.id,
          p_qty: Number(form.qty),
          p_note: 'Opening stock',
        })
        if (stock.error) result = stock
      }
    }

    setSaving(false)
    if (result.error) {
      setError(result.error.code === '23505' ? 'This product code is already used' : result.error.message)
    } else {
      onSaved()
    }
  }

  // Hides the product (nothing is deleted, so old bills keep working)
  async function removeProduct() {
    if (!confirm(`Remove "${product.name}"?\n\nIt will be hidden from the product list and new bills. Old bills will still show it.`)) return
    setSaving(true)
    setError('')
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', product.id)
    setSaving(false)
    if (error) setError(error.message)
    else onRemoved?.()
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-light tracking-tight">{isEdit ? 'Edit product' : 'Add product'}</h2>
            <p className="text-sm muted">{isEdit ? product.name : 'Fill in the product details'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="w-9 h-9 rounded-full bg-white/5 border border-white/10 grid place-items-center hover:bg-white/10">
            <X size={16} />
          </button>
        </div>

        <div>
          <label className="label">Product name *</label>
          <input required autoFocus className="field" value={form.name} onChange={e => update('name', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Code (optional)</label>
            <input className="field" value={form.code} onChange={e => update('code', e.target.value)} />
          </div>
          <div>
            <label className="label">Category *</label>
            <select required className="field" value={form.category_id} onChange={e => update('category_id', e.target.value)}>
              <option value="">Choose a category</option>
              {choices.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.is_active ? '' : ' (hidden)'}</option>
              ))}
            </select>
            {categories.length === 0 && (
              <p className="text-[11px] text-amber-300 mt-1">No categories yet. Add them in Settings first.</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Cost price *</label>
            <input required type="number" min="0" step="0.01" className="field"
              value={form.cost_price} onChange={e => update('cost_price', e.target.value)} />
          </div>
          <div>
            <label className="label">Selling price *</label>
            <input required type="number" min="0" step="0.01" className="field"
              value={form.sell_price} onChange={e => update('sell_price', e.target.value)} />
          </div>
        </div>

        {/* Live margin preview */}
        {(cost > 0 || price > 0) && (
          <div className={`flex justify-between text-sm rounded-2xl px-4 py-2.5 border ${
            margin >= 0 ? 'bg-accent/10 border-accent/25 text-accent' : 'bg-red-500/10 border-red-400/25 text-red-300'
          }`}>
            <span>Profit per item</span>
            <span className="font-semibold">
              Rs. {margin.toFixed(2)}{cost > 0 && ` (${((margin / cost) * 100).toFixed(0)}%)`}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {!isEdit && (
            <div>
              <label className="label">Opening stock</label>
              <input type="number" min="0" className="field"
                value={form.qty} onChange={e => update('qty', e.target.value)} />
            </div>
          )}
          <div>
            <label className="label">Low stock alert at</label>
            <input type="number" min="0" className="field"
              value={form.low_stock_level} onChange={e => update('low_stock_level', e.target.value)} />
          </div>
        </div>

        {isEdit && (
          <p className="text-xs muted">Current stock: {product.qty}. Use Stock in to add stock.</p>
        )}

        {error && <p className="text-sm text-red-300">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-lime flex-1">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {/* Remove lives here, only in edit mode, away from Save */}
        {isEdit && (
          <div className="border-t border-white/10 pt-4">
            <button type="button" onClick={removeProduct} disabled={saving} className="btn btn-danger w-full">
              <Trash2 size={15} /> Remove product
            </button>
          </div>
        )}
      </form>
    </Modal>
  )
}