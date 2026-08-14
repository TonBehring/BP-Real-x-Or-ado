import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useCostCenterMerge } from '../hooks/useCostCenterMerge';

export default function MergeCostCenters() {
  const { profile } = useAuth();
  const { costCenters, loading, mergeCostCenters } = useCostCenterMerge();
  const [canonicalId, setCanonicalId] = useState('');
  const [absorbedIds, setAbsorbedIds] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);
  const [resultMessages, setResultMessages] = useState<string[] | null>(null);

  if (profile && profile.papel !== 'fpna_admin') {
    return (
      <div className="p-6">
        <p className="text-sm text-bp-estouro">Esta área é restrita ao FP&A.</p>
      </div>
    );
  }

  function toggleAbsorbed(id: string) {
    setAbsorbedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleMerge() {
    if (!canonicalId || absorbedIds.length === 0) return;
    const confirmed = window.confirm(
      `Isso vai fundir ${absorbedIds.length} centro(s) de custo dentro do centro de custo escolhido como principal. ` +
        'Os absorvidos ficam inativos (não são apagados). Confirma?'
    );
    if (!confirmed) return;

    setMerging(true);
    setResultMessages(null);
    const { messages } = await mergeCostCenters(canonicalId, absorbedIds.filter((id) => id !== canonicalId));
    setResultMessages(messages);
    setAbsorbedIds([]);
    setMerging(false);
  }

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
              <h2 className="text-sm font-semibold text-bp-header">
                1. Escolha o centro de custo PRINCIPAL (o que vai sobreviver)
              </h2>
              <select
                value={canonicalId}
                onChange={(e) => setCanonicalId(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              >
                <option value="">Selecionar…</option>
                {costCenters.map((cc) => (
                  <option key={cc.id} value={cc.id}>
                    {cc.codigo} — {cc.nome}
                  </option>
                ))}
              </select>
            </section>

            <section className="bg-white rounded shadow-sm p-4 space-y-3">
              <h2 className="text-sm font-semibold text-bp-header">
                2. Marque os centros de custo que serão ABSORVIDOS
              </h2>
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                {costCenters
                  .filter((cc) => cc.id !== canonicalId)
                  .map((cc) => (
                    <label key={cc.id} className="flex items-center gap-2 px-1 py-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={absorbedIds.includes(cc.id)}
                        onChange={() => toggleAbsorbed(cc.id)}
                      />
                      <span>
                        {cc.codigo} — {cc.nome}
                      </span>
                    </label>
                  ))}
              </div>
            </section>

            <button
              onClick={handleMerge}
              disabled={!canonicalId || absorbedIds.length === 0 || merging}
              className="bg-bp-black text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {merging ? 'Fundindo…' : `Fundir ${absorbedIds.length} centro(s) de custo`}
            </button>

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
    </div>
  );
}
