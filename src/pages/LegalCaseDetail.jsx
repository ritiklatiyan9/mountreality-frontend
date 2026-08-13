import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CalendarClock, ExternalLink, FileText, Gavel, IndianRupee,
  Loader2, Plus, Scale, ShieldAlert, Upload, UserRound,
} from 'lucide-react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Skeleton } from '../components/ui/skeleton';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { fmtDate, labelize, money, RISK_STYLE, STATUS_STYLE } from '../components/compliance/complianceUi';
import {
  ComplianceDetailHeader, ComplianceField as Field, ComplianceSurface as Panel,
} from '../components/compliance/ComplianceWorkspace';

const CASE_STAGES = ['PRE_LITIGATION', 'NOTICE_ISSUED', 'REPLY_SUBMITTED', 'CASE_FILED', 'ADMISSION', 'EVIDENCE', 'ARGUMENTS', 'ORDER_RESERVED', 'JUDGEMENT', 'APPEAL', 'EXECUTION', 'SETTLED', 'CLOSED'];
const CASE_STATUSES = ['OPEN', 'ACTIVE', 'ON_HOLD', 'SETTLED', 'CLOSED'];
const EVENT_TYPES = ['HEARING', 'ORDER', 'SUBMISSION', 'EVIDENCE', 'ADVOCATE_UPDATE', 'INTERNAL_DISCUSSION', 'NEXT_ACTION', 'OTHER'];
const Pill = ({ value, styles = STATUS_STYLE }) => <Badge variant="outline" className={cn('rounded-full px-2.5 text-[10px] font-semibold', styles[value] || 'border-slate-200 bg-slate-50 text-slate-600')}>{labelize(value)}</Badge>;

