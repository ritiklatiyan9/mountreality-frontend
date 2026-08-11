import { cloneElement, isValidElement } from 'react';
import { AlertCircle, Inbox } from 'lucide-react';
import { EmptyBlock, StatusDot } from '@/components/ui/page';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { PolicyNotice } from '@/components/policy/PolicyNotice';
import { PolicyField } from '@/components/policy/PolicyField';
import { cn } from '@/lib/utils';
import { readable } from './reraUtils';

const toneFor = (value) => {
  const status = String(value ?? '').toUpperCase();
  if (['ACTIVE', 'APPROVED', 'CURRENT', 'COMPLETED', 'REVIEWED', 'VERIFIED'].includes(status)) return 'positive';
  if (['PENDING', 'DRAFT', 'FILED', 'SUBMITTED', 'UNDER_REVIEW', 'RENEWAL_DUE', 'APPLICATION_IN_PREPARATION', 'APPLICABILITY_UNDER_REVIEW'].includes(status)) return 'attention';
  if (['EXPIRED', 'LAPSED', 'REVOKED', 'REJECTED', 'MISSING'].includes(status)) return 'negative';
  if (['REGISTERED', 'RECORDED'].includes(status)) return 'info';
  return 'neutral';
};

export function ReraStatus({ value, label, className }) {
  return (
    <StatusDot tone={toneFor(value)} className={className}>
      {label ?? readable(value)}
    </StatusDot>
  );
}

export function DetailFact({ label, value, children, className }) {
  return (
    <div className={cn('min-w-0 border-b border-mr-line py-3', className)}>
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-mr-faint">{label}</p>
      <div className="mt-1 break-words text-[13px] font-medium text-mr-text">
        {children ?? (value === null || value === undefined || value === '' ? 'Not recorded' : value)}
      </div>
    </div>
  );
}

export function FormField({ policyId, label, htmlFor, required, hint, children, className }) {
  if (policyId) {
    return (
      <PolicyField
        fieldId={policyId}
        label={label}
        required={required}
        helpText={hint}
        className={className}
      >
        {({ controlProps, readOnly }) => (isValidElement(children)
          ? cloneElement(children, {
            ...controlProps,
            disabled: Boolean(children.props.disabled || readOnly),
          })
          : children)}
      </PolicyField>
    );
  }

  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="text-[13px] font-medium text-mr-text">
        {label}
        {required && <span className="ml-0.5 text-mr-coral-ink" aria-hidden="true">*</span>}
      </Label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[11px] leading-relaxed text-mr-muted">{hint}</p>}
    </div>
  );
}

export function WorkspaceLoading() {
  return (
    <div className="space-y-6" aria-label="Loading project workspace">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-10 w-64" />
      </div>
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-11 w-full" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

export function WorkspaceError({ message, onRetry, action, title = 'Project workspace could not be loaded' }) {
  return (
    <PolicyNotice
      variant="attention"
      title={title}
      action={action ?? (onRetry ? (
        <button type="button" onClick={onRetry} className="text-[12px] font-semibold text-mr-amber-ink underline underline-offset-2">
          Try again
        </button>
      ) : null)}
    >
      {message || 'Check the selected site and try again.'}
    </PolicyNotice>
  );
}

export function CompactEmpty({ title, description, action, icon = Inbox, tall = false }) {
  return <EmptyBlock icon={icon} title={title} description={description} action={action} tall={tall} />;
}

export function InlineError({ children }) {
  if (!children) return null;
  return (
    <div className="flex items-start gap-2 border-b border-mr-line py-3 text-[12px] text-mr-coral-ink">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function ReadinessCount({ label, value, total, detail, className }) {
  const hasValue = value !== null && value !== undefined && value !== '';
  const hasTotal = total !== null && total !== undefined && total !== '';
  if (!hasValue && !hasTotal) return null;

  return (
    <div className={cn('min-w-0 border-l border-mr-line pl-4 first:border-l-0 first:pl-0', className)}>
      <p className="text-[20px] font-semibold tabular-nums tracking-[-0.02em] text-mr-text">
        {hasValue ? value : '—'}{hasTotal ? <span className="text-[13px] font-normal text-mr-faint"> of {total}</span> : null}
      </p>
      <p className="mt-0.5 text-[12px] font-medium text-mr-text">{label}</p>
      {detail && <p className="mt-0.5 text-[11px] text-mr-muted">{detail}</p>}
    </div>
  );
}
