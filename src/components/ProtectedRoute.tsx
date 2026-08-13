import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { ReactNode } from 'react';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) return <p className="p-6 text-sm text-gray-500">Carregando…</p>;
  if (!session) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
