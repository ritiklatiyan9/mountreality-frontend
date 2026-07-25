import { MapPin, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';

const SITE_STATUS = {
  active: { label: 'Active', chip: 'bg-mr-lime-soft text-mr-lime-ink', dot: 'bg-mr-lime-ink' },
  inactive: { label: 'Inactive', chip: 'bg-mr-surface-2 text-mr-muted', dot: 'bg-mr-faint' },
  completed: { label: 'Completed', chip: 'bg-mr-blue-soft text-mr-blue', dot: 'bg-mr-blue' },
};

const siteDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—');

/* ── Site row ────────────────────────────────────────────────────────
   A site is a row in one shared directory, not a floating card. The
   name leads, location and description trail it, and status sits where
   the eye already is — at the right edge with the actions. ── */
export default function SiteRow({ site, onEdit, onDelete }) {
  const status = SITE_STATUS[site.status] || SITE_STATUS.inactive;
  const location = [site.city, site.state].filter(Boolean).join(', ') || site.address;

  return (
    <li className="group flex flex-col gap-3 px-5 py-4 transition-colors duration-150 hover:bg-mr-surface-2/60 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-[15px] font-semibold text-white"
        style={{ background: 'linear-gradient(135deg, #2f6bff 0%, #50ddeb 100%)' }}
        aria-hidden="true"
      >
        {site.name?.charAt(0)?.toUpperCase() || 'S'}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-mr-text">{site.name}</h3>
          {site.code && <span className="text-[12px] tabular-nums text-mr-faint">{site.code}</span>}
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-mr-muted">
          <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} aria-hidden="true" />
          <span className="truncate">{location || 'Location not added yet'}</span>
        </p>
        {site.description && (
          <p className="mt-1 line-clamp-1 text-[12px] text-mr-faint">{site.description}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-4 sm:gap-6">
        <span className="hidden text-[12px] text-mr-faint lg:block">Created {siteDate(site.created_at)}</span>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${status.chip}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden="true" />
          {status.label}
        </span>
        <span className="flex gap-1">
          <Button
            variant="ghost"
            onClick={() => onEdit(site)}
            aria-label={`Edit ${site.name}`}
            className="h-8 w-8 rounded-full p-0 text-mr-faint hover:bg-mr-blue-soft hover:text-mr-blue"
          >
            <Pencil className="h-4 w-4" strokeWidth={1.9} />
          </Button>
          <Button
            variant="ghost"
            onClick={() => onDelete(site.id)}
            aria-label={`Delete ${site.name}`}
            className="h-8 w-8 rounded-full p-0 text-mr-faint hover:bg-mr-coral-soft hover:text-mr-coral-ink"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.9} />
          </Button>
        </span>
      </div>
    </li>
  );
}
