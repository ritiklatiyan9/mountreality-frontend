import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, Banknote, Check, CircleDollarSign, Download, Edit3, FileCheck2,
  FileText, LandPlot, Loader2, MoreHorizontal, Plus, RotateCcw, Upload, UserRound,
} from 'lucide-react';
import api from '@/api/api';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { EmptyBlock, PageTabs, SectionHead, StatusDot } from '@/components/ui/page';
import AcquisitionSummaryStrip from '@/components/land-acquisition/AcquisitionSummaryStrip';
import AcquisitionActivityTimeline from '@/components/land-acquisition/AcquisitionActivityTimeline';
import LandAcquisitionProgress from '@/components/land-acquisition/LandAcquisitionProgress';
import { LandownerDrawer, TransactionDrawer } from '@/components/land-acquisition/LandAcquisitionDrawers';
import {
  AgreementSheet, DocumentUploadSheet, FinancialTermsSheet, LandDetailsSheet, RecordPaymentSheet,
} from '@/components/land-acquisition/AcquisitionEditDrawers';
import {
  apiMessage, areaLabel, dateLabel, DETAIL_TABS, money, readable, statusTone,
} from '@/components/land-acquisition/landAcquisitionUtils';

const EMPTY = { acquisition: null, agreements: [], payment_schedule: [], transactions: [], activity: [], documents: [] };

