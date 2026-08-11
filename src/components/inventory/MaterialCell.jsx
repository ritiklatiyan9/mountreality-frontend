import { PackageOpen } from 'lucide-react';
import { cn } from '../../lib/utils';

const initials = (value) => String(value || '?').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';

export default function MaterialCell({ name, code, category, className }) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500">
        <span aria-hidden="true" className="flex items-center gap-0.5">
          <PackageOpen className="h-3.5 w-3.5" />
          <span className="sr-only">{initials(name)}</span>
        </span>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-5 text-slate-900">{name || 'Unnamed material'}</span>
        <span className="block truncate text-[11px] leading-4 text-slate-400">
          {code || category || 'Material master'}
        </span>
      </span>
    </div>
  );
}
