import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface ProfileLite {
  id: string;
  nome: string;
  email: string;
  papel: 'gestor' | 'fpna_admin';
}

export interface CostCenterLite {
  id: string;
  codigo: string;
  nome: string;
}

export interface Assignment {
  profileId: string;
  costCenterId: string;
}

export function useManagerAssignments() {
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenterLite[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [profilesRes, costCentersRes, assignmentsRes] = await Promise.all([
      supabase.from('profiles').select('id, nome, email, papel').order('nome'),
      supabase.from('cost_centers').select('id, codigo, nome').eq('ativo', true).order('nome'),
      supabase.from('manager_cost_centers').select('profile_id, cost_center_id'),
    ]);

    if (profilesRes.error) {
      setError(profilesRes.error.message);
      setLoading(false);
      return;
    }

    setProfiles((profilesRes.data ?? []) as ProfileLite[]);
    setCostCenters((costCentersRes.data ?? []) as CostCenterLite[]);
    setAssignments(
      (assignmentsRes.data ?? []).map((a) => ({ profileId: a.profile_id, costCenterId: a.cost_center_id }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addAssignment(profileId: string, costCenterId: string) {
    if (assignments.some((a) => a.profileId === profileId && a.costCenterId === costCenterId)) {
      return { error: 'Este gestor já está vinculado a este centro de custo.' };
    }
    const { error } = await supabase
      .from('manager_cost_centers')
      .insert({ profile_id: profileId, cost_center_id: costCenterId });
    if (error) return { error: error.message };
    setAssignments((prev) => [...prev, { profileId, costCenterId }]);
    return { error: null };
  }

  async function removeAssignment(profileId: string, costCenterId: string) {
    const { error } = await supabase
      .from('manager_cost_centers')
      .delete()
      .eq('profile_id', profileId)
      .eq('cost_center_id', costCenterId);
    if (error) return { error: error.message };
    setAssignments((prev) => prev.filter((a) => !(a.profileId === profileId && a.costCenterId === costCenterId)));
    return { error: null };
  }

  return { profiles, costCenters, assignments, loading, error, addAssignment, removeAssignment, refresh: load };
}
