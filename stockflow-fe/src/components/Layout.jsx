import Sidebar from './Sidebar'

export default function Layout({ children }) {
  return (
    <div style={styles.wrapper}>
      <Sidebar />
      <main style={styles.main}>
        {children}
      </main>
    </div>
  )
}

const styles = {
  wrapper: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    background: '#0e0f11',
    fontFamily: "'DM Sans', sans-serif",
  },
  main: {
    flex: 1,
    overflowY: 'auto',
    padding: '32px',
  },
}