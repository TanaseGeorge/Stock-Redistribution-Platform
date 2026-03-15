import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Stores from './pages/Stores'
import Inventory from './pages/Inventory'
import Chatbot from './pages/Chatbot'
import Transfers from './pages/Transfers'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* protected */}
        <Route path="/dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        }/>
        <Route path="/stores" element={
          <ProtectedRoute><Stores /></ProtectedRoute>
        }/>
        <Route path="/inventory" element={
          <ProtectedRoute><Inventory /></ProtectedRoute>
        }/>
        <Route path="/chatbot" element={
          <ProtectedRoute><Chatbot /></ProtectedRoute>
        }/>
        <Route path="/transfers" element={
          <ProtectedRoute><Transfers /></ProtectedRoute>
        }/>

        {/* redirects */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}