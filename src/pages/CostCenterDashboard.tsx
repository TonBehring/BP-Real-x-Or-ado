import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CostCenter, ManagerialAccount } from '../types/domain';

/**
 * Esqueleto do "Dashboard do Gestor" (equivalente à aba "Relatório" da planilha).
 *
 * PRÓXIMOS PASSOS (próxima iteração):
 * - Buscar budget_entries + actual_entries + forecast_entries do ano corrente
 *   para este cost_center_id.
 * - Calcular por conta gerencial: Orçado Ano, Real YTD, Forecast Restante,
 *   Real+Forecast, Desvio R$, Desvio % (ver convenções no prompt do Lovable).
 * - Renderizar a tabela mensal (jan-dez) e o card de resumo do ano com alerta
 *   visual se a projeção anual for estourar o orçamento.
 */
export default function CostCenterDashboard() {
  const { id } = useParams<{ id: string }>();
  const [costCenter, setCostCenter] = useState<CostCenter | null>(null);
  const [accounts, setAccounts] = useState<ManagerialAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    async function load() {
      const [ccRes, accountsRes] = await Promise.all([
        supabase.from('cost_centers').select('id, codigo, nome, diretoria_pai, ativo').eq('id', id).single(),
        supabase
          .from('managerial_accounts')
          .select('id, cost_center_id, nome, ordem_exibicao')
          .eq('cost_center_id', id)
          .order('ordem_exibicao'),
      ]);
      setCostCenter(ccRes.data as CostCenter);
      setAccounts((accountsRes.data ?? []) as ManagerialAccount[]);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <p className="p-6 text-sm text-gray-500">Carregando…</p>;
  if (!costCenter) return <p className="p-6 text-sm text-bp-estouro">Centro de custo não encontrado.</p>;

  return (
    <div className="min-h-screen bg-bp-realized">
      <header className="bg-bp-black text-white px-6 py-4">
        <Link to="/" className="text-xs text-gray-300 hover:underline">
          &larr; Meus centros de custo
        </Link>
        <h1 className="text-lg font-semibold mt-1">
          {costCenter.codigo} — {costCenter.nome}
        </h1>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <section className="bg-white rounded shadow-sm">
          <div className="bg-bp-subtitle px-4 py-2 font-medium text-bp-header text-sm">
            Contas Gerenciais
          </div>
          <ul className="divide-y">
            {accounts.map((acc) => (
              <li key={acc.id} className="px-4 py-3 text-sm text-gray-700">
                {acc.nome}
              </li>
            ))}
            {accounts.length === 0 && (
              <li className="px-4 py-3 text-sm text-gray-500">
                Nenhuma conta gerencial cadastrada para este centro de custo ainda.
              </li>
            )}
          </ul>
        </section>

        <Link
          to={`/centros/${costCenter.id}/forecast`}
          className="block bg-bp-black text-white rounded shadow-sm px-4 py-3 text-sm font-medium hover:opacity-90 w-fit"
        >
          Abrir Input de Forecast →
        </Link>

        <section className="bg-white rounded shadow-sm p-4 text-sm text-gray-500">
          Resumo do ano (Orçado vs Real+Forecast) entra na próxima etapa.
        </section>
      </main>
    </div>
  );
}
