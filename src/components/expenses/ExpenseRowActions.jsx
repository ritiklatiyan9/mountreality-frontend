import { Edit2, Eye, PenLine, Printer, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { SOURCE_META } from './expenseMeta';

const ICON = 'h-8 w-8 rounded-full p-0 text-mr-faint';

/* ── Expense row actions ─────────────────────────────────────────────
   Entries imported from another module cannot be edited here — the edit
   button routes to the owning module instead. That decision lived in a
   five-branch ternary inside the table; it lives here now so the table
   and the mobile list can never disagree about it. ── */
export default function ExpenseRowActions({
  expense, canUpdate, canDelete, onView, onPrint, onSign, onEdit, onDelete, onNavigate,
}) {
  const source = expense.source ? SOURCE_META[expense.source] : null;

  return (
    <div className="flex items-center justify-end gap-0.5">
      <Button
        variant="ghost"
        onClick={() => onView(expense)}
        className={`${ICON} hover:bg-mr-blue-soft hover:text-mr-blue`}
        title="View details"
        aria-label="View expense details"
      >
        <Eye className="h-4 w-4" strokeWidth={1.9} />
      </Button>

      <Button
        variant="ghost"
        onClick={() => onPrint(expense)}
        className={`${ICON} hover:bg-mr-surface-2 hover:text-mr-text`}
        title="Print receipt"
        aria-label="Print receipt"
      >
        <Printer className="h-4 w-4" strokeWidth={1.9} />
      </Button>

      {canUpdate && !expense.source && (
        <Button
          variant="ghost"
          onClick={() => onSign(expense)}
          className={`${ICON} ${expense.customer_signature_url ? 'text-mr-lime-ink hover:bg-mr-lime-soft' : 'hover:bg-mr-surface-2 hover:text-mr-text'}`}
          title={expense.customer_signature_url ? 'Signed — capture again' : 'Capture customer signature'}
          aria-label={expense.customer_signature_url ? 'Signed, capture again' : 'Capture customer signature'}
        >
          <PenLine className="h-4 w-4" strokeWidth={1.9} />
        </Button>
      )}

      {canUpdate && (
        source ? (
          <Button
            variant="ghost"
            onClick={() => onNavigate(source.route)}
            className={`${ICON} hover:bg-mr-amber-soft hover:text-mr-amber-ink`}
            title={`Edit in ${source.label}`}
            aria-label={`Edit in ${source.label}`}
          >
            <Edit2 className="h-4 w-4" strokeWidth={1.9} />
          </Button>
        ) : (
          <Button
            variant="ghost"
            onClick={() => onEdit(expense)}
            className={`${ICON} hover:bg-mr-surface-2 hover:text-mr-text`}
            title="Edit"
            aria-label="Edit expense"
          >
            <Edit2 className="h-4 w-4" strokeWidth={1.9} />
          </Button>
        )
      )}

      {canDelete && !expense.source && (
        <Button
          variant="ghost"
          onClick={() => onDelete(expense.id)}
          className={`${ICON} hover:bg-mr-coral-soft hover:text-mr-coral-ink`}
          title="Delete"
          aria-label="Delete expense"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.9} />
        </Button>
      )}
    </div>
  );
}
