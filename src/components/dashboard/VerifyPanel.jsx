import { memo, useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { VERIFY_INTEGRITY } from '../../graphql/queries';
import { ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { ErrorState, StatusPill } from './primitives';

const fmt = (v) => parseFloat(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

function VerifyPanel({ siteId, range }) {
  const [expanded, setExpanded] = useState(false);
  const { data, loading, error, refetch } = useQuery(VERIFY_INTEGRITY, {
    variables: { siteId: String(siteId), range },
    skip: !siteId || !expanded,
    fetchPolicy: 'cache-and-network',
  });

  const result = data?.verifyFinancialIntegrity;

  return (
    <section className="overflow-hidden rounded-panel border border-mr-line bg-mr-surface">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-mr-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-inset sm:px-6"
      >
        <span className="flex items-center gap-2.5">
          <ShieldCheck className="h-[18px] w-[18px] shrink-0 text-mr-muted" strokeWidth={1.9} aria-hidden="true" />
          <span>
            <span className="block text-[15px] font-semibold tracking-[-0.01em] text-mr-text">Data consistency</span>
            <span className="mt-0.5 block text-[12px] text-mr-muted">Source tables vs cash flow entries</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {result && (
            <StatusPill tone={result.passed ? 'positive' : 'negative'}>
              {result.passed ? 'All match' : 'Discrepancies'}
            </StatusPill>
          )}
          {expanded
            ? <ChevronUp className="h-4 w-4 text-mr-faint" strokeWidth={1.9} aria-hidden="true" />
            : <ChevronDown className="h-4 w-4 text-mr-faint" strokeWidth={1.9} aria-hidden="true" />}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-mr-line p-5 sm:p-6">
          {loading && !result ? (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-control border border-mr-line">
                <div className="grid grid-cols-4 gap-3 bg-mr-surface-2 px-3 py-2">
                  {[...Array(4)].map((_, index) => <Skeleton key={index} className="h-3 w-full" />)}
                </div>
                <div className="divide-y divide-mr-line">
                  {[...Array(5)].map((_, row) => (
                    <div key={row} className="grid grid-cols-4 gap-3 px-3 py-2.5">
                      {[...Array(4)].map((_, col) => <Skeleton key={col} className="h-3 w-full" />)}
                    </div>
                  ))}
                </div>
              </div>
              <Skeleton className="h-8 w-32 ml-auto" />
            </div>
          ) : error ? (
            <ErrorState
              title="Verification could not be completed"
              description="The consistency check did not finish. Your financial data is unchanged."
              onRetry={() => refetch()}
            />
          ) : result ? (
            <div className="space-y-4">
              {/* Run A vs Run B comparison table */}
              <div className="overflow-x-auto rounded-control border border-mr-line">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-mr-surface-2">
                      <th scope="col" className="px-3 py-2 text-left font-medium text-mr-muted">Metric</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium text-mr-muted">Run A (source)</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium text-mr-muted">Run B (cash flow)</th>
                      <th scope="col" className="px-3 py-2 text-center font-medium text-mr-muted">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['totalRevenue', 'totalExpense', 'netProfit', 'outstanding'].map((kpi) => {
                      const disc = result.discrepancies?.find(d => d.kpi === kpi);
                      const match = !disc;
                      return (
                        <tr key={kpi} className="border-t border-mr-line">
                          <th scope="row" className="px-3 py-2 text-left font-medium capitalize text-mr-text">{kpi.replace(/([A-Z])/g, ' $1').trim()}</th>
                          <td className="px-3 py-2 text-right tabular-nums text-mr-muted">₹{fmt(result.runA[kpi])}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-mr-muted">₹{fmt(result.runB[kpi])}</td>
                          <td className="px-3 py-2 text-center">
                            {match ? (
                              <span className="font-medium text-mr-lime-ink">Match</span>
                            ) : (
                              <span className="font-medium text-mr-coral-ink" title={`Difference: ₹${fmt(disc.diff)} (${disc.severity})`}>
                                Δ ₹{fmt(disc.diff)}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Discrepancies detail */}
              {result.discrepancies?.length > 0 && (
                <div className="space-y-1.5 rounded-control border border-mr-coral-ink/15 bg-mr-coral-soft p-3.5">
                  <p className="text-[12px] font-semibold text-mr-coral-ink">Discrepancies found</p>
                  {result.discrepancies.map((d) => (
                    <div key={d.kpi} className="flex items-center justify-between gap-3 text-[12px]">
                      <span className="capitalize text-mr-text">{d.kpi.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="font-semibold tabular-nums text-mr-coral-ink">
                        Δ ₹{fmt(d.diff)} ({d.severity})
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12px] text-mr-faint">
                  Checked {new Date(result.checkedAt).toLocaleString('en-IN')}
                </span>
                <button
                  type="button"
                  onClick={() => refetch()}
                  disabled={loading}
                  className="inline-flex h-9 items-center rounded-full border border-mr-line px-3.5 text-[12px] font-semibold text-mr-text transition-colors hover:bg-mr-surface-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
                >
                  Run again
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

export default memo(VerifyPanel);
