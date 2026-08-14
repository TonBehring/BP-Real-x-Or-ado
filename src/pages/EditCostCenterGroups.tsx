import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useCostCenterSplit, OriginOption } from '../hooks/useCostCenterSplit';
import ConfirmDialog from '../components/ConfirmDialog';

export default function EditCostCenterGroups() {
  const { profile } = useAuth();
  const { groups, loading, listOrigins, splitOut, renameCostCenter } = useCostCenterSplit();

  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [origins, setOrigins] = useState<OriginOption[]>([]);
  const [loadingOrigins, setLoadingOrigins] = useState(false);

  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameMsg, setRenameMsg] = useState<string | null>(null);

  const [splitTarget, setSplitTarget] = useState<OriginOption | null>(null);
  const [splitting, setSplitting] = useState(false);
  const [splitMsg, setSplitMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedGroupId) {
      setOrigins([]);
      return;
    }
    setLoadingOrigins(true);
    listOrigins(selectedGroupId).then((o) => {
      setOrigins(o);
      setLoadingOrigins(false);
    });
    const group = groups.find((g) => g.id === selectedGroupId);
    setRenameValue(group?.nome ?? '');
    setSplitMsg(null);
    setRenameMsg(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId]);

  if (profile && profile.papel !== 'fpna_admin') {
    return (
      <div className="p-6">
        <p className="text-sm text-bp-estouro">Esta área é restrita ao FP&A.</p>
      </div>
    );
  }

  async function handleRename() {
    if (!selectedGroupId) return;
    setRenaming(true);
    const { error } = await renameCostCenter(selectedGroupId, renameValue);
    setRenameMsg(error ? `Erro: ${error}` : 'Nome atualizado com sucesso.');
    setRenaming(false);
  }

  async function handleConfirmSplit() {
    if (!selectedGroupId || !splitTarget) return;
    setSplitting(true);
    const { error } = await splitOut(selectedGroupId, splitTarget.origemId);
    setSplitMsg(error ? `Erro: ${error}` : `"${splitTarget.nome}" desmembrado com sucesso.`);
    setSplitTarget(null);
    setSplitting(false);
    // recarrega origens restantes
    const o = await listOrigins(selectedGroupId);
    setOrigins(o);
  }

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const multiOrigin = origins.filter((o) => o.origemId !== selectedGroupId);

  return (
    <div className="min-h-screen bg-bp-realized">
      <header className="bg-bp-black text-white px-6 py-4">
        <Link to="/" className="text-xs text-gray-300 hover:underline">
          &larr; Meus centros de custo
        </Link>
        <h1 className="text-lg font-semibold mt-1">Editar / Desmembrar Centros de Custo</h1>
        <p className="text-xs text-gray-400">
          Renomeie um centro de custo, ou desfaça uma fusão anterior devolvendo um centro de
          custo original ao seu próprio Forecast/Dashboard.
        </p>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {loading && <p className="text-sm text-gray-500">Carregando…</p>}

        {!loading && (
          <>
            <section className="bg-white rounded shadow-sm p-4 space-y-3">
              <label className="block text-xs text-gray-500 mb-1">Centro de custo / grupo</label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              >
                <option value="">Selecionar…</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.codigo} — {g.nome}
                  </option>
                ))}
              </select>
            </section>

            {selectedGroup && (
              <>
                <section className="bg-white rounded shadow-sm p-4 space-y-3">
                  <h2 className="text-sm font-semibold text-bp-header">Renomear</h2>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm"
                    />
                    <button
                      onClick={handleRename}
                      disabled={renaming || !renameValue.trim()}
                      className="bg-bp-black text-white rounded px-4 py-1.5 text-sm font-medium disabled:opacity-50"
                    >
                      {renaming ? 'Salvando…' : 'Salvar nome'}
                    </button>
                  </div>
                  {renameMsg && <p className="text-xs text-bp-economia">{renameMsg}</p>}
                </section>

                <section className="bg-white rounded shadow-sm p-4 space-y-3">
                  <h2 className="text-sm font-semibold text-bp-header">Desmembrar</h2>
                  {loadingOrigins && <p className="text-sm text-gray-500">Verificando origens…</p>}
                  {!loadingOrigins && multiOrigin.length === 0 && (
                    <p className="text-sm text-gray-500">
                      Este centro de custo não tem outras origens fundidas dentro dele (ou a fusão
                      foi feita antes da correção que passou a rastrear origem — nesse caso não é
                      possível desmembrar com segurança).
                    </p>
                  )}
                  {multiOrigin.map((o) => (
                    <div key={o.origemId} className="flex items-center justify-between border-t border-gray-100 pt-2">
                      <span className="text-sm text-bp-header">
                        {o.codigo} — {o.nome}{' '}
                        <span className="text-xs text-gray-400">({o.quantidadeContas} conta(s))</span>
                      </span>
                      <button
                        onClick={() => setSplitTarget(o)}
                        className="text-xs text-bp-estouro hover:underline"
                      >
                        Desmembrar
                      </button>
                    </div>
                  ))}
                  {splitMsg && <p className="text-xs text-bp-economia pt-2">{splitMsg}</p>}
                </section>
              </>
            )}
          </>
        )}
      </main>

      <ConfirmDialog
        open={!!splitTarget}
        title="Desmembrar centro de custo"
        message={
          splitTarget
            ? `Isso vai reativar "${splitTarget.codigo} - ${splitTarget.nome}" como um centro de custo independente novamente, devolvendo suas ${splitTarget.quantidadeContas} conta(s) gerencial(is) e lançamentos. O grupo atual continua existindo com o restante.`
            : ''
        }
        confirmLabel={splitting ? 'Desmembrando…' : 'Confirmar desmembramento'}
        onConfirm={handleConfirmSplit}
        onCancel={() => setSplitTarget(null)}
      />
    </div>
  );
}
