import { useEffect, useState } from 'react'
import { Plus, Pencil, Tags, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../supabase'
import { Modal, Reveal } from './ui'

// Owner-managed product categories (add, rename, hide). Shown on the Settings page.
export default function CategoriesPanel() {
  const [categories, setCategories] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null) // { category? }
  const [showHidden, setShowHidden] = useState(false)

  async function load() {
    const [c, p] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('products').select('category_id').eq('is_active', true),
    ])
    setLoading(false)
    const err = c.error || p.error
    if (err) { setError(err.message); return }
    setCategories(c.data)
    const map = {}
    for (const row of p.data) {
      if (row.category_id != null) map[row.category_id] = (map[row.category_id] ?? 0) + 1
    }
    setCounts(map)
  }

  useEffect(() => { load() }, [])

  const shown = categories.filter(c => showHidden || c.is_active)

  return (
    <Reveal delay={0}>
      <section className="glass p-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Tags size={18} className="text-accent" /> Product categories
          </h2>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs muted cursor-pointer">
              <input type="checkbox" checked={showHidden} onChange={e => setShowHidden(e.target.checked)} />
              Show hidden
            </label>
            <button onClick={() => setModal({})} className="btn btn-lime">
              <Plus size={15} /> Add category
            </button>
          </div>
        </div>

        {error && <p className="text-red-300 text-sm mb-3">{error}</p>}

        {loading ? (
          <div className="h-20 animate-pulse rounded-2xl bg-white/5" />
        ) : shown.length === 0 ? (
          <p className="muted text-sm py-4 text-center">No categories yet. Add your first one.</p>
        ) : (
          <ul className="grid sm:grid-cols-3 gap-2">
            {shown.map(c => {
              const n = counts[c.id] ?? 0
              return (
                <li
                  key={c.id}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                    c.is_active ? 'bg-white/[0.04] border-white/10' : 'bg-white/[0.02] border-white/5 opacity-60'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">
                      {c.name}
                      {!c.is_active && <span className="chip bg-white/10 text-white/60 ml-2 align-middle">Hidden</span>}
                    </p>
                    <p className="text-xs muted">{n} product{n === 1 ? '' : 's'}</p>
                  </div>
                  <button
                    onClick={() => setModal({ category: c })}
                    aria-label={`Edit ${c.name}`}
                    className="w-9 h-9 shrink-0 rounded-full grid place-items-center bg-white/5 border border-white/10 hover:bg-white/15 transition"
                  >
                    {c.is_active ? <Pencil size={14} /> : <Eye size={14} />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {modal && (
          <CategoryForm
            category={modal.category}
            onClose={() => setModal(null)}
            onSaved={() => { setModal(null); load() }}
          />
        )}
      </section>
    </Reveal>
  )
}

function CategoryForm({ category, onClose, onSaved }) {
  const isEdit = !!category
  const [name, setName] = useState(category?.name ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const clean = name.trim()
    if (!clean) { setError('Enter a category name'); return }

    setSaving(true)
    const { error } = isEdit
      ? await supabase.from('categories').update({ name: clean }).eq('id', category.id)
      : await supabase.from('categories').insert({ name: clean })
    setSaving(false)

    if (error) setError(error.code === '23505' ? 'A category with this name already exists' : error.message)
    else onSaved()
  }

  // Hides the category. Products keep it, and it stops appearing as a choice.
  async function toggleHidden() {
    const hide = category.is_active
    if (hide && !confirm(`Hide "${category.name}"?\n\nIt will no longer appear as a choice for new products or on the bill buttons. Existing products keep it.`)) return

    setSaving(true)
    setError('')
    const { error } = await supabase.from('categories').update({ is_active: !hide }).eq('id', category.id)
    setSaving(false)

    if (error) setError(error.message)
    else onSaved()
  }

  return (
    <Modal onClose={onClose} className="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-light tracking-tight">{isEdit ? 'Edit category' : 'Add category'}</h2>
            <p className="text-sm muted">Products are grouped by category on the bill screen</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="w-9 h-9 rounded-full bg-white/5 border border-white/10 grid place-items-center hover:bg-white/10">
            ×
          </button>
        </div>

        <div>
          <label className="label">Category name *</label>
          <input autoFocus required className="field" value={name} onChange={e => setName(e.target.value)} />
        </div>

        {error && <p className="text-sm text-red-300">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-lime flex-1">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {isEdit && (
          <div className="border-t border-white/10 pt-4">
            <button type="button" onClick={toggleHidden} disabled={saving} className="btn btn-ghost w-full">
              {category.is_active ? <><EyeOff size={15} /> Hide category</> : <><Eye size={15} /> Show category again</>}
            </button>
          </div>
        )}
      </form>
    </Modal>
  )
}