import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CostCenter } from '../types/domain';
import { costCenterLabel } from '../lib/costCenterLabel';
import { useCostCenterSummary } from '../hooks/useCostCenterSummary';
import { currentYear } from '../lib/dateHelpers';
import SummaryCard from '../components/SummaryCard';
import MonthlyTable from '../components/MonthlyTable';
import AccountBreakdownTable from '../components/AccountBreakdownTable';

export default function CostCenterDashboard() {
  const { id } = useParams<{ id: string }>();
  const ano = currentYear();
  const [costCenter, setCostCenter] = useState<CostCenter | null>(null);
  const [loadingCc, setLoadingCc] = useState(true);
  const { summary, loading: loadingSummary, error } = useCostCenterSummary(id, ano);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('cost_centers')
      .select('id, codigo, nome, diretoria_pai, ativo')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setCostCenter(data as CostCenter);
        setLoadingCc(false);
      });
  }, [id]);

  if (loadingCc) return <p className="p-6 text-sm text-gray-500">Carregando…</p>;
  if (!costCenter) return <p className="p-6 text-sm text-bp-estouro">Centro de custo não encontrado.</p>;

  return (
    <div className="min-h-screen bg-bp-realized">
      <header className="bg-bp-black text-white px-6 py-4">
        <Link to="/" className="text-xs text-gray-300 hover:underline">
          &larr; Meus centros de custo
        </Link>
        <h1 className="text-lg font-semibold mt-1">
          {costCenterLabel(costCenter.codigo, costCenter.nome)}
        </h1>
        <p className="text-xs text-gray-400">Mês base: hoje · Resumo do ano {ano}</p>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="flex gap-3">
          <Link
            to={`/centros/${costCenter.id}/forecast`}
            className="inline-block bg-bp-black text-white rounded shadow-sm px-4 py-3 text-sm font-medium hover:opacity-90"
          >
            Abrir Input de Forecast →
          </Link>
          <Link
            to={`/centros/${costCenter.id}/analitico`}
            className="inline-block bg-white border border-bp-header text-bp-header rounded shadow-sm px-4 py-3 text-sm font-medium hover:bg-gray-50"
          >
            Real x Orçado Analítico →
          </Link>
        </div>

        {loadingSummary && <p className="text-sm text-gray-500">Calculando resumo…</p>}
        {error && <p className="text-sm text-bp-estouro">{error}</p>}

        {summary && (
          <>
            <SummaryCard
              orcadoAno={summary.orcadoAno}
              realMaisForecastAno={summary.realMaisForecastAno}
              desvioRsAno={summary.desvioRsAno}
              desvioPctAno={summary.desvioPctAno}
            />
            <MonthlyTable months={summary.months} ano={ano} />
            <AccountBreakdownTable accounts={summary.accounts} />
          </>
        )}
      </main>
    </div>
  );
}
