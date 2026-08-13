import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import CostCenterList from './pages/CostCenterList';
import CostCenterDashboard from './pages/CostCenterDashboard';

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
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
