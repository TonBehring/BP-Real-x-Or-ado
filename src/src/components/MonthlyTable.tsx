import { MonthSummary } from '../hooks/useCostCenterSummary';
import { MONTH_LABELS_PT, formatCurrency, isPastOrCurrent } from '../lib/dateHelpers';

export default function MonthlyTable({ months, ano }: { months: MonthSummary[]; ano: number }) {
  return (
    <section className="bg-white rounded shadow-sm overflow-x-auto">
      <div className="bg-bp-subtitle px-4 py-2 font-medium text-bp-header text-sm">Visão Mensal</div>
      <table className="w-full text-xs min-w-[800px]">
        <thead>
          <tr className="bg-bp-header text-white">
            <th className="text-left px-3 py-2 font-medium"></th>
            {months.map((m) => (
              <th key={m.mes} className="px-2 py-2 font-medium text-right">
                {MONTH_LABELS_PT[m.mes - 1]}
                {isPastOrCurrent(ano, m.mes) ? '' : '*'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          <Row label="Orçado" values={months.map((m) => m.orcado)} />
          <Row label="Realizado" values={months.map((m) => m.realizado)} muted />
          <Row label="Forecast" values={months.map((m) => m.forecast)} muted />
          <Row label="Real / Forecast" values={months.map((m) => m.realOuForecast)} highlight />
          <Row label="Desvio (R$)" values={months.map((m) => m.desvioRs)} signColor />
        </tbody>
      </table>
      <p className="text-[11px] text-gray-400 px-4 py-2">* meses em forecast (ainda não realizados)</p>
    </section>
  );
}

function Row({
  label,
  values,
  muted,
  highlight,
  signColor,
}: {
  label: string;
  values: number[];
  muted?: boolean;
  highlight?: boolean;
  signColor?: boolean;
}) {
  return (
    <tr>
      <td className={`px-3 py-2 whitespace-nowrap ${highlight ? 'font-semibold text-bp-header' : 'text-gray-600'}`}>
        {label}
      </td>
      {values.map((v, i) => (
        <td
          key={i}
          className={`px-2 py-2 text-right ${
            signColor ? (v < 0 ? 'text-bp-estouro' : 'text-bp-economia') : muted ? 'text-gray-500' : 'text-bp-header'
          } ${highlight ? 'font-semibold' : ''}`}
        >
          {formatCurrency(v)}
        </td>
      ))}
    </tr>
  );
}
