import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import supabase from '../api/supabase'
import '../styles/Register.css'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  function validatePassword(pwd) {
    if (pwd.length < 6) return 'Password must be at least 6 characters'
    if (!/[A-Z]/.test(pwd)) return 'Password must contain at least one uppercase letter'
    if (!/[0-9]/.test(pwd)) return 'Password must contain at least one number'
    return null
  }

  async function handleRegister(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const validationError = validatePassword(password)
    if (validationError) {
      setError(validationError)
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } }
    })
    if (error) setError(error.message)
    else navigate('/dashboard')
    setLoading(false)
  }

  return (
    <div className="register-page">
      <div className="register-card">
        <div className="register-header">
          <h1 className="register-title">StockMind</h1>
          <h1 className="register-subtitle">AI-driven stock management</h1>
        </div>

        <form onSubmit={handleRegister} className="register-form">
          <div className="register-field">
            <label className="register-label">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ion Popescu"
              required
              className="register-input"
            />
          </div>

          <div className="register-field">
            <label className="register-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="manager@company.com"
              required
              className="register-input"
            />
          </div>

          <div className="register-field">
            <label className="register-label">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="register-input"
            />
            <span className="register-hint">At least 6 characters · 1 uppercase · 1 number</span>
          </div>

          {error && (
            <div className="register-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`register-button${loading ? ' loading' : ''}`}
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="register-footer">
        Already have an account?{' '}
          <Link to="/login" className="register-link">
          Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}