import { Check, Circle, LockKeyhole, X } from 'lucide-react';
import { cn } from '../../lib/utils';

const ICONS = { complete: Check, current: Circle, pending: Circle, blocked: LockKeyhole, rejected: X };

export default function ProcurementTimeline({ stages = [], vertical = false, className }) {
  return (
    <div className={cn(vertical ? 'space-y-0' : 'flex items-start gap-0', className)}>
      {stages.map((stage, index) => {
        const Icon = ICONS[stage.status] || Circle;
        const isLast = index === stages.length - 1;
        return (
          <div key={`${stage.label}-${index}`} className={cn(vertical ? 'flex min-h-[68px] items-stretch gap-3' : 'flex min-w-0 flex-1 items-start', 'group')}>
            <div className={cn('flex shrink-0 items-center', vertical ? 'w-6 flex-col' : 'w-full')}>
              <span className={cn('flex h-6 w-6 items-center justify-center rounded-full border', stage.status === 'complete' && 'border-emerald-800 bg-emerald-900 text-emerald-100', stage.status === 'current' && 'border-emerald-700 bg-emerald-50 text-emerald-800', stage.status === 'blocked' && 'border-mr-amber bg-mr-amber-soft text-mr-amber-ink', stage.status === 'rejected' && 'border-mr-coral bg-mr-coral-soft text-mr-coral-ink', (!stage.status || stage.status === 'pending') && 'border-mr-line bg-mr-surface text-mr-faint')}>
                <Icon className={cn('h-3 w-3', stage.status === 'current' && 'fill-blue-500')} />
              </span>
              {!isLast && <span className={cn(vertical ? 'mt-1 w-px flex-1' : 'h-px flex-1', stage.status === 'complete' ? 'bg-emerald-800' : 'bg-mr-line')} />}
            </div>
            <div className={cn(vertical ? 'min-w-0 flex-1 pb-5' : 'ml-1.5 mt-1 min-w-0 pr-2')}>
              <p className={cn('truncate text-xs font-semibold', stage.status === 'current' ? 'text-emerald-800' : 'text-mr-text')}>{stage.label}</p>
              {stage.detail && <p className="mt-1 text-[11px] leading-4 text-mr-faint">{stage.detail}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
