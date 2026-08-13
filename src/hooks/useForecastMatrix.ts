import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { isPastOrCurrent } from '../lib/dateHelpers';

export interface MonthCell {
  orcado: number;
  real: number;
  forecast: number;
  forecastEntryId: string | null;
  isPast: boolean;
}

export interface SupplierRow {
  supplierId: string | null;
  supplierName: string;
  months: Record<number, MonthCell>; // chave = mes (1-12)
}

export interface AccountGroup {
  accountId: string;
  accountName: string;
  rows: SupplierRow[];
}

interface SupplierOption {
  id: string;
  nome_padronizado: string;
}

export function useForecastMatrix(costCenterId: string | undefined, ano: number) {
  const [accounts, setAccounts] = useState<AccountGroup[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!costCenterId) return;
    setLoading(true);
    setError(null);

    const [accountsRes, budgetRes, actualRes, forecastRes, suppliersRes] = await Promise.all([
      supabase
        .from('managerial_accounts')
        .select('id, nome, ordem_exibicao')
        .eq('cost_center_id', costCenterId)
        .order('ordem_exibicao'),
      supabase
        .from('budget_entries')
        .select('id, managerial_account_id, supplier_id, mes, valor')
        .eq('cost_center_id', costCenterId)
        .eq('ano', ano),
      supabase
        .from('actual_entries')
        .select('id, managerial_account_id, supplier_id, mes, valor')
        .eq('cost_center_id', costCenterId)
        .eq('ano', ano),
      supabase
        .from('forecast_entries')
        .select('id, managerial_account_id, supplier_id, mes, valor')
        .eq('cost_center_id', costCenterId)
        .eq('ano', ano),
      supabase.from('suppliers').select('id, nome_padronizado').order('nome_padronizado'),
    ]);

    if (accountsRes.error) {
      setError(accountsRes.error.message);
      setLoading(false);
      return;
    }

    const supplierNameById = new Map<string, string>();
    (suppliersRes.data ?? []).forEach((s) => supplierNameById.set(s.id, s.nome_padronizado));
    setAllSuppliers((suppliersRes.data ?? []) as SupplierOption[]);

    const groups: AccountGroup[] = (accountsRes.data ?? []).map((acc) => ({
      accountId: acc.id,
      accountName: acc.nome,
      rows: [],
    }));

    const rowKey = (accountId: string, supplierId: string | null) => `${accountId}::${supplierId ?? 'null'}`;
    const rowsByKey = new Map<string, SupplierRow>();

    function ensureRow(accountId: string, supplierId: string | null) {
      const key = rowKey(accountId, supplierId);
      let row = rowsByKey.get(key);
      if (!row) {
        row = {
          supplierId,
          supplierName: supplierId ? supplierNameById.get(supplierId) ?? '(fornecedor removido)' : '(sem fornecedor)',
          months: emptyMonthsForYear(ano),
        };
        rowsByKey.set(key, row);
        const group = groups.find((g) => g.accountId === accountId);
        group?.rows.push(row);
      }
      return row;
    }

    (budgetRes.data ?? []).forEach((b) => {
      const row = ensureRow(b.managerial_account_id, b.supplier_id);
      row.months[b.mes].orcado = Number(b.valor);
    });

    (actualRes.data ?? []).forEach((a) => {
      const row = ensureRow(a.managerial_account_id, a.supplier_id);
      row.months[a.mes].real = Number(a.valor);
    });

    (forecastRes.data ?? []).forEach((f) => {
      const row = ensureRow(f.managerial_account_id, f.supplier_id);
      row.months[f.mes].forecast = Number(f.valor);
      row.months[f.mes].forecastEntryId = f.id;
    });

    setAccounts(groups);
    setLoading(false);
  }, [costCenterId, ano]);

  useEffect(() => {
    load();
  }, [load]);

  function addSupplierToAccount(accountId: string, supplierId: string) {
    setAccounts((prev) =>
      prev.map((g) => {
        if (g.accountId !== accountId) return g;
        if (g.rows.some((r) => r.supplierId === supplierId)) return g; // já existe
        const supplier = allSuppliers.find((s) => s.id === supplierId);
        const newRow: SupplierRow = {
          supplierId,
          supplierName: supplier?.nome_padronizado ?? '(fornecedor)',
          months: emptyMonthsForYear(ano),
        };
        return { ...g, rows: [...g.rows, newRow] };
      })
    );
  }

  async function updateForecastCell(accountId: string, supplierId: string | null, mes: number, valor: number) {
    if (!costCenterId) return { error: 'Centro de custo ausente' };

    const { data, error } = await supabase
      .from('forecast_entries')
      .upsert(
        {
          cost_center_id: costCenterId,
          managerial_account_id: accountId,
          supplier_id: supplierId,
          ano,
          mes,
          valor,
        },
        { onConflict: 'cost_center_id,managerial_account_id,supplier_id,ano,mes' }
      )
      .select('id')
      .single();

    if (error) return { error: error.message };

    setAccounts((prev) =>
      prev.map((g) => {
        if (g.accountId !== accountId) return g;
        return {
          ...g,
          rows: g.rows.map((r) => {
            if (r.supplierId !== supplierId) return r;
            return {
              ...r,
              months: {
                ...r.months,
                [mes]: { ...r.months[mes], forecast: valor, forecastEntryId: data?.id ?? r.months[mes].forecastEntryId },
              },
            };
          }),
        };
      })
    );

    return { error: null };
  }

  return { accounts, allSuppliers, loading, error, addSupplierToAccount, updateForecastCell, refresh: load };
}

function emptyMonthsForYear(ano: number): Record<number, MonthCell> {
  const months: Record<number, MonthCell> = {};
  for (let m = 1; m <= 12; m++) {
    months[m] = { orcado: 0, real: 0, forecast: 0, forecastEntryId: null, isPast: isPastOrCurrent(ano, m) };
  }
  return months;
}
