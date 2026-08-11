import { CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

const VARIANTS = {
  neutral: {
    icon: Info,
    container: 'border-mr-line bg-mr-surface-2/55',
    iconClass: 'text-mr-muted',
  },
  info: {
    icon: Info,
    container: 'border-mr-blue/20 bg-mr-blue-soft/55',
    iconClass: 'text-mr-blue',
  },
  attention: {
    icon: TriangleAlert,
    container: 'border-mr-amber/25 bg-mr-amber-soft/65',
    iconClass: 'text-mr-amber-ink',
  },
  positive: {
    icon: CircleCheck,
    container: 'border-mr-lime-ink/20 bg-mr-lime-soft/65',
    iconClass: 'text-mr-lime-ink',
  },
};

/** Compact informational row for policy state, guidance and non-blocking errors. */
export function PolicyNotice({
  title,
  description,
  children,
  action,
  variant = 'neutral',
  icon,
  className,
  role = 'status',
}) {
  const styles = VARIANTS[variant] ?? VARIANTS.neutral;
  const Icon = icon === false ? null : (icon ?? styles.icon);
  const content = children ?? description;

  return (
    <div
      role={role}
      className={cn(
        'flex items-start gap-3 rounded-control border px-3.5 py-3 text-[13px]',
        styles.container,
        className,
      )}
    >
      {Icon && (
        <Icon
          className={cn('mt-0.5 h-4 w-4 shrink-0', styles.iconClass)}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      )}

      <div className="min-w-0 flex-1">
        {title && <p className="font-medium text-mr-text">{title}</p>}
        {content && (
          <div className={cn('leading-relaxed text-mr-muted', title && 'mt-0.5')}>
            {content}
          </div>
        )}
      </div>

      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

export default PolicyNotice;
