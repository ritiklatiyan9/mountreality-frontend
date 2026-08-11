import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

const STAGES = [
  { key: 'booking', label: 'Booking' },
  { key: 'agreement', label: 'Agreement' },
  { key: 'collections', label: 'Collections' },
  { key: 'registry', label: 'Registry' },
  { key: 'possession', label: 'Possession' },
];

export default function CustomerPropertyLifecycle({ record, onStageClick, compact = false }) {
  const received = Number(record?.received) || 0;
  const consideration = Number(record?.final_consideration || record?.sale_price) || 0;
  const complete = {
    booking: Boolean(record?.booking_id),
    agreement: ['EXECUTED', 'SUPERSEDED'].includes(record?.latest_agreement_status || record?.agreement_status),
    collections: consideration > 0 && received >= consideration,
    registry: ['COMPLETE', 'EXECUTED'].includes(record?.registry_lifecycle_status),
    possession: record?.possession_lifecycle_status === 'POSSESSED',
  };
  const activeIndex = Math.max(0, STAGES.findIndex((stage) => !complete[stage.key]));
  return (
    <ol className={cn('flex items-start', compact ? 'gap-0' : 'gap-1')} aria-label="Customer property lifecycle">
      {STAGES.map((stage, index) => {
        const done = complete[stage.key];
        const active = !done && index === activeIndex;
        return (
          <li key={stage.key} className="flex min-w-0 flex-1 items-start">
            <button type="button" onClick={() => onStageClick?.(stage.key)} className="group flex min-w-0 flex-col items-center gap-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <span className={cn('relative z-10 flex h-5 w-5 items-center justify-center rounded-full border transition-colors duration-150', done && 'border-emerald-600 bg-emerald-600 text-white', active && 'border-blue-600 bg-white text-blue-600', !done && !active && 'border-slate-200 bg-white text-slate-300')}>
                {done ? <Check className="h-3 w-3" aria-hidden="true" /> : <Circle className={cn('h-2 w-2', active && 'fill-current')} aria-hidden="true" />}
              </span>
              {!compact && <span className={cn('truncate text-[10px] font-medium', done ? 'text-slate-700' : active ? 'text-blue-700' : 'text-slate-400')}>{stage.label}</span>}
            </button>
            {index < STAGES.length - 1 && <span className={cn('mt-2.5 h-px min-w-2 flex-1', done ? 'bg-emerald-300' : 'bg-slate-200')} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

