/* ── Members summary ─────────────────────────────────────────────────
   The counts the API already returns, as one compact figure row. No
   card, no oversized hero number — this is context above the register,
   not the subject of the page. ── */
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

  const figure = (label, value, hint) => (
    <div key={label} className="min-w-0">
      <dt className="truncate text-[12px] text-mr-muted">{label}</dt>
      <dd className="mt-0.5 text-[18px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-mr-text">
        {value.toLocaleString('en-IN')}
        {hint && <span className="ml-1.5 text-[12px] font-normal text-mr-faint">{hint}</span>}
      </dd>
    </div>
  );

  return (
    <dl className="grid grid-cols-3 gap-x-6 gap-y-4 border-b border-mr-line pb-5 sm:grid-cols-6">
      {figure('People on record', total)}
      {BREAKDOWN.map((row) => figure(row.label, Number(summary[row.key]) || 0))}
      {figure('Active', active, `${activePct}% · ${inactive.toLocaleString('en-IN')} inactive`)}
    </dl>
  );
}
