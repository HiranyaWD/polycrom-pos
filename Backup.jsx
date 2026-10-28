import { useState } from 'react'
import { DatabaseBackup, Download, Loader2, CheckCircle2, AlertTriangle, FileSpreadsheet, CloudUpload, CalendarClock } from 'lucide-react'
import { exportFullBackup, getLastBackup, daysSince } from '../lib/exportExcel'
import { PageTitle, Reveal } from '../components/ui'

const sheets = [
  { name: 'Summary', desc: 'Totals at a glance' },
  { name: 'Products', desc: 'All products, including removed ones' },
  { name: 'Bills', desc: 'Every bill with total and status' },
  { name: 'Bill items', desc: 'Each product line on every bill' },
  { name: 'Stock in', desc: 'Full stock-in history' },
  { name: 'Shops', desc: 'Shops and zones' },
]

export default function Backup() {
  const [status, setStatus] = useState('idle') // idle | working | done | error
  const [step, setStep] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [last, setLast] = useState(getLastBackup())

  const age = daysSince(last)
  const overdue = age === null || age >= 7

  async function runBackup() {
    setStatus('working')
    setError('')
    setResult(null)
    try {
      const r = await exportFullBackup(setStep)
      setResult(r)
      setStatus('done')
      setLast(getLastBackup())
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }

  return (
    <div>
      <PageTitle title="Backup" subtitle="Download all your data as an Excel file" />

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {/* Main backup card */}
        <Reveal delay={0} className="lg:col-span-2">
          <section className="glass-accent p-6 relative overflow-hidden">
            <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-accent/20 blur-3xl" aria-hidden="true" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <span className="w-11 h-11 rounded-full bg-accent text-ink grid place-items-center">
                  <DatabaseBackup size={20} />
                </span>
                <div>
                  <h2 className="text-xl font-medium">Full backup</h2>
                  <p className="text-sm text-white/60">One .xlsx file with everything in the system</p>
                </div>
              </div>

              <ul className="grid sm:grid-cols-2 gap-2 mt-6">
                {sheets.map((s, i) => (
                  <li
                    key={s.name}
                    className="anim-fade-up flex items-start gap-3 rounded-2xl bg-white/[0.05] border border-white/10 px-4 py-3"
                    style={{ '--d': `${120 + i * 50}ms` }}
                  >
                    <FileSpreadsheet size={16} className="text-accent mt-0.5 shrink-0" />
                    <span>
                      <span className="block text-sm font-semibold">{s.name}</span>
                      <span className="block text-xs text-white/55">{s.desc}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-4">
                <button onClick={runBackup} disabled={status === 'working'} className="btn btn-lime py-3 px-6 text-base">
                  {status === 'working'
                    ? <><Loader2 size={18} className="animate-spin" /> Preparing...</>
                    : <><Download size={18} /> Download backup</>}
                </button>
                {status === 'working' && <p className="text-sm text-white/70 anim-page">{step}</p>}
              </div>

              {status === 'done' && result && (
                <div className="anim-pop mt-5 flex items-start gap-3 rounded-2xl bg-accent/10 border border-accent/30 px-4 py-3">
                  <CheckCircle2 size={18} className="text-accent shrink-0 mt-0.5" />
                  <p className="text-sm">
                    Backup downloaded: <b>{result.products}</b> products, <b>{result.bills}</b> bills,{' '}
                    <b>{result.items}</b> bill lines and <b>{result.stockIns}</b> stock-in records.
                    Check your Downloads folder.
                  </p>
                </div>
              )}

              {status === 'error' && (
                <div className="anim-pop mt-5 flex items-start gap-3 rounded-2xl bg-red-500/10 border border-red-400/30 px-4 py-3 text-red-300">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <p className="text-sm">Backup failed: {error}. Check the internet connection and try again.</p>
                </div>
              )}
            </div>
          </section>
        </Reveal>

        <div className="space-y-4">
          {/* Last backup */}
          <Reveal delay={100}>
            <section className={`p-5 ${overdue ? 'glass border-amber-400/30' : 'glass'}`}>
              <div className="flex items-center justify-between">
                <p className="label mb-0">Last backup</p>
                <CalendarClock size={16} className={overdue ? 'text-amber-300' : 'text-accent'} />
              </div>
              <p className={`text-2xl font-light mt-2 ${overdue ? 'text-amber-300' : ''}`}>
                {age === null ? 'Never' : age === 0 ? 'Today' : age === 1 ? 'Yesterday' : `${age} days ago`}
              </p>
              <p className="text-xs muted mt-1">
                {last ? last.toLocaleString() : 'No backup downloaded on this device yet'}
              </p>
              {overdue && (
                <p className="text-xs text-amber-300 mt-3">It's been a while. Download a backup now.</p>
              )}
            </section>
          </Reveal>

          {/* Tips */}
          <Reveal delay={180}>
            <section className="glass p-5">
              <div className="flex items-center gap-2">
                <CloudUpload size={16} className="text-accent" />
                <p className="font-medium">Keep it safe</p>
              </div>
              <ul className="mt-3 space-y-2 text-sm text-white/65 list-disc pl-5">
                <li>Download a backup at least once a week.</li>
                <li>Save the file to Google Drive or email it to yourself.</li>
                <li>Keep a few old backups, not only the newest one.</li>
              </ul>
            </section>
          </Reveal>
        </div>
      </div>
    </div>
  )
}