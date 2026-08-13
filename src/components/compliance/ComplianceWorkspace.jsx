import { createElement } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ComplianceSurface({ children, className }) {
  return (
    <section className={cn('overflow-hidden border-y border-slate-200/80 bg-white sm:border-x', className)}>
      {children}
    </section>
  );
}

export function ComplianceField({ label, value, children, className }) {
  return (
    <div className={className}>
      <p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">{label}</p>
      <div className="mt-1.5 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-800">{children || value || '—'}</div>
    </div>
  );
}

export function ComplianceDetailHeader({
  backTo,
  backLabel,
  eyebrow,
  title,
  description,
  badges,
  actions,
  icon = ShieldCheck,
  accent = 'blue',
}) {
  const accentClass = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    violet: 'bg-violet-50 text-violet-700 ring-violet-100',
    rose: 'bg-rose-50 text-rose-700 ring-rose-100',
  }[accent] || 'bg-blue-50 text-blue-700 ring-blue-100';

  return (
    <header className="border-b border-slate-200 bg-gradient-to-r from-white via-white to-slate-50 px-1 pb-6 pt-1">
      <Link to={backTo} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 transition hover:text-slate-950">
        <ArrowLeft className="h-3.5 w-3.5" />{backLabel}
      </Link>
      <div className="mt-5 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="flex min-w-0 items-start gap-4">
          <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1', accentClass)}>{createElement(icon, { className: 'h-5 w-5' })}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">{badges}<span className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">{eyebrow}</span></div>
            <h1 className="mt-2 max-w-4xl text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}
