import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface CostCenterOption {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
}

export function useCostCenterMerge() {
  const [costCenters, setCostCenters] = useState<CostCenterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('cost_centers')
      .select('id, codigo, nome, ativo')
      .eq('ativo', true)
      .order('nome')
      .range(0, 9999);
    if (error) setError(error.message);
    setCostCenters((data ?? []) as CostCenterOption[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Funde os centros de custo em `absorbedIds` dentro de `canonicalId`:
   * - reatribui contas gerenciais e lançamentos (orçado/realizado/forecast)
   * - reatribui vínculos de gestor (evitando duplicidade)
   * - guarda os códigos/nomes absorvidos para futuras importações reconhecerem
   * - desativa (não apaga) os centros de custo absorvidos
   */
  async function mergeCostCenters(canonicalId: string, absorbedIds: string[]) {
    const messages: string[] = [];

    for (const absorbedId of absorbedIds) {
      if (absorbedId === canonicalId) continue;

      const { data: absorbed, error: fetchError } = await supabase
        .from('cost_centers')
        .select('codigo, nome, codigos_alternativos')
        .eq('id', absorbedId)
        .single();
      if (fetchError || !absorbed) {
        messages.push(`Não foi possível ler o centro de custo ${absorbedId}: ${fetchError?.message}`);
        continue;
      }

      await supabase.from('managerial_accounts').update({ cost_center_id: canonicalId }).eq('cost_center_id', absorbedId);
      await supabase.from('budget_entries').update({ cost_center_id: canonicalId }).eq('cost_center_id', absorbedId);
      await supabase.from('actual_entries').update({ cost_center_id: canonicalId }).eq('cost_center_id', absorbedId);
      await supabase.from('forecast_entries').update({ cost_center_id: canonicalId }).eq('cost_center_id', absorbedId);
      await supabase
        .from('deviation_justifications')
        .update({ cost_center_id: canonicalId })
        .eq('cost_center_id', absorbedId);

      // Vínculos de gestor: pega os do absorvido, tenta recriar no canônico,
      // ignora se já existir (evita erro de chave única), depois remove os antigos.
      const { data: links } = await supabase
        .from('manager_cost_centers')
        .select('profile_id')
        .eq('cost_center_id', absorbedId);
      for (const link of links ?? []) {
        await supabase
          .from('manager_cost_centers')
          .upsert({ profile_id: link.profile_id, cost_center_id: canonicalId }, { onConflict: 'profile_id,cost_center_id' });
      }
      await supabase.from('manager_cost_centers').delete().eq('cost_center_id', absorbedId);

      // Guarda o código/nome antigo no canônico, para a importação reconhecer depois
      const codigoAntigo = absorbed.codigo;
      const { data: canonical } = await supabase
        .from('cost_centers')
        .select('codigos_alternativos')
        .eq('id', canonicalId)
        .single();
      const novosAlternativos = Array.from(
        new Set([...(canonical?.codigos_alternativos ?? []), codigoAntigo, absorbed.nome])
      );
      await supabase
        .from('cost_centers')
        .update({ codigos_alternativos: novosAlternativos })
        .eq('id', canonicalId);

      // Desativa (não apaga) o centro de custo absorvido
      await supabase.from('cost_centers').update({ ativo: false }).eq('id', absorbedId);

      messages.push(`"${absorbed.codigo} - ${absorbed.nome}" fundido com sucesso.`);
    }

    await load();
    return { messages };
  }

  return { costCenters, loading, error, mergeCostCenters, refresh: load };
}
