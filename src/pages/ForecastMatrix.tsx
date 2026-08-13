import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForecastMatrix } from '../hooks/useForecastMatrix';
import { MONTH_LABELS_PT, currentYear, formatCurrency } from '../lib/dateHelpers';

// Larguras fixas e IDÊNTICAS em todas as tabelas — é isso que garante que
// jan/fev/mar... fiquem alinhados verticalmente entre uma conta gerencial e
// outra, independente do tamanho dos nomes de fornecedor em cada uma.
const SUPPLIER_COL_WIDTH = 220;
const MONTH_COL_WIDTH = 78;

function ColGroup() {
  return (
    <colgroup>
      <col style={{ width: SUPPLIER_COL_WIDTH }} />
      {MONTH_LABELS_PT.map((label) => (
        <col key={label} style={{ width: MONTH_COL_WIDTH }} />
      ))}
    </colgroup>
  );
}

export default function ForecastMatrix() {
  const { id } = useParams<{ id: string }>();
  const ano = currentYear();
  const { accounts, allSuppliers, loading, error, addSupplierToAccount, createSupplierAndAddToAccount, updateForecastCell } =
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

  const tableWidth = SUPPLIER_COL_WIDTH + MONTH_COL_WIDTH * 12;

  return (
    <div className="min-h-screen bg-bp-realized">
      <header className="bg-bp-black text-white px-6 py-4">
        <Link to={`/centros/${id}`} className="text-xs text-gray-300 hover:underline">
          &larr; Voltar ao Dashboard
        </Link>
        <h1 className="text-lg font-semibold mt-1">Input de Forecast — {ano}</h1>
        <p className="text-xs text-gray-400">
          Meses já realizados aparecem travados (fundo cinza). Meses futuros são editáveis (fundo
          branco, texto azul). As colunas de mês ficam sempre alinhadas entre as contas
          gerenciais abaixo.
        </p>
      </header>

      <main className="px-4 py-6 space-y-8 overflow-x-auto">
        <div style={{ minWidth: tableWidth }} className="space-y-8">
          {accounts.map((group) => (
            <section key={group.accountId} className="bg-white rounded shadow-sm">
              <div className="bg-bp-subtitle px-4 py-2 font-medium text-bp-header text-sm flex items-center justify-between gap-3">
                <span className="truncate">{group.accountName}</span>
                <AddSupplierControl
                  suppliers={allSuppliers.filter(
                    (s) => !group.rows.some((r) => r.supplierId === s.id)
                  )}
                  onAdd={(supplierId) => addSupplierToAccount(group.accountId, supplierId)}
                  onCreateNew={async (nome) => {
                    const result = await createSupplierAndAddToAccount(group.accountId, nome);
                    if (result.error) alert(`Não foi possível criar o fornecedor: ${result.error}`);
                  }}
                />
              </div>
              <table className="text-xs [table-layout:fixed] w-full">
                <ColGroup />
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
                      <td
                        className="px-3 py-2 text-bp-header font-medium truncate"
                        title={row.supplierName}
                      >
                        {row.supplierName}
                      </td>
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
                              className="w-full text-right text-bp-forecast font-medium border border-gray-200 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-bp-forecast"
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
        </div>

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
  onCreateNew,
}: {
  suppliers: { id: string; nome_padronizado: string }[];
  onAdd: (supplierId: string) => void;
  onCreateNew: (nome: string) => void | Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const normalizedQuery = query.trim().toLowerCase();
  const matches =
    normalizedQuery.length === 0
      ? []
      : suppliers
          .filter((s) => s.nome_padronizado.toLowerCase().includes(normalizedQuery))
          .slice(0, 8);

  const hasExactMatch = suppliers.some((s) => s.nome_padronizado.toLowerCase() === normalizedQuery);

  function handlePick(s: { id: string; nome_padronizado: string }) {
    onAdd(s.id);
    setQuery('');
    setOpen(false);
  }

  async function handleCreateNew() {
    const nome = query.trim();
    if (!nome) return;
    setCreating(true);
    await onCreateNew(nome);
    setCreating(false);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="relative w-56 flex-shrink-0">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="+ Buscar ou criar fornecedor…"
        className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 text-bp-header focus:outline-none focus:ring-1 focus:ring-bp-forecast"
      />
      {open && normalizedQuery.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-gray-200 rounded shadow-lg text-xs">
          {matches.map((s) => (
            <li
              key={s.id}
              onClick={() => handlePick(s)}
              className="px-2 py-1.5 text-bp-header hover:bg-bp-realized cursor-pointer truncate"
              title={s.nome_padronizado}
            >
              {s.nome_padronizado}
            </li>
          ))}
          {matches.length === 0 && (
            <li className="px-2 py-1.5 text-gray-400">Nenhum fornecedor encontrado</li>
          )}
          {!hasExactMatch && (
            <li
              onMouseDown={(e) => e.preventDefault()} // evita perder o foco antes do clique
              onClick={handleCreateNew}
              className="px-2 py-1.5 text-bp-forecast font-medium hover:bg-bp-realized cursor-pointer border-t border-gray-100"
            >
              {creating ? 'Criando…' : `+ Criar fornecedor novo: "${query.trim()}"`}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
