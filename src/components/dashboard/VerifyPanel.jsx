import { memo, useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { VERIFY_INTEGRITY } from '../../graphql/queries';
import { ShieldCheck, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';

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
    <div className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.03]">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 sm:px-5 py-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-emerald-50">
            <ShieldCheck className="w-[18px] h-[18px] text-emerald-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-800">Data Consistency Verification</p>
            <p className="text-[10px] text-slate-400">Source tables vs cash_flow_entries</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${result.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {result.passed ? '✅ All Match' : '❌ Discrepancies'}
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 p-4 sm:p-5">
          {loading && !result ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="grid grid-cols-4 gap-3 bg-slate-50 px-3 py-2">
                  {[...Array(4)].map((_, index) => <Skeleton key={index} className="h-3 w-full" />)}
                </div>
                <div className="divide-y divide-slate-100">
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
            <div className="text-center py-6">
              <p className="text-sm text-red-500 mb-2">Failed to verify: {error.message}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
                <RefreshCw className="w-3 h-3" /> Retry
              </Button>
            </div>
          ) : result ? (
            <div className="space-y-4">
              {/* Run A vs Run B comparison table */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left px-3 py-2 text-slate-500 font-semibold">KPI</th>
                      <th className="text-right px-3 py-2 text-slate-500 font-semibold">Run A (Source)</th>
                      <th className="text-right px-3 py-2 text-slate-500 font-semibold">Run B (CFE)</th>
                      <th className="text-center px-3 py-2 text-slate-500 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['totalRevenue', 'totalExpense', 'netProfit', 'outstanding'].map((kpi) => {
                      const disc = result.discrepancies?.find(d => d.kpi === kpi);
                      const match = !disc;
                      return (
                        <tr key={kpi} className={`border-t border-slate-100 ${match ? '' : 'bg-red-50/30'}`}>
                          <td className="px-3 py-2 font-medium text-slate-700 capitalize">{kpi.replace(/([A-Z])/g, ' $1').trim()}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700">₹{fmt(result.runA[kpi])}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700">₹{fmt(result.runB[kpi])}</td>
                          <td className="px-3 py-2 text-center">
                            {match ? (
                              <span className="text-emerald-600 font-semibold">✓</span>
                            ) : (
                              <span className="text-red-600 font-semibold" title={`Diff: ₹${fmt(disc.diff)} (${disc.severity})`}>
                                ✗ Δ₹{fmt(disc.diff)}
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
                <div className="rounded-xl border border-red-200 bg-red-50/40 p-3 space-y-1">
                  <p className="text-[11px] font-semibold text-red-700 uppercase tracking-wider">Discrepancies Found</p>
                  {result.discrepancies.map((d) => (
                    <div key={d.kpi} className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 capitalize">{d.kpi.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className={`font-semibold ${d.severity === 'CRITICAL' ? 'text-red-700' : 'text-amber-700'}`}>
                        Δ ₹{fmt(d.diff)} ({d.severity})
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400">
                  Checked: {new Date(result.checkedAt).toLocaleString('en-IN')}
                </span>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => refetch()} disabled={loading}>
                  <RefreshCw className="w-3 h-3" />
                  Re-test
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default memo(VerifyPanel);
