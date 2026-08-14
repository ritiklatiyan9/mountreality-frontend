import {
  ArrowDownLeft, ArrowUpRight, FileText, Landmark, RefreshCw, ShieldCheck, Wallet,
} from 'lucide-react';
import TimeFilter from './TimeFilter';
import { Checkbox } from '../ui/checkbox';
import {
  CurrencyValue, FinancialMetric, IconButton, SectionHeader, StatusPill,
} from './primitives';
import { ACCENT, toneFor } from './accents';
import { money } from '@/lib/utils';

/* ── Module split bar ────────────────────────────────────────────────
   The existing kpi.breakdown, drawn as one stacked bar instead of a
   stack of progress cards. Only modules with a value are shown. ── */
const MODULE_LABEL = (key) => key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function ModuleSplit({ breakdown, loading }) {
  const rows = (breakdown || [])
    .map((m) => ({
      module: m.module,
      value: Math.abs(Number(m.credit) > 0 ? Number(m.credit) : Number(m.debit) || 0),
      incoming: Number(m.credit) > 0,
      count: Number(m.count) || 0,
      accent: Number(m.credit) > 0 ? toneFor(m.module) : 'coral',
    }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  const total = rows.reduce((sum, r) => sum + r.value, 0);

  if (loading) return <div className="h-2 w-full animate-pulse rounded-full bg-mr-surface-2" />;
  if (!rows.length) {
    return <p className="text-[12px] text-mr-faint">No module activity recorded in this period.</p>;
  }

  return (
    <div>
      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full" role="img"
        aria-label={`Activity split: ${rows.map((r) => `${MODULE_LABEL(r.module)} ${money(r.value)}`).join(', ')}`}>
        {rows.map((r) => (
          <span
            key={r.module}
            className={`h-full transition-[width] duration-500 ${ACCENT[r.accent].solid}`}
            style={{ width: `${Math.max(1.5, (r.value / total) * 100)}%` }}
          />
        ))}
      </div>
      <ul className="mt-3 space-y-2">
        {rows.slice(0, 3).map((r) => (
          <li key={r.module} className="flex items-baseline justify-between gap-3 text-[12px]">
            <span className="flex min-w-0 items-center gap-2 text-mr-muted">
              <span className={`h-2 w-2 shrink-0 rounded-full ${ACCENT[r.accent].solid}`} aria-hidden="true" />
              <span className="truncate">{MODULE_LABEL(r.module)}</span>
              <span className="shrink-0 text-mr-faint">{r.count}</span>
            </span>
            <span className={`shrink-0 font-semibold tabular-nums ${r.incoming ? 'text-mr-text' : 'text-mr-coral-ink'}`} title={money(r.value)}>
              {r.incoming ? '+' : '−'}{money(r.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Financial pulse ─────────────────────────────────────────────────
   One instrument panel. Net profit dominates; the supporting figures
   share the same surface and are separated by hairlines, not cards.
   Every value and every permission gate is unchanged. ── */
export default function FinancialPulseBoard({
  kpi, loading, canSee, timePreset, setTimePreset, excludeOldPlots, setExcludeOldPlots,
  registryIncludeOld, setRegistryIncludeOld, onRefresh, onVerify, onSelect,
}) {
  const incoming = Number(kpi?.totalIncoming) || 0;
  const revenue = Number(kpi?.totalRevenue) || 0;
  const expense = Number(kpi?.totalExpense) || 0;
  const profit = Number(kpi?.netProfit) || 0;
  const margin = Number(kpi?.profitMargin) || 0;
  const regNew = Number(kpi?.registryPaymentsNew) || 0;
  const regOld = Number(kpi?.registryPaymentsOld) || 0;
  const registry = registryIncludeOld ? (Number(kpi?.registryPayments) || regNew + regOld) : regNew;
  const oldCount = Number(kpi?.registryPaymentsOldCount) || 0;
  const showProfit = canSee('kpi_profit');

  const metrics = [
    canSee('kpi_totalIncoming') && {
      key: 'totalIncoming', icon: ArrowDownLeft, label: 'Total incoming', accent: 'aqua',
      value: incoming, hint: 'Approved ledger credits',
    },
    canSee('kpi_totalExpense') && {
      key: 'totalExpense', icon: ArrowUpRight, label: 'Total outgoing', accent: 'coral',
      value: expense, hint: 'Approved business outflow', tone: 'negative',
    },
    canSee('kpi_plotPayments') && {
      key: 'totalIncoming', icon: Landmark, label: 'Plot collections', accent: 'lime',
      value: revenue, hint: 'Payments and installments',
    },
    canSee('kpi_personalLedger') && {
      key: 'personalLedger', icon: Wallet, label: 'Personal ledger', accent: 'amber',
      value: Number(kpi?.outstanding) || 0, hint: 'Net pending balance',
    },
    canSee('kpi_registryPayments') && {
      key: 'registryPayments', icon: FileText, label: 'Registry mapping', accent: 'blue',
      value: registry,
      hint: registryIncludeOld
        ? `New ${money(regNew)} + old ${money(regOld)}`
        : `New plots only · ${money(regOld)} old hidden`,
      registry: true,
    },
  ].filter(Boolean);

  return (
    <section
      aria-labelledby="mr-pulse-title"
      className="overflow-hidden rounded-panel border border-mr-line bg-mr-surface"
    >
      <div className="border-b border-mr-line px-5 py-3">
        <SectionHeader
          id="mr-pulse-title"
          title="Financial performance"
          description="One connected view of approved accounting activity"
          actions={(
            <>
              <label className="mr-glass mr-press flex h-9 cursor-pointer items-center gap-2 rounded-full px-3 text-[12px] font-medium text-mr-muted hover:text-mr-text">
                <Checkbox
                  checked={excludeOldPlots}
                  onCheckedChange={(value) => setExcludeOldPlots(!!value)}
                  className="mr-check h-4 w-4"
                  aria-label="Show new plots only"
                />
                New plots only
              </label>
              <TimeFilter value={timePreset} onChange={setTimePreset} />
              <button
                type="button"
                onClick={onVerify}
                className="mr-press inline-flex h-9 items-center gap-1.5 rounded-full bg-mr-lime-soft px-3.5 text-[12px] font-semibold text-mr-lime-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_6px_16px_-8px_rgba(77,122,0,0.45)] ring-1 ring-inset ring-mr-lime-ink/12 hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-offset-2"
              >
                <ShieldCheck className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
                Verify
              </button>
              <IconButton
                icon={RefreshCw}
                label="Refresh financial data"
                onClick={onRefresh}
                disabled={loading}
                className={loading ? '[&>svg]:animate-spin' : ''}
              />
            </>
          )}
        />
      </div>

      <div className={`grid ${showProfit ? 'lg:grid-cols-[minmax(0,0.72fr)_minmax(0,2.28fr)]' : 'grid-cols-1'}`}>
        {/* Dominant metric — net profit for the selected period */}
        {showProfit && (
          <div className="relative flex flex-col justify-between gap-4 border-b border-mr-line p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <div
              className="pointer-events-none absolute inset-0"
              aria-hidden="true"
              style={{
                background: profit >= 0
                  ? 'radial-gradient(115% 85% at 0% 100%, rgba(185,255,69,0.45) 0%, rgba(80,221,235,0.16) 45%, rgba(255,255,255,0) 72%)'
                  : 'radial-gradient(115% 85% at 0% 100%, rgba(255,101,74,0.30) 0%, rgba(255,176,46,0.12) 45%, rgba(255,255,255,0) 72%)',
              }}
            />
            <button
              type="button"
              onClick={() => onSelect('profit')}
              className="relative -m-2 rounded-panel-sm p-2 text-left transition-colors hover:bg-mr-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
            >
              <span className="text-[12px] font-medium text-mr-muted">Net profit</span>
              {loading
                ? <span className="mt-3 block h-12 w-44 animate-pulse rounded-lg bg-mr-surface-2" />
                : <CurrencyValue value={profit} size="lg" tone={profit >= 0 ? 'default' : 'negative'} className="mt-2" />}
              <span className="mt-2.5 flex flex-wrap items-center gap-2">
                <StatusPill tone={profit >= 0 ? 'positive' : 'negative'}>
                  {profit >= 0 ? 'Surplus' : 'Deficit'}
                </StatusPill>
                {margin !== 0 && <StatusPill>{margin}% margin</StatusPill>}
              </span>
              <span className="mt-2 block text-[12px] text-mr-faint">
                Plot revenue {money(revenue)} − outgoing {money(expense)}
              </span>
            </button>

            {canSee('module_breakdown') && (
              <div className="relative">
                <p className="mb-2 text-[12px] font-medium text-mr-muted">Top account activity</p>
                <ModuleSplit breakdown={kpi?.breakdown} loading={loading} />
              </div>
            )}
          </div>
        )}

        {/* Supporting figures — one shared surface, hairline separated */}
        {/* -mb-px/-mr-px lets the trailing hairlines fall on the section's own
            border instead of drawing a dangling line inside it. */}
        <div className="-mb-px -mr-px grid sm:grid-cols-2 xl:grid-cols-3 [&>*]:border-b [&>*]:border-r [&>*]:border-mr-line">
          {metrics.map((metric) => (
            <FinancialMetric
              key={`${metric.key}-${metric.label}`}
              icon={metric.icon}
              accent={metric.accent}
              label={metric.label}
              value={metric.value}
              hint={metric.hint}
              tone={metric.tone}
              size="md"
              loading={loading}
              onClick={() => onSelect(metric.key)}
            >
              {metric.registry && oldCount > 0 && (
                <label
                  onClick={(event) => event.stopPropagation()}
                  className="mr-glass mr-press mt-2 inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-mr-muted hover:text-mr-text"
                >
                  <Checkbox
                    checked={registryIncludeOld}
                    onCheckedChange={(value) => setRegistryIncludeOld(!!value)}
                    className="mr-check h-3.5 w-3.5"
                    aria-label={`Include ${oldCount} old plot receipts`}
                  />
                  Include {oldCount} old
                </label>
              )}
            </FinancialMetric>
          ))}
        </div>
      </div>
    </section>
  );
}
