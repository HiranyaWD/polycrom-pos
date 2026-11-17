import { Routes, Route, Navigate } from 'react-router'
import ProtectedLayout from './components/ProtectedLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import StockHistory from './pages/StockHistory'
import NewBill from './pages/NewBill'
import Bills from './pages/Bills'
import InvoicePrint from './pages/InvoicePrint'
import Credit from './pages/Credit'
import Reports from './pages/Reports'
import Backup from './pages/Backup'
import Settings from './pages/Settings'
import TestPage from './pages/TestPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Every page below needs a login */}
      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/products" element={<Products />} />
        <Route path="/stock-history" element={<StockHistory />} />
        <Route path="/new-bill" element={<NewBill />} />
        <Route path="/bills" element={<Bills />} />
        <Route path="/invoice/:id" element={<InvoicePrint />} />
        <Route path="/credit" element={<Credit />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/backup" element={<Backup />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="/test" element={<TestPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}