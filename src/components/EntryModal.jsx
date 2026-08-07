import { createElement, useEffect, useRef, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Shared layout kit for every entry-recording modal, so all modules look and
 * feel identical. Standard order inside <EntryDialog>:
 *   1. <CreditDebitTabs/> (when the module has a direction choice)
 *   2. <EntryRow> Date | mode selector </EntryRow>
 *   3. <EntryAmount/> (full width, direction-tinted)
 *   4. module-specific fields in <EntryRow>/<EntryField>
 *   5. notes/remarks full width, then uploads
 * Fields vary per module; size, spacing, labels, and footer never do.
 */

/** Small colored circular icon badge used in front of a field label — the
 * "premium" accent shared by Quick Entry and Day Book's redesigned dialogs. */
export const FieldLabel = ({ icon, color, children }) => (
  <span className="flex items-center gap-1.5">
    <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full', color)}>
      {createElement(icon, { className: 'w-3 h-3' })}
    </span>
    {children}
  </span>
);

export function EntryDialog({ open, onOpenChange, title, description, children, footer }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-slate-900">{title}</DialogTitle>
          {description ? (
            <DialogDescription className="text-sm text-slate-500">{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="space-y-4 py-1">{children}</div>
        {footer ? <DialogFooter className="pt-2">{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}

/** Standard footer: outline Cancel + primary submit with loading spinner. */
export function EntryFooter({ onCancel, onSubmit, submitLabel = 'Save', submitting = false, disabled = false, submitClassName }) {
  return (
    <>
      <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
        Cancel
      </Button>
      <Button type={onSubmit ? 'button' : 'submit'} onClick={onSubmit} disabled={submitting || disabled} className={submitClassName}>
        {submitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
        {submitLabel}
      </Button>
    </>
  );
}

/** Two-column responsive field row (single column on small screens). */
export function EntryRow({ children, className }) {
  return <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-3', className)}>{children}</div>;
}

/** Label + control wrapper with the standard label style. */
export function EntryField({ label, required = false, hint, className, children }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <Label className="text-sm font-medium text-slate-700">
          {label}
          {required ? <span className="text-red-500 ml-0.5">*</span> : null}
        </Label>
      ) : null}
      {children}
      {hint ? <p className="text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

/**
 * The prominent amount box, tinted by direction to match CreditDebitTabs
 * (credit = emerald / debit = red). Direction-less modals pass their fixed one.
 */
export function EntryAmount({ label = 'Amount (₹)', direction = 'credit', visual, required = true, hint, inputProps = {} }) {
  const credit = visual ? visual === 'in' : direction === 'credit';
  return (
    <div className={cn(
      'rounded-lg border p-3',
      credit ? 'border-emerald-200 bg-emerald-50/40' : 'border-red-200 bg-red-50/40'
    )}>
      <Label className={cn('text-sm font-medium', credit ? 'text-emerald-700' : 'text-red-700')}>
        {label}
        {required ? <span className="ml-0.5">*</span> : null}
      </Label>
      <Input
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        {...inputProps}
        className={cn(
          'mt-1.5 bg-white text-lg font-semibold',
          credit ? 'focus-visible:ring-emerald-500' : 'focus-visible:ring-red-500',
          inputProps.className
        )}
      />
      {hint ? <p className={cn('mt-1 text-[11px]', credit ? 'text-emerald-600/70' : 'text-red-600/70')}>{hint}</p> : null}
    </div>
  );
}

export const CASH_PARTICULARS = ['CASH'];
export const BANK_PARTICULARS = ['RTGS', 'NEFT', 'UPI', 'IMPS', 'BANK TRANSFER'];

export const getParticularsForMode = (mode) => {
  const m = String(mode || '').toUpperCase();
  if (m === 'BANK') return BANK_PARTICULARS;
  if (m === 'CHEQUE') return ['CHEQUE'];
  return CASH_PARTICULARS;
};

/**
 * The standard mode-driven Particular dropdown (same in every module):
 * CASH -> CASH, BANK -> RTGS/NEFT/UPI/IMPS/BANK TRANSFER, CHEQUE -> fixed chip.
 * A stored legacy value outside the list is prepended so old records still
 * display and re-save unchanged when edited.
 */
export function EntryParticular({ mode, value, onChange, required = true }) {
  const m = String(mode || '').toUpperCase();
  if (m === 'CHEQUE') {
    return (
      <EntryField label="Particular">
        <div className="flex items-center h-9 px-3 rounded-md border bg-teal-50 text-sm font-semibold text-teal-700 border-teal-200">
          CHEQUE
        </div>
      </EntryField>
    );
  }
  const options = getParticularsForMode(m);
  const opts = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <EntryField label="Particular" required={required}>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Select particular" /></SelectTrigger>
        <SelectContent>
          {opts.map((opt) => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </EntryField>
  );
}

/**
 * Searchable dropdown for entity pickers (plots, farmers, firms, ledgers…).
 * Inline panel, no portal — safe inside dialogs (same pattern as PlotDetail's
 * Booked By picker). Filters on label + sublabel, case-insensitive.
 * options: [{ value, label, sublabel? }]
 */
export function EntrySearchSelect({ value, onChange, options = [], placeholder = 'Select…', searchPlaceholder = 'Search by name or number…', disabled = false }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selected = options.find((o) => String(o.value) === String(value));
  const norm = (s) => String(s || '').toLowerCase();
  const query = norm(q.trim());
  const filtered = query
    ? options.filter((o) => `${norm(o.label)} ${norm(o.sublabel)}`.includes(query))
    : options;

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen((v) => !v); setQ(''); }}
        className="h-9 w-full flex items-center justify-between px-3 border border-slate-200 rounded-md text-sm bg-white hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:opacity-50"
      >
        {selected ? (
          <span className="truncate text-slate-800">
            {selected.label}
            {selected.sublabel ? <span className="text-slate-400"> · {selected.sublabel}</span> : null}
          </span>
        ) : (
          <span className="text-slate-400">{placeholder}</span>
        )}
        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg overflow-hidden">
          <div className="p-1.5 border-b border-slate-100">
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
              placeholder={searchPlaceholder}
              className="h-8"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">No matches</p>
            ) : filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(String(o.value)); setOpen(false); }}
                className={cn(
                  'w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors',
                  String(o.value) === String(value) && 'bg-indigo-50 text-indigo-700'
                )}
              >
                <span className="truncate block">
                  {o.label}
                  {o.sublabel ? <span className="text-slate-400"> · {o.sublabel}</span> : null}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const MODE_ACTIVE = {
  CASH: 'bg-emerald-600 text-white border-emerald-600',
  BANK: 'bg-blue-600 text-white border-blue-600',
  CHEQUE: 'bg-teal-600 text-white border-teal-600',
  UPI: 'bg-violet-600 text-white border-violet-600',
};

/** Standard payment-mode chip row. Pass uppercase mode names; value compared case-insensitively. */
export function EntryModeChips({ value, onChange, modes = ['CASH', 'BANK', 'CHEQUE'], disabled = false }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {modes.map((m) => {
        const active = String(value).toUpperCase() === m.toUpperCase();
        return (
          <button
            key={m}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(m)}
            className={cn(
              'px-3 py-1.5 rounded-md border text-xs font-medium transition-colors',
              active
                ? (MODE_ACTIVE[m.toUpperCase()] || 'bg-slate-800 text-white border-slate-800')
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {m}
          </button>
        );
      })}
    </div>
  );
}
