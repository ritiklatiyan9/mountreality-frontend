import { cn } from '@/lib/utils';

const currency = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function CollectionProgress({ received = 0, consideration = 0, overdue = 0, className }) {
  const total = Number(consideration) || 0;
  const collected = Number(received) || 0;
  const percent = total > 0 ? Math.min(Math.max((collected / total) * 100, 0), 100) : 0;
  return (
    <div className={cn('min-w-[150px]', className)}>
      <div className="flex items-baseline justify-between gap-3 text-[11px]">
        <span className="font-semibold tabular-nums text-slate-800">{currency(collected)} / {currency(total)}</span>
        <span className="tabular-nums text-slate-400">{Math.round(percent)}%</span>
      </div>
      <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
        <div className="h-full rounded-full bg-blue-600 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${percent}%` }} />
      </div>
      {Number(overdue) > 0 && <p className="mt-1 text-[10px] font-medium text-amber-700">{currency(overdue)} overdue</p>}
    </div>
  );
}

