import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useCostCenterMerge } from '../hooks/useCostCenterMerge';
import ConfirmDialog from '../components/ConfirmDialog';
import { costCenterLabel } from '../lib/costCenterLabel';

type Mode = 'existing' | 'new-group';

export default function MergeCostCenters() {
  const { profile } = useAuth();
  const { costCenters, loading, mergeCostCenters, createGroupAndMerge } = useCostCenterMerge();
  const [mode, setMode] = useState<Mode>('new-group');
  const [canonicalId, setCanonicalId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);
  const [resultMessages, setResultMessages] = useState<string[] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  if (profile && profile.papel !== 'fpna_admin') {
    return (
      <div className="p-6">
        <p className="text-sm text-bp-estouro">Esta área é restrita ao FP&A.</p>
      </div>
    );
  }

  function toggleMember(id: string) {
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleMergeClick() {
    setActionError(null);
    setResultMessages(null);
    if (mode === 'existing') {
      if (!canonicalId || memberIds.length === 0) return;
    } else {
      if (!groupName.trim() || memberIds.length === 0) return;
    }
    setShowConfirm(true);
  }

  async function handleConfirmed() {
    setShowConfirm(false);

    if (mode === 'existing') {
      setMerging(true);
      const { messages } = await mergeCostCenters(canonicalId, memberIds.filter((id) => id !== canonicalId));
      setResultMessages(messages);
      setMemberIds([]);
      setMerging(false);
    } else {
      setMerging(true);
      const { error, messages } = await createGroupAndMerge(groupName, memberIds);
      if (error) setActionError(error);
      setResultMessages(messages);
      setGroupName('');
      setMemberIds([]);
      setMerging(false);
    }
  }

  const canSubmit =
    mode === 'existing' ? !!canonicalId && memberIds.length > 0 : !!groupName.trim() && memberIds.length > 0;

  return (
    <div className="min-h-screen bg-bp-realized">
      <header className="bg-bp-black text-white px-6 py-4">
        <Link to="/" className="text-xs text-gray-300 hover:underline">
          &larr; Meus centros de custo
        </Link>
        <h1 className="text-lg font-semibold mt-1">Fundir Centros de Custo</h1>
        <p className="text-xs text-gray-400">
          Use quando vários centros de custo devem virar UM só no sistema — um único Forecast, um
          único Dashboard, feito pelo mesmo gestor. Os absorvidos ficam inativos, mas seus
          códigos continuam reconhecidos em futuras importações.
        </p>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {loading && <p className="text-sm text-gray-500">Carregando…</p>}

        {!loading && (
          <>
            <section className="bg-white rounded shadow-sm p-4 space-y-3">
              <h2 className="text-sm font-semibold text-bp-header">1. Como você quer nomear o resultado?</h2>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={mode === 'new-group'}
                    onChange={() => setMode('new-group')}
                  />
                  Criar um grupo novo, com nome próprio
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={mode === 'existing'}
                    onChange={() => setMode('existing')}
                  />
                  Fundir dentro de um centro de custo já existente
                </label>
              </div>

              {mode === 'new-group' ? (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nome do grupo</label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Ex: Financeiro"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Centro de custo principal (sobrevive)</label>
                  <select
                    value={canonicalId}
                    onChange={(e) => setCanonicalId(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  >
                    <option value="">Selecionar…</option>
                    {costCenters.map((cc) => (
                      <option key={cc.id} value={cc.id}>
                        {costCenterLabel(cc.codigo, cc.nome)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </section>

            <section className="bg-white rounded shadow-sm p-4 space-y-3">
              <h2 className="text-sm font-semibold text-bp-header">
                2. Marque os centros de custo que farão parte{' '}
                {mode === 'new-group' ? 'do grupo' : '(serão absorvidos)'}
              </h2>
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                {costCenters
                  .filter((cc) => cc.id !== canonicalId)
                  .map((cc) => (
                    <label key={cc.id} className="flex items-center gap-2 px-1 py-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={memberIds.includes(cc.id)}
                        onChange={() => toggleMember(cc.id)}
                      />
                      <span>
                        {costCenterLabel(cc.codigo, cc.nome)}
                      </span>
                    </label>
                  ))}
              </div>
            </section>

            <button
              onClick={handleMergeClick}
              disabled={!canSubmit || merging}
              className="bg-bp-black text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {merging
                ? 'Processando…'
                : mode === 'new-group'
                ? `Criar grupo "${groupName || '...'}" com ${memberIds.length} centro(s)`
                : `Fundir ${memberIds.length} centro(s) de custo`}
            </button>

            {actionError && <p className="text-sm text-bp-estouro">{actionError}</p>}

            {resultMessages && (
              <section className="bg-white rounded shadow-sm p-4 text-sm space-y-1">
                {resultMessages.map((msg, i) => (
                  <p key={i} className="text-bp-economia">
                    {msg}
                  </p>
                ))}
              </section>
            )}
          </>
        )}
      </main>

      <ConfirmDialog
        open={showConfirm}
        title={mode === 'new-group' ? `Criar grupo "${groupName}"` : 'Fundir centros de custo'}
        message={
          mode === 'new-group'
            ? `Isso vai criar o grupo "${groupName}" e fundir ${memberIds.length} centro(s) de custo dentro dele.\nOs originais ficam inativos (não são apagados).`
            : `Isso vai fundir ${memberIds.length} centro(s) de custo dentro do centro de custo escolhido como principal.\nOs absorvidos ficam inativos (não são apagados).`
        }
        confirmLabel="Confirmar fusão"
        onConfirm={handleConfirmed}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
