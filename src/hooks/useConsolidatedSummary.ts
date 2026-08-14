import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { isPastOrCurrent } from '../lib/dateHelpers';

export interface MonthSummary {
  mes: number;
  orcado: number;
  realizado: number;
  forecast: number;
  realOuForecast: number; // realizado se mês passado, forecast se futuro
  desvioRs: number;
  desvioPct: number | null; // null quando orçado = 0 (evita divisão por zero)
}

export interface AccountSummary {
  accountId: string;
  accountName: string;
  orcadoAno: number;
  realYtd: number;
  forecastRestante: number;
  realMaisForecast: number;
  desvioRs: number;
  desvioPct: number | null;
}

export interface CostCenterSummary {
  months: MonthSummary[];
  accounts: AccountSummary[];
  orcadoAno: number;
  realMaisForecastAno: number;
  desvioRsAno: number;
  desvioPctAno: number | null;
}

export function useCostCenterSummary(costCenterId: string | undefined, ano: number) {
  const [summary, setSummary] = useState<CostCenterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!costCenterId) return;
    setLoading(true);
    setError(null);

    const [accountsRes, budgetRes, actualRes, forecastRes] = await Promise.all([
      supabase
        .from('managerial_accounts')
        .select('id, nome, ordem_exibicao')
        .eq('cost_center_id', costCenterId)
        .order('ordem_exibicao'),
      supabase
        .from('budget_entries')
        .select('managerial_account_id, mes, valor')
        .eq('cost_center_id', costCenterId)
        .eq('ano', ano),
      supabase
        .from('actual_entries')
        .select('managerial_account_id, mes, valor, tratamento')
        .eq('cost_center_id', costCenterId)
        .eq('ano', ano),
      supabase
        .from('forecast_entries')
        .select('managerial_account_id, mes, valor')
        .eq('cost_center_id', costCenterId)
        .eq('ano', ano),
    ]);

    if (accountsRes.error) {
      setError(accountsRes.error.message);
      setLoading(false);
      return;
    }

    const accountsMeta = accountsRes.data ?? [];

    // Totais por mês (todas as contas somadas)
    const monthTotals: Record<number, { orcado: number; realizado: number; forecast: number }> = {};
    for (let m = 1; m <= 12; m++) monthTotals[m] = { orcado: 0, realizado: 0, forecast: 0 };

    // Totais por conta gerencial
    const accountTotals: Record<
      string,
      { orcadoAno: number; realYtd: number; forecastRestante: number }
    > = {};
    accountsMeta.forEach((a) => {
      accountTotals[a.id] = { orcadoAno: 0, realYtd: 0, forecastRestante: 0 };
    });

    (budgetRes.data ?? []).forEach((b) => {
      monthTotals[b.mes].orcado += Number(b.valor);
      if (accountTotals[b.managerial_account_id]) {
        accountTotals[b.managerial_account_id].orcadoAno += Number(b.valor);
      }
    });

    (actualRes.data ?? []).forEach((a) => {
      if (a.tratamento === 'Não utilizar') return; // exclui lançamentos neutralizados
      monthTotals[a.mes].realizado += Number(a.valor);
      if (accountTotals[a.managerial_account_id]) {
        accountTotals[a.managerial_account_id].realYtd += Number(a.valor);
      }
    });

    (forecastRes.data ?? []).forEach((f) => {
      monthTotals[f.mes].forecast += Number(f.valor);
      if (accountTotals[f.managerial_account_id] && !isPastOrCurrent(ano, f.mes)) {
        accountTotals[f.managerial_account_id].forecastRestante += Number(f.valor);
      }
    });

    const months: MonthSummary[] = [];
    let orcadoAno = 0;
    let realMaisForecastAno = 0;

    for (let m = 1; m <= 12; m++) {
      const t = monthTotals[m];
      const realOuForecast = isPastOrCurrent(ano, m) ? t.realizado : t.forecast;
      const desvioRs = t.orcado - realOuForecast;
      const desvioPct = t.orcado !== 0 ? desvioRs / t.orcado : null;
      months.push({
        mes: m,
        orcado: t.orcado,
        realizado: t.realizado,
        forecast: t.forecast,
        realOuForecast,
        desvioRs,
        desvioPct,
      });
      orcadoAno += t.orcado;
      realMaisForecastAno += realOuForecast;
    }

    const accounts: AccountSummary[] = accountsMeta.map((a) => {
      const t = accountTotals[a.id];
      const realMaisForecast = t.realYtd + t.forecastRestante;
      const desvioRs = t.orcadoAno - realMaisForecast;
      const desvioPct = t.orcadoAno !== 0 ? desvioRs / t.orcadoAno : null;
      return {
        accountId: a.id,
        accountName: a.nome,
        orcadoAno: t.orcadoAno,
        realYtd: t.realYtd,
        forecastRestante: t.forecastRestante,
        realMaisForecast,
        desvioRs,
        desvioPct,
      };
    });

    const desvioRsAno = orcadoAno - realMaisForecastAno;
    const desvioPctAno = orcadoAno !== 0 ? desvioRsAno / orcadoAno : null;

    setSummary({
      months,
      accounts,
      orcadoAno,
      realMaisForecastAno,
      desvioRsAno,
      desvioPctAno,
    });
    setLoading(false);
  }, [costCenterId, ano]);

  useEffect(() => {
    load();
  }, [load]);

  return { summary, loading, error, refresh: load };
}
