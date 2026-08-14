import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useManagerAssignments } from '../hooks/useManagerAssignments';

export default function ManageManagers() {
  const { profile: currentProfile } = useAuth();
  const { profiles, costCenters, assignments, loading, error, addAssignment, removeAssignment } =
    useManagerAssignments();
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [selectedCostCenterId, setSelectedCostCenterId] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (currentProfile && currentProfile.papel !== 'fpna_admin') {
    return (
      <div className="p-6">
        <p className="text-sm text-bp-estouro">Esta área é restrita ao FP&A.</p>
      </div>
    );
  }

  async function handleAdd() {
    if (!selectedProfileId || !selectedCostCenterId) return;
    setSaving(true);
    setActionError(null);
    const { error } = await addAssignment(selectedProfileId, selectedCostCenterId);
    setSaving(false);
    if (error) {
      setActionError(error);
    } else {
      setSelectedProfileId('');
      setSelectedCostCenterId('');
    }
  }

  function profileName(id: string) {
    return profiles.find((p) => p.id === id)?.nome ?? '(gestor removido)';
  }
  function costCenterLabel(id: string) {
    const cc = costCenters.find((c) => c.id === id);
    return cc ? `${cc.codigo} — ${cc.nome}` : '(centro de custo removido)';
  }

  return (
    <div className="min-h-screen bg-bp-realized">
      <header className="bg-bp-black text-white px-6 py-4">
        <Link to="/" className="text-xs text-gray-300 hover:underline">
          &larr; Meus centros de custo
        </Link>
        <h1 className="text-lg font-semibold mt-1">Vincular Gestores a Centros de Custo</h1>
        <p className="text-xs text-gray-400">
          O gestor precisa já ter feito login pelo menos uma vez (para o perfil existir) antes de
          poder ser vinculado aqui.
        </p>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {loading && <p className="text-sm text-gray-500">Carregando…</p>}
        {error && <p className="text-sm text-bp-estouro">{error}</p>}

        {!loading && (
          <>
            <section className="bg-white rounded shadow-sm p-4 space-y-3">
              <h2 className="text-sm font-semibold text-bp-header">Adicionar vínculo</h2>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[220px]">
                  <label className="block text-xs text-gray-500 mb-1">Gestor</label>
                  <select
                    value={selectedProfileId}
                    onChange={(e) => setSelectedProfileId(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  >
                    <option value="">Selecionar gestor…</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} ({p.email}) {p.papel === 'fpna_admin' ? ' · FP&A' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[220px]">
                  <label className="block text-xs text-gray-500 mb-1">Centro de Custo</label>
                  <select
                    value={selectedCostCenterId}
                    onChange={(e) => setSelectedCostCenterId(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  >
                    <option value="">Selecionar centro de custo…</option>
                    {costCenters.map((cc) => (
                      <option key={cc.id} value={cc.id}>
                        {cc.codigo} — {cc.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleAdd}
                  disabled={!selectedProfileId || !selectedCostCenterId || saving}
                  className="bg-bp-black text-white rounded px-4 py-1.5 text-sm font-medium disabled:opacity-50"
                >
                  {saving ? 'Salvando…' : '+ Vincular'}
                </button>
              </div>
              {actionError && <p className="text-xs text-bp-estouro">{actionError}</p>}
              {profiles.length === 0 && (
                <p className="text-xs text-gray-500">
                  Nenhum gestor cadastrado ainda. Peça para a pessoa fazer login pelo menos uma vez.
                </p>
              )}
            </section>

            <section className="bg-white rounded shadow-sm">
              <div className="bg-bp-subtitle px-4 py-2 font-medium text-bp-header text-sm">
                Vínculos atuais ({assignments.length})
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bp-header text-white text-xs">
                    <th className="text-left px-3 py-2 font-medium">Gestor</th>
                    <th className="text-left px-3 py-2 font-medium">Centro de Custo</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {assignments.map((a) => (
                    <tr key={`${a.profileId}-${a.costCenterId}`}>
                      <td className="px-3 py-2 text-bp-header">{profileName(a.profileId)}</td>
                      <td className="px-3 py-2 text-gray-600">{costCenterLabel(a.costCenterId)}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => removeAssignment(a.profileId, a.costCenterId)}
                          className="text-xs text-bp-estouro hover:underline"
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                  {assignments.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-3 text-gray-500 text-sm">
                        Nenhum vínculo cadastrado ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
