import { ArrowDownLeft, ArrowUpRight, Banknote, Landmark } from 'lucide-react';
import { CurrencyValue, StatusPill } from '../dashboard/primitives';
import { money, moneyCompact } from '@/lib/utils';

/* ── Expense position ────────────────────────────────────────────────
   One surface: net balance dominates, debit/credit sit beside it, and
   the cash/bank split runs along the bottom as a quiet strip rather
   than four more boxes. Every figure is passed in already computed. ── */
export default function ExpenseSummary({
  totalDebit, totalCredit, netBalance, entryCount,
  cashIn, cashOut, bankIn, bankOut, siteName,
}) {
  const surplus = netBalance >= 0;
  const flow = [
    { label: 'Cash in', value: cashIn, tone: 'text-mr-aqua-ink', icon: ArrowDownLeft, note: 'Cash, incl. split leg' },
    { label: 'Cash out', value: cashOut, tone: 'text-mr-coral-ink', icon: ArrowUpRight, note: 'Cash, incl. split leg' },
    { label: 'Bank in', value: bankIn, tone: 'text-mr-blue', icon: ArrowDownLeft, note: 'NEFT, RTGS, UPI, cheque' },
    { label: 'Bank out', value: bankOut, tone: 'text-mr-amber-ink', icon: ArrowUpRight, note: 'NEFT, RTGS, UPI, cheque' },
  ];

  return (
    <section
      aria-labelledby="mr-expense-position"
      className="overflow-hidden rounded-panel border border-mr-line bg-mr-surface"
    >
      <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
        <div
          className="relative flex flex-col justify-between gap-5 border-b border-mr-line p-6 sm:p-7 lg:border-b-0 lg:border-r"
          style={{
            background: surplus
              ? 'radial-gradient(115% 85% at 0% 100%, rgba(185,255,69,.40) 0%, rgba(255,255,255,0) 68%)'
              : 'radial-gradient(115% 85% at 0% 100%, rgba(255,101,74,.28) 0%, rgba(255,255,255,0) 68%)',
          }}
        >
          <div>
            <h2 id="mr-expense-position" className="text-[12px] font-medium text-mr-muted">
              Net balance{siteName ? ` · ${siteName}` : ''}
            </h2>
            <CurrencyValue
              value={Math.abs(netBalance)}
              size="xl"
              tone={surplus ? 'positive' : 'negative'}
              className="mt-2"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusPill tone={surplus ? 'positive' : 'negative'}>
                {surplus ? 'Surplus' : 'Deficit'}
              </StatusPill>
              <StatusPill>{entryCount} entr{entryCount === 1 ? 'y' : 'ies'}</StatusPill>
            </div>
          </div>
          <p className="text-[12px] text-mr-faint">Credit received minus debit paid, in the current view</p>
        </div>

        <div className="-mb-px -mr-px grid sm:grid-cols-2 [&>*]:border-b [&>*]:border-r [&>*]:border-mr-line">
          <div className="flex flex-col gap-1.5 px-5 py-5">
            <span className="flex items-center gap-2.5 text-[12px] font-medium text-mr-muted">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mr-coral-soft text-mr-coral-ink">
                <ArrowUpRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </span>
              Total debit
            </span>
            <CurrencyValue value={totalDebit} size="lg" tone="negative" />
            <span className="text-[12px] text-mr-faint">Money paid out</span>
          </div>

          <div className="flex flex-col gap-1.5 px-5 py-5">
            <span className="flex items-center gap-2.5 text-[12px] font-medium text-mr-muted">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mr-lime-soft text-mr-lime-ink">
                <ArrowDownLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </span>
              Total credit
            </span>
            <CurrencyValue value={totalCredit} size="lg" tone="positive" />
            <span className="text-[12px] text-mr-faint">Received or reimbursed</span>
          </div>

          {/* Cash vs bank — a strip inside the same surface, not four cards */}
          <div className="col-span-full grid grid-cols-2 gap-x-6 gap-y-3 bg-mr-surface-2/60 px-5 py-4 sm:grid-cols-4">
            {flow.map((f) => (
              <div key={f.label} className="min-w-0">
                <span className="flex items-center gap-1.5 text-[12px] text-mr-muted">
                  <f.icon className={`h-3.5 w-3.5 shrink-0 ${f.tone}`} strokeWidth={2} aria-hidden="true" />
                  <span className="truncate">{f.label}</span>
                </span>
                <span
                  className={`mt-0.5 block truncate text-[15px] font-semibold tabular-nums ${f.tone}`}
                  title={`${money(f.value)} — ${f.note}`}
                >
                  {moneyCompact(f.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-mr-line px-5 py-3 text-[12px] text-mr-faint sm:px-6">
        <Banknote className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />
        Cash and bank legs always add up to the totals above
        <Landmark className="ml-auto h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />
      </div>
    </section>
  );
}
