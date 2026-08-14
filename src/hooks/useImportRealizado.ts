import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { normalize, parseCurrencyToNumber, parseMonthYear } from '../lib/importParsers';

export interface ParsedRow {
  ano: number | null;
  mes: number | null;
  costCenterRaw: string;
  costCenterCodigo: string | null; // extraído de "930600 - AQUISIÇÃO DE CONTEÚDO"
  costCenterNome: string | null;
  managerialAccountName: string;
  supplierName: string;
  valor: number;
  tratamento: 'Utilizar' | 'Não utilizar';
  // resolução (preenchida na pré-visualização)
  costCenterId: string | null; // null enquanto pendente de criação
  costCenterIsNew: boolean;
  managerialAccountId: string | null;
  managerialAccountIsNew: boolean;
  supplierId: string | null;
  supplierIsNew: boolean;
  status: 'ok' | 'erro';
  errorMessage?: string;
}

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
  codigos_alternativos?: string[];
}
interface AccountLite {
  id: string;
  cost_center_id: string;
  nome: string;
}
interface SupplierLite {
  id: string;
  nome_padronizado: string;
  nomes_alternativos: string[];
}

/** Extrai {codigo, nome} de "930600 - AQUISIÇÃO DE CONTEÚDO". Sem código, retorna nome=raw e codigo=null. */
function splitCostCenterRaw(raw: string): { codigo: string | null; nome: string } {
  const match = raw.match(/^(\d+)\s*-\s*(.+)$/);
  if (match) return { codigo: match[1], nome: match[2].trim() };
  return { codigo: null, nome: raw.trim() };
}

function resolveCostCenter(raw: string, costCenters: CostCenterLite[]): CostCenterLite | null {
  const { codigo, nome } = splitCostCenterRaw(raw);
  const target = normalize(nome);

  if (codigo) {
    const byCodigo = costCenters.find(
      (cc) => cc.codigo === codigo || (cc.codigos_alternativos ?? []).includes(codigo)
    );
    if (byCodigo) return byCodigo;
  }

  const exact = costCenters.find((cc) => normalize(cc.nome) === target);
  if (exact) return exact;

  // Verifica se o nome bate com algum código/nome "antigo" guardado numa fusão anterior
  const byAlt = costCenters.find((cc) =>
    (cc.codigos_alternativos ?? []).some(
      (alt) => normalize(alt) === target || alt === codigo || alt === raw.trim()
    )
  );
  if (byAlt) return byAlt;

  const partial = costCenters.find(
    (cc) => target.includes(normalize(cc.nome)) || normalize(cc.nome).includes(target)
  );
  return partial ?? null;
}

