import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Pencil, Route as RouteIcon, Store, EyeOff, Eye } from 'lucide-react'
import { supabase } from '../supabase'
import { Modal, Money, PageTitle, Reveal } from '../components/ui'
import CategoriesPanel from '../components/CategoriesPanel'

// Settings: routes (delivery areas) and the shops on each route
export default function Settings() {
  const [routes, setRoutes] = useState([])
  const [shops, setShops] = useState([])
  const [balances, setBalances] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [routeFilter, setRouteFilter] = useState('') // '' = all, 'none' = no route, otherwise a route id
  const [showHidden, setShowHidden] = useState(false)

  const [routeModal, setRouteModal] = useState(null) // { route? }
  const [shopModal, setShopModal] = useState(null)   // { shop?, routeId? }

  async function load() {
    const [r, s, b] = await Promise.all([
      supabase.from('routes').select('*').order('name'),
      supabase.from('shops').select('*').order('name'),
      supabase.from('shop_balances').select('*'),
    ])
    setLoading(false)
    const err = r.error || s.error || b.error
    if (err) { setError(err.message); return }
    setRoutes(r.data)
    setShops(s.data)
    setBalances(Object.fromEntries(b.data.map(x => [x.shop_id, Number(x.balance)])))
  }

  useEffect(() => { load() }, [])

  const routeName = id => routes.find(r => r.id === id)?.name ?? ''
  const shopCount = id => shops.filter(s => s.route_id === id && s.is_active).length
  const unassignedCount = shops.filter(s => s.is_active && s.route_id == null).length

  const visibleShops = useMemo(() => {
    const q = search.trim().toLowerCase()
    return shops.filter(s => {
      if (!showHidden && !s.is_active) return false
      if (routeFilter === 'none' && s.route_id != null) return false
      if (routeFilter && routeFilter !== 'none' && String(s.route_id) !== routeFilter) return false
      if (!q) return true
      return (
        s.name.toLowerCase().includes(q) ||
        (s.phone ?? '').toLowerCase().includes(q) ||
        routeName(s.route_id).toLowerCase().includes(q)
      )
    })
  }, [shops, routes, search, routeFilter, showHidden])

  const totalOwed = visibleShops.reduce((sum, s) => sum + (balances[s.id] ?? 0), 0)

  return (
    <div>
      <PageTitle title="Settings" subtitle="Routes and shops. Every bill is made for one shop." />

      {error && <p className="text-red-300 text-sm mb-4">{error}</p>}

      <div className="grid lg:grid-cols-5 gap-4 items-start">
        {/* LEFT: routes */}
        <Reveal delay={60} className="lg:col-span-2">
          <section className="glass p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-medium flex items-center gap-2">
                <RouteIcon size={18} className="text-accent" /> Routes
              </h2>
              <button onClick={() => setRouteModal({})} className="btn btn-lime">
                <Plus size={15} /> Add route
              </button>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map(i => <div key={i} className="glass h-14 animate-pulse" />)}
              </div>
            ) : routes.length === 0 ? (
              <p className="muted text-sm py-6 text-center">No routes yet. Add your first route.</p>
            ) : (
              <ul className="space-y-2">
                {routes.map(r => {
                  const count = shopCount(r.id)
                  return (
                    <li key={r.id}
                      className="flex items-center gap-2 rounded-2xl bg-white/[0.04] border border-white/10 pl-4 pr-2 py-2.5">
                      <button
                        onClick={() => setRouteFilter(String(r.id))}
                        className="flex-1 min-w-0 text-left"
                        title="Show this route's shops"
                      >
                        <p className="font-semibold truncate">{r.name}</p>
                        <p className="text-xs muted">
                          {r.code || 'No code'} · {count} shop{count === 1 ? '' : 's'}
                        </p>
                      </button>
                      <button
                        onClick={() => setShopModal({ routeId: r.id })}
                        aria-label={`Add shop to ${r.name}`}
                        title="Add shop to this route"
                        className="w-9 h-9 shrink-0 rounded-full grid place-items-center bg-accent/15 text-accent border border-accent/30 hover:bg-accent hover:text-ink transition"
                      >
                        <Plus size={15} />
                      </button>
                      <button
                        onClick={() => setRouteModal({ route: r })}
                        aria-label={`Rename ${r.name}`}
                        title="Rename route"
                        className="w-9 h-9 shrink-0 rounded-full grid place-items-center bg-white/5 border border-white/10 hover:bg-white/15 transition"
                      >
                        <Pencil size={14} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {unassignedCount > 0 && (
              <p className="text-xs text-amber-300 mt-4">
                {unassignedCount} shop{unassignedCount === 1 ? ' has' : 's have'} no route. Edit {unassignedCount === 1 ? 'it' : 'them'} and choose a route.
              </p>
            )}
          </section>
        </Reveal>

        {/* RIGHT: shops */}
        <Reveal delay={140} className="lg:col-span-3">
          <section className="glass p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-medium flex items-center gap-2">
                <Store size={18} className="text-accent" /> Shops
              </h2>
              <button
                onClick={() => setShopModal({})}
                disabled={routes.length === 0}
                className="btn btn-lime"
                title={routes.length === 0 ? 'Add a route first' : 'Add shop'}
              >
                <Plus size={15} /> Add shop
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-2">
              <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  placeholder="Search shop, phone or route..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="field rounded-full pl-11"
                />
              </div>
              <select
                value={routeFilter}
                onChange={e => setRouteFilter(e.target.value)}
                className="field rounded-full"
              >
                <option value="">All routes</option>
                {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                <option value="none">No route</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-3 text-xs muted mt-3 mb-3 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showHidden} onChange={e => setShowHidden(e.target.checked)} />
                Show hidden shops
              </label>
              <span>
                {visibleShops.length} shown · owed <Money value={totalOwed} className="text-white/80" />
              </span>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map(i => <div key={i} className="glass h-16 animate-pulse" />)}
              </div>
            ) : visibleShops.length === 0 ? (
              <p className="muted text-sm py-8 text-center">
                {shops.length === 0 ? 'No shops yet. Add your first shop.' : 'No shops match these filters.'}
              </p>
            ) : (
              <ul className="space-y-2 max-h-[62vh] overflow-y-auto pr-1">
                {visibleShops.map(s => {
                  const owed = balances[s.id] ?? 0
                  return (
                    <li
                      key={s.id}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                        s.is_active ? 'bg-white/[0.04] border-white/10' : 'bg-white/[0.02] border-white/5 opacity-60'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">
                          {s.name}
                          {!s.is_active && <span className="chip bg-white/10 text-white/60 ml-2 align-middle">Hidden</span>}
                        </p>
                        <p className="text-xs muted truncate">
                          {routeName(s.route_id) || 'No route'} · {s.phone || 'No phone'}
                        </p>
                      </div>
                      <div className="text-right text-sm shrink-0">
                        <p className={owed > 0 ? 'text-amber-300 font-semibold' : 'text-white/60'}>
                          <Money value={owed} />
                        </p>
                        <p className="text-[11px] muted">
                          {s.credit_limit ? <>Limit <Money value={s.credit_limit} /></> : 'No credit limit'}
                        </p>
                      </div>
                      <button
                        onClick={() => setShopModal({ shop: s })}
                        aria-label={`Edit ${s.name}`}
                        className="w-9 h-9 shrink-0 rounded-full grid place-items-center bg-white/5 border border-white/10 hover:bg-white/15 transition"
                      >
                        {s.is_active ? <Pencil size={14} /> : <Eye size={14} />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </Reveal>
      </div>

      <div className="mt-4">
        <CategoriesPanel />
      </div>

      {routeModal && (
        <RouteForm
          route={routeModal.route}
          onClose={() => setRouteModal(null)}
          onSaved={() => { setRouteModal(null); load() }}
        />
      )}

      {shopModal && (
        <ShopForm
          shop={shopModal.shop}
          presetRouteId={shopModal.routeId}
          routes={routes}
          onClose={() => setShopModal(null)}
          onSaved={() => { setShopModal(null); load() }}
        />
      )}
    </div>
  )
}

// Add or rename a route
function RouteForm({ route, onClose, onSaved }) {
  const isEdit = !!route
  const [name, setName] = useState(route?.name ?? '')
  const [code, setCode] = useState(route?.code ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const data = { name: name.trim(), code: code.trim() || null }
    if (!data.name) { setError('Enter a route name'); return }

    setSaving(true)
    const { error } = isEdit
      ? await supabase.from('routes').update(data).eq('id', route.id)
      : await supabase.from('routes').insert(data)
    setSaving(false)

    if (error) setError(error.code === '23505' ? 'A route with this name already exists' : error.message)
    else onSaved()
  }

  return (
    <Modal onClose={onClose} className="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-light tracking-tight">{isEdit ? 'Rename route' : 'Add route'}</h2>
            <p className="text-sm muted">Delivery area, e.g. Kandy, Colombo</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="w-9 h-9 rounded-full bg-white/5 border border-white/10 grid place-items-center hover:bg-white/10">
            ×
          </button>
        </div>

        <div>
          <label className="label">Route name *</label>
          <input autoFocus required className="field" value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div>
          <label className="label">Code (optional)</label>
          <input className="field" value={code} onChange={e => setCode(e.target.value)} />
        </div>

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

// Add or edit a shop. Every shop must have a route.
function ShopForm({ shop, presetRouteId, routes, onClose, onSaved }) {
  const isEdit = !!shop
  const [form, setForm] = useState({
    name: shop?.name ?? '',
    route_id: shop?.route_id != null ? String(shop.route_id) : presetRouteId ? String(presetRouteId) : '',
    phone: shop?.phone ?? '',
    address: shop?.address ?? '',
    credit_limit: shop?.credit_limit ?? '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const name = form.name.trim()
    if (!name) { setError('Enter the shop name'); return }
    if (!form.route_id) { setError('Choose a route. Every shop needs one.'); return }

    const limit = form.credit_limit === '' ? null : Number(form.credit_limit)
    if (limit !== null && (Number.isNaN(limit) || limit < 0)) {
      setError('Credit limit must be 0 or more, or left empty for no limit')
      return
    }

    const data = {
      name,
      route_id: Number(form.route_id),
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      credit_limit: limit,
    }

    setSaving(true)
    const { error } = isEdit
      ? await supabase.from('shops').update(data).eq('id', shop.id)
      : await supabase.from('shops').insert(data)
    setSaving(false)

    if (error) setError(error.message)
    else onSaved()
  }

  // Hides or shows the shop. Nothing is deleted, so old bills keep working.
  async function toggleHidden() {
    const hide = shop.is_active
    if (hide && !confirm(`Hide "${shop.name}"?\n\nIt will be removed from the shop list for new bills. Old bills still show it. You can show it again later.`)) return

    setSaving(true)
    setError('')
    const { error } = await supabase.from('shops').update({ is_active: !hide }).eq('id', shop.id)
    setSaving(false)

    if (error) setError(error.message)
    else onSaved()
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-light tracking-tight">{isEdit ? 'Edit shop' : 'Add shop'}</h2>
            <p className="text-sm muted">{isEdit ? shop.name : 'Every shop belongs to one route'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="w-9 h-9 rounded-full bg-white/5 border border-white/10 grid place-items-center hover:bg-white/10">
            ×
          </button>
        </div>

        <div>
          <label className="label">Shop name *</label>
          <input autoFocus required className="field" value={form.name} onChange={e => update('name', e.target.value)} />
        </div>

        <div>
          <label className="label">Route *</label>
          <select required className="field" value={form.route_id} onChange={e => update('route_id', e.target.value)}>
            <option value="">Choose a route</option>
            {routes.map(r => (
              <option key={r.id} value={r.id}>
                {r.name}{r.is_active ? '' : ' (hidden)'}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Phone</label>
            <input className="field" value={form.phone} onChange={e => update('phone', e.target.value)} />
          </div>
          <div>
            <label className="label">Credit limit</label>
            <input type="number" min="0" step="0.01" className="field" placeholder="No limit"
              value={form.credit_limit} onChange={e => update('credit_limit', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Address</label>
          <input className="field" value={form.address} onChange={e => update('address', e.target.value)} />
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
              {shop.is_active ? <><EyeOff size={15} /> Hide shop</> : <><Eye size={15} /> Show shop again</>}
            </button>
          </div>
        )}
      </form>
    </Modal>
  )
}