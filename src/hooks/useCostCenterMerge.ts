import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface CostCenterOption {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
}

function slugifyAsCodigo(nome: string) {
  return (
    nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'GRUPO'
  );
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

  /** Absorve um único centro de custo (absorbedId) dentro de outro (canonicalId). */
  async function absorbOne(canonicalId: string, absorbedId: string): Promise<string> {
    const { data: absorbed, error: fetchError } = await supabase
      .from('cost_centers')
      .select('codigo, nome, codigos_alternativos')
      .eq('id', absorbedId)
      .single();
    if (fetchError || !absorbed) {
      return `Não foi possível ler o centro de custo ${absorbedId}: ${fetchError?.message}`;
    }

    await supabase.from('managerial_accounts').update({ cost_center_id: canonicalId }).eq('cost_center_id', absorbedId);
    await supabase.from('budget_entries').update({ cost_center_id: canonicalId }).eq('cost_center_id', absorbedId);
    await supabase.from('actual_entries').update({ cost_center_id: canonicalId }).eq('cost_center_id', absorbedId);
    await supabase.from('forecast_entries').update({ cost_center_id: canonicalId }).eq('cost_center_id', absorbedId);
    await supabase
      .from('deviation_justifications')
      .update({ cost_center_id: canonicalId })
      .eq('cost_center_id', absorbedId);

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

    const { data: canonical } = await supabase
      .from('cost_centers')
      .select('codigos_alternativos')
      .eq('id', canonicalId)
      .single();
    const novosAlternativos = Array.from(
      new Set([...(canonical?.codigos_alternativos ?? []), absorbed.codigo, absorbed.nome])
    );
    await supabase.from('cost_centers').update({ codigos_alternativos: novosAlternativos }).eq('id', canonicalId);

    await supabase.from('cost_centers').update({ ativo: false }).eq('id', absorbedId);

    return `"${absorbed.codigo} - ${absorbed.nome}" fundido com sucesso.`;
  }

  /** Funde os centros de custo em `absorbedIds` DENTRO de um centro de custo já existente. */
  async function mergeCostCenters(canonicalId: string, absorbedIds: string[]) {
    const messages: string[] = [];
    for (const absorbedId of absorbedIds) {
      if (absorbedId === canonicalId) continue;
      messages.push(await absorbOne(canonicalId, absorbedId));
    }
    await load();
    return { messages };
  }

  /**
   * Cria um GRUPO NOVO (com nome próprio, ex: "Financeiro") e funde todos os
   * `memberIds` selecionados dentro dele — nenhum dos originais "sobrevive"
   * com seu nome antigo, todos viram membros do grupo novo.
   */
  async function createGroupAndMerge(groupName: string, memberIds: string[]) {
    const nome = groupName.trim();
    if (!nome) return { error: 'Nome do grupo não pode ser vazio', messages: [] };
    if (memberIds.length === 0) return { error: 'Selecione pelo menos um centro de custo', messages: [] };

    let codigo = slugifyAsCodigo(nome);
    // evita colisão de código caso já exista um com o mesmo nome gerado
    const { data: existing } = await supabase.from('cost_centers').select('id').eq('codigo', codigo);
    if (existing && existing.length > 0) {
      codigo = `${codigo}_${Date.now().toString().slice(-4)}`;
    }

    const { data: novoGrupo, error: createError } = await supabase
      .from('cost_centers')
      .insert({ codigo, nome, ativo: true })
      .select('id')
      .single();

    if (createError || !novoGrupo) {
      return { error: createError?.message ?? 'Erro ao criar o grupo', messages: [] };
    }

    const messages: string[] = [`Grupo "${nome}" criado.`];
    for (const memberId of memberIds) {
      messages.push(await absorbOne(novoGrupo.id, memberId));
    }
    await load();
    return { error: null, messages };
  }

  return { costCenters, loading, error, mergeCostCenters, createGroupAndMerge, refresh: load };
}
