/* ── Dashboard UI primitives ─────────────────────────────────────────
   The whole dashboard is built from these few pieces so surfaces, type
   scale and currency formatting stay identical everywhere. Everything
   here is presentational — no data fetching, no business logic. ── */
import { useEffect, useRef, useState } from 'react';
import { cn, money, moneyCompact } from '@/lib/utils';
import { ACCENT } from './accents';


/* Long values get abbreviated automatically; the exact amount stays
   reachable via the native tooltip and the screen-reader label. */
const VALUE_SIZES = {
  xl: 'text-[clamp(2rem,4.2vw,3rem)] leading-[0.95] tracking-[-0.045em] font-semibold',
  lg: 'text-[clamp(1.5rem,2.6vw,2rem)] leading-[1] tracking-[-0.04em] font-semibold',
  md: 'text-xl leading-tight tracking-[-0.03em] font-semibold',
  sm: 'text-[15px] leading-tight tracking-[-0.02em] font-semibold',
};

/* Count from the currently displayed value to the next server value. Keeping
   this in the shared currency primitive animates every dashboard KPI without
   duplicating timers, and reduced-motion users always receive the final value. */
function useCountUp(value, duration = 720) {
  const target = Number(value) || 0;
  const currentRef = useRef(0);
  const frameRef = useRef(null);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const startValue = currentRef.current;
    const distance = target - startValue;
    if (reduceMotion || Math.abs(distance) < 0.01) {
      currentRef.current = target;
      frameRef.current = requestAnimationFrame(() => {
        setDisplayValue(target);
        frameRef.current = null;
      });
      return () => {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      };
    }

    const startedAt = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - ((1 - progress) ** 3);
      const nextValue = startValue + (distance * eased);
      currentRef.current = nextValue;
      setDisplayValue(nextValue);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        currentRef.current = target;
        setDisplayValue(target);
        frameRef.current = null;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [duration, target]);

  return displayValue;
}

export function CurrencyValue({ value, size = 'md', tone = 'default', className, compactAbove = 1e7 }) {
  const n = Number(value) || 0;
  const animatedValue = useCountUp(n);
  const exact = money(n);
  const abbreviated = Math.abs(n) >= compactAbove;
  const tones = {
    default: 'text-mr-text',
    invert: 'text-white',
    positive: 'text-mr-lime-ink',
    negative: 'text-mr-coral-ink',
    muted: 'text-mr-muted',
  };
  return (
    <span
      className={cn('block tabular-nums whitespace-nowrap', VALUE_SIZES[size], tones[tone], className)}
      title={exact}
      aria-label={exact}
    >
      <span aria-hidden="true">{abbreviated ? moneyCompact(animatedValue) : money(animatedValue)}</span>
    </span>
  );
}

/* ── Section header ──────────────────────────────────────────────────
   Title + optional description on the left, controls on the right. */
export function SectionHeader({ title, description, id, actions, className, level = 2 }) {
  const Heading = `h${level}`;
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="min-w-0">
        <Heading id={id} className="text-[15px] font-semibold tracking-[-0.01em] text-mr-text">{title}</Heading>
        {description && <p className="mt-0.5 text-[12px] text-mr-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ── Status pill ─────────────────────────────────────────────────────
   Never colour-only: every tone also carries its own text label, and
   callers pass an icon for the states that matter. */
const PILL_TONES = {
  neutral: 'bg-mr-surface-2 text-mr-muted border-mr-line',
  positive: 'bg-mr-lime-soft text-mr-lime-ink border-mr-lime-ink/15',
  attention: 'bg-mr-amber-soft text-mr-amber-ink border-mr-amber-ink/15',
  negative: 'bg-mr-coral-soft text-mr-coral-ink border-mr-coral-ink/15',
  info: 'bg-mr-blue-soft text-mr-blue border-mr-blue/15',
  ink: 'bg-mr-ink text-white border-transparent',
};

export function StatusPill({ tone = 'neutral', icon: Icon, children, className }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium whitespace-nowrap',
      PILL_TONES[tone], className,
    )}>
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} aria-hidden="true" />}
      {children}
    </span>
  );
}

/* ── Metric ──────────────────────────────────────────────────────────
   A single figure inside a shared surface. Separated by the parent's
   grid borders, never by its own card or shadow. */
export function FinancialMetric({
  label, value, hint, icon: Icon, tone = 'default', accent = 'blue', size = 'md',
  loading, onClick, children, className,
}) {
  const Tag = onClick ? 'button' : 'div';
  const chip = (ACCENT[accent] || ACCENT.blue).chip;
  return (
    <Tag
      {...(onClick ? { type: 'button', onClick } : {})}
      className={cn(
        'group flex w-full flex-col gap-1.5 px-4 py-4 text-left transition-colors duration-200',
        onClick && 'hover:bg-mr-surface-2/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-inset',
        className,
      )}
    >
      <span className="flex items-center gap-2.5 text-[12px] font-medium text-mr-muted">
        {Icon && (
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-105', chip)}>
            <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </span>
        )}
        <span className="truncate">{label}</span>
      </span>
      {loading
        ? <span className="mt-1 block h-7 w-32 animate-pulse rounded-md bg-mr-surface-2" />
        : <CurrencyValue value={value} size={size} tone={tone} />}
      {hint && <span className="block text-[12px] text-mr-faint">{hint}</span>}
      {children}
    </Tag>
  );
}

/* ── States ──────────────────────────────────────────────────────────
   Every data-driven section uses these three so the shapes match. */
export function SkeletonBlock({ className }) {
  return <div className={cn('animate-pulse rounded-xl bg-mr-surface-2', className)} aria-hidden="true" />;
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-14 text-center', className)}>
      {Icon && (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-mr-blue-soft text-mr-blue">
          <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
        </span>
      )}
      <p className="text-[14px] font-medium text-mr-text">{title}</p>
      {description && <p className="max-w-sm text-[12px] text-mr-muted">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title = 'This section could not be loaded', description, onRetry, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-12 text-center', className)}>
      <p className="text-[14px] font-medium text-mr-text">{title}</p>
      <p className="max-w-sm text-[12px] text-mr-muted">
        {description || 'Please try again. If it keeps happening, contact your administrator.'}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mr-press mr-glass-ink mt-1 inline-flex h-9 items-center rounded-full bg-mr-ink px-4 text-[12px] font-semibold text-white hover:bg-mr-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-offset-2"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/* Quiet icon-only control used for refresh / overflow actions. */
export function IconButton(props) {
  const { icon: Icon, label, className, ...rest } = props;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'mr-glass mr-press flex h-9 w-9 items-center justify-center rounded-full text-mr-muted',
        'hover:text-mr-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-offset-2 disabled:opacity-50',
        className,
      )}
      {...rest}
    >
      <Icon className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
    </button>
  );
}
