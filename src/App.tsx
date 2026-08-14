import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import CostCenterList from './pages/CostCenterList';
import CostCenterDashboard from './pages/CostCenterDashboard';
import ForecastMatrix from './pages/ForecastMatrix';
import ImportRealizado from './pages/ImportRealizado';
import ManageManagers from './pages/ManageManagers';
import MergeCostCenters from './pages/MergeCostCenters';
import DiretoriaView from './pages/DiretoriaView';
import EditCostCenterGroups from './pages/EditCostCenterGroups';

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
          <Route
            path="/gerenciar-gestores"
            element={
              <ProtectedRoute>
                <ManageManagers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/fundir-centros-de-custo"
            element={
              <ProtectedRoute>
                <MergeCostCenters />
              </ProtectedRoute>
            }
          />
          <Route
            path="/visao-diretoria"
            element={
              <ProtectedRoute>
                <DiretoriaView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/editar-centros-de-custo"
            element={
              <ProtectedRoute>
                <EditCostCenterGroups />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
