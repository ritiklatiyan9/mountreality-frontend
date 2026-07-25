import { Checkbox } from '../ui/checkbox';
import ExpenseRowActions from './ExpenseRowActions';
import ExpenseBillCell from './ExpenseBillCell';
import { MODE_CHIP, SOURCE_META, STATUS_CHIP, isMissingBill } from './expenseMeta';
import { money } from '@/lib/utils';

/* ── Expense list (mobile) ───────────────────────────────────────────
   One card per entry. The amount leads, because on a phone that is what
   people are scanning for. ── */
export default function ExpenseMobileList({
  expenses, selection, canUpdate, canDelete, uploadingBillId, getAssignedAdminLabel, actions,
}) {
  return (
    <ul className="divide-y divide-mr-line md:hidden">
      {expenses.map((exp) => {
        const debit = parseFloat(exp.debit) || 0;
        const credit = parseFloat(exp.credit) || 0;
        const rejected = exp.status === 'rejected';
        const status = STATUS_CHIP[exp.status] || STATUS_CHIP.pending;
        const source = exp.source ? SOURCE_META[exp.source] : null;
        const meta = [exp.category, getAssignedAdminLabel(exp), exp.remark].filter(Boolean).join(' · ');

        return (
          <li key={`m-${exp.id}`} className={`px-4 py-4 ${isMissingBill(exp) ? 'bg-mr-coral-soft/40' : ''}`}>
            <div className="flex items-start gap-3">
              {!exp.source && (
                <Checkbox
                  checked={selection.isSelected(exp.id)}
                  onCheckedChange={() => selection.toggle(exp.id)}
                  aria-label="Select expense"
                  className="mt-1 shrink-0"
                />
              )}
              <button type="button" onClick={() => actions.onView(exp)} className="min-w-0 flex-1 text-left">
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium text-mr-text">
                      {exp.to_entity || exp.from_entity || '—'}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-mr-faint">{actions.formatDate(exp.date)}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    {debit > 0 && (
                      <span className={`block text-[15px] font-semibold tabular-nums ${rejected ? 'text-mr-faint line-through' : 'text-mr-coral-ink'}`}>
                        −{money(debit)}
                      </span>
                    )}
                    {credit > 0 && (
                      <span className={`block text-[15px] font-semibold tabular-nums ${rejected ? 'text-mr-faint line-through' : 'text-mr-lime-ink'}`}>
                        +{money(credit)}
                      </span>
                    )}
                  </span>
                </span>

                <span className="mt-2 flex flex-wrap items-center gap-1.5">
                  {exp.payment_mode && (
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium ${MODE_CHIP[exp.payment_mode] || MODE_CHIP.DEFAULT}`}>
                      {exp.payment_mode}
                    </span>
                  )}
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium ${status.chip}`}>
                    {status.label}
                  </span>
                  {source && <span className="text-[12px] text-mr-faint">{source.label}</span>}
                </span>

                {meta && <span className="mt-1.5 block truncate text-[12px] text-mr-faint">{meta}</span>}
              </button>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
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
          </li>
        );
      })}
    </ul>
  );
}
