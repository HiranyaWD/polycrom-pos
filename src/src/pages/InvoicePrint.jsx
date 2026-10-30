import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router'
import { ArrowLeft, Printer } from 'lucide-react'
import { supabase } from '../supabase'

// Change to 'A4' if the client uses a normal A4 printer
const PAPER = '80mm'

// Edit these with the client's real details
const BUSINESS = {
  name: 'RMK Enterprises',
  sub: 'Polycrom Distributor',
  address: 'Your address here',
  phone: '07X XXX XXXX',
}

export default function InvoicePrint() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setInvoice(data)
      })
  }, [id])

  // Auto print when opened right after saving a bill
  useEffect(() => {
    if (!invoice || params.get('print') !== '1') return
    const timer = setTimeout(() => {
      window.print()
      navigate(`/invoice/${id}`, { replace: true }) // so refresh won't print again
    }, 300)
    return () => clearTimeout(timer)
  }, [invoice])

  if (error) return <p className="text-red-300">{error}</p>
  if (!invoice) return <div className="glass h-96 max-w-md mx-auto animate-pulse" />

  const isThermal = PAPER === '80mm'
  const cancelled = invoice.status === 'cancelled'

  return (
    <div>
      <style>
        {isThermal
          ? '@page { size: 80mm auto; margin: 0 }'
          : '@page { size: A4; margin: 12mm }'}
      </style>

      {/* Buttons, hidden when printing */}
      <div className="anim-fade-up flex flex-wrap items-center justify-between gap-3 mb-6 print:hidden">
        <div>
          <h1 className="text-4xl font-light tracking-tight">Invoice</h1>
          <p className="muted text-sm mt-1"># {invoice.invoice_no}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate(-1)} className="btn btn-ghost">
            <ArrowLeft size={16} /> Back
          </button>
          <button onClick={() => window.print()} className="btn btn-lime">
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      {/* The invoice */}
      <div
        className={`anim-pop bg-white text-black mx-auto shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] print:shadow-none print:animate-none ${
          isThermal
            ? 'w-[72mm] p-3 text-[11px] rounded-lg print:p-1 print:rounded-none'
            : 'max-w-2xl p-8 text-sm rounded-2xl print:p-0 print:rounded-none'
        }`}
      >
        <div className="text-center mb-3">
          <p className={`font-bold ${isThermal ? 'text-base' : 'text-2xl'}`}>{BUSINESS.name}</p>
          <p>{BUSINESS.sub}</p>
          <p>{BUSINESS.address}</p>
          <p>Tel: {BUSINESS.phone}</p>
        </div>

        {cancelled && (
          <p className="text-center font-bold border-2 border-black py-1 mb-2">CANCELLED</p>
        )}

        <div className="border-t border-b border-dashed border-black py-2 mb-2 flex justify-between">
          <span>Invoice: <b>{invoice.invoice_no}</b></span>
          <span>{new Date(invoice.created_at).toLocaleString()}</span>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-dashed border-black">
              <th className="text-left py-1">Item</th>
              <th className="text-right py-1">Qty</th>
              <th className="text-right py-1">Price</th>
              <th className="text-right py-1">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.invoice_items.map(item => (
              <tr key={item.id}>
                <td className="py-1 pr-1">{item.product_name}</td>
                <td className="text-right py-1">{item.qty}</td>
                <td className="text-right py-1">{Number(item.unit_price).toFixed(2)}</td>
                <td className="text-right py-1">{Number(item.line_total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-dashed border-black mt-2 pt-2 flex justify-between font-bold">
          <span>TOTAL</span>
          <span>Rs. {Number(invoice.total).toFixed(2)}</span>
        </div>

        <p className="text-center mt-4">Thank you!</p>
      </div>
    </div>
  )
}