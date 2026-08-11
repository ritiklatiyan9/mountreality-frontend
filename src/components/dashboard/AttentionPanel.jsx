import { Link } from 'react-router-dom';
import { ArrowUpRight, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { EmptyState, SkeletonBlock, StatusPill } from './primitives';
import { ACCENT } from './accents';

const STATUS = {
  approved: { tone: 'positive', accent: 'lime', icon: CheckCircle2, label: 'Approved' },
  rejected: { tone: 'negative', accent: 'coral', icon: XCircle, label: 'Rejected' },
  pending: { tone: 'attention', accent: 'amber', icon: Clock, label: 'Pending' },
};

const statusOf = (raw) => STATUS[String(raw || 'pending').toLowerCase()] || STATUS.pending;

const fmtDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—');

/* ── Needs attention ─────────────────────────────────────────────────
   Approvals that are waiting on someone, as rows inside one surface.
   Only the two lists the backend actually returns are rendered:
   approvals received (admins) and requests sent by the current user. ── */
export default function AttentionPanel({
  items, loading, isAdmin, tab, onTabChange, pendingCount, viewAllHref, limit = 5,
}) {
  const rows = (items || []).slice(0, limit);

  return (
    <section
      aria-labelledby="mr-attention-title"
      className="flex flex-col overflow-hidden rounded-panel border border-mr-line bg-mr-surface"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mr-line px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <h2 id="mr-attention-title" className="text-[15px] font-semibold tracking-[-0.01em] text-mr-text">
            Needs attention
          </h2>
          {pendingCount > 0 && (
            <StatusPill tone="attention" icon={Clock}>{pendingCount} pending</StatusPill>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <div role="radiogroup" aria-label="Approval direction" className="mr-glass flex items-center gap-0.5 rounded-full p-1">
              {[{ key: 'received', label: 'Received' }, { key: 'sent', label: 'Sent' }].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={tab === key}
                  onClick={() => onTabChange(key)}
                  className={`mr-press rounded-full px-3 py-1.5 text-[12px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-offset-1 ${
                    tab === key ? 'mr-glass-ink bg-mr-ink text-white' : 'text-mr-muted hover:text-mr-text'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <Link
            to={viewAllHref}
            className="mr-press group inline-flex h-9 items-center gap-1 rounded-full px-3 text-[12px] font-semibold text-mr-blue hover:bg-mr-blue-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-offset-2"
          >
            View all
            <ArrowUpRight
              className="h-3.5 w-3.5 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              strokeWidth={2}
              aria-hidden="true"
            />
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 p-5 sm:p-6">
          {[0, 1, 2].map((i) => <SkeletonBlock key={i} className="h-11 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nothing waiting on you"
          description={tab === 'received'
            ? 'Approval requests raised by your team will appear here.'
            : 'Requests you raise for edits or imprest will appear here.'}
        />
      ) : (
        <ul className="divide-y divide-mr-line">
          {rows.map((item, index) => {
            const status = statusOf(item.status);
            const StatusIcon = status.icon;
            return (
              <li
                key={`${item._type || item.source || 'approval'}-${item.id || index}`}
                className="flex items-center gap-3 px-5 py-3.5 sm:px-6"
              >
                <span className={`h-8 w-1 shrink-0 rounded-full ${ACCENT[status.accent].solid}`} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-mr-text">
                    {item.entry_label || item.reason || item.description || item.module || item._type || 'Approval request'}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-mr-faint">
                    {fmtDate(item.created_at || item.date)}
                    {item.requested_by_name ? ` · ${item.requested_by_name}` : ''}
                  </span>
                </span>
                <StatusPill tone={status.tone} icon={StatusIcon}>{status.label}</StatusPill>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
