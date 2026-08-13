import { AccountSummary } from '../hooks/useCostCenterSummary';
import { formatCurrency } from '../lib/dateHelpers';

export default function AccountBreakdownTable({ accounts }: { accounts: AccountSummary[] }) {
  return (
    <section className="bg-white rounded shadow-sm overflow-x-auto">
      <div className="bg-bp-subtitle px-4 py-2 font-medium text-bp-header text-sm">
        Detalhamento por Conta Gerencial
      </div>
      <table className="w-full text-xs min-w-[700px]">
        <thead>
          <tr className="bg-bp-header text-white">
            <th className="text-left px-3 py-2 font-medium">Conta Gerencial</th>
            <th className="px-2 py-2 font-medium text-right">Orçado Ano</th>
            <th className="px-2 py-2 font-medium text-right">Real YTD</th>
            <th className="px-2 py-2 font-medium text-right">Forecast Restante</th>
            <th className="px-2 py-2 font-medium text-right">Real+Forecast</th>
            <th className="px-2 py-2 font-medium text-right">Desvio (R$)</th>
            <th className="px-2 py-2 font-medium text-right">Desvio (%)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {accounts.map((a) => (
            <tr key={a.accountId}>
              <td className="px-3 py-2 text-bp-header font-medium whitespace-nowrap">{a.accountName}</td>
              <td className="px-2 py-2 text-right">{formatCurrency(a.orcadoAno)}</td>
              <td className="px-2 py-2 text-right text-gray-500">{formatCurrency(a.realYtd)}</td>
              <td className="px-2 py-2 text-right text-gray-500">{formatCurrency(a.forecastRestante)}</td>
              <td className="px-2 py-2 text-right font-medium">{formatCurrency(a.realMaisForecast)}</td>
              <td className={`px-2 py-2 text-right ${a.desvioRs < 0 ? 'text-bp-estouro' : 'text-bp-economia'}`}>
                {formatCurrency(a.desvioRs)}
              </td>
              <td className={`px-2 py-2 text-right ${a.desvioRs < 0 ? 'text-bp-estouro' : 'text-bp-economia'}`}>
                {a.desvioPct !== null ? `${(a.desvioPct * 100).toFixed(1)}%` : '–'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
