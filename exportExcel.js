import { supabase } from '../supabase'

const LAST_BACKUP_KEY = 'rmk:lastBackup'

// ---------- last backup date (saved on this device only) ----------
export function getLastBackup() {
  try {
    const v = localStorage.getItem(LAST_BACKUP_KEY)
    return v ? new Date(v) : null
  } catch {
    return null
  }
}

function setLastBackup() {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString())
  } catch {
    // storage blocked (private mode) - ignore
  }
}

export function daysSince(date) {
  if (!date) return null
  return Math.floor((Date.now() - date.getTime()) / 86400000)
}

// ---------- helpers ----------

// Supabase returns max 1000 rows per request, so fetch page by page
async function fetchAll(table, select) {
  const size = 1000
  const rows = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order('id', { ascending: true })
      .range(from, from + size - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...data)
    if (data.length < size) break
    from += size
  }
  return rows
}

// Local date-time as text, e.g. 2026-10-28 14:05 (sorts correctly in Excel)
function dt(value) {
  if (!value) return ''
  const d = new Date(value)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const num = v => Number(v || 0)

function stampForFile() {
  return dt(new Date()).replace(' ', '_').replace(':', '-')
}

// Build one sheet from a header row + data rows, with column widths
function makeSheet(XLSX, headers, rows, widths) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = widths.map(wch => ({ wch }))
  return ws
}

// xlsx is loaded only when needed, so the app itself stays fast
async function loadXLSX() {
  return await import('xlsx')
}

// ---------- full backup ----------
export async function exportFullBackup(onStep = () => {}) {
  onStep('Loading products...')
  const products = await fetchAll('products', '*')

  onStep('Loading bills...')
  const invoices = await fetchAll('invoices', '*, shops(name, zone)')

  onStep('Loading bill items...')
  const items = await fetchAll('invoice_items', '*, invoices(invoice_no, created_at, status)')

  onStep('Loading stock history...')
  const stockIns = await fetchAll('stock_ins', '*, products(name, code)')

  onStep('Loading shops...')
  const shops = await fetchAll('shops', '*')

  onStep('Building Excel file...')
  const XLSX = await loadXLSX()
  const wb = XLSX.utils.book_new()

  // Items per bill
  const itemCount = {}
  for (const it of items) itemCount[it.invoice_id] = (itemCount[it.invoice_id] || 0) + it.qty

  const active = products.filter(p => p.is_active)
  const paid = invoices.filter(i => i.status === 'paid')
  const cancelled = invoices.length - paid.length

  // Summary
  XLSX.utils.book_append_sheet(wb, makeSheet(XLSX,
    ['RMK Enterprises - Polycrom backup', ''],
    [
      ['Created', dt(new Date())],
      ['', ''],
      ['Products (active)', active.length],
      ['Products (removed)', products.length - active.length],
      ['Stock value at cost', active.reduce((s, p) => s + num(p.cost_price) * p.qty, 0)],
      ['Bills (paid)', paid.length],
      ['Bills (cancelled)', cancelled],
      ['Total sales (paid bills)', paid.reduce((s, i) => s + num(i.total), 0)],
      ['Bill lines', items.length],
      ['Stock-in records', stockIns.length],
      ['Shops', shops.length],
    ],
    [30, 22]
  ), 'Summary')

  // Products
  XLSX.utils.book_append_sheet(wb, makeSheet(XLSX,
    ['ID', 'Code', 'Name', 'Cost price', 'Selling price', 'Stock', 'Low stock level', 'Status', 'Created', 'Updated'],
    products.map(p => [
      p.id, p.code || '', p.name, num(p.cost_price), num(p.sell_price), p.qty,
      p.low_stock_level, p.is_active ? 'Active' : 'Removed', dt(p.created_at), dt(p.updated_at),
    ]),
    [6, 14, 32, 12, 13, 8, 15, 10, 17, 17]
  ), 'Products')

  // Bills
  XLSX.utils.book_append_sheet(wb, makeSheet(XLSX,
    ['Invoice no', 'Date', 'Shop', 'Zone', 'Items', 'Total', 'Status'],
    invoices.map(i => [
      i.invoice_no, dt(i.created_at), i.shops?.name || '', i.shops?.zone || '',
      itemCount[i.id] || 0, num(i.total), i.status === 'paid' ? 'Paid' : 'Cancelled',
    ]),
    [14, 17, 24, 14, 8, 14, 11]
  ), 'Bills')

  // Bill items
  XLSX.utils.book_append_sheet(wb, makeSheet(XLSX,
    ['Invoice no', 'Date', 'Product', 'Qty', 'Unit price', 'Line total', 'Bill status'],
    items.map(it => [
      it.invoices?.invoice_no || '', dt(it.invoices?.created_at), it.product_name,
      it.qty, num(it.unit_price), num(it.line_total),
      it.invoices?.status === 'cancelled' ? 'Cancelled' : 'Paid',
    ]),
    [14, 17, 32, 7, 12, 13, 11]
  ), 'Bill items')

  // Stock in
  XLSX.utils.book_append_sheet(wb, makeSheet(XLSX,
    ['Date', 'Product', 'Code', 'Qty added', 'Note'],
    stockIns.map(s => [dt(s.created_at), s.products?.name || '', s.products?.code || '', s.qty_added, s.note || '']),
    [17, 32, 14, 11, 36]
  ), 'Stock in')

  // Shops
  XLSX.utils.book_append_sheet(wb, makeSheet(XLSX,
    ['ID', 'Name', 'Zone', 'Phone', 'Address'],
    shops.map(s => [s.id, s.name, s.zone || '', s.phone || '', s.address || '']),
    [6, 28, 16, 14, 40]
  ), 'Shops')

  XLSX.writeFile(wb, `RMK-Polycrom-backup_${stampForFile()}.xlsx`, { compression: true })
  setLastBackup()

  return {
    products: products.length,
    bills: invoices.length,
    items: items.length,
    stockIns: stockIns.length,
  }
}

// ---------- bills for a date range (from the Bills page) ----------
export async function exportBills(bills, from, to) {
  const XLSX = await loadXLSX()
  const wb = XLSX.utils.book_new()

  const paid = bills.filter(b => b.status === 'paid')

  XLSX.utils.book_append_sheet(wb, makeSheet(XLSX,
    ['Invoice no', 'Date', 'Items', 'Total', 'Status'],
    [
      ...bills.map(b => [
        b.invoice_no, dt(b.created_at),
        b.invoice_items.reduce((s, i) => s + i.qty, 0),
        num(b.total), b.status === 'paid' ? 'Paid' : 'Cancelled',
      ]),
      [],
      ['Paid bills', paid.length, '', paid.reduce((s, b) => s + num(b.total), 0), ''],
    ],
    [14, 17, 8, 14, 11]
  ), 'Bills')

  XLSX.utils.book_append_sheet(wb, makeSheet(XLSX,
    ['Invoice no', 'Date', 'Product', 'Qty', 'Unit price', 'Line total', 'Bill status'],
    bills.flatMap(b => b.invoice_items.map(it => [
      b.invoice_no, dt(b.created_at), it.product_name, it.qty,
      num(it.unit_price), num(it.line_total), b.status === 'paid' ? 'Paid' : 'Cancelled',
    ])),
    [14, 17, 32, 7, 12, 13, 11]
  ), 'Bill items')

  const range = from === to ? from : `${from}_to_${to}`
  XLSX.writeFile(wb, `RMK-Polycrom-bills_${range}.xlsx`, { compression: true })
}