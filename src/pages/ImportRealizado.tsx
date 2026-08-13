import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useImportRealizado } from '../hooks/useImportRealizado';
import { formatCurrency } from '../lib/dateHelpers';

export default function ImportRealizado() {
  const { profile } = useAuth();
  const [text, setText] = useState('');
  const { parsedRows, parsing, importing, importResult, importError, parsePastedText, confirmImport } =
    useImportRealizado();

  if (profile && profile.papel !== 'fpna_admin') {
    return (
      <div className="p-6">
        <p className="text-sm text-bp-estouro">
          Esta área é restrita ao FP&A. Fale com o time de FP&A para importar dados de Realizado.
        </p>
      </div>
    );
  }

  const okRows = parsedRows.filter((r) => r.status === 'ok');
  const errorRows = parsedRows.filter((r) => r.status === 'erro');
  const costCentersInPreview = new Set(okRows.map((r) => r.costCenterRaw)).size;

  return (
    <div className="min-h-screen bg-bp-realized">
      <header className="bg-bp-black text-white px-6 py-4">
        <Link to="/" className="text-xs text-gray-300 hover:underline">
          &larr; Meus centros de custo
        </Link>
        <h1 className="text-lg font-semibold mt-1">Importar Realizado (base geral → sistema)</h1>
        <p className="text-xs text-gray-400">
          Cole abaixo as linhas de REALIZADO da base geral (CONSOLIDADO_REALIZADO), de TODOS os
          centros de custo de uma vez. O sistema distribui cada linha pro centro de custo certo
          automaticamente, pela coluna "Centro de Custo".
        </p>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <section className="bg-white rounded shadow-sm p-4 space-y-3">
          <p className="text-xs text-gray-500">
            Colunas esperadas (nomes flexíveis, ordem não importa):{' '}
            <code>Data</code>, <code>Centro de Custo</code> (ex: "930600 - AQUISIÇÃO DE CONTEÚDO"),{' '}
            <code>Conta Gerencial Padronizada</code>, <code>Nome Padronizado</code> (fornecedor),{' '}
            <code>Valor</code>, <code>Tipo</code> (opcional — se existir, só linhas "REALIZADO" são
            importadas). Só entram linhas cujo Centro de Custo e Conta Gerencial já estejam
            cadastrados no sistema — os demais aparecem como erro na pré-visualização.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            placeholder="Cole aqui as linhas copiadas da base geral (incluindo o cabeçalho na primeira linha)…"
            className="w-full border border-gray-300 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-bp-forecast"
          />
          <button
            onClick={() => parsePastedText(text)}
            disabled={!text.trim() || parsing}
            className="bg-bp-black text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {parsing ? 'Processando…' : 'Pré-visualizar'}
          </button>
        </section>

        {parsedRows.length > 0 && (
          <section className="bg-white rounded shadow-sm">
            <div className="bg-bp-subtitle px-4 py-2 font-medium text-bp-header text-sm flex items-center justify-between">
              <span>
                {okRows.length} linha(s) prontas para importar (em {costCentersInPreview} centro(s)
                de custo) · {errorRows.length} com erro
              </span>
              <button
                onClick={confirmImport}
                disabled={okRows.length === 0 || importing}
                className="bg-bp-black text-white rounded px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                {importing ? 'Importando…' : `Confirmar importação (${okRows.length})`}
              </button>
            </div>

            <table className="w-full text-xs">
              <thead>
                <tr className="bg-bp-header text-white">
                  <th className="text-left px-2 py-2">Status</th>
                  <th className="text-left px-2 py-2">Mês/Ano</th>
                  <th className="text-left px-2 py-2">Centro de Custo</th>
                  <th className="text-left px-2 py-2">Conta Gerencial</th>
                  <th className="text-left px-2 py-2">Fornecedor</th>
                  <th className="text-right px-2 py-2">Valor</th>
                  <th className="text-left px-2 py-2">Observação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {parsedRows.map((row, i) => (
                  <tr key={i} className={row.status === 'erro' ? 'bg-red-50' : ''}>
                    <td className="px-2 py-1.5">
                      {row.status === 'ok' ? (
                        <span className="text-bp-economia">OK</span>
                      ) : (
                        <span className="text-bp-estouro">Erro</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {row.mes && row.ano ? `${row.mes}/${row.ano}` : '–'}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{row.costCenterRaw}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{row.managerialAccountName}</td>
                    <td className="px-2 py-1.5">
                      {row.supplierName}
                      {row.supplierIsNew && (
                        <span className="ml-1 text-[10px] text-bp-forecast">(novo fornecedor)</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right">{formatCurrency(row.valor)}</td>
                    <td className="px-2 py-1.5 text-bp-estouro">{row.errorMessage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {importError && (
          <section className="bg-white rounded shadow-sm p-4 text-sm">
            <p className="text-bp-estouro font-medium">Erro durante a importação: {importError}</p>
          </section>
        )}

        {importResult && (
          <section className="bg-white rounded shadow-sm p-4 text-sm space-y-1">
            <p className="text-bp-economia font-medium">
              {importResult.inserted} linha(s) importada(s) com sucesso.
            </p>
            {importResult.skippedDuplicates > 0 && (
              <p className="text-gray-500">
                {importResult.skippedDuplicates} linha(s) ignoradas por já existirem (mesmo
                fornecedor, mês e valor).
              </p>
            )}
            {importResult.failed > 0 && (
              <div>
                <p className="text-bp-estouro font-medium">
                  {importResult.failed} linha(s) falharam ao importar:
                </p>
                <ul className="list-disc list-inside text-xs text-bp-estouro">
                  {importResult.failMessages.map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
