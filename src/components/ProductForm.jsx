import { useState } from 'react'
import { supabase } from '../supabase'

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

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (Number(form.sell_price) < Number(form.cost_price)) {
      if (!confirm('Selling price is lower than cost price. Save anyway?')) return
    }

    setSaving(true)
    const data = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      cost_price: Number(form.cost_price) || 0,
      sell_price: Number(form.sell_price) || 0,
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

  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
  const label = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-800">{isEdit ? 'Edit product' : 'Add product'}</h2>

        <div>
          <label className={label}>Product name *</label>
          <input required className={input} value={form.name} onChange={e => update('name', e.target.value)} />
        </div>

        <div>
          <label className={label}>Code (optional)</label>
          <input className={input} value={form.code} onChange={e => update('code', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Cost price *</label>
            <input required type="number" min="0" step="0.01" className={input}
              value={form.cost_price} onChange={e => update('cost_price', e.target.value)} />
          </div>
          <div>
            <label className={label}>Selling price *</label>
            <input required type="number" min="0" step="0.01" className={input}
              value={form.sell_price} onChange={e => update('sell_price', e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {!isEdit && (
            <div>
              <label className={label}>Opening stock</label>
              <input type="number" min="0" className={input}
                value={form.qty} onChange={e => update('qty', e.target.value)} />
            </div>
          )}
          <div>
            <label className={label}>Low stock alert at</label>
            <input type="number" min="0" className={input}
              value={form.low_stock_level} onChange={e => update('low_stock_level', e.target.value)} />
          </div>
        </div>

        {isEdit && (
          <p className="text-xs text-gray-500">Current stock: {product.qty}. Use Stock in to add stock.</p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2 hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 disabled:opacity-60">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}