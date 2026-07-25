import { createElement, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2, Clock3, ShieldCheck,
} from 'lucide-react';
import api from '../../api/api';
import eventBus from '../../utils/eventBus';
import { EmptyState, SkeletonBlock, StatusPill } from './primitives';

const fmtDate = (value) => (value
  ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short',
  })
  : 'No due date');

const riskTone = (risk) => (risk === 'CRITICAL' || risk === 'HIGH' ? 'negative' : 'attention');

export default function ComplianceWatchCard({ siteId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!siteId) return;
    if (!silent) setLoading(true);
    try {
      const response = await api.get('/compliance/dashboard', { params: { site_id: siteId } });
      setData(response.data);
    } catch {
      setData(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    load();
    const refresh = () => load({ silent: true });
    eventBus.on('data-mutated', refresh);
    return () => eventBus.off('data-mutated', refresh);
  }, [load]);

  const summary = data?.summary || {};
  const priorities = (data?.priority || []).slice(0, 3);
  const urgent = Number(summary.overdue || 0) + Number(summary.due_today || 0);

  return (
    <section
      aria-labelledby="mr-compliance-watch-title"
      className="overflow-hidden rounded-panel border border-mr-line bg-mr-surface"
    >
      <div className="flex items-center justify-between gap-3 border-b border-mr-line px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mr-blue-soft text-mr-blue">
            <ShieldCheck className="h-4.5 w-4.5" strokeWidth={1.9} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 id="mr-compliance-watch-title" className="truncate text-[15px] font-semibold tracking-[-0.01em] text-mr-text">
                Compliance watch
              </h2>
              {!loading && urgent > 0 && (
                <StatusPill tone="negative" icon={AlertTriangle}>{urgent} urgent</StatusPill>
              )}
            </div>
            <p className="mt-0.5 text-[12px] text-mr-muted">Deadlines and risk for this project</p>
          </div>
        </div>
        <Link
          to="/compliance/dashboard"
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-[12px] font-semibold text-mr-blue transition-colors hover:bg-mr-blue-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
        >
          Open <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3 p-5 sm:p-6">
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((index) => <SkeletonBlock key={index} className="h-16" />)}
          </div>
          <SkeletonBlock className="h-11" />
          <SkeletonBlock className="h-11" />
        </div>
      ) : !data ? (
        <EmptyState
          icon={ShieldCheck}
          title="Compliance summary unavailable"
          description="Open the control centre to review this project's obligations."
        />
      ) : (
        <>
          <div className="grid grid-cols-3 divide-x divide-mr-line border-b border-mr-line">
            {[
              { label: 'Overdue', value: summary.overdue, icon: AlertTriangle, tone: 'text-mr-coral-ink' },
              { label: 'Due in 7d', value: summary.due_7, icon: Clock3, tone: 'text-mr-amber-ink' },
              { label: 'High risk', value: summary.high_risk, icon: CalendarClock, tone: 'text-mr-blue' },
            ].map(({ label, value, icon: Icon, tone }) => (
              <Link
                key={label}
                to={label === 'Overdue' ? '/compliance/register?overdue=true' : label === 'High risk' ? '/compliance/register?risk=HIGH' : '/compliance/register'}
                className="group px-3 py-4 text-center transition-colors hover:bg-mr-surface-2 sm:px-4"
              >
                <span className={`mx-auto flex items-center justify-center gap-1.5 text-[20px] font-semibold tabular-nums ${tone}`}>
                  {createElement(Icon, { className: 'h-4 w-4', strokeWidth: 2, 'aria-hidden': true })}
                  {Number(value || 0).toLocaleString('en-IN')}
                </span>
                <span className="mt-1 block text-[11px] font-medium text-mr-muted">{label}</span>
              </Link>
            ))}
          </div>

          {priorities.length ? (
            <ul className="divide-y divide-mr-line">
              {priorities.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`/compliance/register/${item.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-mr-surface-2/70 sm:px-6"
                  >
                    <span className={`h-8 w-1 shrink-0 rounded-full ${item.risk_level === 'CRITICAL' ? 'bg-mr-coral' : 'bg-mr-amber'}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-mr-text">{item.title}</span>
                      <span className="mt-0.5 block truncate text-[12px] text-mr-faint">
                        {fmtDate(item.current_due_date)} · {item.assigned_to_name || 'Unassigned'}
                      </span>
                    </span>
                    <StatusPill tone={riskTone(item.risk_level)}>
                      {String(item.risk_level || 'MEDIUM').toLowerCase()}
                    </StatusPill>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={CheckCircle2}
              title="No urgent compliance work"
              description="Critical and approaching obligations will appear here."
            />
          )}
        </>
      )}
    </section>
  );
}
