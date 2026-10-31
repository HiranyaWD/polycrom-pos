import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { LayoutDashboard, Package, Plus, ReceiptText, DatabaseBackup, LogOut } from 'lucide-react'
import { supabase } from '../supabase'
import { Backdrop } from './ui'

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/new-bill', label: 'New Bill', icon: Plus },
  { to: '/bills', label: 'Bills', icon: ReceiptText },
  { to: '/backup', label: 'Backup', icon: DatabaseBackup },
]

export default function ProtectedLayout() {
  const [session, setSession] = useState(undefined) // undefined = still checking
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => listener.subscription.unsubscribe()
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (session === undefined) {
    return (
      <div className="min-h-screen grid place-items-center muted">
        <Backdrop />
        Loading...
      </div>
    )
  }
  if (!session) return <Navigate to="/login" />

  const initial = (session.user.email || '?')[0].toUpperCase()

  return (
    <div className="min-h-screen">
      <Backdrop />

      {/* Top bar */}
      <header className="sticky top-0 z-40 px-4 pt-4 print:hidden">
        <div className="max-w-7xl mx-auto glass rounded-full flex items-center justify-between pl-3 pr-2 py-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-accent text-ink grid place-items-center font-bold text-sm">R</div>
            <span className="font-semibold tracking-tight">
              RMK <span className="muted font-normal">· Polycrom</span>
            </span>
          </div>

          {/* Desktop pill menu */}
          <nav className="hidden md:flex items-center gap-1 rounded-full bg-white/5 border border-white/10 p-1">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition ${
                    isActive ? 'bg-accent text-ink' : 'text-white/65 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <Icon size={16} strokeWidth={2.2} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={logout} className="btn btn-ghost px-3 md:px-4" aria-label="Logout">
              <LogOut size={16} />
              <span className="hidden md:inline">Logout</span>
            </button>
            <div
              title={session.user.email}
              className="hidden sm:grid w-9 h-9 rounded-full bg-white/10 border border-white/15 place-items-center text-sm font-semibold"
            >
              {initial}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-8 pb-28 md:pb-12 print:p-0">
        {/* key changes on every page, so each page fades in */}
        <div key={location.pathname} className="anim-page">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-3 inset-x-3 z-40 glass rounded-full flex p-1.5 print:hidden">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-2 rounded-full text-[11px] font-semibold transition ${
                isActive ? 'bg-accent text-ink' : 'text-white/60'
              }`
            }
          >
            <Icon size={18} strokeWidth={2.2} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}