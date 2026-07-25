import {
  Check, ClipboardCheck, Clock, LineChart, PenLine, ShieldCheck,
} from 'lucide-react';
import { CurrencyValue, StatusPill } from '../dashboard/primitives';
import { COLLECTION_MIX, DEMO_LEDGER } from './demoLedger';
import { money, moneyCompact } from '@/lib/utils';

/* ── Product mockups ─────────────────────────────────────────────────
   Static slices of MountReality's real interface vocabulary, built from
   the app's own StatusPill and CurrencyValue so they cannot drift away
   from the product they are advertising.

   Rules these obey:
   · No state, no effects, no charts — they are illustrations, and the
     one real chart on the page is mounted exactly once (its SVG gradient
     ids are document-global, so a second mount would silently share the
     first definition).
   · Every ₹ figure comes from demoLedger and keeps the label that module
     uses for it. Rows that would need a per-row amount carry none rather
     than inventing one.
   · Content deliberately overflows the frame and is cut, so each reads
     as a slice of a bigger screen. ── */

const CARDLET = 'rounded-panel-sm border border-mr-line bg-mr-surface px-3 py-2.5 shadow-[0_1px_3px_rgba(16,17,20,0.04)]';
const ROWLABEL = 'truncate text-[13px] font-medium text-mr-text';
const ROWMETA = 'shrink-0 text-[12px] text-mr-muted';

/* One height for every cell in the row, so the three titles below them
   sit on the same baseline. */
const FRAME_H = 'h-[340px]';

export function MockFrame({ children, className = '', label }) {
  return (
    <div
      className={`mr-dots ${FRAME_H} overflow-hidden rounded-panel-sm bg-mr-surface ${className}`}
      role="img"
      aria-label={label}
    >
      <div className="relative flex h-full flex-col gap-2.5 p-5">{children}</div>
    </div>
  );
}

/* ── Screenshot cell ─────────────────────────────────────────────────
   A real product screenshot in the same frame as the built mockups.
   object-top because these are tall portrait captures — anchoring to the
   top shows the part of the screen that carries the meaning, and the
   frame crops the rest, matching the "slice of a bigger screen" reading
   the other cells have.

   ponytail: lazy + async decoding because this row is below the fold.
   These files are ~1MB PNGs; converting them to WebP would cut ~90% of
   that, but that is an asset job, not a code change. */
export function ScreenshotMock({ src, alt }) {
  return (
    <div className={`${FRAME_H} overflow-hidden rounded-panel-sm border border-mr-line bg-mr-surface`}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover object-top"
      />
    </div>
  );
}

/* ── A · the approval queue ──
   No rupee figures here on purpose: a plausible amount on a queue row
   would either be invented, or a demoLedger monthly total mislabelled as
   one plot instalment. Names, status and relative time carry the idea. */
const QUEUE = [
  { initials: 'RK', chip: 'bg-mr-aqua-soft text-mr-aqua-ink', label: 'Plot 42 · instalment 3', meta: '2h ago', offset: '' },
  { initials: 'SV', chip: 'bg-mr-coral-soft text-mr-coral-ink', label: 'Cement · vendor bill', meta: '4h ago', offset: 'translate-x-2' },
  { initials: 'MP', chip: 'bg-mr-amber-soft text-mr-amber-ink', label: 'Survey 118 · farmer payout', meta: '1d ago', offset: '' },
];

