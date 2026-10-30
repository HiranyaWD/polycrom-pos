import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { supabase } from '../supabase'
import { Backdrop } from '../components/ui'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // If already logged in, go straight to dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate('/dashboard')
    })
  }, [navigate])

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError('Wrong email or password')
    else navigate('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Backdrop />

      <form onSubmit={handleLogin} className="glass anim-fade-up w-full max-w-sm p-8 space-y-6">
        <div className="space-y-4">
          <div className="w-12 h-12 rounded-full bg-accent text-ink grid place-items-center font-bold text-lg shadow-[0_0_40px_-6px_rgba(198,244,50,0.7)]">R</div>
          <div>
            <h1 className="text-3xl font-light tracking-tight">Welcome back</h1>
            <p className="muted text-sm mt-1">RMK Enterprises · Polycrom stock & billing</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input type="email" required autoComplete="email" className="field"
              value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" required autoComplete="current-password" className="field"
              value={password} onChange={e => setPassword(e.target.value)} />
          </div>
        </div>

        {error && <p className="text-sm text-red-300">{error}</p>}

        <button type="submit" disabled={loading} className="btn btn-lime w-full py-3">
          {loading ? 'Logging in...' : <>Login <ArrowRight size={16} /></>}
        </button>
      </form>
    </div>
  )
}
