import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '../supabase'
 
function todayStr() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function Bills() {
  const navigate = useNavigate()
  const [bills, setBills] = useState([])
  const [from, setFrom] = useState(todayStr())
  const [to, setTo] = useState(todayStr())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
 
  async function loadBills() {
    setLoading(true)
    setError('')
 
    // start of "from" day and start of the day after "to", in local time
    const start = new Date(from + 'T00:00:00')
    const end = new Date(to + 'T00:00:00')
    end.setDate(end.getDate() + 1)
 
    const { data, error } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())
      .order('created_at', { ascending: false })
 
    setLoading(false)
    if (error) setError(error.message)
    else setBills(data)
  }
 
  useEffect(() => { loadBills() }, [from, to])
 
  async function cancelBill(bill) {
    if (!confirm(`Cancel bill ${bill.invoice_no}?\n\nStock will be returned. This cannot be undone.`)) return
    const { error } = await supabase.rpc('cancel_invoice', { p_invoice_id: bill.id })
    if (error) setError(error.message)
    else loadBills()
  }
 
  const filtered = bills.filter(b =>
    b.invoice_no.toLowerCase().includes(search.toLowerCase())
  )
 
  const paid = filtered.filter(b => b.status === 'paid')
  const paidTotal = paid.reduce((sum, b) => sum + Number(b.total), 0)
 
  const input = 'border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
 
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Bills</h1>
 
      {/* Filters */}
      <div className="bg-white rounded-xl shadow p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className={`w-full ${input}`} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} className={`w-full ${input}`} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Search</label>
          <input placeholder="Invoice no, e.g. PC-000012" value={search} onChange={e => setSearch(e.target.value)} className={`w-full ${input}`} />
        </div>
      </div>
 
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-gray-500">Bills (paid)</p>
          <p className="text-2xl font-bold">{paid.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-gray-500">Total sales</p>
          <p className="text-2xl font-bold">Rs. {paidTotal.toFixed(2)}</p>
        </div>
      </div>
 
      {error && <p className="text-red-600 text-sm">{error}</p>}
 
      {loading ? (
        <p className="text-gray-500">Loading bills...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500">No bills for these dates.</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-left">
                <tr>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id} className={`border-t ${b.status === 'cancelled' ? 'text-gray-400' : ''}`}>
                    <td className="px-4 py-3 font-medium">{b.invoice_no}</td>
                    <td className="px-4 py-3">{new Date(b.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3">{b.invoice_items.reduce((s, i) => s + i.qty, 0)} items</td>
                    <td className="px-4 py-3 text-right">{Number(b.total).toFixed(2)}</td>
                    <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => navigate(`/invoice/${b.id}`)} className="text-blue-600 hover:underline mr-3">
                        View
                      </button>
                      {b.status === 'paid' && (
                        <button onClick={() => cancelBill(b)} className="text-red-600 hover:underline">
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
 
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(b => (
              <div key={b.id} className={`bg-white rounded-xl shadow p-4 ${b.status === 'cancelled' ? 'opacity-60' : ''}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{b.invoice_no}</p>
                    <p className="text-xs text-gray-500">{new Date(b.created_at).toLocaleString()}</p>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
                <div className="mt-2 flex justify-between items-center text-sm">
                  <span className="font-bold">Rs. {Number(b.total).toFixed(2)}</span>
                  <div className="flex gap-3">
                    <button onClick={() => navigate(`/invoice/${b.id}`)} className="text-blue-600">View</button>
                    {b.status === 'paid' && (
                      <button onClick={() => cancelBill(b)} className="text-red-600">Cancel</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
 
function StatusBadge({ status }) {
  return (
    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
      status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    }`}>
      {status === 'paid' ? 'Paid' : 'Cancelled'}
    </span>
  )
}