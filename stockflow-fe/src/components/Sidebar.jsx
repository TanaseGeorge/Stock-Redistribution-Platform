import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import supabase from '../api/supabase'

const navItems = [
  { path: '/dashboard',  label: 'Dashboard',   icon: '▦' },
  { path: '/stores',     label: 'Stores',     icon: '◫' },
  { path: '/inventory',  label: 'Inventory',      icon: '◈' },
  { path: '/transfers',  label: 'Transfers',  icon: '⇄' },
  { path: '/chatbot',    label: 'Chatbot',      icon: '◎' },
]

export default function Sidebar() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Manager'

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <aside style={styles.sidebar}>
      <div style={styles.logoRow}>
        <div>
            <div style={styles.logoText}>StockMind</div>
            <div style={styles.logoSubtitle}>AI-driven stock management</div>
        </div>
    </div>

      <div style={styles.userBox}>
        <div style={styles.avatar}>
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={styles.userName}>{displayName}</div>
        </div>
      </div>

      <div style={styles.divider} />

      <nav style={styles.nav}>
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              ...styles.navItem,
              background: isActive ? '#1e2026' : 'transparent',
              color: isActive ? '#e8eaf0' : '#6b7080',
              borderLeft: isActive ? '2px solid #6366f1' : '2px solid transparent',
            })}
          >
            <span style={styles.icon}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div style={styles.bottom}>
        <div style={styles.divider} />
        <button onClick={handleLogout} style={styles.logoutBtn}
          onMouseEnter={e => e.currentTarget.style.color = '#f08080'}
          onMouseLeave={e => e.currentTarget.style.color = '#6b7080'}
        >
          <span style={styles.icon}>→</span>
          Deconectare
        </button>
      </div>
    </aside>
  )
}

const styles = {
  sidebar: {
    width: '220px',
    minWidth: '220px',
    height: '100vh',
    background: '#16181c',
    borderRight: '1px solid #2a2d35',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 0',
    fontFamily: "'DM Sans', sans-serif",
    position: 'sticky',
    top: 0,
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '0 20px 20px',
  },
  logoBox: {
    width: '32px',
    height: '32px',
    background: '#6366f1',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: '700',
    color: '#fff',
    letterSpacing: '0.05em',
    flexShrink: 0,
  },
  logoText: {
    fontSize: '22px',
    fontWeight: '600',
    color: '#e8eaf0',
    textAlign: 'left',
  },
  logoSubtitle: {
    fontSize: '12px',
    color: '#4b5563',
    fontWeight: '400',
    letterSpacing: '0.03em',
    textAlign: 'left',
  },
  userBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 20px',
    background: '#1e2026',
    margin: '0 12px',
    borderRadius: '10px',
  },
  avatar: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    background: '#312e81',
    color: '#a5b4fc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '600',
    flexShrink: 0,
  },
  userName: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#e8eaf0',
    lineHeight: 1.3,
    maxWidth: '120px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  divider: {
    height: '1px',
    background: '#2a2d35',
    margin: '16px 20px',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '0 12px',
    flex: 1,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '9px 12px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '500',
    textDecoration: 'none',
    transition: 'background 0.15s, color 0.15s',
    cursor: 'pointer',
  },
  icon: {
    fontSize: '15px',
    width: '18px',
    textAlign: 'center',
    flexShrink: 0,
  },
  bottom: {
    padding: '0',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '9px 24px',
    fontSize: '13px',
    fontWeight: '500',
    color: '#6b7080',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    width: '100%',
    fontFamily: "'DM Sans', sans-serif",
    transition: 'color 0.15s',
  },
}