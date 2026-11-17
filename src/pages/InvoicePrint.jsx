import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router'
import { ArrowLeft, Printer } from 'lucide-react'
import { supabase } from '../supabase'

// Business details printed at the top of every bill (from the client's template)
const BUSINESS = {
  name: 'R M K ENTERPRISES',
  address: 'NO 164/2 A,-KOSHENA ROAD, BRAHMANAGAMA,PANNIPITIYA.',
  tel: '0751876085',
  taxReg: 'No',
  salesperson: 'W.K SAMEERA',
}

const money = n =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function Row({ label, value, bold = false }) {
  return (
    <div className={`flex justify-between gap-6 ${bold ? 'font-bold' : ''}`}>
      <span>{label}</span>
      <span className="tabular-nums text-right">{value}</span>
    </div>
  )
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
      .select('*, invoice_items(*, products(code)), shops(address)')
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

  const cancelled = invoice.status === 'cancelled'
  const isCredit = invoice.payment_type === 'credit'

  // Older bills (before discounts) have no subtotal, so use the total
  const subtotal = Number(invoice.subtotal ?? invoice.total)
  const extraAmt = Number(invoice.manual_discount_amount ?? 0)
  const extraPct = Number(invoice.manual_discount_percent ?? 0)
  const baseDiscountAmt = Number(invoice.discount_amount ?? 0) - extraAmt
  const total = Number(invoice.total)

  const dateText = new Date(invoice.created_at).toLocaleDateString('en-US') // 11/17/2026

  return (
    <div>
      <style>{'@page { size: A4; margin: 12mm }'}</style>

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

      {/* The bill: plain A4 layout, same as the client's template */}
      <div className="anim-pop bg-white text-black mx-auto max-w-[210mm] p-10 text-[13px] leading-snug shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] print:shadow-none print:p-0 print:max-w-none print:animate-none">
        {/* Business header */}
        <div className="text-center">
          <p className="text-lg">{BUSINESS.name}</p>
          <p>{BUSINESS.address}</p>
          <p>Tel: {BUSINESS.tel}</p>
          <p>Tax Reg: {BUSINESS.taxReg}</p>
        </div>

        {/* Salesperson */}
        <p className="mt-10">{BUSINESS.salesperson}</p>

        {cancelled && (
          <p className="text-center font-bold border-2 border-black py-1 mt-4">CANCELLED</p>
        )}

        {/* Shop and invoice details */}
        <div className="grid grid-cols-2 gap-6 mt-8">
          <div>
            <p>{invoice.shop_name}</p>
            {invoice.shops?.address && <p>{invoice.shops.address}</p>}
          </div>
          <div>
            <p>{invoice.invoice_no}</p>
            <p className="mt-3">{dateText}</p>
            <p>{isCredit ? 'Credit' : 'Cash'}</p>
          </div>
        </div>

        {/* Items */}
        <table className="w-full mt-10">
          <tbody>
            {invoice.invoice_items.map(item => (
              <tr key={item.id} className="align-top">
                <td className="py-1 pr-3 whitespace-nowrap">{item.products?.code ?? ''}</td>
                <td className="py-1 pr-3">{item.product_name}</td>
                <td className="py-1 px-2 text-right">{item.qty}</td>
                <td className="py-1 px-2 text-right">{money(item.unit_price)}</td>
                <td className="py-1 px-2 text-right">0.00</td>
                <td className="py-1 pl-2 text-right">{money(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mt-12">
          <div className="w-96 space-y-2">
            <Row label="Total" value={money(subtotal)} bold />
            <Row label="Discount" value={money(baseDiscountAmt)} />
            <Row label="Company Discount" value={money(extraAmt)} />
            <Row label="Company Discount (%)" value={extraPct ? `${extraPct}%` : ''} />
            <div className="pt-3">
              <div className="border-t border-black border-b-[3px] border-double pb-1">
                <Row label="Total After Discount" value={money(total)} bold />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}