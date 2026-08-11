/* A connected overview surface, following the Farmers register pattern. */
const BREAKDOWN = [
  { key: 'clients', label: 'Clients' },
  { key: 'farmers', label: 'Farmers' },
  { key: 'employees', label: 'Employees' },
  { key: 'members', label: 'Members' },
];

export default function MembersSummary({ summary }) {
  if (!summary?.total) return null;

  const total = Number(summary.total) || 0;
  const active = Number(summary.active) || 0;
  const inactive = Number(summary.inactive) || 0;
  const activePct = total > 0 ? Math.round((active / total) * 100) : 0;

  return (
    <section className="grid overflow-hidden rounded-panel border border-mr-line bg-mr-surface lg:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)]">
      <div className="border-b border-mr-line p-5 sm:p-6 lg:border-b-0 lg:border-r">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-mr-faint">People on record</p>
        <div className="mt-2 flex items-end gap-3">
          <p className="text-[36px] font-semibold leading-none tracking-[-0.045em] text-mr-text tabular-nums">
            {total.toLocaleString('en-IN')}
          </p>
          <span className="mb-0.5 text-[12px] text-mr-muted">members</span>
        </div>
        <div className="mt-6 max-w-sm">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-mr-muted">Active records</span>
            <span className="font-medium text-mr-text tabular-nums">{activePct}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mr-surface-2">
            <div className="h-full rounded-full bg-mr-blue transition-all" style={{ width: `${activePct}%` }} />
          </div>
          <p className="mt-2 text-[12px] text-mr-faint">
            {active.toLocaleString('en-IN')} active · {inactive.toLocaleString('en-IN')} inactive
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4">
        {BREAKDOWN.map(({ key, label }) => (
          <div key={key} className="border-b border-mr-line px-4 py-5 last:border-b-0 sm:border-b-0 sm:border-r sm:px-5 sm:last:border-r-0">
            <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-mr-faint">{label}</dt>
            <dd className="mt-2 text-[22px] font-semibold leading-none tracking-[-0.03em] text-mr-text tabular-nums">
              {(Number(summary[key]) || 0).toLocaleString('en-IN')}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