export function useImportRealizado() {
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    inserted: number;
    skippedDuplicates: number;
    failed: number;
    newCostCenters: number;
    newAccounts: number;
    newSuppliers: number;
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

    const [costCentersRes, accountsRes, suppliersRes] = await Promise.all([
      supabase.from('cost_centers').select('id, codigo, nome, codigos_alternativos').eq('ativo',true).range(0, 9999),
      supabase.from('managerial_accounts').select('id, cost_center_id, nome').range(0, 9999),
      supabase.from('suppliers').select('id, nome_padronizado, nomes_alternativos').range(0, 9999),
    ]);
    const costCenters = (costCentersRes.data ?? []) as CostCenterLite[];
    const accounts = (accountsRes.data ?? []) as AccountLite[];
    const suppliers = (suppliersRes.data ?? []) as SupplierLite[];

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
          (s.nomes_alternativos ?? []).some((alt) => normalize(alt) === target)
      );
      if (found) return { id: found.id, isNew: false };
      return { id: null, isNew: true };
    }

    const rows: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delimiter).map((c) => c.trim());

      const tipoRaw = idxTipo !== -1 ? cols[idxTipo] : '';
      const tipoNormalizado = tipoRaw ? normalize(tipoRaw) : '';
      if (tipoNormalizado && tipoNormalizado !== 'realizado' && tipoNormalizado !== 'passado') continue;

      const dataRaw = idxData !== -1 ? cols[idxData] : '';
      const centroCustoRaw = idxCentroCusto !== -1 ? cols[idxCentroCusto] : '';
      const contaRaw = idxConta !== -1 ? cols[idxConta] : '';
      const fornecedorRaw = idxFornecedor !== -1 ? cols[idxFornecedor] : '';
      const valorRaw = idxValor !== -1 ? cols[idxValor] : '';
      const tratamentoRaw = idxTratamento !== -1 ? cols[idxTratamento] : '';

      const monthYear = parseMonthYear(dataRaw);
      const valorNum = Math.abs(parseCurrencyToNumber(valorRaw));

      const resolvedCC = centroCustoRaw ? resolveCostCenter(centroCustoRaw, costCenters) : null;
      const { codigo: ccCodigo, nome: ccNome } = centroCustoRaw
        ? splitCostCenterRaw(centroCustoRaw)
        : { codigo: null, nome: '' };
      const costCenterIsNew = !resolvedCC && !!centroCustoRaw;

      const accountId =
        resolvedCC && contaRaw ? resolveAccountId(resolvedCC.id, contaRaw) : null;
      const managerialAccountIsNew = !!contaRaw && !accountId; // novo se CC existir ou não

      const supplierResolved = fornecedorRaw ? resolveSupplier(fornecedorRaw) : { id: null, isNew: false };
      const tratamento: 'Utilizar' | 'Não utilizar' =
        normalize(tratamentoRaw) === 'nao utilizar' ? 'Não utilizar' : 'Utilizar';

      let status: 'ok' | 'erro' = 'ok';
      let errorMessage: string | undefined;

      if (!monthYear) {
        status = 'erro';
        errorMessage = 'Data não reconhecida';
      } else if (!centroCustoRaw) {
        status = 'erro';
        errorMessage = 'Centro de custo vazio';
      } else if (!contaRaw) {
        status = 'erro';
        errorMessage = 'Conta gerencial vazia';
      } else if (!fornecedorRaw) {
        status = 'erro';
        errorMessage = 'Fornecedor vazio';
      } else if (valorNum === 0) {
        status = 'erro';
        errorMessage = 'Valor zerado ou não reconhecido';
      }

      rows.push({
        ano: monthYear?.ano ?? null,
        mes: monthYear?.mes ?? null,
        costCenterRaw: centroCustoRaw,
        costCenterCodigo: ccCodigo,
        costCenterNome: ccNome || null,
        managerialAccountName: contaRaw,
        supplierName: fornecedorRaw,
        valor: valorNum,
        tratamento,
        costCenterId: resolvedCC?.id ?? null,
        costCenterIsNew,
        managerialAccountId: accountId,
        managerialAccountIsNew,
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
    let newCostCentersCount = 0;
    let newAccountsCount = 0;
    let newSuppliersCount = 0;
    const failMessages: string[] = [];

    try {
      const validRows = parsedRows.filter((r) => r.status === 'ok');

      // 1) Criar Centros de Custo novos (dedup por código real, ou pelo nome quando não há código)
      function ccDedupKey(codigo: string | null, nome: string) {
        return codigo ?? `NOME:${normalize(nome)}`;
      }
      function slugifyAsCodigo(nome: string) {
        return (
          normalize(nome)
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '') || 'CC'
        );
      }

      const newCcMap = new Map<string, { codigo: string; nome: string }>(); // dedupKey -> {codigo real ou gerado, nome}
      validRows
        .filter((r) => r.costCenterIsNew)
        .forEach((r) => {
          const key = ccDedupKey(r.costCenterCodigo, r.costCenterNome ?? r.costCenterRaw);
          if (!newCcMap.has(key)) {
            const codigo = r.costCenterCodigo ?? slugifyAsCodigo(r.costCenterNome ?? r.costCenterRaw);
            newCcMap.set(key, { codigo, nome: r.costCenterNome ?? r.costCenterRaw });
          }
        });

      const costCenterIdByDedupKey = new Map<string, string>();
      for (const [key, { codigo, nome }] of newCcMap) {
        const { data, error } = await supabase
          .from('cost_centers')
          .insert({ codigo, nome, ativo: true })
          .select('id')
          .single();
        if (error) {
          // Colisão de código (ex.: mesma conta com pontuação diferente gerou o
          // mesmo código-placeholder) — em vez de falhar, reaproveita o registro existente.
          if (error.code === '23505') {
            const { data: existing } = await supabase
              .from('cost_centers')
              .select('id')
              .eq('codigo', codigo)
              .single();
            if (existing) {
              costCenterIdByDedupKey.set(key, existing.id);
              continue;
            }
          }
          failMessages.push(`Centro de custo "${codigo} - ${nome}": ${error.message}`);
        } else if (data) {
          costCenterIdByDedupKey.set(key, data.id);
          newCostCentersCount++;
        }
      }

      function resolveRowCostCenterId(row: ParsedRow): string | null {
        if (row.costCenterId) return row.costCenterId;
        const key = ccDedupKey(row.costCenterCodigo, row.costCenterNome ?? row.costCenterRaw);
        return costCenterIdByDedupKey.get(key) ?? null;
      }

      // 2) Criar Contas Gerenciais novas (dedup por cost_center_id + nome)
      const newAccountKeys = new Map<string, { costCenterId: string; nome: string }>();
      for (const row of validRows) {
        if (!row.managerialAccountIsNew) continue;
        const ccId = resolveRowCostCenterId(row);
        if (!ccId) continue;
        const key = `${ccId}::${normalize(row.managerialAccountName)}`;
        if (!newAccountKeys.has(key)) {
          newAccountKeys.set(key, { costCenterId: ccId, nome: row.managerialAccountName });
        }
      }

      const accountIdByKey = new Map<string, string>();
      for (const [key, { costCenterId, nome }] of newAccountKeys) {
        const { data, error } = await supabase
          .from('managerial_accounts')
          .insert({ cost_center_id: costCenterId, nome, ordem_exibicao: 0 })
          .select('id')
          .single();
        if (error) {
          if (error.code === '23505') {
            const { data: existing } = await supabase
              .from('managerial_accounts')
              .select('id')
              .eq('cost_center_id', costCenterId)
              .eq('nome', nome)
              .single();
            if (existing) {
              accountIdByKey.set(key, existing.id);
              continue;
            }
          }
          failMessages.push(`Conta gerencial "${nome}": ${error.message}`);
        } else if (data) {
          accountIdByKey.set(key, data.id);
          newAccountsCount++;
        }
      }

      function resolveRowAccountId(row: ParsedRow, ccId: string): string | null {
        if (row.managerialAccountId) return row.managerialAccountId;
        const key = `${ccId}::${normalize(row.managerialAccountName)}`;
        return accountIdByKey.get(key) ?? null;
      }

      // 3) Criar Fornecedores novos (dedup por nome)
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
          if (error.code === '23505') {
            const { data: existing } = await supabase
              .from('suppliers')
              .select('id')
              .eq('nome_padronizado', name)
              .single();
            if (existing) {
              createdSupplierIds.set(normalize(name), existing.id);
              continue;
            }
          }
          failMessages.push(`Fornecedor "${name}": ${error.message}`);
        } else if (data) {
          createdSupplierIds.set(normalize(name), data.id);
          newSuppliersCount++;
        }
      }

      // 4) Inserir os lançamentos de Realizado
      for (const row of validRows) {
        const ccId = resolveRowCostCenterId(row);
        if (!ccId) {
          failed++;
          failMessages.push(`${row.costCenterRaw}: centro de custo não pôde ser criado/resolvido`);
          continue;
        }
        const accountId = resolveRowAccountId(row, ccId);
        if (!accountId) {
          failed++;
          failMessages.push(`${row.managerialAccountName}: conta gerencial não pôde ser criada/resolvida`);
          continue;
        }
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
          .eq('cost_center_id', ccId)
          .eq('managerial_account_id', accountId)
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
          cost_center_id: ccId,
          managerial_account_id: accountId,
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

      setImportResult({
        inserted,
        skippedDuplicates,
        failed,
        newCostCenters: newCostCentersCount,
        newAccounts: newAccountsCount,
        newSuppliers: newSuppliersCount,
        failMessages: failMessages.slice(0, 30),
      });
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
