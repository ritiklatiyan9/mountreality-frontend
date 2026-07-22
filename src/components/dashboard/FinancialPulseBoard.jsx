import { createElement } from 'react';
import {
  Activity, ArrowDownLeft, ArrowUpRight, Banknote, CircleDollarSign,
  FileText, Landmark, RefreshCw, ShieldCheck, TrendingDown, TrendingUp, Wallet,
} from 'lucide-react';
import TimeFilter from './TimeFilter';
import { Checkbox } from '../ui/checkbox';
import { Skeleton } from '../ui/skeleton';

const fmt = (value) => (Number(value) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const money = (value) => `${Number(value) < 0 ? '-' : ''}₹${fmt(Math.abs(Number(value) || 0))}`;

const TONES = {
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  violet: 'bg-violet-50 text-violet-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  cyan: 'bg-cyan-50 text-cyan-600',
};

const Metric = ({ icon, tone, label, value, hint, onClick, loading, negative = false, children }) => (
  <button type="button" onClick={onClick} className="group flex min-h-24 w-full items-center gap-3 px-3 py-4 text-left transition-colors hover:bg-slate-50/80 sm:px-4">
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${TONES[tone]}`}>{createElement(icon, { className: 'h-4.5 w-4.5' })}</span>
    <span className="min-w-0 flex-1">
      <span className="block text-[11px] font-medium text-slate-500">{label}</span>
      {loading ? <Skeleton className="mt-2 h-6 w-28" /> : <span className={`mt-1 block truncate text-lg font-bold tracking-tight ${negative ? 'text-rose-600' : 'text-slate-950'}`}>{money(value)}</span>}
      {hint && <span className="mt-0.5 block truncate text-[10px] text-slate-400">{hint}</span>}
      {children}
    </span>
    <TrendingUp className="h-4 w-4 shrink-0 text-slate-200 transition-colors group-hover:text-slate-400" />
  </button>
);

export default function FinancialPulseBoard({
  kpi, loading, canSee, timePreset, setTimePreset, excludeOldPlots, setExcludeOldPlots,
  registryIncludeOld, setRegistryIncludeOld, onRefresh, onVerify, onSelect,
}) {
  const incoming = Number(kpi?.totalIncoming) || 0;
  const outgoing = Number(kpi?.totalOutgoing) || 0;
  const opening = Number(kpi?.openingBalance) || 0;
  const balance = Number(kpi?.siteBalance) || 0;
  const revenue = Number(kpi?.totalRevenue) || 0;
  const expense = Number(kpi?.totalExpense) || 0;
  const profit = Number(kpi?.netProfit) || 0;
  const regNew = Number(kpi?.registryPaymentsNew) || 0;
  const regOld = Number(kpi?.registryPaymentsOld) || 0;
  const registry = registryIncludeOld ? (Number(kpi?.registryPayments) || regNew + regOld) : regNew;
  const base = Math.max(Math.abs(opening) + Math.abs(incoming) + Math.abs(outgoing), 1);
  const gauge = Math.min(100, Math.max(6, Math.round((Math.abs(balance) / base) * 100)));
  const dash = `${gauge} ${100 - gauge}`;

  const metrics = [
    canSee('kpi_totalIncoming') && { key: 'totalIncoming', icon: ArrowDownLeft, tone: 'blue', label: 'Total incoming', value: incoming, hint: 'Approved ledger credits' },
    canSee('kpi_plotPayments') && { key: 'totalIncoming', icon: Landmark, tone: 'emerald', label: 'Plot collections', value: revenue, hint: 'Payments and installments' },
    canSee('kpi_registryPayments') && { key: 'registryPayments', icon: FileText, tone: 'violet', label: 'Registry mapping', value: registry, hint: registryIncludeOld ? `NEW ${money(regNew)} + OLD ${money(regOld)}` : `NEW only · ${money(regOld)} OLD hidden`, registry: true },
    canSee('kpi_personalLedger') && { key: 'personalLedger', icon: Wallet, tone: 'amber', label: 'Personal ledger', value: Number(kpi?.outstanding) || 0, hint: 'Net pending balance' },
    canSee('kpi_totalExpense') && { key: 'totalExpense', icon: TrendingDown, tone: 'rose', label: 'Total outgoing', value: expense, hint: 'Approved business outflow' },
    canSee('kpi_profit') && { key: 'profit', icon: CircleDollarSign, tone: profit >= 0 ? 'emerald' : 'rose', label: 'Net profit', value: profit, hint: `${money(revenue)} − ${money(expense)}`, negative: profit < 0 },
  ].filter(Boolean);

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.03]">
      <header className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-white"><Activity className="h-4.5 w-4.5" /></span>
          <div><h2 className="text-sm font-semibold text-slate-950">Financial performance</h2><p className="text-[10px] text-slate-400">One connected view of approved accounting activity</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1.5 text-[10px] font-medium text-slate-500"><Checkbox checked={excludeOldPlots} onCheckedChange={(value) => setExcludeOldPlots(!!value)} className="h-3.5 w-3.5" />New plots only</label>
          <TimeFilter value={timePreset} onChange={setTimePreset} />
          <button type="button" onClick={onVerify} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-emerald-50 px-3 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100"><ShieldCheck className="h-3.5 w-3.5" />Verify</button>
          <button type="button" onClick={onRefresh} disabled={loading} aria-label="Refresh financial data" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[300px_minmax(0,1fr)]">
        {canSee('kpi_siteBalance') && (
          <button type="button" onClick={() => onSelect('siteBalance')} className="group relative flex min-h-64 flex-col items-center justify-center overflow-hidden bg-slate-950 px-5 py-6 text-white lg:min-h-full">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.18),transparent_45%)]" />
            <div className="relative h-36 w-36">
              <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90" aria-hidden="true">
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="rgba(255,255,255,.09)" strokeWidth="2.8" />
                <circle cx="21" cy="21" r="15.9" fill="none" stroke={balance >= 0 ? '#22d3ee' : '#fb7185'} strokeWidth="2.8" strokeLinecap="round" pathLength="100" strokeDasharray={dash} />
              </svg>
              <span className="absolute inset-0 flex flex-col items-center justify-center"><Banknote className="mb-1 h-4 w-4 text-cyan-300" /><span className="text-[10px] text-slate-400">Site balance</span><span className="mt-1 max-w-28 truncate text-lg font-bold">{money(balance)}</span></span>
            </div>
            <div className="relative mt-4 grid w-full grid-cols-3 gap-2 border-t border-white/10 pt-4 text-center"><span><span className="block text-[9px] text-slate-500">Opening</span><span className="mt-1 block truncate text-[11px] font-semibold">{money(opening)}</span></span><span><span className="block text-[9px] text-slate-500">Incoming</span><span className="mt-1 block truncate text-[11px] font-semibold text-cyan-300">{money(incoming)}</span></span><span><span className="block text-[9px] text-slate-500">Outgoing</span><span className="mt-1 block truncate text-[11px] font-semibold text-rose-300">{money(outgoing)}</span></span></div>
          </button>
        )}

        <div className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:[&>*:nth-child(odd)]:border-r sm:[&>*:nth-child(odd)]:border-slate-100 xl:grid-cols-3 xl:[&>*:not(:nth-child(3n))]:border-r xl:[&>*:not(:nth-child(3n))]:border-slate-100 xl:[&>*:nth-child(odd)]:border-r-0">
          {metrics.map((metric) => (
            <Metric key={`${metric.label}-${metric.key}`} {...metric} loading={loading} onClick={() => onSelect(metric.key)}>
              {metric.registry && Number(kpi?.registryPaymentsOldCount) > 0 && <label onClick={(event) => event.stopPropagation()} className="mt-1.5 inline-flex cursor-pointer items-center gap-1 text-[9px] font-medium text-slate-400"><Checkbox checked={registryIncludeOld} onCheckedChange={(value) => setRegistryIncludeOld(!!value)} className="h-3 w-3" />Include {Number(kpi.registryPaymentsOldCount) || 0} OLD</label>}
            </Metric>
          ))}
        </div>
      </div>
    </section>
  );
}
