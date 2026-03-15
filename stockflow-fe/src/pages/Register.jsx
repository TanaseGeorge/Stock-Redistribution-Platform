import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import supabase from '../api/supabase'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleRegister(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
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
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>StockFlow</h1>
        </div>

        <form onSubmit={handleRegister} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Nume</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ion Popescu"
              required
              style={styles.input}
              onFocus={e => e.target.style.borderColor = '#6366f1'}
              onBlur={e => e.target.style.borderColor = '#2a2d35'}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="manager@company.com"
              required
              style={styles.input}
              onFocus={e => e.target.style.borderColor = '#6366f1'}
              onBlur={e => e.target.style.borderColor = '#2a2d35'}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Parolă</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              style={styles.input}
              onFocus={e => e.target.style.borderColor = '#6366f1'}
              onBlur={e => e.target.style.borderColor = '#2a2d35'}
            />
            <span style={styles.hint}>Minimum 6 caractere</span>
          </div>

          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
            onMouseEnter={e => { if (!loading) e.target.style.background = '#4f46e5' }}
            onMouseLeave={e => { if (!loading) e.target.style.background = '#6366f1' }}
          >
            {loading ? 'Se creează contul...' : 'Creează cont'}
          </button>
        </form>

        <p style={styles.footer}>
          Ai deja cont?{' '}
          <Link to="/login" style={styles.link}>
            Intră în cont
          </Link>
        </p>
      </div>
    </div>
  )
}

const styles = {
  page: {
    height: '100vh',
    overflow:'hidden',
    background: '#0e0f11',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'DM Sans', sans-serif",
    padding: '20px',
  },
  card: {
    background: '#16181c',
    border: '1px solid #2a2d35',
    borderRadius: '16px',
    padding: '40px',
    width: '100%',
    maxWidth: '400px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  title: {
    fontSize: '30px',
    fontWeight: '600',
    color: '#e8eaf0',
    margin: '0 0 6px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    textAlign: 'left',
    fontWeight: '500',
    color: '#9ca3af',
  },
  input: {
    background: '#1e2026',
    border: '1px solid #2a2d35',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '14px',
    color: '#e8eaf0',
    outline: 'none',
    transition: 'border-color 0.15s',
    fontFamily: "'DM Sans', sans-serif",
  },
  hint: {
    fontSize: '11px',
    color: '#4b5563',
  },
  error: {
    background: '#3a1515',
    border: '1px solid #7f2020',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '13px',
    color: '#f08080',
  },
  button: {
    background: '#6366f1',
    border: 'none',
    borderRadius: '8px',
    padding: '11px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#fff',
    transition: 'background 0.15s',
    fontFamily: "'DM Sans', sans-serif",
    marginTop: '4px',
  },
  footer: {
    textAlign: 'center',
    fontSize: '13px',
    color: '#6b7080',
    marginTop: '24px',
    marginBottom: 0,
  },
  link: {
    color: '#818cf8',
    textDecoration: 'none',
    fontWeight: '500',
  },
}