export default function LegalCaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [data, setData] = useState(null);
  const [users, setUsers] = useState([]);
  const [caseStages, setCaseStages] = useState(CASE_STAGES);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [timeline, setTimeline] = useState({ event_type: 'HEARING', event_date: '', title: '', description: '', outcome: '', next_action: '', next_action_due_date: '', assigned_to: '' });
  const [edit, setEdit] = useState({ stage: '', status: '', next_hearing_date: '', risk_level: '', reason: '' });
  const [upload, setUpload] = useState({ file: null, title: '', category: 'COURT_ORDER', confidentiality: 'CONFIDENTIAL', issue_date: '', expiry_date: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [caseResult, userResult, configResult] = await Promise.all([
        api.get(`/compliance/legal-cases/${id}`),
        api.get('/compliance/legal-users'),
        api.get('/compliance/legal-config'),
      ]);
      setData(caseResult.data);
      setUsers(userResult.data.users || []);
      setCaseStages(configResult.data.case_stages?.length ? configResult.data.case_stages : CASE_STAGES);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not load legal case');
      navigate('/legal/cases');
    } finally { setLoading(false); }
  }, [id, navigate]);
  useEffect(() => { load(); }, [load]);

  const legalCase = data?.case;
  const canWrite = hasPermission('legal', 'write');
  const canUpdate = hasPermission('legal', 'update');

  const addTimeline = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      await api.post(`/compliance/legal-cases/${id}/timeline`, timeline);
      toast.success('Case update added');
      setTimelineOpen(false);
      setTimeline({ event_type: 'HEARING', event_date: '', title: '', description: '', outcome: '', next_action: '', next_action_due_date: '', assigned_to: '' });
      load();
    } catch (error) { toast.error(error.response?.data?.message || 'Case update could not be added'); }
    finally { setBusy(false); }
  };
  const updateCase = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      await api.patch(`/compliance/legal-cases/${id}`, edit);
      toast.success('Case stage updated'); setEditOpen(false); load();
    } catch (error) { toast.error(error.response?.data?.message || 'Case could not be updated'); }
    finally { setBusy(false); }
  };
  const uploadDocument = async (event) => {
    event.preventDefault();
    if (!upload.file) return toast.error('Select a document');
    setBusy(true);
    try {
      const body = new FormData();
      Object.entries(upload).forEach(([key, value]) => { if (value) body.append(key, value); });
      await api.post(`/compliance-documents/LEGAL_CASE/${id}`, body);
      toast.success('Legal document uploaded'); setUploadOpen(false);
      setUpload({ file: null, title: '', category: 'COURT_ORDER', confidentiality: 'CONFIDENTIAL', issue_date: '', expiry_date: '' });
      load();
    } catch (error) { toast.error(error.response?.data?.message || 'Document upload failed'); }
    finally { setBusy(false); }
  };
  const openDocument = async (documentId) => {
    try {
      const { data: result } = await api.get(`/compliance-documents/file/${documentId}`);
      const previewUrl = result.document?.file_url || result.document?.content_url;
      if (previewUrl) window.open(previewUrl, '_blank', 'noopener,noreferrer');
    } catch (error) { toast.error(error.response?.data?.message || 'Document access denied'); }
  };

  if (loading || !legalCase) return <div className="mx-auto max-w-7xl space-y-4"><Skeleton className="h-48 rounded-[26px]" /><Skeleton className="h-[520px] rounded-[22px]" /></div>;
  const owner = users.find((row) => Number(row.id) === Number(legalCase.internal_owner_id));
  return <div className="mx-auto w-full max-w-7xl space-y-5 pb-10">
    <ComplianceDetailHeader backTo="/legal/cases" backLabel="Back to cases" eyebrow={legalCase.case_code} title={legalCase.title} description={`${legalCase.court_authority || labelize(legalCase.case_type)} · ${legalCase.case_number || 'Case number pending'}`} icon={Gavel} accent="violet" badges={<><Pill value={legalCase.status} /><Pill value={legalCase.risk_level} styles={RISK_STYLE} /></>} actions={<>{canWrite && <Button variant="outline" onClick={() => setTimelineOpen(true)}><Plus className="mr-2 h-4 w-4" />Add update</Button>}{canUpdate && <Button className="bg-slate-950 text-white hover:bg-slate-800" onClick={() => { setEdit({ stage: legalCase.stage || 'PRE_LITIGATION', status: legalCase.status || 'OPEN', next_hearing_date: legalCase.next_hearing_date?.slice(0, 16) || '', risk_level: legalCase.risk_level || 'MEDIUM', reason: '' }); setEditOpen(true); }}>Update stage</Button>}</>} />

    <div className="grid gap-5 xl:grid-cols-[1fr_330px]">
      <Panel><Tabs defaultValue="overview"><div className="overflow-x-auto border-b px-4 pt-3"><TabsList className="h-11 bg-transparent"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="timeline">Case timeline ({data.timeline.length})</TabsTrigger><TabsTrigger value="documents">Documents ({data.documents.length})</TabsTrigger></TabsList></div>
        <TabsContent value="overview" className="m-0 p-5"><div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3"><Field label="Case type" value={labelize(legalCase.case_type)} /><Field label="Current stage" value={labelize(legalCase.stage)} /><Field label="Opposite party" value={legalCase.opposite_party} /><Field label="Filing number / year" value={[legalCase.filing_number, legalCase.case_year].filter(Boolean).join(' / ')} /><Field label="Filing date" value={fmtDate(legalCase.filing_date)} /><Field label="Limitation date" value={fmtDate(legalCase.limitation_date)} /><Field label="Advocate" value={legalCase.advocate} /><Field label="Claim amount" value={money(legalCase.claim_amount)} /><Field label="Financial exposure" value={money(legalCase.financial_exposure)} /></div><div className="mt-7 border-l-2 border-violet-300 bg-slate-50 px-4 py-3"><Field label="Case summary" value={legalCase.summary} /></div>{legalCase.notes && <div className="mt-4 border-l-2 border-amber-300 bg-amber-50 px-4 py-3"><Field label="Internal notes" value={legalCase.notes} /></div>}</TabsContent>
        <TabsContent value="timeline" className="m-0 p-5">{data.timeline.length ? <div className="relative space-y-1 before:absolute before:bottom-2 before:left-[9px] before:top-2 before:w-px before:bg-slate-200">{data.timeline.map((row) => <div key={row.id} className="relative flex gap-4 py-3"><span className="relative z-10 mt-1 h-[19px] w-[19px] shrink-0 rounded-full border-4 border-white bg-violet-500 shadow-sm" /><div className="min-w-0 flex-1 border-b border-slate-100 pb-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Pill value={row.event_type} /><p className="text-xs font-bold">{row.title}</p></div><p className="text-[10px] text-slate-400">{fmtDate(row.event_date, true)}</p></div>{row.description && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">{row.description}</p>}{row.outcome && <p className="mt-2 text-xs"><span className="font-bold">Outcome:</span> {row.outcome}</p>}{row.next_action && <div className="mt-3 border-l-2 border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-900"><span className="font-bold">Next action:</span> {row.next_action}{row.next_action_due_date ? ` · due ${fmtDate(row.next_action_due_date, true)}` : ''}</div>}<p className="mt-2 text-[10px] text-slate-400">{row.created_by_name || 'System'}{row.assigned_to_name ? ` · assigned to ${row.assigned_to_name}` : ''}</p></div></div>)}</div> : <div className="p-10 text-center text-xs text-slate-500">No case updates have been recorded.</div>}</TabsContent>
        <TabsContent value="documents" className="m-0"><div className="flex items-center justify-between border-b p-5"><div><h2 className="text-sm font-bold">Private case documents</h2><p className="mt-1 text-xs text-slate-500">Every preview and download is tenant checked and audited.</p></div>{canWrite && <Button size="sm" onClick={() => setUploadOpen(true)}><Upload className="mr-1.5 h-4 w-4" />Upload</Button>}</div>{data.documents.length ? <div className="divide-y divide-slate-100">{data.documents.map((row) => <button type="button" key={row.id} onClick={() => openDocument(row.id)} className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-violet-50/40"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-700"><FileText className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{row.title}</p><p className="mt-1 text-[10px] text-slate-400">{labelize(row.category)} · {labelize(row.confidentiality)} · v{row.version_no}</p></div><ExternalLink className="h-3.5 w-3.5 text-slate-400" /></button>)}</div> : <div className="p-10 text-center text-xs text-slate-500">No legal documents uploaded.</div>}</TabsContent>
      </Tabs></Panel>
      <aside className="space-y-4"><Panel className="p-5"><h2 className="text-xs font-bold">Next action</h2><div className="mt-4 space-y-4"><div className="flex gap-3"><CalendarClock className="mt-0.5 h-4 w-4 text-violet-600" /><Field label="Next hearing" value={fmtDate(legalCase.next_hearing_date, true)} /></div><div className="flex gap-3"><UserRound className="mt-0.5 h-4 w-4 text-blue-600" /><Field label="Internal owner" value={owner?.name || 'Unassigned'} /></div><div className="flex gap-3"><Gavel className="mt-0.5 h-4 w-4 text-amber-600" /><Field label="Advocate" value={legalCase.advocate} /></div></div></Panel><Panel className="p-5"><div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-red-600" /><h2 className="text-xs font-bold">Exposure</h2></div><p className="mt-4 text-2xl font-bold text-slate-900">{money(legalCase.financial_exposure)}</p><p className="mt-1 text-[10px] text-slate-500">{labelize(legalCase.risk_level)} management risk</p></Panel><Panel className="p-5"><div className="flex items-center gap-2"><Scale className="h-4 w-4 text-slate-500" /><h2 className="text-xs font-bold">Related finance</h2></div><Button variant="outline" className="mt-4 w-full" onClick={() => navigate('/expenses')}><IndianRupee className="mr-2 h-4 w-4" />Record legal expense</Button></Panel></aside>
    </div>

    <Dialog open={timelineOpen} onOpenChange={setTimelineOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Add case timeline update</DialogTitle><DialogDescription>Record hearings, orders, submissions, evidence and the next responsible action.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={addTimeline}><div className="grid gap-4 sm:grid-cols-2"><div><Label>Event type</Label><select className="mt-1.5 h-10 w-full rounded-xl border px-3 text-sm" value={timeline.event_type} onChange={(event) => setTimeline({ ...timeline, event_type: event.target.value })}>{EVENT_TYPES.map((value) => <option key={value}>{labelize(value)}</option>)}</select></div><div><Label>Event date & time</Label><Input className="mt-1.5" type="datetime-local" value={timeline.event_date} onChange={(event) => setTimeline({ ...timeline, event_date: event.target.value })} /></div></div><div><Label>Title</Label><Input className="mt-1.5" value={timeline.title} onChange={(event) => setTimeline({ ...timeline, title: event.target.value })} /></div><div><Label>Description / submission</Label><Textarea className="mt-1.5" value={timeline.description} onChange={(event) => setTimeline({ ...timeline, description: event.target.value })} /></div><div><Label>Outcome</Label><Textarea className="mt-1.5" value={timeline.outcome} onChange={(event) => setTimeline({ ...timeline, outcome: event.target.value })} /></div><div className="grid gap-4 sm:grid-cols-2"><div><Label>Next action</Label><Input className="mt-1.5" value={timeline.next_action} onChange={(event) => setTimeline({ ...timeline, next_action: event.target.value })} /></div><div><Label>Next action deadline</Label><Input className="mt-1.5" type="datetime-local" value={timeline.next_action_due_date} onChange={(event) => setTimeline({ ...timeline, next_action_due_date: event.target.value })} /></div><div><Label>Assigned employee</Label><select className="mt-1.5 h-10 w-full rounded-xl border px-3 text-sm" value={timeline.assigned_to} onChange={(event) => setTimeline({ ...timeline, assigned_to: event.target.value })}><option value="">Unassigned</option>{users.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => setTimelineOpen(false)}>Cancel</Button><Button disabled={busy || !timeline.title || !timeline.event_date}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add update</Button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent><DialogHeader><DialogTitle>Update case stage</DialogTitle><DialogDescription>Stage, status, hearing and risk changes are written to the compliance audit log.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={updateCase}><div className="grid gap-4 sm:grid-cols-2"><div><Label>Stage</Label><select className="mt-1.5 h-10 w-full rounded-xl border px-3 text-sm" value={edit.stage} onChange={(event) => setEdit({ ...edit, stage: event.target.value })}>{caseStages.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}</select></div><div><Label>Status</Label><select className="mt-1.5 h-10 w-full rounded-xl border px-3 text-sm" value={edit.status} onChange={(event) => setEdit({ ...edit, status: event.target.value })}>{CASE_STATUSES.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}</select></div></div><div><Label>Next hearing</Label><Input className="mt-1.5" type="datetime-local" value={edit.next_hearing_date} onChange={(event) => setEdit({ ...edit, next_hearing_date: event.target.value })} /></div><div><Label>Audit reason</Label><Textarea className="mt-1.5" value={edit.reason} onChange={(event) => setEdit({ ...edit, reason: event.target.value })} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save changes</Button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={uploadOpen} onOpenChange={setUploadOpen}><DialogContent><DialogHeader><DialogTitle>Upload legal document</DialogTitle><DialogDescription>Private PDF, Word or image evidence up to 25 MB.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={uploadDocument}><div><Label>File</Label><Input className="mt-1.5" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={(event) => setUpload({ ...upload, file: event.target.files?.[0] || null })} /></div><div><Label>Document title</Label><Input className="mt-1.5" value={upload.title} onChange={(event) => setUpload({ ...upload, title: event.target.value })} /></div><div className="grid gap-4 sm:grid-cols-2"><div><Label>Category</Label><Input className="mt-1.5" value={upload.category} onChange={(event) => setUpload({ ...upload, category: event.target.value })} /></div><div><Label>Confidentiality</Label><select className="mt-1.5 h-10 w-full rounded-xl border px-3 text-sm" value={upload.confidentiality} onChange={(event) => setUpload({ ...upload, confidentiality: event.target.value })}><option>INTERNAL</option><option>CONFIDENTIAL</option><option>RESTRICTED</option></select></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button><Button disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Upload</Button></DialogFooter></form></DialogContent></Dialog>
  </div>;
}
