import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { CostCenter } from '../types/domain';

export default function CostCenterList() {
  const { profile, signOut } = useAuth();
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      // A RLS já filtra automaticamente: gestor só recebe os seus,
      // fpna_admin recebe todos.
      const { data, error } = await supabase
        .from('cost_centers')
        .select('id, codigo, nome, diretoria_pai, ativo')
        .eq('ativo', true)
        .order('nome');

      if (error) {
        setErrorMsg(error.message);
      } else {
        setCostCenters(data as CostCenter[]);
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-bp-realized">
      <header className="bg-bp-black text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Real x Orçado</h1>
          <p className="text-sm text-gray-300">
            {profile ? `${profile.nome} · ${profile.papel === 'fpna_admin' ? 'FP&A' : 'Gestor'}` : ''}
          </p>
        </div>
        <button
          onClick={signOut}
          className="text-sm border border-white/40 rounded px-3 py-1 hover:bg-white/10"
        >
          Sair
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <h2 className="text-bp-header font-semibold mb-4">Meus Centros de Custo</h2>

        {loading && <p className="text-sm text-gray-500">Carregando…</p>}
        {errorMsg && <p className="text-sm text-bp-estouro">{errorMsg}</p>}

        {!loading && costCenters.length === 0 && !errorMsg && (
          <p className="text-sm text-gray-500">
            Nenhum centro de custo vinculado a este usuário ainda. Peça ao FP&A para vincular seu
            perfil em <code>manager_cost_centers</code>.
          </p>
        )}

        <ul className="space-y-2">
          {costCenters.map((cc) => (
            <li key={cc.id}>
              <Link
                to={`/centros/${cc.id}`}
                className="block bg-white rounded shadow-sm px-4 py-3 hover:shadow-md transition-shadow"
              >
                <span className="font-medium text-bp-header">{cc.codigo} — {cc.nome}</span>
                {cc.diretoria_pai && (
                  <span className="block text-xs text-gray-500">{cc.diretoria_pai}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
