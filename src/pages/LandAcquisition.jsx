import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, BarChart3, Building2, ChevronLeft, ChevronRight,
  CircleDollarSign, FileWarning, LandPlot, MoreHorizontal, Plus, RefreshCw,
  Search, UsersRound,
} from 'lucide-react';
import api from '@/api/api';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { EmptyBlock, PageHeader, PageTabs, SectionHead, StatusDot } from '@/components/ui/page';
import LandAcquisitionProgress from '@/components/land-acquisition/LandAcquisitionProgress';
import AcquisitionActivityTimeline from '@/components/land-acquisition/AcquisitionActivityTimeline';
import {
  CreateAcquisitionSheet, LandownerDrawer, TransactionDrawer,
} from '@/components/land-acquisition/LandAcquisitionDrawers';
import {
  apiMessage, areaLabel, dateLabel, initials, money, readable, statusTone, WORKSPACE_VIEWS,
} from '@/components/land-acquisition/landAcquisitionUtils';

const EMPTY = { acquisitions: [], transactions: [], pagination: {}, summary: {}, attention: [], recent_activity: [], recent_acquisitions: [] };

function WorkspaceLoading() {
  return <div className="space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-80 w-full" /></div>;
}

function MetricStrip({ values }) {
  return (
    <section className="grid gap-y-4 border-y border-mr-line py-4 sm:grid-cols-2 xl:grid-cols-6">
      {values.map((item, index) => (
        <div key={item.label} className={index ? 'min-w-0 border-l border-mr-line pl-5' : 'min-w-0'}>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-mr-faint">{item.label}</p>
          <p className="mt-1 truncate text-[19px] font-semibold tracking-[-0.02em] text-mr-text">{item.value}</p>
        </div>
      ))}
    </section>
  );
}

