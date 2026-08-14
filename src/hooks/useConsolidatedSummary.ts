import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { isPastOrCurrent } from '../lib/dateHelpers';

export interface ConsolidatedRow {
  costCenterId: string;
  codigo: string;
  nome: string;
  diretoriaPai: string | null;
  gestores: string;
  orcadoAno: number;
  realYtd: number;
  forecastRestante: number;
  realMaisForecast: number;
  desvioRs: number;
  desvioPct: number | null;
}

export interface ConsolidatedSummary {
  rows: ConsolidatedRow[];
  orcadoAno: number;
  realMaisForecastAno: number;
  desvioRsAno: number;
  desvioPctAno: number | null;
}

export function useConsolidatedSummary(ano: number) {
  const [summary, setSummary] = useState<ConsolidatedSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: costCenters, error: ccError } = await supabase
      .from('cost_centers')
      .select('id, codigo, nome, diretoria_pai')
      .eq('ativo', true)
      .range(0, 9999);

    if (ccError) {
      setError(ccError.message);
      setLoading(false);
      return;
    }

    const ccIds = (costCenters ?? []).map((c) => c.id);
    if (ccIds.length === 0) {
      setSummary({ rows: [], orcadoAno: 0, realMaisForecastAno: 0, desvioRsAno: 0, desvioPctAno: null });
      setLoading(false);
      return;
    }

    const [budgetRes, actualRes, forecastRes, assignmentsRes] = await Promise.all([
      supabase.from('budget_entries').select('cost_center_id, mes, valor').in('cost_center_id', ccIds).eq('ano', ano).range(0, 9999),
      supabase
        .from('actual_entries')
        .select('cost_center_id, mes, valor, tratamento')
        .in('cost_center_id', ccIds)
        .eq('ano', ano)
        .range(0, 9999),
      supabase.from('forecast_entries').select('cost_center_id, mes, valor').in('cost_center_id', ccIds).eq('ano', ano).range(0, 9999),
      supabase
        .from('manager_cost_centers')
        .select('cost_center_id, profiles(nome, email)')
        .in('cost_center_id', ccIds)
        .range(0, 9999),
    ]);

    const totals: Record<string, { orcadoAno: number; realYtd: number; forecastRestante: number }> = {};
    ccIds.forEach((id) => (totals[id] = { orcadoAno: 0, realYtd: 0, forecastRestante: 0 }));

    (budgetRes.data ?? []).forEach((b) => {
      if (totals[b.cost_center_id]) totals[b.cost_center_id].orcadoAno += Number(b.valor);
    });
    (actualRes.data ?? []).forEach((a) => {
      if (a.tratamento === 'Não utilizar') return;
      if (totals[a.cost_center_id]) totals[a.cost_center_id].realYtd += Number(a.valor);
    });
    (forecastRes.data ?? []).forEach((f) => {
      if (totals[f.cost_center_id] && !isPastOrCurrent(ano, f.mes)) {
        totals[f.cost_center_id].forecastRestante += Number(f.valor);
      }
    });

    const gestoresByCc: Record<string, string[]> = {};
    (assignmentsRes.data ?? []).forEach((a: any) => {
      const nome = a.profiles?.nome ?? a.profiles?.email ?? '?';
      if (!gestoresByCc[a.cost_center_id]) gestoresByCc[a.cost_center_id] = [];
      gestoresByCc[a.cost_center_id].push(nome);
    });

    const rows: ConsolidatedRow[] = (costCenters ?? []).map((cc) => {
      const t = totals[cc.id];
      const realMaisForecast = t.realYtd + t.forecastRestante;
      const desvioRs = t.orcadoAno - realMaisForecast;
      const desvioPct = t.orcadoAno !== 0 ? desvioRs / t.orcadoAno : null;
      return {
        costCenterId: cc.id,
        codigo: cc.codigo,
        nome: cc.nome,
        diretoriaPai: cc.diretoria_pai,
        gestores: (gestoresByCc[cc.id] ?? []).join(', ') || '—',
        orcadoAno: t.orcadoAno,
        realYtd: t.realYtd,
        forecastRestante: t.forecastRestante,
        realMaisForecast,
        desvioRs,
        desvioPct,
      };
    });

    const orcadoAno = rows.reduce((s, r) => s + r.orcadoAno, 0);
    const realMaisForecastAno = rows.reduce((s, r) => s + r.realMaisForecast, 0);
    const desvioRsAno = orcadoAno - realMaisForecastAno;
    const desvioPctAno = orcadoAno !== 0 ? desvioRsAno / orcadoAno : null;

    setSummary({ rows, orcadoAno, realMaisForecastAno, desvioRsAno, desvioPctAno });
    setLoading(false);
  }, [ano]);

  useEffect(() => {
    load();
  }, [load]);

  return { summary, loading, error, refresh: load };
}
