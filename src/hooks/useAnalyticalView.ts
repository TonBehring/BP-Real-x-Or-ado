import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { isPastOrCurrent } from '../lib/dateHelpers';

export type Classificacao = 'nao_orcado' | 'estouro' | 'economia' | 'neutro';

export interface AnalyticalSupplierRow {
  supplierId: string | null;
  supplierName: string;
  orcadoAno: number;
  realYtd: number;
  forecastRestante: number;
  realMaisForecast: number;
  desvioRs: number;
  desvioPct: number | null;
  classificacao: Classificacao;
  justificativa: string;
}

export interface AnalyticalAccountGroup {
  accountId: string;
  accountName: string;
  rows: AnalyticalSupplierRow[];
  subtotal: {
    orcadoAno: number;
    realMaisForecast: number;
    desvioRs: number;
    desvioPct: number | null;
  };
}

function classify(orcado: number, realMaisForecast: number): Classificacao {
  if (orcado === 0 && realMaisForecast === 0) return 'neutro';
  if (orcado === 0 && realMaisForecast !== 0) return 'nao_orcado';
  if (realMaisForecast > orcado) return 'estouro';
  return 'economia';
}

export function useAnalyticalView(costCenterId: string | undefined, ano: number) {
  const [groups, setGroups] = useState<AnalyticalAccountGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!costCenterId) return;
    setLoading(true);
    setError(null);

    const [accountsRes, budgetRes, actualRes, forecastRes, suppliersRes, justRes] = await Promise.all([
      supabase
        .from('managerial_accounts')
        .select('id, nome, ordem_exibicao')
        .eq('cost_center_id', costCenterId)
        .order('ordem_exibicao'),
      supabase
        .from('budget_entries')
        .select('managerial_account_id, supplier_id, valor')
        .eq('cost_center_id', costCenterId)
        .eq('ano', ano),
      supabase
        .from('actual_entries')
        .select('managerial_account_id, supplier_id, valor, tratamento, mes')
        .eq('cost_center_id', costCenterId)
        .eq('ano', ano),
      supabase
        .from('forecast_entries')
        .select('managerial_account_id, supplier_id, valor, mes')
        .eq('cost_center_id', costCenterId)
        .eq('ano', ano),
      supabase.from('suppliers').select('id, nome_padronizado').range(0, 9999),
      supabase
        .from('deviation_justifications')
        .select('managerial_account_id, supplier_id, texto')
        .eq('cost_center_id', costCenterId)
        .eq('ano', ano)
        .is('mes_referencia', null),
    ]);

    if (accountsRes.error) {
      setError(accountsRes.error.message);
      setLoading(false);
      return;
    }

    const supplierNameById = new Map<string, string>();
    (suppliersRes.data ?? []).forEach((s) => supplierNameById.set(s.id, s.nome_padronizado));

    const justByKey = new Map<string, string>();
    (justRes.data ?? []).forEach((j) => {
      justByKey.set(`${j.managerial_account_id}::${j.supplier_id ?? 'null'}`, j.texto);
    });

    const accountsMeta = accountsRes.data ?? [];
    const rowsByKey = new Map<
      string,
      { accountId: string; supplierId: string | null; orcado: number; realYtd: number; forecastRestante: number }
    >();

    function ensure(accountId: string, supplierId: string | null) {
      const key = `${accountId}::${supplierId ?? 'null'}`;
      let row = rowsByKey.get(key);
      if (!row) {
        row = { accountId, supplierId, orcado: 0, realYtd: 0, forecastRestante: 0 };
        rowsByKey.set(key, row);
      }
      return row;
    }

    (budgetRes.data ?? []).forEach((b) => {
      ensure(b.managerial_account_id, b.supplier_id).orcado += Number(b.valor);
    });
    (actualRes.data ?? []).forEach((a) => {
      if (a.tratamento === 'Não utilizar') return;
      ensure(a.managerial_account_id, a.supplier_id).realYtd += Number(a.valor);
    });
    (forecastRes.data ?? []).forEach((f) => {
      if (!isPastOrCurrent(ano, f.mes)) {
        ensure(f.managerial_account_id, f.supplier_id).forecastRestante += Number(f.valor);
      }
    });

    const groupsMap = new Map<string, AnalyticalAccountGroup>();
    accountsMeta.forEach((a) =>
      groupsMap.set(a.id, {
        accountId: a.id,
        accountName: a.nome,
        rows: [],
        subtotal: { orcadoAno: 0, realMaisForecast: 0, desvioRs: 0, desvioPct: null },
      })
    );

    for (const row of rowsByKey.values()) {
      const group = groupsMap.get(row.accountId);
      if (!group) continue;
      const realMaisForecast = row.realYtd + row.forecastRestante;
      const desvioRs = row.orcado - realMaisForecast;
      const desvioPct = row.orcado !== 0 ? desvioRs / row.orcado : null;
      group.rows.push({
        supplierId: row.supplierId,
        supplierName: row.supplierId ? supplierNameById.get(row.supplierId) ?? '(fornecedor)' : '(sem fornecedor)',
        orcadoAno: row.orcado,
        realYtd: row.realYtd,
        forecastRestante: row.forecastRestante,
        realMaisForecast,
        desvioRs,
        desvioPct,
        classificacao: classify(row.orcado, realMaisForecast),
        justificativa: justByKey.get(`${row.accountId}::${row.supplierId ?? 'null'}`) ?? '',
      });
    }

    for (const group of groupsMap.values()) {
      group.rows.sort((a, b) => a.desvioRs - b.desvioRs); // maiores estouros primeiro
      const orcadoAno = group.rows.reduce((s, r) => s + r.orcadoAno, 0);
      const realMaisForecast = group.rows.reduce((s, r) => s + r.realMaisForecast, 0);
      const desvioRs = orcadoAno - realMaisForecast;
      group.subtotal = {
        orcadoAno,
        realMaisForecast,
        desvioRs,
        desvioPct: orcadoAno !== 0 ? desvioRs / orcadoAno : null,
      };
    }

    setGroups(Array.from(groupsMap.values()));
    setLoading(false);
  }, [costCenterId, ano]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveJustificativa(accountId: string, supplierId: string | null, texto: string) {
    if (!costCenterId) return { error: 'Centro de custo ausente' };

    await supabase
      .from('deviation_justifications')
      .delete()
      .eq('cost_center_id', costCenterId)
      .eq('managerial_account_id', accountId)
      .eq('ano', ano)
      .is('mes_referencia', null)
      .filter('supplier_id', supplierId === null ? 'is' : 'eq', supplierId as any);

    if (texto.trim()) {
      const { error } = await supabase.from('deviation_justifications').insert({
        cost_center_id: costCenterId,
        managerial_account_id: accountId,
        supplier_id: supplierId,
        ano,
        mes_referencia: null,
        texto: texto.trim(),
      });
      if (error) return { error: error.message };
    }

    setGroups((prev) =>
      prev.map((g) => {
        if (g.accountId !== accountId) return g;
        return {
          ...g,
          rows: g.rows.map((r) => (r.supplierId === supplierId ? { ...r, justificativa: texto } : r)),
        };
      })
    );
    return { error: null };
  }

  return { groups, loading, error, saveJustificativa, refresh: load };
}
