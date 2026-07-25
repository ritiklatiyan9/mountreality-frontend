import { cn } from '@/lib/utils';
import { Label } from './label';

/* ── Page furniture ──────────────────────────────────────────────────
   One flat page language, shared by every full-page screen:

     PageHeader   large title, one line of explanation, right-hand tools
     PageTabs     horizontal underline tabs, scrollable, never wrapping
     SectionHead  a rule, a title, an optional count and control
     Row          label + hint on the left, control on the right
     EmptyBlock   the one empty state

   Nothing here draws a card. Sections are separated by hairlines, so a
   page reads as one continuous document rather than a tray of boxes. ── */

export const FIELD = 'h-10 rounded-control border border-mr-line bg-mr-surface text-[13px] shadow-none placeholder:text-mr-faint focus-visible:border-mr-blue focus-visible:ring-2 focus-visible:ring-mr-blue/20';
export const FIELD_LG = 'h-11 w-full rounded-control border border-mr-line bg-mr-surface text-[14px] shadow-none placeholder:text-mr-faint focus-visible:border-mr-blue focus-visible:ring-2 focus-visible:ring-mr-blue/20';
export const GHOST_BTN = 'inline-flex h-10 items-center gap-1.5 rounded-control border border-mr-line bg-mr-surface px-3.5 text-[13px] font-medium text-mr-text transition-colors hover:bg-mr-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue disabled:opacity-40';
export const PRIMARY_BTN = 'inline-flex h-10 items-center gap-1.5 rounded-control bg-mr-ink px-4 text-[13px] font-semibold text-white transition-colors hover:bg-mr-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue disabled:opacity-40';
export const DANGER_BTN = 'inline-flex h-10 items-center gap-1.5 rounded-control border border-mr-coral-ink/20 bg-mr-coral-soft px-3.5 text-[13px] font-semibold text-mr-coral-ink transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue disabled:opacity-40';

export function PageHeader({ title, description, actions, className }) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="text-[30px] font-semibold tracking-[-0.03em] text-mr-text">{title}</h1>
        {description && <p className="mt-1.5 text-[15px] text-mr-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/* `items` is [{ id, label }]; the caller owns the selected id so a tab
   can be driven by the URL as easily as by state. */
export function PageTabs({ items, value, onChange, label, className }) {
  return (
    <div role="tablist" aria-label={label} className={cn('flex gap-1 overflow-x-auto border-b border-mr-line', className)}>
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.id)}
            className={cn(
              '-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 pb-3 pt-1 text-[14px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue',
              selected
                ? 'border-mr-ink font-semibold text-mr-text'
                : 'border-transparent font-medium text-mr-muted hover:text-mr-text',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function SectionHead({ title, meta, description, actions, className }) {
  return (
    <div className={cn('border-b border-mr-line pb-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-mr-text">
          {title}
          {meta && <span className="ml-2 text-[13px] font-normal text-mr-faint">{meta}</span>}
        </h2>
        {actions}
      </div>
      {description && <p className="mt-1 text-[14px] text-mr-muted">{description}</p>}
    </div>
  );
}

export function Row({ label, hint, htmlFor, children, className }) {
  return (
    <div className={cn('grid gap-x-8 gap-y-3 border-b border-mr-line py-5 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)]', className)}>
      <div className="min-w-0">
        <Label htmlFor={htmlFor} className="text-[14px] font-medium text-mr-text">{label}</Label>
        {hint && <p className="mt-1 text-[13px] leading-relaxed text-mr-muted">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function EmptyBlock({ icon, title, description, action, tall, className }) {
  const EmptyIcon = icon;
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', tall ? 'py-20' : 'py-14', className)}>
      {EmptyIcon && <EmptyIcon className="mb-2.5 h-7 w-7 text-mr-faint" strokeWidth={1.5} aria-hidden="true" />}
      <p className="text-[14px] font-medium text-mr-text">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-mr-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* Status text is never colour-only — the label always says the state. */
export function StatusDot({ tone = 'neutral', children, className }) {
  const tones = {
    positive: 'bg-mr-lime-soft text-mr-lime-ink',
    negative: 'bg-mr-coral-soft text-mr-coral-ink',
    attention: 'bg-mr-amber-soft text-mr-amber-ink',
    info: 'bg-mr-blue-soft text-mr-blue',
    neutral: 'bg-mr-surface-2 text-mr-muted',
  };
  const dots = {
    positive: 'bg-mr-lime-ink',
    negative: 'bg-mr-coral',
    attention: 'bg-mr-amber',
    info: 'bg-mr-blue',
    neutral: 'bg-mr-faint',
  };
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium', tones[tone], className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', dots[tone])} aria-hidden="true" />
      {children}
    </span>
  );
}
