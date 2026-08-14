import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { CurrencyValue } from '../dashboard/primitives';
import { money, moneyCompact } from '@/lib/utils';

/* A quiet financial strip: the numbers are useful context for the register,
   not a separate dashboard competing with the work below. */
export default function ExpenseSummary({
  totalDebit, totalCredit, entryCount,
  cashIn, cashOut, bankIn, bankOut, siteName,
}) {
  const netSpend = totalDebit - totalCredit;
  const isNetOutflow = netSpend >= 0;
  const reimbursedPercent = totalDebit > 0
    ? Math.min(100, Math.max(0, (totalCredit / totalDebit) * 100))
    : 0;
  const paymentRails = [
    { label: 'Cash paid', value: cashOut, tone: 'text-mr-coral-ink', icon: ArrowUpRight },
    { label: 'Bank paid', value: bankOut, tone: 'text-mr-amber-ink', icon: ArrowUpRight },
    { label: 'Cash received', value: cashIn, tone: 'text-mr-aqua-ink', icon: ArrowDownLeft },
    { label: 'Bank received', value: bankIn, tone: 'text-mr-blue', icon: ArrowDownLeft },
  ];

  return (
    <section aria-labelledby="mr-expense-snapshot" className="border-b border-mr-line">
      <div className="grid gap-7 px-5 py-6 sm:px-6 lg:grid-cols-[minmax(260px,.9fr)_minmax(0,1.6fr)] lg:items-end lg:gap-10 lg:py-7">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-mr-muted">Current selection</p>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id="mr-expense-snapshot" className="text-[15px] font-semibold tracking-[-.015em] text-mr-text">Net spend</h2>
            <span className={`text-[11px] font-medium ${isNetOutflow ? 'text-mr-coral-ink' : 'text-mr-lime-ink'}`}>
              {isNetOutflow ? 'Outflow' : 'Net credit'}
            </span>
          </div>
          <CurrencyValue
            value={Math.abs(netSpend)}
            size="xl"
            tone={isNetOutflow ? 'negative' : 'positive'}
            className="mt-2"
          />
          <p className="mt-1.5 text-[12px] text-mr-muted">
            {siteName ? `${siteName} · ` : ''}{entryCount} entr{entryCount === 1 ? 'y' : 'ies'} in this view
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-3 lg:border-l lg:border-mr-line lg:pl-10">
          <div>
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-mr-muted">
              <ArrowUpRight className="h-3.5 w-3.5 text-mr-coral-ink" strokeWidth={2} aria-hidden="true" /> Total paid
            </span>
            <CurrencyValue value={totalDebit} size="lg" tone="negative" className="mt-1.5" />
            <span className="mt-1 block text-[11px] text-mr-faint">Recorded expense outflow</span>
          </div>
          <div>
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-mr-muted">
              <ArrowDownLeft className="h-3.5 w-3.5 text-mr-lime-ink" strokeWidth={2} aria-hidden="true" /> Recovered
            </span>
            <CurrencyValue value={totalCredit} size="lg" tone="positive" className="mt-1.5" />
            <span className="mt-1 block text-[11px] text-mr-faint">Credits and reimbursements</span>
          </div>
          <div>
            <span className="text-[12px] font-medium text-mr-muted">Recovery rate</span>
            <p className="mt-1 text-[26px] font-semibold leading-none tracking-[-.04em] tabular-nums text-mr-text">{reimbursedPercent.toFixed(0)}%</p>
            <span className="mt-1 block text-[11px] text-mr-faint">Of recorded payments</span>
          </div>
        </div>
      </div>

      <dl className="flex flex-wrap gap-x-7 gap-y-3 border-t border-mr-line px-5 py-3.5 sm:px-6">
        {paymentRails.map((rail) => (
          <div key={rail.label} className="flex min-w-[128px] items-center gap-2">
            <rail.icon className={`h-3.5 w-3.5 shrink-0 ${rail.tone}`} strokeWidth={2} aria-hidden="true" />
            <div className="min-w-0">
              <dt className="text-[11px] text-mr-muted">{rail.label}</dt>
              <dd className={`truncate text-[13px] font-semibold tabular-nums ${rail.tone}`} title={money(rail.value)}>{moneyCompact(rail.value)}</dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}
