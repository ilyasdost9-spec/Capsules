import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Auth from './pages/Auth'
import Feed from './pages/Feed'
import Profile from './pages/Profile'
import './index.css'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <span className="spinner" />
    </div>
  )
  return user ? children : <Navigate to="/" replace />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <span className="spinner" />
    </div>
  )
  return user ? <Navigate to="/feed" replace /> : children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicRoute><Auth /></PublicRoute>} />
      <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
