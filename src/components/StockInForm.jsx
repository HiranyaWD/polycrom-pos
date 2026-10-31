import { useState } from 'react'
import { X, ArrowRight } from 'lucide-react'
import { supabase } from '../supabase'
import { Modal } from './ui'

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

  const added = Number(qty) > 0 ? Number(qty) : 0
  const newTotal = product.qty + added

  return (
    <Modal onClose={onClose} className="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-light tracking-tight">Stock in</h2>
            <p className="text-sm muted">{product.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="w-9 h-9 rounded-full bg-white/5 border border-white/10 grid place-items-center hover:bg-white/10">
            <X size={16} />
          </button>
        </div>

        {/* Before → after */}
        <div className="flex items-center justify-between rounded-2xl bg-white/[0.04] border border-white/10 px-5 py-4">
          <div>
            <p className="label mb-0">Current</p>
            <p className="text-3xl font-light">{product.qty}</p>
          </div>
          <ArrowRight size={18} className={added ? 'text-accent' : 'text-white/30'} />
          <div className="text-right">
            <p className="label mb-0">After</p>
            <p className={`text-3xl font-light transition-colors ${added ? 'text-accent' : ''}`}>{newTotal}</p>
          </div>
        </div>

        <div>
          <label className="label">Quantity to add *</label>
          <input autoFocus required type="number" min="1" step="1" className="field text-lg"
            value={qty} onChange={e => setQty(e.target.value)} />
        </div>

        <div>
          <label className="label">Note (optional)</label>
          <input placeholder="e.g. Invoice no, supplier" className="field"
            value={note} onChange={e => setNote(e.target.value)} />
        </div>

        {error && <p className="text-sm text-red-300">{error}</p>}

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-lime flex-1">
            {saving ? 'Saving...' : `Add ${added || ''} stock`}
          </button>
        </div>
      </form>
    </Modal>
  )
}
