import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAnalyticalView, Classificacao } from '../hooks/useAnalyticalView';
import { currentYear, formatCurrency } from '../lib/dateHelpers';

const CLASSIFICACAO_LABEL: Record<Classificacao, string> = {
  nao_orcado: 'Não orçado',
  estouro: 'Estouro',
  economia: 'Economia',
  neutro: 'Neutro',
};

const CLASSIFICACAO_COLOR: Record<Classificacao, string> = {
  nao_orcado: 'bg-purple-100 text-purple-700',
  estouro: 'bg-red-100 text-bp-estouro',
  economia: 'bg-green-100 text-bp-economia',
  neutro: 'bg-gray-100 text-gray-500',
};

export default function AnalyticalView() {
  const { id } = useParams<{ id: string }>();
  const ano = currentYear();
  const { groups, loading, error, saveJustificativa } = useAnalyticalView(id, ano);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function handleBlurJustificativa(accountId: string, supplierId: string | null, texto: string) {
    const key = `${accountId}-${supplierId}`;
    setSavingKey(key);
    await saveJustificativa(accountId, supplierId, texto);
    setSavingKey(null);
  }

  if (loading) return <p className="p-6 text-sm text-gray-500">Carregando análise…</p>;
  if (error) return <p className="p-6 text-sm text-bp-estouro">{error}</p>;

  return (
    <div className="min-h-screen bg-bp-realized">
      <header className="bg-bp-black text-white px-6 py-4">
        <Link to={`/centros/${id}`} className="text-xs text-gray-300 hover:underline">
          &larr; Voltar ao Dashboard
        </Link>
        <h1 className="text-lg font-semibold mt-1">Real x Orçado Analítico — {ano}</h1>
        <p className="text-xs text-gray-400">
          Decomposição do desvio por fornecedor, com classificação automática. Fornecedores com
          maior estouro aparecem primeiro em cada conta.
        </p>
      </header>

      <main className="px-4 py-6 space-y-8">
        {groups.map((group) => (
          <section key={group.accountId} className="bg-white rounded shadow-sm overflow-x-auto">
            <div className="bg-bp-subtitle px-4 py-2 font-medium text-bp-header text-sm flex items-center justify-between">
              <span>{group.accountName}</span>
              <span
                className={
                  group.subtotal.desvioRs < 0 ? 'text-bp-estouro font-medium' : 'text-bp-economia font-medium'
                }
              >
                Subtotal: {formatCurrency(group.subtotal.desvioRs)}
                {group.subtotal.desvioPct !== null && ` (${(group.subtotal.desvioPct * 100).toFixed(1)}%)`}
              </span>
            </div>
            <table className="w-full text-xs min-w-[1000px]">
              <thead>
                <tr className="bg-bp-header text-white">
                  <th className="text-left px-3 py-2 font-medium">Fornecedor</th>
                  <th className="px-2 py-2 font-medium text-right">Orçado Ano</th>
                  <th className="px-2 py-2 font-medium text-right">Real YTD</th>
                  <th className="px-2 py-2 font-medium text-right">Forecast Restante</th>
                  <th className="px-2 py-2 font-medium text-right">Real+Forecast</th>
                  <th className="px-2 py-2 font-medium text-right">Desvio (R$)</th>
                  <th className="px-2 py-2 font-medium text-right">Desvio (%)</th>
                  <th className="px-2 py-2 font-medium text-left">Classificação</th>
                  <th className="px-2 py-2 font-medium text-left">Justificativa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {group.rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-3 text-gray-500">
                      Nenhum lançamento para esta conta ainda.
                    </td>
                  </tr>
                )}
                {group.rows.map((row) => {
                  const key = `${group.accountId}-${row.supplierId}`;
                  return (
                    <tr key={row.supplierId ?? 'sem-fornecedor'}>
                      <td className="px-3 py-2 text-bp-header font-medium whitespace-nowrap">{row.supplierName}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(row.orcadoAno)}</td>
                      <td className="px-2 py-2 text-right text-gray-500">{formatCurrency(row.realYtd)}</td>
                      <td className="px-2 py-2 text-right text-gray-500">{formatCurrency(row.forecastRestante)}</td>
                      <td className="px-2 py-2 text-right font-medium">{formatCurrency(row.realMaisForecast)}</td>
                      <td
                        className={`px-2 py-2 text-right ${
                          row.desvioRs < 0 ? 'text-bp-estouro' : 'text-bp-economia'
                        }`}
                      >
                        {formatCurrency(row.desvioRs)}
                      </td>
                      <td
                        className={`px-2 py-2 text-right ${
                          row.desvioRs < 0 ? 'text-bp-estouro' : 'text-bp-economia'
                        }`}
                      >
                        {row.desvioPct !== null ? `${(row.desvioPct * 100).toFixed(1)}%` : '–'}
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${CLASSIFICACAO_COLOR[row.classificacao]}`}
                        >
                          {CLASSIFICACAO_LABEL[row.classificacao]}
                        </span>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          defaultValue={row.justificativa}
                          placeholder="Adicionar justificativa…"
                          onBlur={(e) => handleBlurJustificativa(group.accountId, row.supplierId, e.target.value)}
                          className="w-56 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-bp-forecast"
                        />
                        {savingKey === key && <span className="text-[10px] text-gray-400 block">salvando…</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}

        {groups.length === 0 && (
          <p className="text-sm text-gray-500">Nenhuma conta gerencial cadastrada para este centro de custo.</p>
        )}
      </main>
    </div>
  );
}
