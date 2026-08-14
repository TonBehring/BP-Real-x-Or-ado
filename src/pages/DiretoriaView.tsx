import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDiretoriaList, useDiretoriaSummary } from '../hooks/useDiretoriaSummary';
import { currentYear, formatCurrency } from '../lib/dateHelpers';
import { costCenterLabel } from '../lib/costCenterLabel';

export default function DiretoriaView() {
  const ano = currentYear();
  const { diretorias, loading: loadingList } = useDiretoriaList();
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const { summary, loading: loadingSummary, error } = useDiretoriaSummary(selected, ano);

  return (
    <div className="min-h-screen bg-bp-realized">
      <header className="bg-bp-black text-white px-6 py-4">
        <Link to="/" className="text-xs text-gray-300 hover:underline">
          &larr; Meus centros de custo
        </Link>
        <h1 className="text-lg font-semibold mt-1">Visão por Diretoria</h1>
        <p className="text-xs text-gray-400">
          Soma o Orçado, Real e Forecast de todos os centros de custo de uma diretoria — cada
          centro de custo continua com seu próprio Forecast e Dashboard, isso aqui é só uma visão
          agregada.
        </p>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <section className="bg-white rounded shadow-sm p-4">
          <label className="block text-xs text-gray-500 mb-1">Diretoria</label>
          {loadingList ? (
            <p className="text-sm text-gray-500">Carregando…</p>
          ) : diretorias.length === 0 ? (
            <p className="text-sm text-gray-500">
              Nenhum centro de custo tem "Diretoria" preenchida ainda. Preencha o campo{' '}
              <code>diretoria_pai</code> nos centros de custo para eles aparecerem aqui.
            </p>
          ) : (
            <select
              value={selected ?? ''}
              onChange={(e) => setSelected(e.target.value || undefined)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
            >
              <option value="">Selecionar diretoria…</option>
              {diretorias.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}
        </section>

        {selected && loadingSummary && <p className="text-sm text-gray-500">Calculando…</p>}
        {error && <p className="text-sm text-bp-estouro">{error}</p>}

        {selected && summary && (
          <>
            <section className="bg-white rounded shadow-sm overflow-hidden">
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100">
                <Stat label="Orçado (Ano)" value={formatCurrency(summary.orcadoAno)} />
                <Stat label="Real + Forecast" value={formatCurrency(summary.realMaisForecastAno)} />
                <Stat
                  label="Desvio (R$)"
                  value={formatCurrency(summary.desvioRsAno)}
                  colorClass={summary.desvioRsAno < 0 ? 'text-bp-estouro' : 'text-bp-economia'}
                />
                <Stat
                  label="Desvio (%)"
                  value={summary.desvioPctAno !== null ? `${(summary.desvioPctAno * 100).toFixed(1)}%` : '–'}
                  colorClass={summary.desvioRsAno < 0 ? 'text-bp-estouro' : 'text-bp-economia'}
                />
              </div>
            </section>

            <section className="bg-white rounded shadow-sm overflow-x-auto">
              <div className="bg-bp-subtitle px-4 py-2 font-medium text-bp-header text-sm">
                Centros de Custo desta Diretoria
              </div>
              <table className="w-full text-xs min-w-[700px]">
                <thead>
                  <tr className="bg-bp-header text-white">
                    <th className="text-left px-3 py-2 font-medium">Centro de Custo</th>
                    <th className="px-2 py-2 font-medium text-right">Orçado Ano</th>
                    <th className="px-2 py-2 font-medium text-right">Real YTD</th>
                    <th className="px-2 py-2 font-medium text-right">Forecast Restante</th>
                    <th className="px-2 py-2 font-medium text-right">Real+Forecast</th>
                    <th className="px-2 py-2 font-medium text-right">Desvio (R$)</th>
                    <th className="px-2 py-2 font-medium text-right">Desvio (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summary.rows.map((r) => (
                    <tr key={r.costCenterId}>
                      <td className="px-3 py-2 text-bp-header font-medium whitespace-nowrap">
                        {costCenterLabel(r.codigo, r.nome)}
                      </td>
                      <td className="px-2 py-2 text-right">{formatCurrency(r.orcadoAno)}</td>
                      <td className="px-2 py-2 text-right text-gray-500">{formatCurrency(r.realYtd)}</td>
                      <td className="px-2 py-2 text-right text-gray-500">{formatCurrency(r.forecastRestante)}</td>
                      <td className="px-2 py-2 text-right font-medium">{formatCurrency(r.realMaisForecast)}</td>
                      <td className={`px-2 py-2 text-right ${r.desvioRs < 0 ? 'text-bp-estouro' : 'text-bp-economia'}`}>
                        {formatCurrency(r.desvioRs)}
                      </td>
                      <td className={`px-2 py-2 text-right ${r.desvioRs < 0 ? 'text-bp-estouro' : 'text-bp-economia'}`}>
                        {r.desvioPct !== null ? `${(r.desvioPct * 100).toFixed(1)}%` : '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, colorClass }: { label: string; value: string; colorClass?: string }) {
  return (
    <div className="px-4 py-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${colorClass ?? 'text-bp-header'}`}>{value}</div>
    </div>
  );
}
