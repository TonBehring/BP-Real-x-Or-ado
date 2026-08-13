import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import CostCenterList from './pages/CostCenterList';
import CostCenterDashboard from './pages/CostCenterDashboard';
import ForecastMatrix from './pages/ForecastMatrix';
import ImportRealizado from './pages/ImportRealizado';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <CostCenterList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/centros/:id"
            element={
              <ProtectedRoute>
                <CostCenterDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/centros/:id/forecast"
            element={
              <ProtectedRoute>
                <ForecastMatrix />
              </ProtectedRoute>
            }
          />
          <Route
            path="/importar-realizado"
            element={
              <ProtectedRoute>
                <ImportRealizado />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