export function ApprovalQueueMock() {
  return (
    <MockFrame label="Pending approvals queue: three entries waiting for sign-off, one already approved.">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-medium text-mr-muted">Pending approvals</p>
        <StatusPill tone="attention" icon={Clock}>{QUEUE.length} waiting</StatusPill>
      </div>

      {QUEUE.map((row) => (
        <div key={row.label} className={`${CARDLET} flex items-center gap-2.5 ${row.offset}`}>
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${row.chip}`}>
            {row.initials}
          </span>
          <span className={ROWLABEL}>{row.label}</span>
          <span className={`ml-auto ${ROWMETA}`}>{row.meta}</span>
          <StatusPill tone="attention">Pending</StatusPill>
        </div>
      ))}

      <div className={`${CARDLET} flex items-center gap-2.5 opacity-70`}>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mr-lime-soft text-[12px] font-semibold text-mr-lime-ink">
          AS
        </span>
        <span className={ROWLABEL}>Plot 17 · registry transfer</span>
        <StatusPill tone="positive" icon={Check} className="ml-auto">Approved</StatusPill>
      </div>
    </MockFrame>
  );
}

/* ── B · the period recompute ── */
const PERIODS = ['This month', DEMO_LEDGER.period, 'FY 25-26'];

export function PeriodRecomputeMock() {
  const mixTotal = COLLECTION_MIX.reduce((sum, row) => sum + row.value, 0);

  return (
    <MockFrame label={`Period selector set to ${DEMO_LEDGER.period}, with collected and closing figures and the collection mix recomputed for it.`}>
      {/* An illustration of the control, not a control */}
      <div className="inline-flex items-center rounded-control border border-mr-line bg-mr-surface p-0.5" aria-hidden="true">
        {PERIODS.map((period) => (
          <span
            key={period}
            className={`px-2.5 py-1 text-[12px] font-medium ${
              period === DEMO_LEDGER.period ? 'rounded-[11px] bg-mr-ink text-white' : 'text-mr-muted'
            }`}
          >
            {period}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className={CARDLET}>
          <p className="flex items-center gap-1.5 text-[12px] text-mr-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-mr-aqua-ink" aria-hidden="true" />
            Collected
          </p>
          <CurrencyValue value={DEMO_LEDGER.incoming} size="sm" className="mt-1" compactAbove={1e5} />
        </div>
        <div className={CARDLET}>
          <p className="flex items-center gap-1.5 text-[12px] text-mr-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-mr-lime-ink" aria-hidden="true" />
            Closing balance
          </p>
          <CurrencyValue value={DEMO_LEDGER.closing} size="sm" tone="positive" className="mt-1" compactAbove={1e5} />
        </div>
      </div>

      <div className="mt-1 flex h-2 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
        {COLLECTION_MIX.map((row) => (
          <span key={row.label} className={`h-full ${row.tone}`} style={{ width: `${(row.value / mixTotal) * 100}%` }} />
        ))}
      </div>

      <ul className="space-y-1.5">
        {COLLECTION_MIX.map((row) => (
          <li key={row.label} className="flex items-baseline justify-between gap-3 text-[12px]">
            <span className="flex min-w-0 items-center gap-2 text-mr-muted">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${row.tone}`} aria-hidden="true" />
              <span className="truncate">{row.label}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-mr-text" title={money(row.value)}>
              {moneyCompact(row.value)}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-[12px] text-mr-muted">Every figure recomputed against the same ledger.</p>
    </MockFrame>
  );
}

/* ── C · the role matrix ── */
const ROLES = ['Manager', 'Accounts', 'Owner'];
const PERMISSIONS = [
  { label: 'Own site', allow: [true, true, true] },
  { label: 'All sites', allow: [false, true, true] },
  { label: 'Approve entries', allow: [false, true, true] },
  { label: 'Export books', allow: [false, false, true] },
];

export function RoleMatrixMock() {
  return (
    <MockFrame label="Role permission matrix: a site manager sees their own site only, accounts can approve, the owner can export the books.">
      <StatusPill tone="ink" icon={ShieldCheck}>Role permissions</StatusPill>

      <div className={`${CARDLET} overflow-hidden !p-0`}>
        <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,44px)] border-b border-mr-line px-3 py-2">
          <span />
          {ROLES.map((role) => (
            <span key={role} className="truncate text-center text-[12px] text-mr-muted">{role}</span>
          ))}
        </div>
        {PERMISSIONS.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[minmax(0,1fr)_repeat(3,44px)] items-center border-b border-mr-line px-3 py-2.5 last:border-b-0"
          >
            <span className="truncate text-[13px] text-mr-text">{row.label}</span>
            {row.allow.map((allowed, index) => (
              <span key={ROLES[index]} className="flex justify-center">
                {allowed
                  ? <Check className="h-4 w-4 text-mr-lime-ink" strokeWidth={2.4} aria-hidden="true" />
                  : <span className="h-px w-3 bg-mr-line-strong" aria-hidden="true" />}
              </span>
            ))}
          </div>
        ))}
      </div>
    </MockFrame>
  );
}

