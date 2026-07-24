import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The standard Credit / Debit selector used by every entry-recording modal.
 * Exactly two tabs, always labeled "Credit" (money in, emerald) and
 * "Debit" (money out, red). Pages map 'credit'/'debit' to their own API
 * payload — this component never touches submit logic.
 *
 * @param {'credit'|'debit'} value
 * @param {(v: 'credit'|'debit') => void} onChange
 * @param {string} [creditHint] tiny caption shown while Credit is selected
 * @param {string} [debitHint]  tiny caption shown while Debit is selected
 * @param {string} [creditLabel] tab button text for Credit (default 'Credit')
 * @param {string} [debitLabel]  tab button text for Debit (default 'Debit')
 * @param {'in'|'out'} [creditVisual] icon/color for Credit — 'in' (default, green/down-arrow) or 'out' (red/up-arrow)
 * @param {'in'|'out'} [debitVisual]  icon/color for Debit — 'out' (default, red/up-arrow) or 'in' (green/down-arrow)
 */
export default function CreditDebitTabs({
  value,
  onChange,
  disabled = false,
  creditHint = 'Money In',
  debitHint = 'Money Out',
  creditLabel = 'Credit',
  debitLabel = 'Debit',
  creditVisual = 'in',
  debitVisual = 'out',
  className,
}) {
  const visuals = {
    in: { icon: ArrowDownLeft, activeCls: 'bg-emerald-600 text-white shadow-sm' },
    out: { icon: ArrowUpRight, activeCls: 'bg-red-600 text-white shadow-sm' },
  };
  const tabs = [
    { key: 'credit', label: creditLabel, ...visuals[creditVisual] },
    { key: 'debit', label: debitLabel, ...visuals[debitVisual] },
  ];
  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            disabled={disabled}
            aria-pressed={value === t.key}
            onClick={() => onChange(t.key)}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              value === t.key ? t.activeCls : 'text-slate-600 hover:bg-white/60',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        {value === 'credit' ? creditHint : debitHint}
      </p>
    </div>
  );
}
