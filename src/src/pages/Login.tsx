import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export default function Login() {
  const { signInWithPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await signInWithPassword(email, password);
    setSubmitting(false);
    if (error) {
      setError(error);
      return;
    }
    navigate('/');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bp-realized">
      <div className="w-full max-w-sm bg-white rounded-md shadow-md overflow-hidden">
        <div className="bg-bp-black text-white px-6 py-4">
          <h1 className="text-lg font-semibold">Real x Orçado</h1>
          <p className="text-sm text-gray-300">Brasil Paralelo Educação S.A.</p>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-bp-header mb-1">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bp-forecast"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-bp-header mb-1">Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bp-forecast"
            />
          </div>
          {error && <p className="text-sm text-bp-estouro">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-bp-black text-white rounded py-2 text-sm font-medium disabled:opacity-60"
          >
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
