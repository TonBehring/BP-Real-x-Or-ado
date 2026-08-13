import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { normalize, parseCurrencyToNumber, parseMonthYear } from '../lib/importParsers';

export interface ParsedRow {
  raw: Record<string, string>;
  ano: number | null;
  mes: number | null;
  costCenterRaw: string;
  managerialAccountName: string;
  supplierName: string;
  valor: number;
  tratamento: 'Utilizar' | 'Não utilizar';
  // resolução
  costCenterId: string | null;
  managerialAccountId: string | null;
  supplierId: string | null;
  supplierIsNew: boolean;
  status: 'ok' | 'erro';
  errorMessage?: string;
}

// Aliases de cabeçalho (tolerantes a variação de nome de coluna)
const HEADER_ALIASES: Record<string, string[]> = {
  data: ['data', 'fimmes', 'mes', 'mes/ano', 'mes_competencia'],
  centroCusto: ['centro de custo', 'centro de custo ajustado', 'centro resultado', 'centro_custo_ajustado'],
  conta: ['conta gerencial padronizada', 'conta gerencial', 'conta gerencial ajustado', 'conta_gerencial_ajustado'],
  fornecedor: ['nome padronizado', 'fornecedor', 'cliente/fornecedor', 'fornecedor_reclassificacao2'],
  valor: ['valor', 'valor ajustado', 'valor (r$)'],
  tipo: ['tipo'],
  tratamento: ['tratamento', 'usa p/l?'],
};

function findColumnIndex(headers: string[], aliasKey: string): number {
  const normalizedHeaders = headers.map(normalize);
  const aliases = HEADER_ALIASES[aliasKey].map(normalize);
  for (const alias of aliases) {
    const idx = normalizedHeaders.indexOf(alias);
    if (idx !== -1) return idx;
  }
  return -1;
}

function detectDelimiter(line: string): string {
  if (line.includes('\t')) return '\t';
  if (line.includes(';')) return ';';
  return ',';
}

interface CostCenterLite {
  id: string;
  codigo: string;
  nome: string;
}

/**
 * Resolve o texto de "Centro de Custo" da base geral (ex: "930600 - AQUISIÇÃO DE CONTEÚDO",
 * ou só "AQUISICAO DE CONTEUDO") para o cost_center_id já cadastrado no sistema.
 */
function resolveCostCenterId(raw: string, costCenters: CostCenterLite[]): string | null {
  if (!raw) return null;
  const match = raw.match(/^(\d+)\s*-\s*(.+)$/);
  if (match) {
    const codigo = match[1];
    const nome = match[2];
    const byCodigo = costCenters.find((cc) => cc.codigo === codigo);
    if (byCodigo) return byCodigo.id;
    const byNome = costCenters.find((cc) => normalize(cc.nome) === normalize(nome));
    if (byNome) return byNome.id;
  }
  const target = normalize(raw);
  const exact = costCenters.find((cc) => normalize(cc.nome) === target || cc.codigo === raw.trim());
  if (exact) return exact.id;
  // fallback tolerante: contém
  const partial = costCenters.find(
    (cc) => target.includes(normalize(cc.nome)) || normalize(cc.nome).includes(target)
  );
  return partial?.id ?? null;
}

