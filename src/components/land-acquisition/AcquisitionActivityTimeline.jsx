import { dateTimeLabel, initials, readable } from './landAcquisitionUtils';

export default function AcquisitionActivityTimeline({ items = [], onOpen }) {
  if (!items.length) {
    return <p className="py-10 text-center text-[13px] text-mr-muted">Activity will appear as the acquisition progresses.</p>;
  }
  return (
    <ol className="divide-y divide-mr-line">
      {items.map((item, index) => {
        const user = item.user_name || item.recorded_by_name || 'MountReality';
        const amount = item.new_value?.amount;
        const content = (
          <>
            <p className="text-[13px] font-medium text-mr-text">
              {amount ? `${Number(amount) < 0 ? 'Payment reversal' : 'Payment'} ${readable(item.action)}` : readable(item.action)}
            </p>
            <p className="mt-0.5 text-[12px] text-mr-muted">{user}{item.reason ? ` · ${item.reason}` : ''}</p>
          </>
        );
        return (
          <li key={item.id ?? index} className="grid grid-cols-[72px_32px_minmax(0,1fr)] gap-3 py-4">
            <time className="pt-1 text-[11px] leading-4 text-mr-faint">{dateTimeLabel(item.created_at)}</time>
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-mr-line bg-mr-surface-2 text-[10px] font-semibold text-mr-muted">{initials(user)}</span>
            {onOpen ? (
              <button type="button" data-print-row onClick={() => onOpen(item)} className="group min-w-0 flex-col rounded-md px-2 py-1 text-left transition-colors hover:bg-mr-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">{content}</div>
                  <span className="shrink-0 text-[11px] font-medium text-mr-faint transition-colors group-hover:text-mr-blue">Open</span>
                </div>
              </button>
            ) : <div className="min-w-0">{content}</div>}
          </li>
        );
      })}
    </ol>
  );
}
