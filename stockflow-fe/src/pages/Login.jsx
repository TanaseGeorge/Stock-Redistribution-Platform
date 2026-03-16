import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import supabase from '../api/supabase'
import '../styles/Login.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else navigate('/dashboard')
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">StockMind</h1>
          <h1 className="login-subtitle">AI-driven stock management</h1>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          <div className="login-field">
            <label className="login-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="manager@company.com"
              required
              className="login-input"
            />
          </div>

          <div className="login-field">
            <label className="login-label">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="login-input"
            />
          </div>

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`login-button${loading ? ' loading' : ''}`}
          >
            {loading ? 'Loading...' : 'Sign in'}
          </button>
        </form>

        <p className="login-footer">
        Don't have an account?{' '}
          <Link to="/register" className="login-link">
          Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}