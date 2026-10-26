import { useState } from 'react'
import { supabase } from '../supabase'
 
export default function StockInForm({ product, onClose, onSaved }) {
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
 
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const amount = Number(qty)
    if (!Number.isInteger(amount) || amount <= 0) {
      setError('Enter a whole number more than 0')
      return
    }
 
    setSaving(true)
    const { error } = await supabase.rpc('add_stock', {
      p_product_id: product.id,
      p_qty: amount,
      p_note: note.trim() || null,
    })
    setSaving(false)
 
    if (error) setError(error.message)
    else onSaved()
  }
 
  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
  const label = 'block text-sm font-medium text-gray-700 mb-1'
  const newTotal = product.qty + (Number(qty) > 0 ? Number(qty) : 0)
 
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg w-full max-w-sm p-6 space-y-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Stock in</h2>
          <p className="text-sm text-gray-500">{product.name}</p>
        </div>
 
        <div className="flex justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
          <span>Current stock: <b>{product.qty}</b></span>
          <span>After: <b className="text-green-700">{newTotal}</b></span>
        </div>
 
        <div>
          <label className={label}>Quantity to add *</label>
          <input
            autoFocus
            required
            type="number"
            min="1"
            step="1"
            className={input}
            value={qty}
            onChange={e => setQty(e.target.value)}
          />
        </div>
 
        <div>
          <label className={label}>Note (optional)</label>
          <input
            placeholder="e.g. Invoice no, supplier"
            className={input}
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </div>
 
        {error && <p className="text-sm text-red-600">{error}</p>}
 
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2 hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-lg py-2 disabled:opacity-60">
            {saving ? 'Saving...' : 'Add stock'}
          </button>
        </div>
      </form>
    </div>
  )
}