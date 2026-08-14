import { History } from 'lucide-react';
import { EmptyBlock, SectionHead, StatusDot } from '../ui/page';

const statusTone = (status) => ({
  PUBLISHED: 'positive',
  REVIEW: 'info',
  VALIDATION: 'attention',
  REJECTED: 'negative',
  SUPERSEDED: 'neutral',
}[status] || 'neutral');

const readable = (value) => String(value || '—').replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());

export default function ProfileHistory({ rows = [] }) {
  return (
    <section>
      <SectionHead
        title="Change history"
        meta={`${rows.length} revision${rows.length === 1 ? '' : 's'}`}
        description="Published and superseded revisions remain available as an immutable operating record."
      />
      {!rows.length ? (
        <EmptyBlock icon={History} title="No profile revisions yet" description="The Site is using legacy-compatible behavior." />
      ) : (
        <div className="mt-3 overflow-x-auto rounded-control border border-mr-line">
          <table className="w-full min-w-[760px] text-left">
            <thead className="border-b border-mr-line bg-mr-surface-2/70 text-[11px] uppercase tracking-[0.07em] text-mr-faint">
              <tr>
                <th className="px-4 py-3 font-semibold">Revision</th>
                <th className="px-4 py-3 font-semibold">Profile</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Effective</th>
                <th className="px-4 py-3 font-semibold">Changed by</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mr-line text-[13px]">
              {rows.map((row) => (
                <tr key={row.id} className="align-top hover:bg-mr-surface-2/45">
                  <td className="px-4 py-3 font-semibold tabular-nums text-mr-text">v{row.revision_number ?? row.revision}</td>
                  <td className="px-4 py-3 text-mr-text">
                    <p>{readable(row.operating_model)}</p>
                    <p className="mt-0.5 text-[11px] text-mr-faint">Finance · {readable(row.finance_payment_mode || 'ALL_MODES')}</p>
                  </td>
                  <td className="px-4 py-3"><StatusDot tone={statusTone(row.lifecycle_status)}>{readable(row.lifecycle_status)}</StatusDot></td>
                  <td className="px-4 py-3 text-mr-muted">{row.effective_from ? new Date(row.effective_from).toLocaleDateString('en-IN') : 'Not published'}</td>
                  <td className="px-4 py-3 text-mr-muted">{row.published_by_name || row.updated_by_name || row.created_by_name || '—'}</td>
                  <td className="max-w-xs px-4 py-3 text-mr-muted">{row.change_reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