/* ── D · the approval flow ──
   A vertical spine with ring-4 junction dots gives the connector-line
   look with no SVG paths and no layout measurement, and it survives
   every breakpoint unchanged. */
const NODES = [
  {
    icon: PenLine,
    chipClass: 'bg-mr-aqua-soft text-mr-aqua-ink',
    title: 'Site manager records the voucher',
    meta: 'Bill image attached · Demo Colony · Phase II',
    chip: 'Recorded',
    tone: 'positive',
  },
  {
    icon: ClipboardCheck,
    chipClass: 'bg-mr-amber-soft text-mr-amber-ink',
    title: 'Accountant reviews and signs off',
    meta: 'Category, site and approver on the entry',
    chip: 'Awaiting approval',
    tone: 'attention',
  },
  {
    icon: LineChart,
    chipClass: 'bg-mr-lime-soft text-mr-lime-ink',
    title: 'Day book and balance sheet update',
    meta: 'No consolidation step, no re-entry',
    chip: 'Posted to the books',
    tone: 'info',
  },
];

export function ApprovalFlowMock() {
  return (
    <div className="mr-dots relative overflow-hidden rounded-panel-sm bg-mr-surface">
      <div className="relative p-5 sm:p-6">
        <span className="pointer-events-none absolute bottom-8 left-[27px] top-8 w-px bg-mr-line-strong" aria-hidden="true" />
        <ol className="relative space-y-3">
          {NODES.map((node) => (
            <li key={node.title} className="flex items-start gap-3">
              <span className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-4 ring-mr-surface ${node.chipClass}`}>
                <node.icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              </span>
              <div className={`min-w-0 flex-1 ${CARDLET}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className={ROWLABEL}>{node.title}</p>
                  <StatusPill tone={node.tone}>{node.chip}</StatusPill>
                </div>
                <p className="mt-1 truncate text-[12px] text-mr-muted">{node.meta}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/* ── E · filed against ──
   Eight rows so the list overflows and the top/bottom mask does the
   work. No rupee figures — these are attachments, not amounts. */
const FILED = [
  { label: 'Plot 42 · booking file', meta: 'Attached', dot: 'bg-mr-aqua-ink' },
  { label: 'Survey 118 · farmer agreement', meta: 'Attached', dot: 'bg-mr-lime-ink' },
  { label: 'Cement · vendor bill', meta: 'Bill image', dot: 'bg-mr-coral' },
  { label: 'Registry · transfer deed', meta: 'Attached', dot: 'bg-mr-blue' },
  { label: 'Agent commission note', meta: 'Linked to sale', dot: 'bg-mr-aqua-ink' },
  { label: 'Site expense voucher', meta: 'Approver on file', dot: 'bg-mr-lime-ink' },
  { label: 'Buyer KYC', meta: 'Attached', dot: 'bg-mr-coral' },
  { label: 'Instalment receipt', meta: 'Sent', dot: 'bg-mr-blue' },
];

export function FiledAgainstMock() {
  return (
    <div
      className="mr-fade-y h-[300px] overflow-hidden"
      role="img"
      aria-label="A list of documents filed against the plot, survey number, vendor or agent they concern."
    >
      <ul className="px-1">
        {FILED.map((item) => (
          <li key={item.label} className="flex items-center gap-3 border-b border-mr-line py-3 last:border-b-0">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.dot}`} aria-hidden="true" />
            <span className={ROWLABEL}>{item.label}</span>
            <span className={`ml-auto ${ROWMETA}`}>{item.meta}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
