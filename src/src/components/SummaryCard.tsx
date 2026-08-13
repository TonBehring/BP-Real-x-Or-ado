import { formatCurrency } from '../lib/dateHelpers';

interface Props {
  orcadoAno: number;
  realMaisForecastAno: number;
  desvioRsAno: number;
  desvioPctAno: number | null;
}

export default function SummaryCard({ orcadoAno, realMaisForecastAno, desvioRsAno, desvioPctAno }: Props) {
  const vaiEstourar = desvioRsAno < 0;

  return (
    <section className="bg-white rounded shadow-sm overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100">
        <Stat label="Orçado (Ano)" value={formatCurrency(orcadoAno)} />
        <Stat label="Real + Forecast" value={formatCurrency(realMaisForecastAno)} />
        <Stat
          label="Desvio (R$)"
          value={formatCurrency(desvioRsAno)}
          colorClass={vaiEstourar ? 'text-bp-estouro' : 'text-bp-economia'}
        />
        <Stat
          label="Desvio (%)"
          value={desvioPctAno !== null ? `${(desvioPctAno * 100).toFixed(1)}%` : '–'}
          colorClass={vaiEstourar ? 'text-bp-estouro' : 'text-bp-economia'}
        />
      </div>

      {vaiEstourar && (
        <div className="bg-red-50 border-t border-red-200 px-4 py-3 text-sm text-bp-estouro font-medium">
          ⚠ Projeção do ano indica estouro de orçamento de {formatCurrency(Math.abs(desvioRsAno))}. Ainda há
          tempo de ajustar o forecast dos meses restantes.
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, colorClass }: { label: string; value: string; colorClass?: string }) {
  return (
    <div className="px-4 py-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${colorClass ?? 'text-bp-header'}`}>{value}</div>
    </div>
  );
}
