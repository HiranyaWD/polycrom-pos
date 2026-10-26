import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { supabase } from '../supabase'

function dayKey(date) {
  const d = new Date(date)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [weekBills, setWeekBills] = useState([])
  const [recentBills, setRecentBills] = useState([])
  const [products, setProducts] = useState([])

  useEffect(() => {
    async function load() {
      // start of the day 6 days ago (local time) → last 7 days including today
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      start.setDate(start.getDate() - 6)

      const [week, recent, prods] = await Promise.all([
        supabase.from('invoices').select('id, total, created_at')
          .eq('status', 'paid')
          .gte('created_at', start.toISOString()),
        supabase.from('invoices').select('id, invoice_no, total, status, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('products').select('id, name, qty, low_stock_level')
          .eq('is_active', true),
      ])

      const firstError = week.error || recent.error || prods.error
      if (firstError) setError(firstError.message)
      else {
        setWeekBills(week.data)
        setRecentBills(recent.data)
        setProducts(prods.data)
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <p className="text-gray-500">Loading dashboard...</p>
  if (error) return <p className="text-red-600">{error}</p>

  // Today
  const todayKey = dayKey(new Date())
  const todayBills = weekBills.filter(b => dayKey(b.created_at) === todayKey)
  const todaySales = todayBills.reduce((s, b) => s + Number(b.total), 0)

  // Last 7 days chart data
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = dayKey(d)
    const total = weekBills
      .filter(b => dayKey(b.created_at) === key)
      .reduce((s, b) => s + Number(b.total), 0)
    days.push({ key, label: d.toLocaleDateString(undefined, { weekday: 'short' }), total })
  }
  const maxDay = Math.max(...days.map(d => d.total), 1)
  const weekTotal = days.reduce((s, d) => s + d.total, 0)

  // Low stock
  const lowStock = products
    .filter(p => p.qty <= p.low_stock_level)
    .sort((a, b) => a.qty - b.qty)

  const money = n => `Rs. ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <div className="flex gap-2">
          <button onClick={() => navigate('/new-bill')} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg">
            + New bill
          </button>
          <button onClick={() => navigate('/products')} className="flex-1 sm:flex-none bg-white border border-gray-300 hover:bg-gray-50 px-5 py-2.5 rounded-lg">
            Products
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label="Today's sales" value={money(todaySales)} />
        <Card label="Bills today" value={todayBills.length} />
        <Card label="Last 7 days" value={money(weekTotal)} />
        <Card
          label="Low stock items"
          value={lowStock.length}
          highlight={lowStock.length > 0}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* 7-day chart */}
        <div className="bg-white rounded-xl shadow p-4 lg:col-span-2">
          <h2 className="font-bold text-gray-800 mb-4">Sales, last 7 days</h2>
          <div className="flex items-end gap-2 h-48">
            {days.map(d => (
              <div key={d.key} className="flex-1 flex flex-col items-center justify-end h-full">
                <span className="text-[10px] text-gray-500 mb-1">
                  {d.total > 0 ? Math.round(d.total).toLocaleString() : ''}
                </span>
                <div
                  className={`w-full rounded-t-md ${d.key === todayKey ? 'bg-blue-600' : 'bg-blue-300'}`}
                  style={{ height: `${(d.total / maxDay) * 100}%`, minHeight: d.total > 0 ? 4 : 0 }}
                />
                <span className="text-xs text-gray-600 mt-2">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Low stock */}
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-gray-800">Low stock</h2>
            <Link to="/products" className="text-sm text-blue-600">View all</Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-gray-500">All products have enough stock.</p>
          ) : (
            <ul className="divide-y max-h-56 overflow-y-auto">
              {lowStock.map(p => (
                <li key={p.id} className="py-2 flex justify-between text-sm">
                  <span>{p.name}</span>
                  <span className={`font-medium ${p.qty === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                    {p.qty === 0 ? 'Out' : p.qty}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recent bills */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-gray-800">Recent bills</h2>
          <Link to="/bills" className="text-sm text-blue-600">View all</Link>
        </div>
        {recentBills.length === 0 ? (
          <p className="text-sm text-gray-500">No bills yet.</p>
        ) : (
          <ul className="divide-y">
            {recentBills.map(b => (
              <li key={b.id}>
                <button
                  onClick={() => navigate(`/invoice/${b.id}`)}
                  className={`w-full py-2.5 flex justify-between items-center text-sm text-left hover:bg-gray-50 px-1 rounded ${b.status === 'cancelled' ? 'text-gray-400 line-through' : ''}`}
                >
                  <span>
                    <span className="font-medium">{b.invoice_no}</span>
                    <span className="text-gray-500 ml-2 text-xs">{new Date(b.created_at).toLocaleString()}</span>
                  </span>
                  <span className="font-medium">{money(b.total)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Card({ label, value, highlight }) {
  return (
    <div className={`rounded-xl shadow p-4 ${highlight ? 'bg-amber-50 border border-amber-200' : 'bg-white'}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-xl font-bold mt-1 ${highlight ? 'text-amber-700' : 'text-gray-800'}`}>{value}</p>
    </div>
  )
}