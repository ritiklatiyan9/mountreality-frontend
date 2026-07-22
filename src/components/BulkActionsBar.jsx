import { useState } from 'react';
import { Loader2, Pencil, Printer, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Selection toolbar shown next to a page header once rows are checked.
// Renders as a fragment — drop it inside the page's existing header flex
// row (see PlotCommissionList.jsx's "N selected" pill for the precedent).
//
// onEdit is only ever called with exactly 1 row selected (bulk edit across
// heterogeneous rows isn't supported — see draw allotment / booking-erp
// conventions: edit always targets one record).
export default function BulkActionsBar({
  count,
  onClear,
  onDelete,
  onEdit,
  onPrint,
  entityLabel = 'item',
  deleting = false,
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  if (count === 0) return null;

  const plural = count === 1 ? entityLabel : `${entityLabel}s`;

  return (
    <>
      <span className="flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 pl-3 pr-1 py-0.5">
        <span className="text-[11px] font-semibold text-sky-700">{count} selected</span>
        <button
          onClick={onClear}
          className="text-[11px] font-medium text-sky-600 px-1.5 py-0.5 rounded-full hover:bg-sky-100"
        >
          Clear
        </button>
      </span>
      {onEdit && (
        <Button variant="outline" size="sm" onClick={onEdit} disabled={count !== 1} className="h-8">
          <Pencil className="h-4 w-4 mr-2" /> Edit
        </Button>
      )}
      {onPrint && (
        <Button
          variant="outline"
          size="sm"
          onClick={onPrint}
          className="h-8 border-blue-200 text-blue-700 hover:bg-blue-50"
        >
          <Printer className="h-4 w-4 mr-2" /> Print Selected ({count})
        </Button>
      )}
      {onDelete && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            className="h-8 border-red-200 text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4 mr-2" /> Delete ({count})
          </Button>
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-base">Delete {count} {plural}?</DialogTitle>
                <DialogDescription className="text-sm">
                  This will permanently remove {count} selected {plural}. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirmOpen(false)} disabled={deleting}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    await onDelete();
                    setConfirmOpen(false);
                  }}
                  disabled={deleting}
                >
                  {deleting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </>
  );
}