export default function LandAcquisitionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentSite, hasPermission, isAdmin } = useAuth();
  const requestedTab = searchParams.get('tab') || 'overview';
  const tab = DETAIL_TABS.some((item) => item.id === requestedTab) ? requestedTab : 'overview';
  const [state, setState] = useState({ loading: true, error: '', data: EMPTY });
  const [reloadKey, setReloadKey] = useState(0);
  const [drawer, setDrawer] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [landownerOpen, setLandownerOpen] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [reversal, setReversal] = useState({ payment: null, reason: '', busy: false });
  const [actionBusy, setActionBusy] = useState(false);
  const canWrite = hasPermission('farmers', 'write');
  const canUpdate = hasPermission('farmers', 'update');

  const load = useCallback(async (signal) => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const [detail, documents] = await Promise.all([
        api.get(`/land-acquisitions/${id}`, { signal }),
        api.get(`/compliance-documents/LAND_ACQUISITION/${id}`, { signal }),
      ]);
      setState({ loading: false, error: '', data: { ...detail.data, documents: documents.data.documents || [] } });
    } catch (error) {
      if (error?.code !== 'ERR_CANCELED') setState({ loading: false, error: apiMessage(error, 'Land acquisition could not be loaded'), data: EMPTY });
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, reloadKey, currentSite?.id]);

  useEffect(() => {
    const action = searchParams.get('action');
    if (!action || !state.data.acquisition) return;
    if (['payment', 'land', 'agreement', 'financials'].includes(action)) setDrawer(action);
    if (action === 'complete') setCompletionOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('action');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, state.data.acquisition]);

  const refresh = () => setReloadKey((key) => key + 1);
  const acquisition = state.data.acquisition;
  const latestAgreement = state.data.agreements[0] || null;
  const documentsByCategory = useMemo(() => state.data.documents.reduce((map, document) => {
    const category = document.category || 'OTHER';
    map[category] = [...(map[category] || []), document];
    return map;
  }, {}), [state.data.documents]);

  const setTab = (value) => {
    const next = new URLSearchParams(searchParams); next.set('tab', value); next.delete('action'); setSearchParams(next);
  };

  const complete = async () => {
    setActionBusy(true);
    try {
      await api.post(`/land-acquisitions/${id}/complete`, { notes: completionNotes });
      toast.success('Land acquisition completed'); setCompletionOpen(false); setCompletionNotes(''); refresh();
    } catch (error) { toast.error(apiMessage(error, 'This acquisition is not eligible for completion')); } finally { setActionBusy(false); }
  };
  const reopen = async () => {
    const reason = window.prompt('Reason for reopening this completed acquisition:');
    if (!reason?.trim()) return;
    setActionBusy(true);
    try { await api.post(`/land-acquisitions/${id}/reopen`, { reason }); toast.success('Acquisition reopened'); refresh(); }
    catch (error) { toast.error(apiMessage(error, 'Acquisition could not be reopened')); }
    finally { setActionBusy(false); }
  };
  const reversePayment = async () => {
    if (!reversal.payment || !reversal.reason.trim()) return;
    setReversal((current) => ({ ...current, busy: true }));
    try {
      await api.post(`/land-acquisitions/${id}/transactions/${reversal.payment.id}/reverse`, { reason: reversal.reason });
      toast.success('Reversal recorded and sent for approval'); setReversal({ payment: null, reason: '', busy: false }); refresh();
    } catch (error) {
      toast.error(apiMessage(error, 'Payment could not be reversed')); setReversal((current) => ({ ...current, busy: false }));
    }
  };
  const openDocument = async (document) => {
    try {
      const { data } = await api.get(`/compliance-documents/file/${document.id}`);
      if (data.document.file_url) return window.open(data.document.file_url, '_blank', 'noopener,noreferrer');
      if (data.document.content_url) {
        const response = await api.get(data.document.content_url, { responseType: 'blob' });
        const url = URL.createObjectURL(response.data); window.open(url, '_blank', 'noopener,noreferrer'); setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (error) { toast.error(apiMessage(error, 'Document could not be opened')); }
    return null;
  };

  if (state.loading && !acquisition) return <div className="mx-auto max-w-[1500px] space-y-5 pb-12"><Skeleton className="h-16 w-2/3" /><Skeleton className="h-20" /><Skeleton className="h-10" /><Skeleton className="h-96" /></div>;
  if (state.error || !acquisition) return <EmptyBlock icon={LandPlot} title="Land acquisition not found" description={state.error || 'This record may belong to another Site.'} action={<Button variant="outline" onClick={() => navigate('/land-acquisition?view=acquisitions')}><ArrowLeft className="mr-2 h-4 w-4" />Back to acquisitions</Button>} tall />;

  const completed = acquisition.effective_lifecycle_status === 'COMPLETED';
  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 items-start gap-3">
          <Button variant="ghost" size="icon" className="mt-0.5" onClick={() => navigate('/land-acquisition?view=acquisitions')}><ArrowLeft className="h-4 w-4" /><span className="sr-only">Back</span></Button>
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-[28px] font-semibold tracking-[-0.03em] text-mr-text">{acquisition.acquisition_reference}</h1><StatusDot tone={statusTone(acquisition.effective_lifecycle_status)}>{readable(acquisition.effective_lifecycle_status)}</StatusDot>{acquisition.is_legacy && <StatusDot tone="attention">Legacy review required</StatusDot>}</div><button type="button" onClick={() => setLandownerOpen(true)} className="mt-1.5 text-left text-[15px] font-medium text-mr-text hover:text-mr-blue">{acquisition.landowner_name}</button><p className="mt-0.5 text-[13px] text-mr-muted">{acquisition.village || 'Location pending'} · {areaLabel(acquisition)}</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!completed && canWrite && <Button onClick={() => setDrawer('payment')} disabled={acquisition.financial_terms_status !== 'CONFIRMED'}><CircleDollarSign className="mr-2 h-4 w-4" />Record payment</Button>}
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{!completed && canUpdate && <><DropdownMenuItem onClick={() => setDrawer('land')}>Edit land details</DropdownMenuItem><DropdownMenuItem onClick={() => setDrawer('agreement')}>Record agreement revision</DropdownMenuItem><DropdownMenuItem onClick={() => setDrawer('financials')}>Confirm financial terms</DropdownMenuItem><DropdownMenuItem onClick={() => setCompletionOpen(true)}>Complete acquisition</DropdownMenuItem></>}{completed && isAdmin && <DropdownMenuItem onClick={reopen} disabled={actionBusy}><RotateCcw className="mr-2 h-4 w-4" />Reopen with reason</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>
        </div>
      </header>

      <AcquisitionSummaryStrip acquisition={acquisition} />
      <div className="px-1 py-2"><LandAcquisitionProgress status={acquisition.effective_lifecycle_status} /></div>
      <PageTabs items={DETAIL_TABS} value={tab} onChange={setTab} label="Acquisition workspace" />

      {tab === 'overview' && <OverviewTab acquisition={acquisition} agreement={latestAgreement} onAction={setTab} />}
      {tab === 'land' && <LandTab acquisition={acquisition} documents={documentsByCategory} canEdit={!completed && canUpdate} onEdit={() => setDrawer('land')} onOpenDocument={openDocument} />}
      {tab === 'agreement' && <AgreementTab agreements={state.data.agreements} canEdit={!completed && canUpdate} onEdit={() => setDrawer('agreement')} />}
      {tab === 'financials' && <FinancialTab acquisition={acquisition} schedule={state.data.payment_schedule} canEdit={!completed && canUpdate} onEdit={() => setDrawer('financials')} />}
      {tab === 'transactions' && <TransactionsTab transactions={state.data.transactions} canWrite={!completed && canWrite} canReverse={!completed && canUpdate} onRecord={() => setDrawer('payment')} onOpen={setSelectedTransaction} onReverse={(payment) => setReversal({ payment, reason: '', busy: false })} />}
      {tab === 'documents' && <DocumentsTab documents={state.data.documents} canUpload={!completed && canWrite} onUpload={() => setDrawer('document')} onOpen={openDocument} />}
      {tab === 'activity' && <section><SectionHead title="Activity history" description="Agreement, terms, payment and lifecycle events are retained in one timeline." /><AcquisitionActivityTimeline items={state.data.activity} /></section>}

      <LandDetailsSheet acquisition={acquisition} open={drawer === 'land'} onOpenChange={(open) => !open && setDrawer('')} onSaved={refresh} />
      <AgreementSheet acquisition={acquisition} agreement={latestAgreement} open={drawer === 'agreement'} onOpenChange={(open) => !open && setDrawer('')} onSaved={refresh} />
      <FinancialTermsSheet acquisition={acquisition} schedule={state.data.payment_schedule} open={drawer === 'financials'} onOpenChange={(open) => !open && setDrawer('')} onSaved={refresh} />
      <RecordPaymentSheet acquisition={acquisition} schedule={state.data.payment_schedule} open={drawer === 'payment'} onOpenChange={(open) => !open && setDrawer('')} onSaved={refresh} />
      <DocumentUploadSheet acquisition={acquisition} open={drawer === 'document'} onOpenChange={(open) => !open && setDrawer('')} onSaved={refresh} />
      <LandownerDrawer memberId={acquisition.member_id} siteId={acquisition.site_id} open={landownerOpen} onOpenChange={setLandownerOpen} onOpenAcquisition={(acquisitionId) => navigate(`/land-acquisition/${acquisitionId}`)} />
      <TransactionDrawer transaction={selectedTransaction} open={Boolean(selectedTransaction)} onOpenChange={(open) => !open && setSelectedTransaction(null)} />

      <Dialog open={completionOpen} onOpenChange={setCompletionOpen}><DialogContent><DialogHeader><DialogTitle>Complete acquisition</DialogTitle><DialogDescription>{acquisition.acquisition_reference} · {acquisition.landowner_name}</DialogDescription></DialogHeader><div className="space-y-2">{acquisition.completion?.checks?.map((check) => <div key={check.key} className="flex items-center gap-2 border-b border-mr-line py-2 text-[13px]"><span className={`flex h-5 w-5 items-center justify-center rounded-full ${check.complete ? 'bg-mr-lime-soft text-mr-lime-ink' : 'bg-mr-coral-soft text-mr-coral-ink'}`}>{check.complete ? <Check className="h-3 w-3" /> : '!'}</span>{check.label}</div>)}</div><div><Label>Completion notes</Label><Textarea className="mt-2" rows={3} value={completionNotes} onChange={(event) => setCompletionNotes(event.target.value)} /></div><DialogFooter><Button variant="outline" onClick={() => setCompletionOpen(false)}>Cancel</Button><Button onClick={complete} disabled={actionBusy || !acquisition.completion?.eligible}>{actionBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Complete acquisition</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(reversal.payment)} onOpenChange={(open) => !open && setReversal({ payment: null, reason: '', busy: false })}><DialogContent><DialogHeader><DialogTitle>Reverse payment</DialogTitle><DialogDescription>The original transaction remains visible. A signed correction is created and sent through approval.</DialogDescription></DialogHeader><div className="border-y border-mr-line py-3 text-[13px]"><span className="text-mr-muted">Original payment</span><span className="float-right font-semibold">{money(reversal.payment?.amount)}</span></div><div><Label>Reason</Label><Input className="mt-2" value={reversal.reason} onChange={(event) => setReversal((current) => ({ ...current, reason: event.target.value }))} placeholder="Example: Wrong bank selected" /></div><DialogFooter><Button variant="outline" onClick={() => setReversal({ payment: null, reason: '', busy: false })}>Cancel</Button><Button variant="destructive" disabled={reversal.busy || !reversal.reason.trim()} onClick={reversePayment}>{reversal.busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create reversal</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

function OverviewTab({ acquisition, agreement, onAction }) {
  const next = acquisition.completion?.checks?.find((check) => !check.complete);
  return <div className="grid gap-9 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]"><section><SectionHead title="Acquisition at a glance" /><div className="grid gap-x-8 sm:grid-cols-2"><Fact label="Landowner" value={acquisition.landowner_name} /><Fact label="Land" value={`${acquisition.village || 'Location pending'} · ${areaLabel(acquisition)}`} /><Fact label="Parcel" value={acquisition.khasra_number || acquisition.survey_number || acquisition.parcel_number} /><Fact label="Project" value={acquisition.project_name} /><Fact label="Agreement" value={readable(agreement?.agreement_status || 'NOT_STARTED')} /><Fact label="Agreed value" value={money(acquisition.total_amount)} /><Fact label="Financial status" value={readable(acquisition.financial_status)} /><Fact label="Responsible employee" value={acquisition.responsible_user_name} /></div></section><section><SectionHead title="What happens next" /><div className="py-5"><p className="text-[14px] font-medium text-mr-text">{next?.label || 'Acquisition workflow complete'}</p><p className="mt-1 text-[12px] leading-relaxed text-mr-muted">{next ? 'Open the relevant tab to complete this business step. No legal conclusion is inferred.' : 'All configured business prerequisites are complete.'}</p>{next && <Button className="mt-4" variant="outline" onClick={() => onAction(next.key === 'land_details' ? 'land' : next.key === 'agreement' ? 'agreement' : next.key === 'financial_terms' ? 'financials' : 'transactions')}>Open next step</Button>}</div></section></div>;
}

function LandTab({ acquisition, documents, canEdit, onEdit, onOpenDocument }) {
  const landDocs = [...(documents.LAND_RECORD || []), ...(documents.KHASRA || []), ...(documents.OWNERSHIP_PROOF || [])];
  return <section><SectionHead title="Land details" description="Location, parcel identity and ownership information." actions={canEdit ? <Button variant="outline" onClick={onEdit}><Edit3 className="mr-2 h-4 w-4" />Edit</Button> : null} /><div className="grid gap-x-10 lg:grid-cols-3"><div><p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-mr-faint">Location</p><Fact label="Village" value={acquisition.village} /><Fact label="Tehsil" value={acquisition.tehsil} /><Fact label="District" value={acquisition.district} /><Fact label="State" value={acquisition.state} /></div><div><p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-mr-faint">Parcel</p><Fact label="Khasra" value={acquisition.khasra_number} /><Fact label="Survey" value={acquisition.survey_number} /><Fact label="Parcel number" value={acquisition.parcel_number} /><Fact label="Area" value={areaLabel(acquisition)} /><Fact label="Ownership" value={acquisition.ownership_share ? `${acquisition.ownership_share}%` : null} /></div><div><p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-mr-faint">Documents</p>{landDocs.map((document) => <button key={document.id} type="button" onClick={() => onOpenDocument(document)} className="flex w-full items-center gap-2 border-b border-mr-line py-3 text-left text-[13px] font-medium text-mr-text hover:text-mr-blue"><FileText className="h-4 w-4 text-mr-faint" />{document.title}</button>)}{!landDocs.length && <p className="py-5 text-[12px] text-mr-muted">No land documents uploaded.</p>}</div></div>{acquisition.land_notes && <p className="mt-5 border-t border-mr-line pt-4 text-[13px] text-mr-muted">{acquisition.land_notes}</p>}</section>;
}

function AgreementTab({ agreements, canEdit, onEdit }) {
  const latest = agreements[0];
  return <section><SectionHead title="Agreement" description="Revisioned agreement history; executed records are preserved." actions={canEdit ? <Button onClick={onEdit}><Plus className="mr-2 h-4 w-4" />Record revision</Button> : null} />{latest ? <><div className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-4"><Fact label="Status" value={readable(latest.agreement_status)} /><Fact label="Type" value={latest.agreement_type} /><Fact label="Date" value={dateLabel(latest.agreement_date)} /><Fact label="Number" value={latest.agreement_number} /><Fact label="Value" value={money(latest.agreement_value)} /><Fact label="Revision" value={`Revision ${latest.revision_number}`} /></div><div className="mt-8"><p className="text-[12px] font-semibold text-mr-text">Agreement timeline</p><div className="mt-2 divide-y divide-mr-line border-y border-mr-line">{agreements.map((item) => <div key={item.id} className="grid gap-2 py-3 sm:grid-cols-[100px_1fr_140px]"><span className="text-[12px] text-mr-muted">Revision {item.revision_number}</span><span className="text-[13px] font-medium text-mr-text">{item.agreement_type} · {readable(item.agreement_status)}</span><span className="text-[12px] text-mr-muted">{dateLabel(item.agreement_date)}</span></div>)}</div></div></> : <EmptyBlock icon={FileCheck2} title="Agreement not started" description="Record the first agreement revision when terms are prepared." action={canEdit ? <Button onClick={onEdit}>Record agreement</Button> : null} tall />}</section>;
}

function FinancialTab({ acquisition, schedule, canEdit, onEdit }) {
  return <section><SectionHead title="Financial terms" description="Contractual expectation is shown separately from actual posted transactions." actions={canEdit ? <Button variant="outline" onClick={onEdit}><Edit3 className="mr-2 h-4 w-4" />{acquisition.financial_terms_status === 'CONFIRMED' ? 'Revise terms' : 'Confirm terms'}</Button> : null} /><div className="grid gap-y-4 border-b border-mr-line py-5 sm:grid-cols-3">{[['Total consideration', money(acquisition.total_amount)], ['Cash agreed', money(acquisition.cash_amount)], ['Bank agreed', money(acquisition.bank_amount)]].map(([label, value]) => <div key={label}><p className="text-[11px] uppercase tracking-wide text-mr-faint">{label}</p><p className="mt-1 text-[20px] font-semibold text-mr-text">{value}</p></div>)}</div><div className="grid gap-5 border-b border-mr-line py-5 lg:grid-cols-3"><PaymentBar label="Cash" paid={acquisition.cash_paid} total={acquisition.cash_amount} /><PaymentBar label="Bank" paid={acquisition.bank_paid} total={acquisition.bank_amount} /><PaymentBar label="Total" paid={acquisition.total_paid} total={acquisition.total_amount} /></div><div className="mt-7"><p className="text-[12px] font-semibold text-mr-text">Payment schedule</p>{schedule.length ? <div className="mt-2 overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Installment</TableHead><TableHead>Due date</TableHead><TableHead>Mode</TableHead><TableHead className="text-right">Expected</TableHead><TableHead className="text-right">Paid</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{schedule.map((item) => <TableRow key={item.id}><TableCell className="font-medium">{item.description}</TableCell><TableCell>{dateLabel(item.due_date)}</TableCell><TableCell>{readable(item.preferred_mode)}</TableCell><TableCell className="text-right">{money(item.expected_amount)}</TableCell><TableCell className="text-right">{money(item.amount_paid)}</TableCell><TableCell><StatusDot tone={statusTone(item.effective_status)}>{readable(item.effective_status)}</StatusDot></TableCell></TableRow>)}</TableBody></Table></div> : <p className="mt-4 text-[13px] text-mr-muted">No payment schedule has been confirmed.</p>}</div></section>;
}

function PaymentBar({ label, paid, total }) {
  const denominator = Number(total) || 0;
  const percent = denominator > 0 ? Math.min(Math.max((Number(paid) || 0) / denominator * 100, 0), 100) : 0;
  return <div><div className="flex items-center justify-between gap-3 text-[12px]"><span className="font-medium text-mr-text">{label}</span><span className="tabular-nums text-mr-muted">{money(paid, true)} / {money(total, true)}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mr-surface-2"><div className="h-full rounded-full bg-mr-blue transition-[width] duration-200" style={{ width: `${percent}%` }} /></div></div>;
}

function TransactionsTab({ transactions, canWrite, canReverse, onRecord, onOpen, onReverse }) {
  return <section><SectionHead title="Transactions" description="Actual money movement from the existing Farmer Payment, Day Book and ledger architecture." actions={canWrite ? <Button onClick={onRecord}><Plus className="mr-2 h-4 w-4" />Record payment</Button> : null} />{transactions.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Particular</TableHead><TableHead>Mode</TableHead><TableHead>Reference</TableHead><TableHead>Allocation</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead className="w-10" /></TableRow></TableHeader><TableBody>{transactions.map((payment) => <TableRow key={payment.id} className="cursor-pointer" onClick={() => onOpen(payment)}><TableCell>{dateLabel(payment.date)}</TableCell><TableCell className="font-medium">{payment.particular}</TableCell><TableCell>{readable(payment.payment_mode)}</TableCell><TableCell>{payment.bank_reference || payment.cheque_no || '—'}</TableCell><TableCell>{payment.allocated_schedule || 'Unallocated'}</TableCell><TableCell className={`text-right font-semibold ${Number(payment.amount) < 0 ? 'text-mr-coral-ink' : ''}`}>{money(payment.amount)}</TableCell><TableCell><StatusDot tone={statusTone(payment.status)}>{readable(payment.status)}</StatusDot></TableCell><TableCell onClick={(event) => event.stopPropagation()}>{canReverse && Number(payment.amount) > 0 && String(payment.status).toLowerCase() === 'approved' && !payment.reverses_payment_id ? <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => onOpen(payment)}>View details</DropdownMenuItem><DropdownMenuItem className="text-mr-coral-ink" onClick={() => onReverse(payment)}>Create reversal</DropdownMenuItem></DropdownMenuContent></DropdownMenu> : null}</TableCell></TableRow>)}</TableBody></Table></div> : <EmptyBlock icon={Banknote} title="No payments yet" description="Record the first installment after financial terms are confirmed." action={canWrite ? <Button onClick={onRecord}>Record payment</Button> : null} tall />}</section>;
}

function DocumentsTab({ documents, canUpload, onUpload, onOpen }) {
  return <section><SectionHead title="Documents" description="Land, agreement, KYC, registry and payment evidence in existing private document storage." actions={canUpload ? <Button onClick={onUpload}><Upload className="mr-2 h-4 w-4" />Upload document</Button> : null} />{documents.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Type</TableHead><TableHead>Uploaded by</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="w-10" /></TableRow></TableHeader><TableBody>{documents.map((document) => <TableRow key={document.id}><TableCell className="font-medium">{document.title}</TableCell><TableCell>{readable(document.category)}</TableCell><TableCell>{document.uploaded_by_name || 'MountReality user'}</TableCell><TableCell>{dateLabel(document.created_at)}</TableCell><TableCell><StatusDot tone={statusTone(document.review_status)}>{readable(document.review_status || 'NOT_REVIEWED')}</StatusDot></TableCell><TableCell><Button variant="ghost" size="icon" onClick={() => onOpen(document)}><Download className="h-4 w-4" /><span className="sr-only">Open document</span></Button></TableCell></TableRow>)}</TableBody></Table></div> : <EmptyBlock icon={FileText} title="No acquisition documents" description="Upload land records, agreements, payment proofs or other supporting evidence." action={canUpload ? <Button onClick={onUpload}>Upload document</Button> : null} tall />}</section>;
}

function Fact({ label, value }) {
  return <div className="border-b border-mr-line py-3"><p className="text-[11px] font-medium uppercase tracking-[0.08em] text-mr-faint">{label}</p><p className="mt-1 break-words text-[13px] font-medium text-mr-text">{value || 'Not recorded'}</p></div>;
}
