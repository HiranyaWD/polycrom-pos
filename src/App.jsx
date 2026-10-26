import { Routes, Route, Navigate } from 'react-router'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import NewBill from './pages/NewBill'
import Bills from './pages/Bills'
import TestPage from './pages/TestPage'
import ProtectedLayout from './components/ProtectedLayout'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/products" element={<Products />} />
        <Route path="/new-bill" element={<NewBill />} />
        <Route path="/bills" element={<Bills />} />
      </Route>

      <Route path="/test" element={<TestPage />} />
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  )
}