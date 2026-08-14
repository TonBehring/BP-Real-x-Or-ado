import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useConsolidatedSummary, ConsolidatedRow } from '../hooks/useConsolidatedSummary';
import { currentYear, formatCurrency } from '../lib/dateHelpers';
import { costCenterLabel } from '../lib/costCenterLabel';

type SortKey = 'nome' | 'orcadoAno' | 'realMaisForecast' | 'desvioRs' | 'desvioPct';
type SortDir = 'asc' | 'desc';

export default function ConsolidatedView() {
  const { profile } = useAuth();
  const ano = currentYear();
  const { summary, loading, error } = useConsolidatedSummary(ano);
  const [sortKey, setSortKey] = useState<SortKey>('desvioRs');
  const [sortDir, setSortDir] = useState<SortDir>('asc'); // asc = maiores estouros (mais negativos) primeiro
  const [filtro, setFiltro] = useState('');

  if (profile && profile.papel !== 'fpna_admin') {
    return (
      <div className="p-6">
        <p className="text-sm text-bp-estouro">Esta área é restrita ao FP&A.</p>
      </div>
    );
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sortedRows = useMemo(() => {
    if (!summary) return [];
    const filtered = summary.rows.filter(
      (r) =>
        !filtro.trim() ||
        r.nome.toLowerCase().includes(filtro.toLowerCase()) ||
        r.gestores.toLowerCase().includes(filtro.toLowerCase())
    );
    const sorted = [...filtered].sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      if (sortKey === 'nome') {
        av = a.nome;
        bv = b.nome;
      } else if (sortKey === 'desvioPct') {
        av = a.desvioPct ?? 0;
        bv = b.desvioPct ?? 0;
      } else {
        av = a[sortKey];
        bv = b[sortKey];
      }
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return sorted;
  }, [summary, sortKey, sortDir, filtro]);

  function SortHeader({ label, sortK }: { label: string; sortK: SortKey }) {
    const active = sortKey === sortK;
    return (
      <th
        onClick={() => toggleSort(sortK)}
        className="px-2 py-2 font-medium text-right cursor-pointer select-none hover:bg-black/20"
      >
        {label} {active ? (sortDir === 'asc' ? '▲' : '▼') : ''}
      </th>
    );
  }

  return (
    <div className="min-h-screen bg-bp-realized">
      <header className="bg-bp-black text-white px-6 py-4">
        <Link to="/" className="text-xs text-gray-300 hover:underline">
          &larr; Meus centros de custo
        </Link>
        <h1 className="text-lg font-semibold mt-1">Visão Consolidada — {ano}</h1>
        <p className="text-xs text-gray-400">
          Todos os centros de custo ativos. Clique numa coluna para ordenar — por padrão, os
          maiores estouros aparecem primeiro.
        </p>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {loading && <p className="text-sm text-gray-500">Calculando…</p>}
        {error && <p className="text-sm text-bp-estouro">{error}</p>}

        {summary && (
          <>
            <section className="bg-white rounded shadow-sm overflow-hidden">
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100">
                <Stat label="Orçado (Ano) — Total" value={formatCurrency(summary.orcadoAno)} />
                <Stat label="Real + Forecast — Total" value={formatCurrency(summary.realMaisForecastAno)} />
                <Stat
                  label="Desvio (R$) — Total"
                  value={formatCurrency(summary.desvioRsAno)}
                  colorClass={summary.desvioRsAno < 0 ? 'text-bp-estouro' : 'text-bp-economia'}
                />
                <Stat
                  label="Desvio (%) — Total"
                  value={summary.desvioPctAno !== null ? `${(summary.desvioPctAno * 100).toFixed(1)}%` : '–'}
                  colorClass={summary.desvioRsAno < 0 ? 'text-bp-estouro' : 'text-bp-economia'}
                />
              </div>
            </section>

            <input
              type="text"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Filtrar por centro de custo ou gestor…"
              className="w-full sm:w-80 border border-gray-300 rounded px-3 py-1.5 text-sm"
            />

            <section className="bg-white rounded shadow-sm overflow-x-auto">
              <table className="w-full text-xs table-fixed">
                <colgroup>
                  <col className="w-[26%]" />
                  <col className="w-[22%]" />
                  <col className="w-[13%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                  <col className="w-[9%]" />
                </colgroup>
                <thead>
                  <tr className="bg-bp-header text-white">
                    <th
                      onClick={() => toggleSort('nome')}
                      className="text-left px-3 py-2 font-medium cursor-pointer select-none hover:bg-black/20"
                    >
                      Centro de Custo {sortKey === 'nome' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="text-left px-2 py-2 font-medium">Gestor(es)</th>
                    <SortHeader label="Orçado Ano" sortK="orcadoAno" />
                    <SortHeader label="Real+Forecast" sortK="realMaisForecast" />
                    <SortHeader label="Desvio (R$)" sortK="desvioRs" />
                    <SortHeader label="Desvio (%)" sortK="desvioPct" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedRows.map((r) => (
                    <Row key={r.costCenterId} row={r} />
                  ))}
                  {sortedRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                        Nenhum centro de custo encontrado.
                      </td>
                    </tr>
                  )}
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

function Row({ row }: { row: ConsolidatedRow }) {
  const estouro = row.desvioRs < 0;
  return (
    <tr className={estouro && row.orcadoAno > 0 ? 'bg-red-50' : ''}>
      <td className="px-3 py-2 text-bp-header font-medium break-words">
        {costCenterLabel(row.codigo, row.nome)}
        {row.diretoriaPai && <span className="block text-[10px] text-gray-400">{row.diretoriaPai}</span>}
      </td>
      <td className="px-2 py-2 text-gray-600 break-words">{row.gestores}</td>
      <td className="px-2 py-2 text-right">{formatCurrency(row.orcadoAno)}</td>
      <td className="px-2 py-2 text-right font-medium">{formatCurrency(row.realMaisForecast)}</td>
      <td className={`px-2 py-2 text-right ${estouro ? 'text-bp-estouro' : 'text-bp-economia'}`}>
        {formatCurrency(row.desvioRs)}
      </td>
      <td className={`px-2 py-2 text-right ${estouro ? 'text-bp-estouro' : 'text-bp-economia'}`}>
        {row.desvioPct !== null ? `${(row.desvioPct * 100).toFixed(1)}%` : '–'}
      </td>
    </tr>
  );
}
