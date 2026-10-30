import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../supabase'
import { Modal } from './ui'

export default function ProductForm({ product, onClose, onSaved }) {
  const isEdit = !!product
  const [form, setForm] = useState({
    name: product?.name ?? '',
    code: product?.code ?? '',
    cost_price: product?.cost_price ?? '',
    sell_price: product?.sell_price ?? '',
    low_stock_level: product?.low_stock_level ?? 5,
    qty: 0,
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  const cost = Number(form.cost_price) || 0
  const price = Number(form.sell_price) || 0
  const margin = price - cost

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (price < cost) {
      if (!confirm('Selling price is lower than cost price. Save anyway?')) return
    }

    setSaving(true)
    const data = {
      name: form.name.trim(),
      code: form.code.trim() || null,
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

        <div>
          <label className="label">Code (optional)</label>
          <input className="field" value={form.code} onChange={e => update('code', e.target.value)} />
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
      </form>
    </Modal>
  )
}