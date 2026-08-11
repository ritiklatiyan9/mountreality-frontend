import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PROGRESS_STEPS, progressIndex } from './landAcquisitionUtils';

export default function LandAcquisitionProgress({ status, compact = false }) {
  const current = progressIndex(status);
  return (
    <ol className={cn('grid grid-cols-5', compact ? 'gap-1' : 'gap-2')} aria-label="Land acquisition progress">
      {PROGRESS_STEPS.map((step, index) => {
        const stepNumber = index + 1;
        const complete = current > stepNumber || (step.key === 'COMPLETED' && current === 5);
        const active = current === stepNumber || (step.key === 'PAYMENT_IN_PROGRESS' && current === 4);
        return (
          <li key={step.key} className="relative min-w-0 text-center">
            {index > 0 && (
              <span className={cn(
                'absolute right-1/2 top-3 h-px w-full -translate-y-1/2',
                current >= stepNumber ? 'bg-mr-lime-ink/50' : 'bg-mr-line',
              )} aria-hidden="true" />
            )}
            <span className={cn(
              'relative z-10 mx-auto flex h-6 w-6 items-center justify-center rounded-full border bg-mr-surface',
              complete && 'border-mr-lime-ink bg-mr-lime-soft text-mr-lime-ink',
              active && 'border-mr-blue bg-mr-blue-soft text-mr-blue',
              !complete && !active && 'border-mr-line text-mr-faint',
            )}>
              {complete ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : <Circle className={cn('h-2 w-2', active && 'fill-current')} />}
            </span>
            <span className={cn(
              'mt-1.5 block truncate text-[11px] font-medium',
              active || complete ? 'text-mr-text' : 'text-mr-faint',
            )}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

