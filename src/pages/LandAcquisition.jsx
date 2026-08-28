import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, BarChart3, Building2, ChevronLeft, ChevronRight,
  CircleDollarSign, FileWarning, LandPlot, MoreHorizontal, Plus, RefreshCw,
  Search, UsersRound,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip as RechartsTooltip, XAxis, YAxis,
} from 'recharts';
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
import {
  EmptyBlock, PageHeader, PageTabs, PrintButton, PrintDocHead, SectionHead, StatusDot,
} from '@/components/ui/page';
import LandAcquisitionProgress from '@/components/land-acquisition/LandAcquisitionProgress';
import AcquisitionActivityTimeline from '@/components/land-acquisition/AcquisitionActivityTimeline';
import {
  CreateAcquisitionSheet, LandownerDrawer, TransactionDrawer,
} from '@/components/land-acquisition/LandAcquisitionDrawers';
import {
  apiMessage, areaLabel, dateLabel, initials, money, readable, statusTone, WORKSPACE_VIEWS,
} from '@/components/land-acquisition/landAcquisitionUtils';

const EMPTY = { acquisitions: [], transactions: [], pagination: {}, summary: {}, chart: [], attention: [], recent_activity: [], recent_acquisitions: [] };

const AGREED = '#2563eb';
const PAID = '#15803d';
const DUE = '#f59e0b';
const AXIS_TICK = { fontSize: 11, fill: '#98a0ad' };
const TOOLTIP_STYLE = {
  borderRadius: 10, border: '1px solid rgba(16,17,20,0.08)', background: '#fff',
  boxShadow: '0 8px 24px rgba(16,17,20,0.08)', fontSize: 12, padding: '8px 10px',
};
// ponytail: same L/Cr short-form the money() helper uses, minus the ₹ — axis ticks need the room.
const axisMoney = (value) => money(value, true).replace('₹', '');

function AgreedVsPaidChart({ rows, onOpen }) {
  if (!rows.length) return <EmptyBlock icon={BarChart3} title="No agreed values yet" description="Confirm financial terms on an acquisition to see it here." />;
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} barGap={3} barCategoryGap="28%" margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="rgba(16,17,20,0.06)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} tickFormatter={(value) => (String(value).length > 12 ? `${String(value).slice(0, 11)}…` : value)} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={axisMoney} width={56} />
          <RechartsTooltip
            cursor={{ fill: 'rgba(16,17,20,0.04)' }}
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, name) => [money(value, true), name]}
            labelStyle={{ fontWeight: 600, color: '#101114' }}
          />
          <Bar dataKey="agreed" name="Agreed" fill={AGREED} radius={[5, 5, 0, 0]} maxBarSize={26} className="cursor-pointer" onClick={(bar) => onOpen?.(bar?.payload?.id)} />
          <Bar dataKey="paid" name="Paid" fill={PAID} radius={[5, 5, 0, 0]} maxBarSize={26} className="cursor-pointer" onClick={(bar) => onOpen?.(bar?.payload?.id)} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ponytail: one stacked row instead of two columns — part-of-whole reads instantly and costs ~60px of page.
function OverallPaidChart({ summary }) {
  const paid = Math.max(Number(summary.total_paid ?? summary.paid) || 0, 0);
  const due = Math.max(Number(summary.outstanding) || 0, 0);
  if (!paid && !due) return null;
  const total = paid + due;
  return (
    <section className="border-b border-mr-line pb-5">
      <SectionHead
        title="Overall position"
        meta={`${money(total, true)} agreed`}
        actions={(
          <span className="flex items-center gap-3 text-[11px] text-mr-muted">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: PAID }} />Paid {money(paid, true)}</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: DUE }} />To pay {money(due, true)}</span>
          </span>
        )}
      />
      <div className="h-[64px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={[{ name: 'Total', paid, due }]} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <XAxis type="number" hide domain={[0, total]} />
            <YAxis type="category" dataKey="name" hide />
            <RechartsTooltip
              cursor={{ fill: 'rgba(16,17,20,0.04)' }}
              contentStyle={TOOLTIP_STYLE}
              formatter={(value, name) => [`${money(value, true)} · ${((value / total) * 100).toFixed(1)}%`, name]}
            />
            <Bar dataKey="paid" name="Paid" stackId="total" fill={PAID} radius={[6, 0, 0, 6]} maxBarSize={34} />
            <Bar dataKey="due" name="To pay" stackId="total" fill={DUE} radius={[0, 6, 6, 0]} maxBarSize={34} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

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

