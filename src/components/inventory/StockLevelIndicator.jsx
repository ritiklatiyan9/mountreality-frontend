import { cn } from '../../lib/utils';

const level = ({ current, minimum }) => {
  const value = Number(current) || 0;
  const min = Number(minimum) || 0;
  if (value <= 0) return { label: 'Out of stock', tone: 'text-red-600', bar: 'bg-red-500', width: 0 };
  if (min > 0 && value < min) {
    const critical = value < min * 0.5;
    return { label: critical ? 'Critical' : 'Low', tone: critical ? 'text-red-600' : 'text-amber-700', bar: critical ? 'bg-red-500' : 'bg-amber-500', width: Math.max(8, Math.min(100, (value / min) * 50)) };
  }
  return { label: 'Healthy', tone: 'text-emerald-700', bar: 'bg-emerald-500', width: Math.min(100, min > 0 ? 50 + (value / Math.max(min * 2, value)) * 50 : 72) };
};

export default function StockLevelIndicator({ current, minimum, unit, className }) {
  const state = level({ current, minimum });
  const quantity = Number(current) || 0;
  return (
    <div className={cn('min-w-[120px]', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="tabular-nums text-sm font-semibold text-slate-900">{quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })} <span className="text-[10px] font-normal text-slate-400">{unit || ''}</span></span>
        <span className={cn('text-[10px] font-semibold', state.tone)}>{state.label}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100" aria-label={`${state.label} stock level`}>
        <div className={cn('h-full rounded-full transition-[width] duration-200', state.bar)} style={{ width: `${state.width}%` }} />
      </div>
    </div>
  );
}