export default function LandAcquisition() {
  const { currentSite, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get('view') || 'overview';
  const view = WORKSPACE_VIEWS.some((item) => item.id === requestedView) ? requestedView : 'overview';
  const siteId = currentSite?.id ? String(currentSite.id) : '';
  const canCreate = hasPermission('farmers', 'write');
  const canUpdate = hasPermission('farmers', 'update');
  const [state, setState] = useState({ scope: '', loading: false, error: '', data: EMPTY });
  const [reloadKey, setReloadKey] = useState(0);
  const [filters, setFilters] = useState({ q: '', status: 'all', mode: 'all', page: 1 });
  const [createOpen, setCreateOpen] = useState(false);
  const [landownerId, setLandownerId] = useState(null);
  const [transaction, setTransaction] = useState(null);

  const scopeKey = `${siteId}:${view}:${filters.q}:${filters.status}:${filters.mode}:${filters.page}:${reloadKey}`;
  useEffect(() => {
    if (!siteId) return undefined;
    const controller = new AbortController();
    const endpoint = view === 'overview' ? '/land-acquisitions/overview'
      : view === 'transactions' ? '/land-acquisitions/transactions'
        : view === 'reports' ? '/land-acquisitions/reports' : '/land-acquisitions';
    const params = { site_id: siteId };
    if (view === 'acquisitions' || view === 'transactions') {
      params.page = filters.page;
      params.limit = 25;
      if (filters.q) params.q = filters.q;
    }
    if (view === 'acquisitions' && filters.status !== 'all') params.status = filters.status;
    if (view === 'transactions' && filters.mode !== 'all') params.mode = filters.mode;
    api.get(endpoint, { params, signal: controller.signal })
      .then(({ data }) => setState({ scope: scopeKey, loading: false, error: '', data: { ...EMPTY, ...data } }))
      .catch((error) => {
        if (error?.code !== 'ERR_CANCELED') setState({ scope: scopeKey, loading: false, error: apiMessage(error, 'Land Acquisition could not be loaded'), data: EMPTY });
      });
    return () => controller.abort();
  }, [filters.mode, filters.page, filters.q, filters.status, reloadKey, scopeKey, siteId, view]);

  const data = state.scope === scopeKey ? state.data : EMPTY;
  const loading = state.scope !== scopeKey || state.loading;
  const setView = (next) => {
    setSearchParams({ view: next });
    setFilters({ q: '', status: 'all', mode: 'all', page: 1 });
  };
  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);
  const openAcquisition = (id) => navigate(`/land-acquisition/${id}`);
  const metrics = useMemo(() => {
    const summary = data.summary || {};
    return [
      { label: 'Active acquisitions', value: Number(summary.active_acquisitions ?? summary.active ?? 0).toLocaleString('en-IN') },
      { label: 'Total land', value: Number(summary.total_land || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }) },
      { label: 'Agreed value', value: money(summary.total_agreed ?? summary.total_consideration, true) },
      { label: 'Paid', value: money(summary.total_paid ?? summary.paid, true) },
      { label: 'Outstanding', value: money(summary.outstanding, true) },
      { label: 'Payments due', value: Number(summary.payments_due || 0).toLocaleString('en-IN') },
    ];
  }, [data.summary]);

  if (!siteId) {
    return <EmptyBlock icon={Building2} title="Select a Site" description="Land Acquisition is Site-scoped. Select a Site to view its acquisitions and transactions." tall />;
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 pb-12">
      <PageHeader
        title="Land Acquisition"
        description={`Landowner agreements, terms and payments · ${currentSite?.name || 'Selected Site'}`}
        actions={(
          <>
            <Button variant="outline" size="icon" onClick={refresh} disabled={loading} title="Refresh"><RefreshCw className={loading ? 'animate-spin' : ''} /></Button>
            {canCreate && <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Create acquisition</Button>}
          </>
        )}
      />
      <PageTabs items={WORKSPACE_VIEWS} value={view} onChange={setView} label="Land Acquisition sections" />

      {state.error && <div className="border-y border-mr-coral-ink/20 bg-mr-coral-soft px-4 py-3 text-[13px] text-mr-coral-ink">{state.error}</div>}
      {loading ? <WorkspaceLoading /> : (
        <>
          {view === 'overview' && (
            <div className="space-y-8">
              <MetricStrip values={metrics} />
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,.7fr)]">
                <section>
                  <SectionHead title="Needs attention" meta={`${data.attention.length} items`} description="Each item opens the exact acquisition that needs action." />
                  {data.attention.length ? (
                    <div className="divide-y divide-mr-line">
                      {data.attention.map((item, index) => (
                        <button key={`${item.acquisition_id}-${index}`} type="button" onClick={() => openAcquisition(item.acquisition_id)} className="flex w-full items-center gap-3 py-4 text-left hover:bg-mr-surface-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mr-amber-soft text-mr-amber-ink"><AlertTriangle className="h-4 w-4" /></span>
                          <span className="min-w-0 flex-1"><span className="block text-[13px] font-medium text-mr-text">{item.message}</span><span className="mt-0.5 block text-[12px] text-mr-muted">{item.acquisition_reference} · {item.landowner_name}</span></span>
                          <ArrowRight className="h-4 w-4 text-mr-faint" />
                        </button>
                      ))}
                    </div>
                  ) : <EmptyBlock icon={FileWarning} title="Nothing needs attention" description="Active acquisitions have no current workflow warnings." />}
                </section>
                <section>
                  <SectionHead title="Recent acquisitions" />
                  <div className="divide-y divide-mr-line">
                    {data.recent_acquisitions.map((item) => (
                      <button key={item.id} type="button" onClick={() => openAcquisition(item.id)} className="flex w-full items-center justify-between gap-4 py-3 text-left hover:bg-mr-surface-2">
                        <span className="min-w-0"><span className="block truncate text-[13px] font-medium text-mr-text">{item.acquisition_reference}</span><span className="block truncate text-[11px] text-mr-muted">{item.landowner_name} · {areaLabel(item)}</span></span>
                        <StatusDot tone={statusTone(item.financial_status)}>{readable(item.financial_status)}</StatusDot>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
              <section>
                <SectionHead title="Recent activity" description="Payments, agreement revisions and lifecycle changes at this Site." />
                <AcquisitionActivityTimeline items={data.recent_activity} />
              </section>
            </div>
          )}

          {view === 'acquisitions' && (
            <section>
              <div className="flex flex-wrap items-center gap-3 border-b border-mr-line pb-4">
                <div className="relative min-w-[260px] flex-1 max-w-lg"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mr-faint" /><Input value={filters.q} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value, page: 1 }))} placeholder="Search reference, landowner, village or Khasra…" className="pl-9" /></div>
                <Select value={filters.status} onValueChange={(status) => setFilters((current) => ({ ...current, status, page: 1 }))}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All acquisitions</SelectItem><SelectItem value="PAYMENT_IN_PROGRESS">Payment pending</SelectItem><SelectItem value="COMPLETED">Completed</SelectItem><SelectItem value="legacy">Legacy review</SelectItem></SelectContent>
                </Select>
              </div>
              {!data.acquisitions.length ? (
                <EmptyBlock icon={LandPlot} title="No land acquisitions yet" description="Create an acquisition by selecting an existing registered landowner and adding their land details." action={canCreate ? <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Create acquisition</Button> : null} tall />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Acquisition</TableHead><TableHead>Landowner</TableHead><TableHead>Land</TableHead><TableHead>Agreement</TableHead><TableHead className="text-right">Agreed</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Outstanding</TableHead><TableHead>Progress</TableHead><TableHead>Status</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                    <TableBody>
                      {data.acquisitions.map((item) => (
                        <TableRow key={item.id} className="cursor-pointer" onClick={() => openAcquisition(item.id)}>
                          <TableCell><span className="font-semibold text-mr-text">{item.acquisition_reference}</span>{item.is_legacy && <span className="mt-1 block text-[10px] uppercase tracking-wide text-mr-amber-ink">Review required</span>}</TableCell>
                          <TableCell><button type="button" onClick={(event) => { event.stopPropagation(); setLandownerId(item.member_id); }} className="flex items-center gap-2 text-left"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-mr-blue-soft text-[10px] font-semibold text-mr-blue">{initials(item.landowner_name)}</span><span><span className="block text-[13px] font-medium text-mr-text">{item.landowner_name}</span><span className="block text-[11px] text-mr-muted">{item.village || 'Location pending'}</span></span></button></TableCell>
                          <TableCell><span className="text-[13px] text-mr-text">{areaLabel(item)}</span><span className="block text-[11px] text-mr-muted">{item.khasra_number ? `Khasra ${item.khasra_number}` : 'Parcel pending'}</span></TableCell>
                          <TableCell><StatusDot tone={statusTone(item.agreement_status)}>{readable(item.agreement_status || 'NOT_STARTED')}</StatusDot></TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{money(item.total_amount, true)}</TableCell>
                          <TableCell className="text-right tabular-nums text-mr-lime-ink">{money(item.total_paid, true)}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{money(item.outstanding, true)}</TableCell>
                          <TableCell className="min-w-[250px]"><LandAcquisitionProgress status={item.effective_lifecycle_status} compact /></TableCell>
                          <TableCell><StatusDot tone={statusTone(item.effective_lifecycle_status)}>{readable(item.effective_lifecycle_status)}</StatusDot></TableCell>
                          <TableCell onClick={(event) => event.stopPropagation()}>
                            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => openAcquisition(item.id)}>Open</DropdownMenuItem>{canCreate && item.financial_terms_status === 'CONFIRMED' && item.effective_lifecycle_status !== 'COMPLETED' && <DropdownMenuItem onClick={() => navigate(`/land-acquisition/${item.id}?action=payment`)}>Record payment</DropdownMenuItem>}{canUpdate && item.effective_lifecycle_status !== 'COMPLETED' && <DropdownMenuItem onClick={() => navigate(`/land-acquisition/${item.id}?action=land`)}>Edit land details</DropdownMenuItem>}<DropdownMenuItem onClick={() => navigate(`/land-acquisition/${item.id}?tab=agreement`)}>View agreement</DropdownMenuItem><DropdownMenuItem onClick={() => navigate(`/land-acquisition/${item.id}?tab=transactions`)}>View transactions</DropdownMenuItem><DropdownMenuItem onClick={() => navigate(`/land-acquisition/${item.id}?tab=documents`)}>View documents</DropdownMenuItem>{canUpdate && item.completion?.eligible && item.effective_lifecycle_status !== 'COMPLETED' && <DropdownMenuItem onClick={() => navigate(`/land-acquisition/${item.id}?action=complete`)}>Mark complete</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <Pagination pagination={data.pagination} onPage={(page) => setFilters((current) => ({ ...current, page }))} />
            </section>
          )}

          {view === 'transactions' && (
            <section>
              <div className="flex flex-wrap items-center gap-3 border-b border-mr-line pb-4">
                <div className="relative min-w-[260px] flex-1 max-w-lg"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mr-faint" /><Input value={filters.q} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value, page: 1 }))} placeholder="Search acquisition, landowner or reference…" className="pl-9" /></div>
                <Select value={filters.mode} onValueChange={(mode) => setFilters((current) => ({ ...current, mode, page: 1 }))}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All modes</SelectItem><SelectItem value="CASH">Cash</SelectItem><SelectItem value="BANK">Bank</SelectItem><SelectItem value="CHEQUE">Cheque</SelectItem><SelectItem value="SPLIT">Split</SelectItem></SelectContent></Select>
              </div>
              {!data.transactions.length ? <EmptyBlock icon={CircleDollarSign} title="No acquisition transactions" description="Payments recorded against Land Acquisitions will appear here." tall /> : (
                <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Landowner</TableHead><TableHead>Acquisition</TableHead><TableHead>Mode</TableHead><TableHead>Account</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Reference</TableHead><TableHead>Recorded by</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{data.transactions.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer" onClick={() => setTransaction(item)}><TableCell>{dateLabel(item.date)}</TableCell><TableCell className="font-medium">{item.landowner_name}</TableCell><TableCell>{item.acquisition_reference || `LEGACY-${item.farmer_id}`}</TableCell><TableCell>{readable(item.payment_mode)}</TableCell><TableCell>{item.bank_account_no ? `••••${String(item.bank_account_no).slice(-4)}` : '—'}</TableCell><TableCell className={`text-right font-semibold tabular-nums ${Number(item.amount) < 0 ? 'text-mr-coral-ink' : 'text-mr-text'}`}>{money(item.amount)}</TableCell><TableCell>{item.bank_reference || item.cheque_no || '—'}</TableCell><TableCell>{item.recorded_by_name || '—'}</TableCell><TableCell><StatusDot tone={statusTone(item.status)}>{readable(item.status)}</StatusDot></TableCell></TableRow>
                ))}</TableBody></Table></div>
              )}
              <Pagination pagination={data.pagination} onPage={(page) => setFilters((current) => ({ ...current, page }))} />
            </section>
          )}

          {view === 'reports' && <ReportsView data={data} onOpenAcquisition={openAcquisition} />}
        </>
      )}

      <CreateAcquisitionSheet open={createOpen} onOpenChange={setCreateOpen} siteId={siteId} onCreated={(item) => navigate(`/land-acquisition/${item.id}`)} />
      <LandownerDrawer memberId={landownerId} siteId={siteId} open={Boolean(landownerId)} onOpenChange={(open) => !open && setLandownerId(null)} onOpenAcquisition={openAcquisition} />
      <TransactionDrawer transaction={transaction} open={Boolean(transaction)} onOpenChange={(open) => !open && setTransaction(null)} />
    </div>
  );
}

function Pagination({ pagination = {}, onPage }) {
  if (!pagination.pages || pagination.pages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-mr-line py-4 text-[12px] text-mr-muted">
      <span>Page {pagination.page} of {pagination.pages} · {pagination.total} records</span>
      <div className="flex gap-2"><Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button><Button variant="outline" size="sm" disabled={pagination.page >= pagination.pages} onClick={() => onPage(pagination.page + 1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button></div>
    </div>
  );
}

function ReportsView({ data, onOpenAcquisition }) {
  const metrics = [
    { label: 'Acquisitions', value: Number(data.summary?.total_acquisitions || 0).toLocaleString('en-IN') },
    { label: 'Total land', value: Number(data.summary?.total_land || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }) },
    { label: 'Consideration', value: money(data.summary?.total_consideration, true) },
    { label: 'Paid', value: money(data.summary?.paid, true) },
    { label: 'Outstanding', value: money(data.summary?.outstanding, true) },
    { label: 'Completed', value: Number(data.summary?.completed || 0).toLocaleString('en-IN') },
  ];
  return (
    <div className="space-y-9">
      <MetricStrip values={metrics} />
      <div className="grid gap-9 xl:grid-cols-2">
        <ReportTable title="Landowner outstanding" icon={UsersRound} headers={['Landowner', 'Acquisitions', 'Agreed', 'Paid', 'Outstanding']} rows={(data.landowner_outstanding || []).map((row) => [row.landowner_name, row.acquisitions, money(row.agreed_value, true), money(row.paid, true), money(row.outstanding, true)])} />
        <ReportTable title="Cash vs bank payments" icon={CircleDollarSign} headers={['Mode', 'Transactions', 'Total']} rows={(data.cash_vs_bank || []).map((row) => [readable(row.mode), row.transactions, money(row.total, true)])} />
        <ReportTable title="Village / location summary" icon={LandPlot} headers={['Village', 'Acquisitions', 'Land', 'Agreed']} rows={(data.village_summary || []).map((row) => [row.village, row.acquisitions, Number(row.total_land).toLocaleString('en-IN'), money(row.agreed_value, true)])} />
        <ReportTable title="Agreement status" icon={BarChart3} headers={['Status', 'Acquisitions']} rows={(data.agreement_status || []).map((row) => [readable(row.status), row.acquisitions])} />
      </div>
      <section>
        <SectionHead title="Payment due / overdue" meta={`${data.payment_due?.length || 0} items`} description="Click a row to open the exact acquisition behind the amount." />
        <div className="divide-y divide-mr-line">
          {(data.payment_due || []).map((row) => (
            <button key={`${row.id}-${row.description}`} type="button" onClick={() => onOpenAcquisition(row.id)} className="grid w-full gap-2 py-3 text-left hover:bg-mr-surface-2 sm:grid-cols-[130px_1fr_140px_140px]">
              <span className="text-[12px] font-medium text-mr-text">{row.acquisition_reference || `LEGACY-${row.id}`}</span><span className="text-[12px] text-mr-muted">{row.landowner_name} · {row.description}</span><span className="text-[12px] text-mr-muted">{dateLabel(row.due_date)}</span><span className="text-right text-[12px] font-semibold text-mr-text">{money(row.outstanding)}</span>
            </button>
          ))}
          {!data.payment_due?.length && <EmptyBlock icon={CircleDollarSign} title="No scheduled payments due" description="Outstanding scheduled installments will appear here." />}
        </div>
      </section>
    </div>
  );
}

function ReportTable({ title, icon, headers, rows }) {
  const ReportIcon = icon;
  return (
    <section>
      <SectionHead title={title} actions={<ReportIcon className="h-4 w-4 text-mr-faint" />} />
      <div className="overflow-x-auto"><Table><TableHeader><TableRow>{headers.map((header) => <TableHead key={header}>{header}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((row, index) => <TableRow key={index}>{row.map((cell, cellIndex) => <TableCell key={`${index}-${cellIndex}`} className={cellIndex >= row.length - 2 ? 'tabular-nums' : ''}>{cell}</TableCell>)}</TableRow>)}</TableBody></Table></div>
      {!rows.length && <EmptyBlock title="No report data" description="Data will appear as acquisitions progress." />}
    </section>
  );
}