function AcquisitionFinancialPosition({ item }) {
  const agreed = Math.max(Number(item.total_amount) || 0, 0);
  const paid = Math.max(Number(item.total_paid) || 0, 0);
  const outstanding = Math.max(Number(item.outstanding) || 0, 0);
  const paidPercent = agreed ? Math.min((paid / agreed) * 100, 100) : 0;
  return (
    <div className="min-w-[190px]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-mr-faint">Agreed</span>
        <span className="text-[13px] font-semibold tabular-nums text-mr-text">{money(agreed, true)}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mr-surface-2" aria-label={`${paidPercent.toFixed(0)} percent paid`}>
        <div className="h-full rounded-full bg-mr-lime transition-[width]" style={{ width: `${paidPercent}%` }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3 text-[10px]">
        <span className="font-medium tabular-nums text-mr-lime-ink">{money(paid, true)} paid</span>
        <span className={outstanding ? 'font-medium tabular-nums text-mr-amber-ink' : 'font-medium tabular-nums text-mr-muted'}>{money(outstanding, true)} due</span>
      </div>
    </div>
  );
}

function AcquisitionMenu({ item, canCreate, canUpdate, navigate, onOpen }) {
  return (
    <div data-print-hide onClick={(event) => event.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-mr-faint hover:bg-mr-surface-2 hover:text-mr-text" aria-label={`Actions for ${item.landowner_name}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => onOpen(item.id)}>Open acquisition</DropdownMenuItem>
          {canCreate && item.financial_terms_status === 'CONFIRMED' && item.effective_lifecycle_status !== 'COMPLETED' && <DropdownMenuItem onClick={() => navigate(`/land-acquisition/${item.id}?action=payment`)}>Record payment</DropdownMenuItem>}
          {canUpdate && item.effective_lifecycle_status !== 'COMPLETED' && <DropdownMenuItem onClick={() => navigate(`/land-acquisition/${item.id}?action=land`)}>Edit land details</DropdownMenuItem>}
          <DropdownMenuItem onClick={() => navigate(`/land-acquisition/${item.id}?tab=agreement`)}>View agreement</DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate(`/land-acquisition/${item.id}?tab=transactions`)}>View transactions</DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate(`/land-acquisition/${item.id}?tab=documents`)}>View documents</DropdownMenuItem>
          {canUpdate && item.completion?.eligible && item.effective_lifecycle_status !== 'COMPLETED' && <DropdownMenuItem onClick={() => navigate(`/land-acquisition/${item.id}?action=complete`)}>Mark complete</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
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
  const openActivity = (item) => {
    if (!item?.entity_id) return;
    const action = String(item.action || '').toUpperCase();
    const tab = action.includes('PAYMENT') ? 'transactions'
      : action.includes('AGREEMENT') ? 'agreement'
        : action.includes('FINANCIAL') || action.includes('TERMS') ? 'financials'
          : action.includes('LAND') ? 'land' : 'activity';
    navigate(`/land-acquisition/${item.entity_id}${tab === 'activity' ? '' : `?tab=${tab}`}`);
  };
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

  // Each view prints as its own report — same letterhead, its own title and applied filters.
  const printDoc = useMemo(() => ({
    overview: {
      title: 'Land Acquisition — Overview',
      subtitle: 'Position, exceptions and recent movement across all acquisitions at this Site.',
      meta: [],
    },
    acquisitions: {
      title: 'Land Acquisition — Acquisition Register',
      subtitle: 'Landowner agreements with agreed value, amount paid and outstanding balance.',
      meta: [
        { label: 'Search', value: filters.q },
        { label: 'Status', value: filters.status === 'all' ? 'All acquisitions' : readable(filters.status) },
        { label: 'Page', value: data.pagination?.pages > 1 ? `${data.pagination.page} of ${data.pagination.pages}` : '' },
      ],
    },
    transactions: {
      title: 'Land Acquisition — Transaction Register',
      subtitle: 'Payments recorded against landowner acquisitions.',
      meta: [
        { label: 'Search', value: filters.q },
        { label: 'Mode', value: filters.mode === 'all' ? 'All modes' : readable(filters.mode) },
        { label: 'Page', value: data.pagination?.pages > 1 ? `${data.pagination.page} of ${data.pagination.pages}` : '' },
      ],
    },
    reports: {
      title: 'Land Acquisition — Reports & Analytics',
      subtitle: 'Landowner outstanding, payment modes, village summary and scheduled dues.',
      meta: [],
    },
  }[view]), [data.pagination, filters.mode, filters.q, filters.status, view]);

  if (!siteId) {
    return <EmptyBlock icon={Building2} title="Select a Site" description="Land Acquisition is Site-scoped. Select a Site to view its acquisitions and transactions." tall />;
  }

  return (
    <div data-print-doc className="mx-auto w-full max-w-[1500px] space-y-6 pb-12">
      <div data-print-hide className="space-y-6">
        <PageHeader
          title="Land Acquisition"
          description={`Landowner agreements, terms and payments · ${currentSite?.name || 'Selected Site'}`}
          actions={(
            <>
              <Button variant="outline" size="icon" onClick={refresh} disabled={loading} title="Refresh"><RefreshCw className={loading ? 'animate-spin' : ''} /></Button>
              <PrintButton />
              {canCreate && <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Create acquisition</Button>}
            </>
          )}
        />
        <PageTabs items={WORKSPACE_VIEWS} value={view} onChange={setView} label="Land Acquisition sections" />
      </div>
      <PrintDocHead title={printDoc.title} subtitle={printDoc.subtitle} meta={printDoc.meta} />

      {state.error && <div className="border-y border-mr-coral-ink/20 bg-mr-coral-soft px-4 py-3 text-[13px] text-mr-coral-ink">{state.error}</div>}
      {loading ? <WorkspaceLoading /> : (
        <>
          {view === 'overview' && (
            <div className="space-y-6">
              <MetricStrip values={metrics} />
              <OverallPaidChart summary={data.summary || {}} />
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,.55fr)]">
                <section>
                  <SectionHead
                    title="Agreed vs paid"
                    description="Top acquisitions by agreed value. Click a bar to open it."
                    actions={(
                      <span className="flex items-center gap-3 text-[11px] text-mr-muted">
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: AGREED }} />Agreed</span>
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: PAID }} />Paid</span>
                      </span>
                    )}
                  />
                  <AgreedVsPaidChart rows={data.chart} onOpen={openAcquisition} />
                </section>
                <section>
                  <SectionHead title="Needs attention" meta={`${data.attention.length} items`} />
                  {data.attention.length ? (
                    <>
                      <div className="divide-y divide-mr-line">
                        {data.attention.slice(0, 5).map((item, index) => (
                          <button key={`${item.acquisition_id}-${index}`} type="button" data-print-row onClick={() => openAcquisition(item.acquisition_id)} className="flex w-full items-center gap-3 py-3 text-left hover:bg-mr-surface-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mr-amber-soft text-mr-amber-ink"><AlertTriangle className="h-3.5 w-3.5" /></span>
                            <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-mr-text">{item.message}</span><span className="mt-0.5 block truncate text-[11px] text-mr-muted">{item.acquisition_reference} · {item.landowner_name}</span></span>
                            <ArrowRight className="h-4 w-4 shrink-0 text-mr-faint" />
                          </button>
                        ))}
                      </div>
                      {data.attention.length > 5 && (
                        <button type="button" data-print-hide onClick={() => setView('acquisitions')} className="pt-3 text-[12px] font-medium text-mr-blue hover:underline">
                          {data.attention.length - 5} more · view all acquisitions
                        </button>
                      )}
                    </>
                  ) : <EmptyBlock icon={FileWarning} title="Nothing needs attention" description="Active acquisitions have no current workflow warnings." />}
                </section>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <section>
                  <SectionHead title="Recent acquisitions" />
                  <div className="divide-y divide-mr-line">
                    {data.recent_acquisitions.map((item) => (
                      <button key={item.id} type="button" data-print-row onClick={() => openAcquisition(item.id)} className="flex w-full items-center justify-between gap-4 py-2.5 text-left hover:bg-mr-surface-2">
                        <span className="min-w-0"><span className="block truncate text-[13px] font-medium text-mr-text">{item.acquisition_reference}</span><span className="block truncate text-[11px] text-mr-muted">{item.landowner_name} · {areaLabel(item)}</span></span>
                        <StatusDot tone={statusTone(item.financial_status)}>{readable(item.financial_status)}</StatusDot>
                      </button>
                    ))}
                    {!data.recent_acquisitions.length && <EmptyBlock icon={LandPlot} title="No acquisitions yet" description="Created acquisitions appear here." />}
                  </div>
                </section>
                <section>
                  <SectionHead title="Recent activity" />
                  <AcquisitionActivityTimeline items={data.recent_activity.slice(0, 6)} onOpen={openActivity} />
                </section>
              </div>
            </div>
          )}

          {view === 'acquisitions' && (
            <section className="overflow-hidden rounded-2xl border border-mr-line bg-mr-surface shadow-[0_12px_36px_rgba(15,23,42,0.04)]">
              <div data-print-hide className="flex flex-col gap-4 border-b border-mr-line bg-mr-surface-2/45 px-4 py-4 lg:flex-row lg:items-center lg:justify-between sm:px-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><h2 className="text-[14px] font-semibold text-mr-text">Acquisition register</h2><span className="rounded-full border border-mr-line bg-mr-surface px-2 py-0.5 text-[10px] font-semibold tabular-nums text-mr-muted">{Number(data.pagination?.total || data.acquisitions.length).toLocaleString('en-IN')}</span></div>
                  <p className="mt-0.5 text-[11px] text-mr-muted">Land position, agreement status, payment progress and workflow in one view.</p>
                </div>
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative min-w-0 flex-1 sm:w-[330px]"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mr-faint" /><Input value={filters.q} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value, page: 1 }))} placeholder="Search landowner, reference, village or Khasra…" className="h-10 rounded-xl border-mr-line bg-mr-surface pl-9" /></div>
                  <Select value={filters.status} onValueChange={(status) => setFilters((current) => ({ ...current, status, page: 1 }))}>
                    <SelectTrigger className="h-10 w-full rounded-xl border-mr-line bg-mr-surface sm:w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All acquisitions</SelectItem><SelectItem value="PAYMENT_IN_PROGRESS">Payment pending</SelectItem><SelectItem value="COMPLETED">Completed</SelectItem><SelectItem value="legacy">Legacy review</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              {!data.acquisitions.length ? (
                <EmptyBlock icon={LandPlot} title="No land acquisitions yet" description="Create an acquisition by selecting an existing registered landowner and adding their land details." action={canCreate ? <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Create acquisition</Button> : null} tall />
              ) : (
                <>
                  <div className="divide-y divide-mr-line lg:hidden">
                    {data.acquisitions.map((item) => (
                      <article key={item.id} role="button" tabIndex={0} data-print-row onClick={() => openAcquisition(item.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openAcquisition(item.id); }} className="group cursor-pointer px-4 py-4 outline-none transition hover:bg-mr-blue-soft/25 focus-visible:bg-mr-blue-soft/35 sm:px-5">
                        <div className="flex items-start gap-3">
                          <button type="button" onClick={(event) => { event.stopPropagation(); setLandownerId(item.member_id); }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mr-blue-soft text-[11px] font-bold text-mr-blue transition group-hover:bg-mr-blue group-hover:text-white">{initials(item.landowner_name)}</button>
                          <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold text-mr-text">{item.landowner_name}</p><p className="mt-0.5 truncate text-[11px] text-mr-muted">{item.acquisition_reference} · {item.village || 'Location pending'}</p></div>
                          <AcquisitionMenu item={item} canCreate={canCreate} canUpdate={canUpdate} navigate={navigate} onOpen={openAcquisition} />
                        </div>
                        <div className="mt-4 grid gap-3 rounded-xl border border-mr-line bg-mr-surface-2/45 p-3 sm:grid-cols-2">
                          <div><p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-mr-faint">Land parcel</p><p className="mt-1 text-[12px] font-semibold text-mr-text">{areaLabel(item)}</p><p className="mt-0.5 text-[10px] text-mr-muted">{item.khasra_number ? `Khasra ${item.khasra_number}` : 'Parcel pending'}</p></div>
                          <AcquisitionFinancialPosition item={item} />
                        </div>
                        <div className="mt-4"><LandAcquisitionProgress status={item.effective_lifecycle_status} compact /></div>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><StatusDot tone={statusTone(item.effective_lifecycle_status)}>{readable(item.effective_lifecycle_status)}</StatusDot><StatusDot tone={statusTone(item.agreement_status)}>{readable(item.agreement_status || 'NOT_STARTED')} agreement</StatusDot></div>{item.is_legacy && <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-mr-amber-ink">Review required</span>}</div>
                      </article>
                    ))}
                  </div>
                  <div className="hidden overflow-x-auto lg:block">
                  <Table className="min-w-[1120px]">
                    <TableHeader><TableRow className="border-mr-line bg-mr-surface-2/70 hover:bg-mr-surface-2/70"><TableHead className="pl-5">Landowner & acquisition</TableHead><TableHead>Land parcel</TableHead><TableHead>Agreement</TableHead><TableHead>Financial position</TableHead><TableHead>Workflow</TableHead><TableHead>Status</TableHead><TableHead data-print-hide className="w-12 pr-4" /></TableRow></TableHeader>
                    <TableBody>
                      {data.acquisitions.map((item) => (
                        <TableRow key={item.id} data-print-row className="group cursor-pointer border-mr-line transition-colors hover:bg-mr-blue-soft/25" onClick={() => openAcquisition(item.id)}>
                          <TableCell className="pl-5 py-4"><button type="button" onClick={(event) => { event.stopPropagation(); setLandownerId(item.member_id); }} className="flex items-center gap-3 text-left"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mr-blue-soft text-[11px] font-bold text-mr-blue transition group-hover:bg-mr-blue group-hover:text-white">{initials(item.landowner_name)}</span><span className="min-w-0"><span className="block max-w-[220px] truncate text-[13px] font-semibold text-mr-text">{item.landowner_name}</span><span className="mt-0.5 block text-[10px] font-medium text-mr-muted">{item.acquisition_reference}</span>{item.is_legacy && <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.08em] text-mr-amber-ink">Review required</span>}</span></button></TableCell>
                          <TableCell><span className="text-[12px] font-semibold text-mr-text">{areaLabel(item)}</span><span className="mt-0.5 block max-w-[180px] truncate text-[10px] text-mr-muted">{item.village || 'Location pending'} · {item.khasra_number ? `Khasra ${item.khasra_number}` : 'Parcel pending'}</span></TableCell>
                          <TableCell><StatusDot tone={statusTone(item.agreement_status)}>{readable(item.agreement_status || 'NOT_STARTED')}</StatusDot></TableCell>
                          <TableCell><AcquisitionFinancialPosition item={item} /></TableCell>
                          <TableCell className="min-w-[280px]"><LandAcquisitionProgress status={item.effective_lifecycle_status} compact /></TableCell>
                          <TableCell><StatusDot tone={statusTone(item.effective_lifecycle_status)}>{readable(item.effective_lifecycle_status)}</StatusDot></TableCell>
                          <TableCell className="pr-4"><AcquisitionMenu item={item} canCreate={canCreate} canUpdate={canUpdate} navigate={navigate} onOpen={openAcquisition} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </>
              )}
              <div className="px-4 sm:px-5"><Pagination pagination={data.pagination} onPage={(page) => setFilters((current) => ({ ...current, page }))} /></div>
            </section>
          )}

          {view === 'transactions' && (
            <section>
              <div data-print-hide className="flex flex-wrap items-center gap-3 border-b border-mr-line pb-4">
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
    <div data-print-hide className="flex items-center justify-between border-t border-mr-line py-4 text-[12px] text-mr-muted">
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
