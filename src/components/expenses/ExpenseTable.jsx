import { ArrowUpDown, Tag } from 'lucide-react';
import { Checkbox } from '../ui/checkbox';
import ChequeStatusControl from '../ChequeStatusControl';
import ExpenseRowActions from './ExpenseRowActions';
import ExpenseBillCell from './ExpenseBillCell';
import { MODE_CHIP, SOURCE_META, STATUS_CHIP, isMissingBill } from './expenseMeta';
import { money } from '@/lib/utils';

const HEAD = 'border-b border-mr-line bg-mr-surface-2 px-4 py-3 text-[12px] font-medium text-mr-muted';

/* ── Expense table (desktop) ─────────────────────────────────────────
   The register keeps the accounting essentials visible: date, mode,
   amounts, approval state and actions. Party details are intentionally
   omitted from this view. ── */
export default function ExpenseTable({
  expenses, selection, visibleNativeIds, sortOrder, onToggleSort,
  isAdmin, canUpdate, canDelete, uploadingBillId,
  onRefreshCheque, actions,
}) {
  return (
    <div className="hidden max-h-[calc(100dvh-320px)] overflow-auto overscroll-contain md:block">
      <table className="w-full min-w-[1180px] border-collapse text-left">
        <caption className="sr-only">Expense entries</caption>
        <thead className="sticky top-0 z-20">
          <tr>
            <th scope="col" className={`${HEAD} w-10`}>
              <Checkbox
                checked={
                  selection.isAllSelected(visibleNativeIds)
                    ? true
                    : selection.count > 0 && visibleNativeIds.some((id) => selection.isSelected(id))
                      ? 'indeterminate'
                      : false
                }
                onCheckedChange={() => selection.toggleAll(visibleNativeIds)}
                aria-label="Select all expenses"
              />
            </th>
            <th scope="col" className={`${HEAD} min-w-[280px]`}>Expense / party</th>
            <th scope="col" className={`${HEAD} w-28`}>
              <button
                type="button"
                onClick={onToggleSort}
                className="inline-flex items-center gap-1 rounded-full transition-colors hover:text-mr-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
                title={sortOrder === 'asc' ? 'Oldest first' : 'Newest first'}
              >
                Date <ArrowUpDown className="h-3 w-3" strokeWidth={1.9} aria-hidden="true" />
              </button>
            </th>
            <th scope="col" className={`${HEAD} w-28`}>Method</th>
            <th scope="col" className={`${HEAD} w-32 text-right`}>Debit</th>
            <th scope="col" className={`${HEAD} w-32 text-right`}>Credit</th>
            <th scope="col" className={`${HEAD} w-36`}>Status</th>
            <th scope="col" className={`${HEAD} w-56 text-right`}>Bill &amp; actions</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((exp, idx) => {
            const debit = parseFloat(exp.debit) || 0;
            const credit = parseFloat(exp.credit) || 0;
            const rejected = exp.status === 'rejected';
            const missingBill = isMissingBill(exp);
            const status = STATUS_CHIP[exp.status] || STATUS_CHIP.pending;
            const source = exp.source ? SOURCE_META[exp.source] : null;
            return (
              <tr
                key={exp.id}
                className={`border-b border-mr-line align-top transition-colors duration-150 ${
                  rejected ? 'opacity-60' : missingBill ? 'bg-mr-coral-soft/40' : 'hover:bg-mr-surface-2/60'
                }`}
              >
                <td className="px-4 py-3.5">
                  {!exp.source && (
                    <Checkbox
                      checked={selection.isSelected(exp.id)}
                      onCheckedChange={() => selection.toggle(exp.id)}
                      aria-label={`Select expense ${idx + 1}`}
                    />
                  )}
                </td>

                <td className="px-4 py-3.5">
                  <button type="button" onClick={() => actions.onView(exp)} className="block max-w-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue">
                    <span className="block truncate text-[13px] font-semibold text-mr-text hover:text-mr-blue">{exp.remark || exp.category || 'Expense entry'}</span>
                    <span className="mt-1 block truncate text-[12px] text-mr-muted">{exp.to_entity ? `Paid to · ${exp.to_entity}` : exp.from_entity ? `Received from · ${exp.from_entity}` : 'No party recorded'}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-[11px] text-mr-faint">{exp.category && <><Tag className="h-3 w-3" strokeWidth={1.9} />{exp.category}</>}{source && <>{exp.category && <span aria-hidden="true">·</span>}<span>{source.label}</span></>}</span>
                  </button>
                </td>

                <td className="whitespace-nowrap px-4 py-3.5">
                  <span className="block text-[13px] font-medium tabular-nums text-mr-text">{actions.formatDate(exp.date)}</span>
                  <span className="mt-0.5 block text-[11px] text-mr-faint">#{String(exp.id).padStart(6, '0')}</span>
                </td>

                <td className="whitespace-nowrap px-4 py-3.5">
                  {exp.payment_mode ? (
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium ${MODE_CHIP[exp.payment_mode] || MODE_CHIP.DEFAULT}`}>
                      {exp.payment_mode}
                    </span>
                  ) : <span className="text-[12px] text-mr-faint">—</span>}
                  <ChequeStatusControl
                    chequeStatus={exp.cheque_status}
                    source="expense"
                    entryId={exp.id}
                    isAdmin={isAdmin}
                    onStatusChange={onRefreshCheque}
                  />
                </td>

                <td className="whitespace-nowrap px-4 py-3.5 text-right">
                  {debit > 0 ? (
                    <span className={`text-[14px] font-semibold tabular-nums ${rejected ? 'text-mr-faint line-through' : 'text-mr-coral-ink'}`}>
                      {money(debit)}
                    </span>
                  ) : <span className="text-[12px] text-mr-faint">—</span>}
                </td>

                <td className="whitespace-nowrap px-4 py-3.5 text-right">
                  {credit > 0 ? (
                    <span className={`text-[14px] font-semibold tabular-nums ${rejected ? 'text-mr-faint line-through' : 'text-mr-lime-ink'}`}>
                      {money(credit)}
                    </span>
                  ) : <span className="text-[12px] text-mr-faint">—</span>}
                </td>

                <td className="whitespace-nowrap px-4 py-3.5">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium ${status.chip}`}>
                    {status.label}
                  </span>
                  {exp.approved_by_name && (exp.status === 'approved' || exp.status === 'rejected') && (
                    <span className="mt-0.5 block truncate text-[12px] text-mr-faint">by {exp.approved_by_name}</span>
                  )}
                  {source && <span className="mt-0.5 block text-[12px] text-mr-faint">{source.label}</span>}
                  {exp.created_by_name && (
                    <span className="mt-0.5 block truncate text-[12px] text-mr-faint">Entry by {exp.created_by_name}</span>
                  )}
                </td>

                <td className="whitespace-nowrap px-4 py-3.5">
                  <div className="flex items-center justify-end gap-2">
                    <ExpenseBillCell
                      expense={exp}
                      uploading={uploadingBillId === exp.id}
                      onUpload={actions.onUploadBill}
                      onView={actions.onViewBill}
                    />
                    <ExpenseRowActions
                      expense={exp}
                      canUpdate={canUpdate}
                      canDelete={canDelete}
                      {...actions}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
