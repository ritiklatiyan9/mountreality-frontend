import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowUpRight, CheckCircle2, ChevronLeft, ChevronRight, Clock, Receipt, XCircle,
} from 'lucide-react';
import { EmptyState, SkeletonBlock, StatusPill } from './primitives';
import { ACCENT, toneFor } from './accents';
import { money } from '@/lib/utils';

/* Module chips reuse toneFor(), so a plot payment is the same colour here
   as in the workflow strip. Amounts carry their own credit/debit colour. */
const MODULE_LABEL = {
  farmer_payments: 'Farmer payment',
  plot_commissions: 'Commission',
  plot_commission_payments: 'Commission payment',
  day_book: 'Day book',
  firm_transactions: 'Firm txn',
  plot_payments: 'Project payment',
  expenses: 'Expense',
  vendor_payments: 'Vendor',
  plot_installment_payments: 'Installment',
  plot_registry_payments: 'Registry txn',
  personal_ledger_debit: 'Personal ledger',
};

const STATUS = {
  pending: { tone: 'attention', icon: Clock, label: 'Pending' },
  approved: { tone: 'positive', icon: CheckCircle2, label: 'Approved' },
  rejected: { tone: 'negative', icon: XCircle, label: 'Rejected' },
  BOUNCED: { tone: 'negative', icon: AlertTriangle, label: 'Bounced' },
  RETURNED: { tone: 'attention', icon: AlertTriangle, label: 'Returned' },
  CLEARED: { tone: 'positive', icon: CheckCircle2, label: 'Cleared' },
  PENDING: { tone: 'attention', icon: Clock, label: 'Pending' },
};

const fmtDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
  : '—');

/* Normalises the row the same way the previous table did: a negative
   credit is a debit and vice versa, and either case is a refund. */
const readRow = (txn) => {
  const rawDebit = parseFloat(txn.debit) || 0;
  const rawCredit = parseFloat(txn.credit) || 0;
  const status = (txn.cheque_status && STATUS[txn.cheque_status.toUpperCase()])
    || STATUS[txn.status] || STATUS.pending;
  return {
    debit: rawDebit > 0 ? rawDebit : (rawCredit < 0 ? Math.abs(rawCredit) : 0),
    credit: rawCredit > 0 ? rawCredit : (rawDebit < 0 ? Math.abs(rawDebit) : 0),
    isRefund: rawCredit < 0 || rawDebit < 0,
    status,
    moduleLabel: MODULE_LABEL[txn.source_module] || 'Cash flow',
    moduleAccent: ACCENT[toneFor(txn.source_module || 'cash_flow')],
    mode: (txn.cash_type || '').toUpperCase(),
  };
};

/* Secondary line: only the fields this particular row actually carries. */
const metaOf = (txn, isRefund) => [
  txn.plot_no && `Plot ${txn.plot_no}`,
  txn.buyer_name && `Buyer ${txn.buyer_name}`,
  txn.booked_by && `Booked by ${txn.booked_by}`,
  txn.cheque_no && `Cheque ${txn.cheque_no}`,
  txn.created_by_name && `Entry by ${txn.created_by_name}`,
  isRefund && 'Refund / adjustment',
  txn.remarks,
].filter(Boolean).join(' · ');

function Amount({ credit, debit, isRefund }) {
  if (credit > 0) {
    return <span className="font-semibold tabular-nums text-mr-lime-ink" title={money(credit)}>+{money(credit)}</span>;
  }
  if (debit > 0) {
    return <span className="font-semibold tabular-nums text-mr-coral-ink" title={money(debit)}>{isRefund ? '−' : ''}{money(debit)}</span>;
  }
  return <span className="text-mr-faint">—</span>;
}

/* ── Recent financial activity ───────────────────────────────────────
   Desktop: one low-chrome table. Mobile: the same rows as a stacked
   list — never a squeezed table. Data, click targets and pagination
   are the caller's existing /daybook/recent behaviour. ── */
