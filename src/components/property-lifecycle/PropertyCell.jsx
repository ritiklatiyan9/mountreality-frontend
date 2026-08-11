import { LandPlot } from 'lucide-react';

export default function PropertyCell({ plotNo, block, size }) {
  return (
    <div className="flex min-w-[150px] items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        <LandPlot className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-slate-900">Plot {plotNo || '—'}</span>
        <span className="block truncate text-[11px] text-slate-500">{[block ? `Block ${block}` : null, size ? `${Number(size).toLocaleString('en-IN')} sq.yd` : null].filter(Boolean).join(' · ') || 'Property record'}</span>
      </span>
    </div>
  );
}

