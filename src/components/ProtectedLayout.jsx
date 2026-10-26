import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router'
import { supabase } from '../supabase'

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/products', label: 'Products' },
  { to: '/new-bill', label: 'New Bill' },
  { to: '/bills', label: 'Bills' },
]

export default function ProtectedLayout() {
  const [session, setSession] = useState(undefined) // undefined = still checking
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

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
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>
  }
  if (!session) return <Navigate to="/login" />

  const linkClass = ({ isActive }) =>
    `block px-3 py-2 rounded-lg text-sm font-medium ${
      isActive ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
    }`

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-gray-800">RMK · Polycrom</span>

          {/* Desktop menu */}
          <nav className="hidden md:flex items-center gap-1">
            {links.map(l => <NavLink key={l.to} to={l.to} className={linkClass}>{l.label}</NavLink>)}
            <button onClick={logout} className="ml-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">Logout</button>
          </nav>

          {/* Mobile menu button */}
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden px-3 py-2 border rounded-lg text-sm">
            Menu
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <nav className="md:hidden px-4 pb-3 space-y-1">
            {links.map(l => (
              <NavLink key={l.to} to={l.to} className={linkClass} onClick={() => setMenuOpen(false)}>{l.label}</NavLink>
            ))}
            <button onClick={logout} className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">Logout</button>
          </nav>
        )}
      </header>

      <main className="max-w-6xl mx-auto p-4">
        <Outlet />
      </main>
    </div>
  )
}