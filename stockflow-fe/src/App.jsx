import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Stores from './pages/Stores'
import Inventory from './pages/Inventory'
import Chatbot from './pages/Chatbot'
import Transfers from './pages/Transfers'

function ProtectedLayout({ children }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* public */}
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* protected — toate au sidebar */}
        <Route path="/dashboard" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
        <Route path="/stores"    element={<ProtectedLayout><Stores /></ProtectedLayout>} />
        <Route path="/inventory" element={<ProtectedLayout><Inventory /></ProtectedLayout>} />
        <Route path="/transfers" element={<ProtectedLayout><Transfers /></ProtectedLayout>} />
        <Route path="/chatbot"   element={<ProtectedLayout><Chatbot /></ProtectedLayout>} />

        {/* redirects */}
        <Route path="/"  element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}