export default function RecentActivity({
  transactions, loading, page, pagination, perPage, onPageChange, onRowClick, viewAllHref = '/daybook',
}) {
  const totalPages = pagination?.totalPages || 1;
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce((acc, p, i, arr) => {
      if (i > 0 && p - arr[i - 1] > 1) acc.push('gap');
      acc.push(p);
      return acc;
    }, []);

  return (
    <section
      aria-labelledby="mr-activity-title"
      className="overflow-hidden rounded-panel border border-mr-line bg-mr-surface"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mr-line px-5 py-4 sm:px-6">
        <div>
          <h2 id="mr-activity-title" className="text-[15px] font-semibold tracking-[-0.01em] text-mr-text">
            Recent financial activity
          </h2>
          <p className="mt-0.5 text-[12px] text-mr-muted">Latest approved movements across every module</p>
        </div>
        <Link
          to={viewAllHref}
          className="mr-press group inline-flex h-9 items-center gap-1 rounded-full px-3 text-[12px] font-semibold text-mr-blue hover:bg-mr-blue-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-offset-2"
        >
          View day book
          <ArrowUpRight
            className="h-3.5 w-3.5 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            strokeWidth={2}
            aria-hidden="true"
          />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3 p-5 sm:p-6">
          {[0, 1, 2, 3, 4].map((i) => <SkeletonBlock key={i} className="h-12 w-full" />)}
        </div>
      ) : !transactions?.length ? (
        <EmptyState
          icon={Receipt}
          title="No transactions yet"
          description="Approved entries from every module will appear here as soon as they are recorded."
        />
      ) : (
        <>
          {/* ── Desktop table ── */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Recent approved transactions for this site</caption>
              <thead>
                <tr className="border-b border-mr-line">
                  {['Date', 'Particular', 'Module', 'Mode', 'Amount', 'Status'].map((head, i) => (
                    <th
                      key={head}
                      scope="col"
                      className={`bg-mr-surface-2/70 px-4 py-3 text-[12px] font-medium text-mr-muted ${i === 4 ? 'text-right' : ''}`}
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => {
                  const row = readRow(txn);
                  const meta = metaOf(txn, row.isRefund);
                  return (
                    <tr
                      key={`txn-${txn.id}`}
                      onClick={() => onRowClick(txn)}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') onRowClick(txn); }}
                      className="cursor-pointer border-b border-mr-line transition-colors duration-150 last:border-b-0 hover:bg-mr-surface-2/70 focus-visible:outline-none focus-visible:bg-mr-surface-2"
                    >
                      <td className="whitespace-nowrap px-4 py-3.5 text-[13px] tabular-nums text-mr-muted">{fmtDate(txn.date)}</td>
                      <td className="max-w-[26rem] px-4 py-3.5">
                        <span className="block truncate text-[13px] font-medium text-mr-text" title={txn.particular}>
                          {txn.particular || '—'}
                        </span>
                        {meta && <span className="mt-0.5 block truncate text-[12px] text-mr-faint" title={meta}>{meta}</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium ${row.moduleAccent.chip}`}>
                          {row.moduleLabel}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-[12px] text-mr-muted">{row.mode || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right text-[13px]">
                        <Amount {...row} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <StatusPill tone={row.status.tone} icon={row.status.icon}>{row.status.label}</StatusPill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Mobile list ── */}
          <ul className="divide-y divide-mr-line md:hidden">
            {transactions.map((txn) => {
              const row = readRow(txn);
              const meta = metaOf(txn, row.isRefund);
              return (
                <li key={`m-txn-${txn.id}`}>
                  <button
                    type="button"
                    onClick={() => onRowClick(txn)}
                    className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-mr-surface-2/70 focus-visible:outline-none focus-visible:bg-mr-surface-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-mr-text">{txn.particular || '—'}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-mr-faint">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${row.moduleAccent.chip}`}>
                          {row.moduleLabel}
                        </span>
                        {fmtDate(txn.date)}{row.mode ? ` · ${row.mode}` : ''}
                      </span>
                      {meta && <span className="mt-1 block truncate text-[12px] text-mr-faint">{meta}</span>}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1.5 text-[13px]">
                      <Amount {...row} />
                      <StatusPill tone={row.status.tone}>{row.status.label}</StatusPill>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {totalPages > 1 && (
            <nav
              aria-label="Recent activity pages"
              className="flex flex-wrap items-center justify-between gap-3 border-t border-mr-line px-5 py-3.5 sm:px-6"
            >
              <p className="text-[12px] text-mr-muted">
                Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, pagination.totalItems)} of {pagination.totalItems}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={page <= 1 || loading}
                  onClick={() => onPageChange(page - 1)}
                  className="mr-glass mr-press flex h-9 w-9 items-center justify-center rounded-full text-mr-muted hover:text-mr-text disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
                </button>
                {pageNumbers.map((p, i) => (p === 'gap' ? (
                  <span key={`gap-${i}`} className="px-1 text-[12px] text-mr-faint" aria-hidden="true">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    aria-label={`Page ${p}`}
                    aria-current={p === page ? 'page' : undefined}
                    disabled={loading}
                    onClick={() => onPageChange(p)}
                    className={`mr-press h-9 min-w-9 rounded-full px-2 text-[12px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue ${
                      p === page ? 'mr-glass-ink bg-mr-ink text-white' : 'mr-glass text-mr-muted hover:text-mr-text'
                    }`}
                  >
                    {p}
                  </button>
                )))}
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={page >= totalPages || loading}
                  onClick={() => onPageChange(page + 1)}
                  className="mr-glass mr-press flex h-9 w-9 items-center justify-center rounded-full text-mr-muted hover:text-mr-text disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
                >
                  <ChevronRight className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
