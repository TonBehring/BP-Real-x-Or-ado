import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useImportRealizado } from '../hooks/useImportRealizado';
import { formatCurrency } from '../lib/dateHelpers';
import ConfirmDialog from '../components/ConfirmDialog';

export default function ImportRealizado() {
  const { profile } = useAuth();
  const [text, setText] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const {
    parsedRows,
    parsing,
    importing,
    importResult,
    importError,
    pendingScopes,
    parsePastedText,
    confirmImport,
  } = useImportRealizado();

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

  async function handleConfirmed() {
    setShowConfirm(false);
    await confirmImport();
  }

  return (
    <div className="min-h-screen bg-bp-realized">
      <header className="bg-bp-black text-white px-6 py-4">
        <Link to="/" className="text-xs text-gray-300 hover:underline">
          &larr; Meus centros de custo
        </Link>
        <h1 className="text-lg font-semibold mt-1">Importar Realizado (base geral → sistema)</h1>
        <p className="text-xs text-gray-400">
          Cole abaixo as linhas de REALIZADO da base geral (CONSOLIDADO_REALIZADO). Esta importação{' '}
          <strong>sobrescreve</strong> o Realizado dos centros de custo e anos presentes na base
          colada — cole sempre a base completa daquele período, não só as linhas novas.
        </p>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <section className="bg-white rounded shadow-sm p-4 space-y-3">
          <p className="text-xs text-gray-500">
            Colunas esperadas (nomes flexíveis, ordem não importa): <code>Data</code>,{' '}
            <code>Centro de Custo</code> (ex: "930600 - AQUISIÇÃO DE CONTEÚDO"),{' '}
            <code>Conta Gerencial Padronizada</code>, <code>Nome Padronizado</code> (fornecedor),{' '}
            <code>Valor</code>, <code>Tipo</code> (opcional — se existir, só linhas "REALIZADO" ou
            "PASSADO" são importadas). Centros de custo, contas gerenciais e fornecedores que ainda
            não existirem no sistema são <strong>criados automaticamente</strong>.
          </p>
          <p className="text-xs text-bp-estouro font-medium">
            ⚠️ Ao confirmar, o Realizado já existente dos centros de custo e anos presentes nesta
            base é apagado e substituído pelo que você colou. Ajustes manuais (como lançamentos
            neutralizados) não são afetados.
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
                onClick={() => setShowConfirm(true)}
                disabled={okRows.length === 0 || importing}
                className="bg-bp-black text-white rounded px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                {importing ? 'Importando…' : `Sobrescrever e importar (${okRows.length})`}
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
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {row.costCenterRaw}
                      {row.costCenterIsNew && (
                        <span className="ml-1 text-[10px] text-bp-forecast">(novo centro de custo)</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {row.managerialAccountName}
                      {row.managerialAccountIsNew && (
                        <span className="ml-1 text-[10px] text-bp-forecast">(nova conta)</span>
                      )}
                    </td>
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
            {importResult.escoposSubstituidos.length > 0 && (
              <div>
                <p className="text-gray-500">Escopos sobrescritos:</p>
                <ul className="list-disc list-inside text-xs text-gray-500">
                  {importResult.escoposSubstituidos.map((e, i) => (
                    <li key={i}>
                      {e.costCenterNome} — {e.ano}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(importResult.newCostCenters > 0 || importResult.newAccounts > 0 || importResult.newSuppliers > 0) && (
              <p className="text-bp-forecast">
                Criados automaticamente: {importResult.newCostCenters} centro(s) de custo,{' '}
                {importResult.newAccounts} conta(s) gerencial(is), {importResult.newSuppliers} fornecedor(es).
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

      <ConfirmDialog
        open={showConfirm}
        title="Sobrescrever Realizado"
        message={
          'Isso vai APAGAR o Realizado já importado (não afeta ajustes manuais) e recriar do zero para:\n\n' +
          pendingScopes.map((s) => `• ${s.costCenterNome} — ${s.ano}`).join('\n') +
          '\n\nConfirma?'
        }
        confirmLabel="Sim, sobrescrever"
        onConfirm={handleConfirmed}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
