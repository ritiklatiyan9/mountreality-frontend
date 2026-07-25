import { ImageIcon, Loader2, UploadCloud } from 'lucide-react';

const CHIP = 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors';

/* ── Bill cell ───────────────────────────────────────────────────────
   Cash entries need no bill. Non-cash entries either show the bill, let
   you upload one inline, or say it is missing when the entry belongs to
   another module and cannot be edited here. ── */
export default function ExpenseBillCell({ expense, uploading, onUpload, onView }) {
  const nonCash = expense.payment_mode && expense.payment_mode !== 'CASH';
  if (!nonCash) return <span className="text-[12px] text-mr-faint">—</span>;

  if (expense.bill_url) {
    return (
      <button
        type="button"
        onClick={() => onView(expense)}
        className={`${CHIP} bg-mr-lime-soft text-mr-lime-ink hover:brightness-95`}
      >
        <ImageIcon className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" /> View bill
      </button>
    );
  }

  if (expense.source) {
    return (
      <span className={`${CHIP} bg-mr-amber-soft text-mr-amber-ink`}>Bill missing</span>
    );
  }

  return (
    <label
      className={`${CHIP} cursor-pointer ${uploading ? 'cursor-wait bg-mr-surface-2 text-mr-faint' : 'bg-mr-coral-soft text-mr-coral-ink hover:brightness-95'}`}
    >
      {uploading
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        : <UploadCloud className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />}
      {uploading ? 'Uploading…' : 'Upload bill'}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="sr-only"
        disabled={uploading}
        onChange={(e) => onUpload(expense.id, e.target.files[0])}
      />
    </label>
  );
}
