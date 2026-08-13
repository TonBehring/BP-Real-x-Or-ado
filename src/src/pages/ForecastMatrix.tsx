import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForecastMatrix } from '../hooks/useForecastMatrix';
import { MONTH_LABELS_PT, currentYear, formatCurrency } from '../lib/dateHelpers';

export default function ForecastMatrix() {
  const { id } = useParams<{ id: string }>();
  const ano = currentYear();
  const { accounts, allSuppliers, loading, error, addSupplierToAccount, updateForecastCell } =
    useForecastMatrix(id, ano);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function handleBlur(accountId: string, supplierId: string | null, mes: number, raw: string) {
    const valor = Number(raw.replace(/\./g, '').replace(',', '.')) || 0;
    const key = `${accountId}-${supplierId}-${mes}`;
    setSavingKey(key);
    await updateForecastCell(accountId, supplierId, mes, valor);
    setSavingKey(null);
  }

  if (loading) return <p className="p-6 text-sm text-gray-500">Carregando matriz de forecast…</p>;
  if (error) return <p className="p-6 text-sm text-bp-estouro">{error}</p>;

  return (
    <div className="min-h-screen bg-bp-realized">
      <header className="bg-bp-black text-white px-6 py-4">
        <Link to={`/centros/${id}`} className="text-xs text-gray-300 hover:underline">
          &larr; Voltar ao Dashboard
        </Link>
        <h1 className="text-lg font-semibold mt-1">Input de Forecast — {ano}</h1>
        <p className="text-xs text-gray-400">
          Meses já realizados aparecem travados (fundo cinza). Meses futuros são editáveis (fundo branco, texto azul).
        </p>
      </header>

      <main className="px-4 py-6 space-y-8 overflow-x-auto">
        {accounts.map((group) => (
          <section key={group.accountId} className="bg-white rounded shadow-sm min-w-[900px]">
            <div className="bg-bp-subtitle px-4 py-2 font-medium text-bp-header text-sm flex items-center justify-between">
              <span>{group.accountName}</span>
              <AddSupplierControl
                suppliers={allSuppliers.filter(
                  (s) => !group.rows.some((r) => r.supplierId === s.id)
                )}
                onAdd={(supplierId) => addSupplierToAccount(group.accountId, supplierId)}
              />
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-bp-header text-white">
                  <th className="text-left px-3 py-2 font-medium">Fornecedor</th>
                  {MONTH_LABELS_PT.map((label) => (
                    <th key={label} className="px-2 py-2 font-medium text-right">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.rows.length === 0 && (
                  <tr>
                    <td colSpan={13} className="px-3 py-3 text-gray-500">
                      Nenhum fornecedor ainda. Use "Adicionar fornecedor" acima.
                    </td>
                  </tr>
                )}
                {group.rows.map((row) => (
                  <tr key={row.supplierId ?? 'sem-fornecedor'} className="border-b border-gray-100">
                    <td className="px-3 py-2 text-bp-header font-medium whitespace-nowrap">{row.supplierName}</td>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => {
                      const cell = row.months[mes];
                      const key = `${group.accountId}-${row.supplierId}-${mes}`;
                      if (cell.isPast) {
                        return (
                          <td key={mes} className="px-2 py-2 text-right bg-bp-realized text-gray-600">
                            {formatCurrency(cell.real)}
                          </td>
                        );
                      }
                      return (
                        <td key={mes} className="px-1 py-1 text-right">
                          <input
                            type="text"
                            defaultValue={cell.forecast ? cell.forecast.toFixed(2).replace('.', ',') : ''}
                            placeholder="0,00"
                            onBlur={(e) => handleBlur(group.accountId, row.supplierId, mes, e.target.value)}
                            className="w-20 text-right text-bp-forecast font-medium border border-gray-200 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-bp-forecast"
                          />
                          {savingKey === key && <span className="text-[10px] text-gray-400">salvando…</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}

        {accounts.length === 0 && (
          <p className="text-sm text-gray-500">
            Nenhuma conta gerencial cadastrada para este centro de custo.
          </p>
        )}
      </main>
    </div>
  );
}

function AddSupplierControl({
  suppliers,
  onAdd,
}: {
  suppliers: { id: string; nome_padronizado: string }[];
  onAdd: (supplierId: string) => void;
}) {
  const [selected, setSelected] = useState('');

  return (
    <div className="flex items-center gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="text-xs border border-gray-300 rounded px-2 py-1 text-bp-header"
      >
        <option value="">Selecionar fornecedor…</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nome_padronizado}
          </option>
        ))}
      </select>
      <button
        disabled={!selected}
        onClick={() => {
          if (selected) {
            onAdd(selected);
            setSelected('');
          }
        }}
        className="text-xs bg-bp-black text-white rounded px-2 py-1 disabled:opacity-40"
      >
        + Adicionar fornecedor
      </button>
    </div>
  );
}
