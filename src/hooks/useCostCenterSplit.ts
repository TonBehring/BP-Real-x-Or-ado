import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface GroupOption {
  id: string;
  codigo: string;
  nome: string;
}

export interface OriginOption {
  origemId: string;
  codigo: string;
  nome: string;
  ativo: boolean;
  quantidadeContas: number;
}

export function useCostCenterSplit() {
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('cost_centers')
      .select('id, codigo, nome')
      .eq('ativo', true)
      .order('nome')
      .range(0, 9999);
    setGroups((data ?? []) as GroupOption[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Lista as origens diferentes que compõem hoje um centro de custo (grupo). */
  async function listOrigins(groupId: string): Promise<OriginOption[]> {
    const { data: accounts } = await supabase
      .from('managerial_accounts')
      .select('origem_cost_center_id')
      .eq('cost_center_id', groupId)
      .range(0, 9999);

    const counts = new Map<string, number>();
    (accounts ?? []).forEach((a) => {
      if (!a.origem_cost_center_id) return;
      counts.set(a.origem_cost_center_id, (counts.get(a.origem_cost_center_id) ?? 0) + 1);
    });

    const ids = Array.from(counts.keys());
    if (ids.length === 0) return [];

    const { data: origins } = await supabase
      .from('cost_centers')
      .select('id, codigo, nome, ativo')
      .in('id', ids);

    return (origins ?? []).map((o) => ({
      origemId: o.id,
      codigo: o.codigo,
      nome: o.nome,
      ativo: o.ativo,
      quantidadeContas: counts.get(o.id) ?? 0,
    }));
  }

  /**
   * Desmembra `origemId` para fora do grupo `groupId`: reativa o centro de
   * custo original e devolve a ele as contas gerenciais (e lançamentos
   * vinculados) que vieram de lá.
   */
  async function splitOut(groupId: string, origemId: string) {
    if (origemId === groupId) {
      return { error: 'Este centro de custo nunca foi absorvido — não há o que desmembrar.' };
    }

    // Reativa o centro de custo original
    await supabase.from('cost_centers').update({ ativo: true }).eq('id', origemId);

    // Pega as contas gerenciais que pertencem a essa origem, hoje dentro do grupo
    const { data: accounts } = await supabase
      .from('managerial_accounts')
      .select('id')
      .eq('cost_center_id', groupId)
      .eq('origem_cost_center_id', origemId);

    const accountIds = (accounts ?? []).map((a) => a.id);
    if (accountIds.length === 0) {
      return { error: 'Nenhuma conta gerencial encontrada para essa origem dentro do grupo.' };
    }

    // Move as contas de volta
    await supabase.from('managerial_accounts').update({ cost_center_id: origemId }).in('id', accountIds);

    // Move os lançamentos vinculados a essas contas de volta também
    await supabase.from('budget_entries').update({ cost_center_id: origemId }).in('managerial_account_id', accountIds);
    await supabase.from('actual_entries').update({ cost_center_id: origemId }).in('managerial_account_id', accountIds);
    await supabase.from('forecast_entries').update({ cost_center_id: origemId }).in('managerial_account_id', accountIds);
    await supabase
      .from('deviation_justifications')
      .update({ cost_center_id: origemId })
      .in('managerial_account_id', accountIds);

    // Vincula os gestores do grupo também ao centro de custo desmembrado
    // (mantém o vínculo com o grupo intacto)
    const { data: links } = await supabase.from('manager_cost_centers').select('profile_id').eq('cost_center_id', groupId);
    for (const link of links ?? []) {
      await supabase
        .from('manager_cost_centers')
        .upsert({ profile_id: link.profile_id, cost_center_id: origemId }, { onConflict: 'profile_id,cost_center_id' });
    }

    // Remove o código antigo da lista de alternativos do grupo, para a
    // importação voltar a direcionar para o centro de custo original
    const { data: origem } = await supabase.from('cost_centers').select('codigo, nome').eq('id', origemId).single();
    const { data: group } = await supabase.from('cost_centers').select('codigos_alternativos').eq('id', groupId).single();
    if (origem && group) {
      const restantes = (group.codigos_alternativos ?? []).filter(
        (c: string) => c !== origem.codigo && c !== origem.nome
      );
      await supabase.from('cost_centers').update({ codigos_alternativos: restantes }).eq('id', groupId);
    }

    await load();
    return { error: null };
  }

  async function renameCostCenter(id: string, novoNome: string) {
    const nome = novoNome.trim();
    if (!nome) return { error: 'Nome não pode ser vazio' };
    const { error } = await supabase.from('cost_centers').update({ nome }).eq('id', id);
    if (error) return { error: error.message };
    await load();
    return { error: null };
  }

  return { groups, loading, listOrigins, splitOut, renameCostCenter, refresh: load };
}