export function useImportRealizado() {
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    inserted: number;
    skippedDuplicates: number;
    failed: number;
    failMessages: string[];
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  async function parsePastedText(text: string) {
    setParsing(true);
    setImportResult(null);
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      setParsedRows([]);
      setParsing(false);
      return;
    }

    const delimiter = detectDelimiter(lines[0]);
    const headers = lines[0].split(delimiter).map((h) => h.trim());

    const idxData = findColumnIndex(headers, 'data');
    const idxCentroCusto = findColumnIndex(headers, 'centroCusto');
    const idxConta = findColumnIndex(headers, 'conta');
    const idxFornecedor = findColumnIndex(headers, 'fornecedor');
    const idxValor = findColumnIndex(headers, 'valor');
    const idxTipo = findColumnIndex(headers, 'tipo');
    const idxTratamento = findColumnIndex(headers, 'tratamento');

    // Busca TODOS os centros de custo, contas gerenciais e fornecedores já cadastrados
    const [costCentersRes, accountsRes, suppliersRes] = await Promise.all([
      supabase.from('cost_centers').select('id, codigo, nome'),
      supabase.from('managerial_accounts').select('id, cost_center_id, nome'),
      supabase.from('suppliers').select('id, nome_padronizado, nomes_alternativos'),
    ]);
    const costCenters = (costCentersRes.data ?? []) as CostCenterLite[];
    const accounts = accountsRes.data ?? [];
    const suppliers = suppliersRes.data ?? [];

    function resolveAccountId(costCenterId: string, nome: string): string | null {
      const target = normalize(nome);
      const found = accounts.find((a) => a.cost_center_id === costCenterId && normalize(a.nome) === target);
      return found?.id ?? null;
    }

    function resolveSupplier(nome: string): { id: string | null; isNew: boolean } {
      const target = normalize(nome);
      const found = suppliers.find(
        (s) =>
          normalize(s.nome_padronizado) === target ||
          (s.nomes_alternativos ?? []).some((alt: string) => normalize(alt) === target)
      );
      if (found) return { id: found.id, isNew: false };
      return { id: null, isNew: true };
    }

    const rows: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delimiter).map((c) => c.trim());

      const tipoRaw = idxTipo !== -1 ? cols[idxTipo] : '';
      if (tipoRaw && normalize(tipoRaw) !== 'realizado') {
        continue; // ignora ORÇAMENTO/FORECAST se a coluna Tipo existir
      }

      const dataRaw = idxData !== -1 ? cols[idxData] : '';
      const centroCustoRaw = idxCentroCusto !== -1 ? cols[idxCentroCusto] : '';
      const contaRaw = idxConta !== -1 ? cols[idxConta] : '';
      const fornecedorRaw = idxFornecedor !== -1 ? cols[idxFornecedor] : '';
      const valorRaw = idxValor !== -1 ? cols[idxValor] : '';
      const tratamentoRaw = idxTratamento !== -1 ? cols[idxTratamento] : '';

      const monthYear = parseMonthYear(dataRaw);
      const valorNum = Math.abs(parseCurrencyToNumber(valorRaw));
      const costCenterId = centroCustoRaw ? resolveCostCenterId(centroCustoRaw, costCenters) : null;
      const accountId = costCenterId && contaRaw ? resolveAccountId(costCenterId, contaRaw) : null;
      const supplierResolved = fornecedorRaw ? resolveSupplier(fornecedorRaw) : { id: null, isNew: false };
      const tratamento: 'Utilizar' | 'Não utilizar' =
        normalize(tratamentoRaw) === 'nao utilizar' || normalize(tratamentoRaw) === 'não utilizar'
          ? 'Não utilizar'
          : 'Utilizar';

      let status: 'ok' | 'erro' = 'ok';
      let errorMessage: string | undefined;

      if (!monthYear) {
        status = 'erro';
        errorMessage = 'Data não reconhecida';
      } else if (!costCenterId) {
        status = 'erro';
        errorMessage = `Centro de custo "${centroCustoRaw}" ainda não cadastrado no sistema`;
      } else if (!accountId) {
        status = 'erro';
        errorMessage = `Conta gerencial "${contaRaw}" não encontrada neste centro de custo`;
      } else if (!fornecedorRaw) {
        status = 'erro';
        errorMessage = 'Fornecedor vazio';
      } else if (valorNum === 0) {
        status = 'erro';
        errorMessage = 'Valor zerado ou não reconhecido';
      }

      rows.push({
        raw: Object.fromEntries(headers.map((h, idx) => [h, cols[idx] ?? ''])),
        ano: monthYear?.ano ?? null,
        mes: monthYear?.mes ?? null,
        costCenterRaw: centroCustoRaw,
        managerialAccountName: contaRaw,
        supplierName: fornecedorRaw,
        valor: valorNum,
        tratamento,
        costCenterId,
        managerialAccountId: accountId,
        supplierId: supplierResolved.id,
        supplierIsNew: supplierResolved.isNew,
        status,
        errorMessage,
      });
    }

    setParsedRows(rows);
    setParsing(false);
  }

  async function confirmImport() {
    setImporting(true);
    setImportError(null);
    let inserted = 0;
    let skippedDuplicates = 0;
    let failed = 0;
    const failMessages: string[] = [];

    try {
      const validRows = parsedRows.filter((r) => r.status === 'ok');

      const newSupplierNames = Array.from(
        new Set(validRows.filter((r) => r.supplierIsNew).map((r) => r.supplierName))
      );
      const createdSupplierIds = new Map<string, string>();
      for (const name of newSupplierNames) {
        const { data, error } = await supabase
          .from('suppliers')
          .insert({ nome_padronizado: name, nomes_alternativos: [] })
          .select('id')
          .single();
        if (error) {
          failMessages.push(`Fornecedor "${name}": ${error.message}`);
        } else if (data) {
          createdSupplierIds.set(normalize(name), data.id);
        }
      }

      for (const row of validRows) {
        const supplierId: string | null =
          row.supplierId ?? createdSupplierIds.get(normalize(row.supplierName)) ?? null;

        if (!supplierId) {
          failed++;
          failMessages.push(`${row.supplierName} (${row.mes}/${row.ano}): fornecedor não pôde ser resolvido`);
          continue;
        }

        const { data: existing, error: selectError } = await supabase
          .from('actual_entries')
          .select('id')
          .eq('cost_center_id', row.costCenterId as string)
          .eq('managerial_account_id', row.managerialAccountId as string)
          .eq('supplier_id', supplierId)
          .eq('ano', row.ano as number)
          .eq('mes', row.mes as number)
          .eq('valor', row.valor);

        if (selectError) {
          failed++;
          failMessages.push(`${row.supplierName} (${row.mes}/${row.ano}): ${selectError.message}`);
          continue;
        }

        if (existing && existing.length > 0) {
          skippedDuplicates++;
          continue;
        }

        const { error: insertError } = await supabase.from('actual_entries').insert({
          cost_center_id: row.costCenterId,
          managerial_account_id: row.managerialAccountId,
          supplier_id: supplierId,
          ano: row.ano,
          mes: row.mes,
          valor: row.valor,
          origem: 'BASE',
          tratamento: row.tratamento,
        });

        if (insertError) {
          failed++;
          failMessages.push(`${row.supplierName} (${row.mes}/${row.ano}): ${insertError.message}`);
        } else {
          inserted++;
        }
      }

      setImportResult({ inserted, skippedDuplicates, failed, failMessages: failMessages.slice(0, 20) });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Erro inesperado durante a importação.');
    } finally {
      setImporting(false);
    }
  }

  return {
    parsedRows,
    parsing,
    importing,
    importResult,
    importError,
    parsePastedText,
    confirmImport,
  };
}
