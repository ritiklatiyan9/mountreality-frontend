import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Landmark, Loader2, Search } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { money } from '../lib/utils';

export default function BankAccountDetail() {
  const { id } = useParams();
  const { currentSite } = useAuth();
  const siteId = currentSite?.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!siteId || !id) return;
    setLoading(true);
    try {
      const response = await api.get(`/bank-accounts/${id}/transactions`, {
        params: { site_id: siteId, page, limit: 25, ...(search ? { search } : {}) },
      });
      setData(response.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Bank ledger could not be loaded');
    } finally { setLoading(false); }
  }, [id, page, search, siteId]);
  useEffect(() => { void load(); }, [load]);

  const account = data?.account;
  const summary = data?.summary || {};
  const pagination = data?.pagination || {};

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-10">
      <Link to="/bank-configs" className="inline-flex items-center gap-2 text-sm font-medium text-mr-muted hover:text-mr-text"><ArrowLeft className="h-4 w-4" /> Bank Configs</Link>
      <header className="rounded-panel bg-mr-ink p-5 text-white sm:p-7">
        {loading && !account ? <Skeleton className="h-28 bg-white/10" /> : <>
          <div className="flex items-start gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10"><Landmark className="h-5 w-5" /></span><div><p className="text-[11px] uppercase tracking-[0.14em] text-mr-lime">Bank ledger</p><h1 className="text-2xl font-semibold tracking-tight">{account?.bank_name || account?.label || 'Bank account'}</h1><p className="mt-1 text-sm text-zinc-300">{account?.label}{account?.masked_account_no ? ` · ${account.masked_account_no}` : ''}{account?.ifsc ? ` · ${account.ifsc}` : ''}</p></div></div>
          <div className="mt-6 grid gap-2 sm:grid-cols-4">{[['Transactions', summary.total || 0], ['Money in', money(summary.total_credit)], ['Money out', money(summary.total_debit)], ['Net balance', money(summary.balance)]].map(([label, value]) => <div key={label} className="rounded-panel-sm border border-white/10 bg-white/5 px-4 py-3"><p className="text-[10px] uppercase tracking-wider text-zinc-400">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>)}</div>
        </>}
      </header>

      <section className="overflow-hidden rounded-panel border border-mr-line bg-mr-surface">
        <div className="flex flex-col gap-3 border-b border-mr-line p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-mr-text">Transaction records</h2><p className="text-xs text-mr-muted">Mapped non-cash entries from every connected module.</p></div><form className="relative w-full sm:w-72" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(query.trim()); }}><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mr-faint" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search transactions" className="h-10 rounded-full border-mr-line pl-9" /></form></div>
        {loading ? <div className="space-y-3 p-5"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : !data?.transactions?.length ? <div className="py-16 text-center"><Landmark className="mx-auto h-9 w-9 text-mr-faint" /><p className="mt-3 text-sm font-medium">No mapped transactions</p><p className="mt-1 text-xs text-mr-muted">This ledger fills when users select this account in a non-cash transaction modal.</p></div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-mr-surface-2"><TableHead>Date</TableHead><TableHead>Source</TableHead><TableHead>Description</TableHead><TableHead>Mode</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader><TableBody>{data.transactions.map((transaction) => <TableRow key={`${transaction.source}-${transaction.id}`}><TableCell className="whitespace-nowrap text-sm">{String(transaction.date || '').slice(0, 10)}</TableCell><TableCell><Badge variant="outline" className="rounded-full border-mr-line capitalize">{transaction.source.replaceAll('-', ' ')}</Badge></TableCell><TableCell><p className="max-w-md truncate font-medium text-mr-text">{transaction.description || 'Transaction'}</p><p className="max-w-md truncate text-xs text-mr-muted">{transaction.reference || '—'}</p></TableCell><TableCell className="text-xs font-medium">{transaction.payment_mode || 'BANK'}</TableCell><TableCell className="text-right font-semibold tabular-nums text-mr-coral-ink">{Number(transaction.debit) ? <span className="inline-flex items-center gap-1"><ArrowUpRight className="h-3.5 w-3.5" />{money(transaction.debit)}</span> : '—'}</TableCell><TableCell className="text-right font-semibold tabular-nums text-mr-lime-ink">{Number(transaction.credit) ? <span className="inline-flex items-center gap-1"><ArrowDownLeft className="h-3.5 w-3.5" />{money(transaction.credit)}</span> : '—'}</TableCell></TableRow>)}</TableBody></Table></div>}
        {pagination.totalPages > 1 ? <div className="flex items-center justify-between border-t border-mr-line p-4"><p className="text-xs text-mr-muted">Page {pagination.currentPage} of {pagination.totalPages}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div> : null}
      </section>
      {loading && data ? <div className="fixed bottom-5 right-5 rounded-full bg-mr-ink p-3 text-white shadow-lg"><Loader2 className="h-4 w-4 animate-spin" /></div> : null}
    </div>
  );
}
