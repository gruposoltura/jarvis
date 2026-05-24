import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import Properties from './pages/Properties'
import Contacts from './pages/Contacts'
import Layout from './components/Layout'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--accent)', fontFamily:'var(--font-display)', letterSpacing:'0.2em' }}>INITIALISING...</div>
  return user ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="leads" element={<Leads />} />
        <Route path="properties" element={<Properties />} />
        <Route path="contacts" element={<Contacts />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <>
      <div className="scanline" aria-hidden="true" />
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </>
  )
}
