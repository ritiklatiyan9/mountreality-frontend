import { cn } from '../../lib/utils';

export default function DeliveryProgress({ received, ordered, unit, expectedDate, className }) {
  const done = Number(received) || 0;
  const total = Number(ordered) || 0;
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  const complete = total > 0 && done >= total;
  return (
    <div className={cn('min-w-[135px]', className)}>
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="tabular-nums font-semibold text-slate-800">{done.toLocaleString('en-IN', { maximumFractionDigits: 3 })} / {total.toLocaleString('en-IN', { maximumFractionDigits: 3 })} <span className="font-normal text-slate-400">{unit || ''}</span></span>
        <span className={complete ? 'font-semibold text-emerald-700' : 'text-amber-700'}>{complete ? 'Complete' : `${Math.round(pct)}%`}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100"><div className={cn('h-full rounded-full transition-[width] duration-200', complete ? 'bg-emerald-500' : 'bg-blue-500')} style={{ width: `${pct}%` }} /></div>
      {expectedDate && !complete && <p className="mt-1 text-[10px] text-slate-400">Expected {expectedDate}</p>}
    </div>
  );
}
