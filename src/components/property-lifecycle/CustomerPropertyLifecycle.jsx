import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
        const stateLabel = done ? 'Completed' : active ? 'Current stage' : 'Upcoming';
        return (
          <li key={stage.key} className="flex min-w-0 flex-1 items-start">
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onClick={() => onStageClick?.(stage.key)} aria-label={`${stage.label}: ${stateLabel}`} className="group flex min-w-0 flex-col items-center gap-1 rounded-md text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                  <span className={cn('relative z-10 flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-150 group-hover:-translate-y-0.5 group-hover:shadow-sm', done && 'border-emerald-600 bg-emerald-600 text-white', active && 'border-blue-600 bg-white text-blue-600', !done && !active && 'border-slate-200 bg-white text-slate-300')}>
                    {done ? <Check className="h-3 w-3" aria-hidden="true" /> : <Circle className={cn('h-2 w-2', active && 'fill-current')} aria-hidden="true" />}
                  </span>
                  {!compact && <span className={cn('truncate text-[10px] font-medium', done ? 'text-slate-700' : active ? 'text-blue-700' : 'text-slate-400')}>{stage.label}</span>}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="rounded-lg bg-slate-950 px-2.5 py-2 text-white shadow-xl">
                <p className="text-[11px] font-semibold">{stage.label}</p>
                <p className="mt-0.5 text-[9px] text-white/65">{stateLabel}</p>
              </TooltipContent>
            </Tooltip>
            {index < STAGES.length - 1 && <span className={cn('mt-2.5 h-px min-w-2 flex-1', done ? 'bg-emerald-300' : 'bg-slate-200')} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
