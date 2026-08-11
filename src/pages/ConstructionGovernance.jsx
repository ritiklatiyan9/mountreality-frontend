import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, HardHat, IndianRupee, Loader2, Plus, RefreshCw,
  Sparkles, TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/api/api';
import { useAuth } from '@/context/AuthContext';
import { useSitePolicy } from '@/hooks/useSitePolicy';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatDate, money, statusTone, title, today, toneClasses } from '@/components/construction/constructionUi';

const EMPTY = {
  projects: [], work_packages: [], certifications: [], filing_periods: [], risks: [], attention: [],
  options: { rera_projects: [], users: [], stakeholders: [] }, policy: { capabilities: {} },
};

const CERT_TRANSITIONS = {
  DRAFT: ['EVIDENCE_PREPARATION'], EVIDENCE_PREPARATION: ['PROFESSIONAL_REVIEW', 'DRAFT'],
  PROFESSIONAL_REVIEW: ['INTERNAL_REVIEW', 'REVISION_REQUIRED'],
  INTERNAL_REVIEW: ['CERTIFIED', 'REJECTED', 'REVISION_REQUIRED'],
  REVISION_REQUIRED: ['EVIDENCE_PREPARATION'], CERTIFIED: ['APPROVED', 'SUPERSEDED'],
  APPROVED: ['SUPERSEDED'], REJECTED: [], SUPERSEDED: [],
};
const CONTROL_TRANSITIONS = {
  DRAFT: ['EVIDENCE_PENDING', 'UNDER_REVIEW'], EVIDENCE_PENDING: ['UNDER_REVIEW', 'DRAFT'],
  UNDER_REVIEW: ['READY', 'REVISION_REQUIRED', 'REJECTED'], READY: ['SUBMITTED', 'UNDER_REVIEW'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'REVISION_REQUIRED'],
  REVISION_REQUIRED: ['EVIDENCE_PENDING', 'UNDER_REVIEW'], APPROVED: ['SUPERSEDED'],
  REJECTED: ['SUPERSEDED'], RESUBMISSION_REQUIRED: ['EVIDENCE_PENDING', 'UNDER_REVIEW'], SUPERSEDED: [],
};

const ACTION_LABELS = {
  PACKAGE: 'Create work package', DAILY: 'Record daily update', FORECAST: 'Create cost forecast',
  SCHEDULE: 'Revise schedule', CERTIFICATION: 'Create certification', FILING: 'Open filing period',
  CHANGE: 'Create change request', EXTENSION: 'Request extension', RISK: 'Record project risk',
  SUBMISSION: 'Record filing submission',
};

function Status({ value }) {
  return <Badge variant="outline" className={cn('rounded-full text-[10px] font-medium', toneClasses[statusTone(value)])}>{title(value)}</Badge>;
}

function Metric({ label, value, note, tone = 'blue', children }) {
  const tones = { blue: 'bg-mr-blue-soft text-mr-blue', aqua: 'bg-mr-aqua-soft text-mr-aqua-ink', lime: 'bg-mr-lime-soft text-mr-lime-ink', amber: 'bg-mr-amber-soft text-mr-amber-ink' };
  return <div className="flex min-w-0 items-center gap-3"><span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', tones[tone])}>{children}</span><div className="min-w-0"><p className="truncate text-lg font-semibold tracking-[-0.035em]">{value}</p><p className="truncate text-[10px] uppercase tracking-[0.09em] text-mr-faint">{label}</p>{note && <p className="truncate text-[9px] text-mr-faint">{note}</p>}</div></div>;
}

function Empty({ heading, copy }) {
  return <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center"><Sparkles className="h-7 w-7 text-mr-faint" /><p className="mt-3 text-[13px] font-semibold">{heading}</p><p className="mt-1 max-w-md text-[11px] leading-5 text-mr-muted">{copy}</p></div>;
}

function Field({ label, children, span = false, hint }) {
  return <div className={cn('space-y-1.5', span && 'sm:col-span-2')}><Label className="text-[11px] text-mr-muted">{label}</Label>{children}{hint && <p className="text-[10px] leading-4 text-mr-faint">{hint}</p>}</div>;
}

const initialForm = () => ({
  construction_project_id: '', work_package_id: '', code: '', name: '', category: '', approved_budget: '',
  baseline_start_date: '', baseline_end_date: '', update_date: today(), new_progress_pct: '', work_completed: '',
  work_planned: '', blocker: '', as_of_date: today(), estimated_additional_cost: '', reason: '',
  new_start_date: '', new_end_date: '', forecast_end_date: '', certification_period_start: '',
  certification_period_end: '', proposed_certified_progress_pct: '', professional_stakeholder_id: '',
  filing_type: 'QUARTERLY_UPDATE', period_start: '', period_end: '', due_date: '', change_type: 'SCOPE',
  proposed_value: '', current_completion_date: '', proposed_completion_date: '', risk_type: 'DELIVERY',
  description: '', impact: '', severity: 'MEDIUM', filing_snapshot_id: '', submission_reference: '',
  submission_date: today(), portal_or_authority: '', acknowledgement_number: '',
});

export default function ConstructionGovernance() {
  const { currentSite, hasPermission } = useAuth();
  const { canUseCapability } = useSitePolicy();
  const siteId = currentSite?.id ? String(currentSite.id) : '';
  const isReraWorkspace = canUseCapability('rera_workspace');
  const [tab, setTab] = useState('overview');
  const [projectId, setProjectId] = useState('');
  const [workspace, setWorkspace] = useState(EMPTY);
  const [controls, setControls] = useState({ change_requests: [], extensions: [] });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [action, setAction] = useState(null);
  const [target, setTarget] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const canWrite = hasPermission('construction', 'write');
  const canUpdate = hasPermission('construction', 'update');
  const canEvidence = isReraWorkspace && (hasPermission('rera_evidence', 'write') || hasPermission('rera_evidence', 'update'));
  const canFile = isReraWorkspace && (hasPermission('rera_projects', 'write') || hasPermission('rera_projects', 'update'));

  const load = useCallback(async (quiet = false) => {
    if (!siteId) return;
    quiet ? setRefreshing(true) : setLoading(true);
    const params = { site_id: siteId, ...(projectId ? { project_id: projectId } : {}) };
    try {
      const requests = [api.get('/construction/command-centre', { params })];
      if (isReraWorkspace) {
        requests.push(
          api.get('/construction/certifications', { params }),
          api.get('/construction/filing-periods', { params: { site_id: siteId } }),
          api.get('/construction/project-controls', { params: { site_id: siteId } }),
        );
      }
      const results = await Promise.allSettled(requests);
      if (results[0].status !== 'fulfilled') throw results[0].reason;
      const command = results[0].value.data || EMPTY;
      setWorkspace({
        ...EMPTY, ...command,
        certifications: isReraWorkspace && results[1]?.status === 'fulfilled' ? results[1].value.data.certifications || [] : [],
        filing_periods: isReraWorkspace && results[2]?.status === 'fulfilled' ? results[2].value.data.filing_periods || [] : [],
      });
      if (isReraWorkspace && results[3]?.status === 'fulfilled') setControls(results[3].value.data);
      else setControls({ change_requests: [], extensions: [] });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Construction governance could not be loaded.');
    } finally { setLoading(false); setRefreshing(false); }
  }, [isReraWorkspace, projectId, siteId]);

  useEffect(() => { void load(); }, [load]);

  const selectedProject = useMemo(() => workspace.projects.find((item) => String(item.id) === String(projectId)) || null, [projectId, workspace.projects]);
  const visibleFilings = useMemo(() => projectId
    ? workspace.filing_periods.filter((item) => String(item.rera_project_id) === String(selectedProject?.rera_project_id))
    : workspace.filing_periods, [projectId, selectedProject?.rera_project_id, workspace.filing_periods]);
  const visibleChanges = useMemo(() => projectId
    ? controls.change_requests.filter((item) => String(item.rera_project_id) === String(selectedProject?.rera_project_id))
    : controls.change_requests, [controls.change_requests, projectId, selectedProject?.rera_project_id]);
  const visibleExtensions = useMemo(() => projectId
    ? controls.extensions.filter((item) => String(item.rera_project_id) === String(selectedProject?.rera_project_id))
    : controls.extensions, [controls.extensions, projectId, selectedProject?.rera_project_id]);
  const capabilities = workspace.policy?.capabilities || {};
  const totals = workspace.projects.reduce((sum, item) => ({
    budget: sum.budget + Number(item.budget || item.approved_budget || 0),
    actual: sum.actual + Number(item.actual_cost || 0),
    forecast: sum.forecast + Number(item.estimate_at_completion || 0),
  }), { budget: 0, actual: 0, forecast: 0 });

  const openAction = (kind, record = null) => {
    const project = record?.construction_project_id || (record?.rera_project_id ? workspace.projects.find((item) => String(item.rera_project_id) === String(record.rera_project_id))?.id : null) || selectedProject?.id || workspace.projects[0]?.id || '';
    setTarget(record);
    setForm({ ...initialForm(), construction_project_id: String(project || ''), work_package_id: record?.id && kind === 'DAILY' ? String(record.id) : '', filing_snapshot_id: record?.snapshots?.find((item) => item.snapshot_kind === 'READY')?.id ? String(record.snapshots.find((item) => item.snapshot_kind === 'READY').id) : '' });
    setAction(kind);
  };

  const submitAction = async (event) => {
    event.preventDefault();
    setSaving(true);
    const numeric = (value) => value === '' ? null : Number(value);
    try {
      if (action === 'PACKAGE') await api.post(`/construction/projects/${form.construction_project_id}/work-packages`, { code: form.code, name: form.name, category: form.category, approved_budget: numeric(form.approved_budget), baseline_start_date: form.baseline_start_date || null, baseline_end_date: form.baseline_end_date || null });
      if (action === 'DAILY') await api.post('/construction/daily-updates', { work_package_id: numeric(form.work_package_id), update_date: form.update_date, new_progress_pct: numeric(form.new_progress_pct), work_completed: form.work_completed, work_planned: form.work_planned, blocker: form.blocker, progress_reason: form.work_completed });
      if (action === 'FORECAST') await api.post(`/construction/projects/${form.construction_project_id}/cost-forecasts`, { work_package_id: numeric(form.work_package_id), as_of_date: form.as_of_date, estimated_additional_cost: numeric(form.estimated_additional_cost), reason: form.reason, approve: true });
      if (action === 'SCHEDULE') await api.post(`/construction/projects/${form.construction_project_id}/schedule-revisions`, { entity_type: form.work_package_id ? 'WORK_PACKAGE' : 'PROJECT', work_package_id: numeric(form.work_package_id), new_start_date: form.new_start_date || null, new_end_date: form.new_end_date, forecast_end_date: form.forecast_end_date || null, reason: form.reason });
      if (action === 'CERTIFICATION') await api.post('/construction/certifications', { construction_project_id: numeric(form.construction_project_id), work_package_id: numeric(form.work_package_id), certification_period_start: form.certification_period_start, certification_period_end: form.certification_period_end, proposed_certified_progress_pct: numeric(form.proposed_certified_progress_pct), professional_stakeholder_id: numeric(form.professional_stakeholder_id), professional_type: 'ENGINEER' });
      if (action === 'FILING') await api.post('/construction/filing-periods', { construction_project_id: numeric(form.construction_project_id), filing_type: form.filing_type, period_start: form.period_start, period_end: form.period_end, due_date: form.due_date || null });
      if (action === 'CHANGE') await api.post('/construction/project-controls/change', { construction_project_id: numeric(form.construction_project_id), change_type: form.change_type, old_value: {}, proposed_value: { summary: form.proposed_value }, reason: form.reason, impact_summary: { narrative: form.impact } });
      if (action === 'EXTENSION') await api.post('/construction/project-controls/extension', { construction_project_id: numeric(form.construction_project_id), current_completion_date: form.current_completion_date, proposed_completion_date: form.proposed_completion_date, reason: form.reason, delay_causes: form.blocker ? [form.blocker] : [] });
      if (action === 'RISK') await api.post('/construction/risks', { construction_project_id: numeric(form.construction_project_id), work_package_id: numeric(form.work_package_id), risk_type: form.risk_type, description: form.description, impact: form.impact, severity: form.severity, due_date: form.due_date || null });
      if (action === 'SUBMISSION') await api.post(`/construction/filing-periods/${target.id}/submissions`, { filing_snapshot_id: numeric(form.filing_snapshot_id), submission_reference: form.submission_reference, submission_date: form.submission_date, portal_or_authority: form.portal_or_authority, acknowledgement_number: form.acknowledgement_number || null });
      toast.success(`${ACTION_LABELS[action]} completed`);
      setAction(null); setTarget(null); await load(true);
    } catch (error) { toast.error(error.response?.data?.message || `${ACTION_LABELS[action]} could not be completed.`); }
    finally { setSaving(false); }
  };

  const transitionCertification = async (record, status) => {
    const notes = window.prompt(`Record the review basis for ${title(status)}:`);
    if (!notes?.trim()) return;
    const payload = { status, review_notes: notes.trim() };
    if (['CERTIFIED', 'APPROVED'].includes(status)) {
      payload.certified_progress_pct = Number(record.proposed_certified_progress_pct || 0);
      payload.certification_date = today();
    }
    try { await api.post(`/construction/certifications/${record.id}/transition`, payload); toast.success(`Certification moved to ${title(status)}`); await load(true); }
    catch (error) { toast.error(error.response?.data?.message || 'Certification could not advance.'); }
  };

  const filingAction = async (record, kind) => {
    try {
      if (kind === 'RECONCILE') await api.post(`/construction/filing-periods/${record.id}/reconcile`, {});
      else await api.post(`/construction/filing-periods/${record.id}/snapshots`, { snapshot_kind: kind });
      toast.success(kind === 'RECONCILE' ? 'Reconciliation completed' : `${title(kind)} snapshot created`);
      await load(true);
    } catch (error) { toast.error(error.response?.data?.message || 'Filing action could not be completed.'); }
  };

  const updateRequirement = async (filing, requirement, status) => {
    const reason = status === 'NOT_APPLICABLE' ? window.prompt('Why is this requirement not applicable?') : '';
    if (status === 'NOT_APPLICABLE' && !reason?.trim()) return;
    try { await api.put(`/construction/filing-periods/${filing.id}/requirements/${requirement.id}`, { status, resolution_notes: reason || null }); toast.success('Requirement updated'); await load(true); }
    catch (error) { toast.error(error.response?.data?.message || 'Requirement could not be updated.'); }
  };

  const transitionControl = async (kind, record, status) => {
    const reason = window.prompt(`Record the decision basis for ${title(status)}:`);
    if (!reason?.trim()) return;
    try { await api.post(`/construction/project-controls/${kind}/${record.id}/transition`, { status, reason: reason.trim() }); toast.success(`${title(kind)} moved to ${title(status)}`); await load(true); }
    catch (error) { toast.error(error.response?.data?.message || 'Control workflow could not advance.'); }
  };

  const tabs = useMemo(() => [
    ['overview', 'Overview'], ['packages', 'Work packages'],
    ...(isReraWorkspace ? [
      ['certifications', 'Certifications'], ['filings', 'Filings'], ['controls', 'Changes & extensions'],
    ] : []),
  ], [isReraWorkspace]);

  useEffect(() => {
    if (!tabs.some(([key]) => key === tab)) setTab('overview');
  }, [tab, tabs]);

  if (!siteId) return <Empty heading="Select a Site" copy="Construction governance is always evaluated inside one explicit Site scope." />;

  return (
    <div className="space-y-5 pb-12">
      <section className="overflow-hidden rounded-[28px] border border-mr-line bg-[linear-gradient(120deg,#fff_0%,#f4f7ff_56%,#ecfaf4_100%)] p-5 shadow-[0_25px_60px_-48px_rgba(20,35,70,0.5)] sm:p-7">
        <div className="flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
          <div><span className="flex h-11 w-11 items-center justify-center rounded-full bg-mr-ink text-white"><HardHat className="h-5 w-5" /></span><p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-mr-blue">Phase 3 execution control</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.045em] sm:text-4xl">Construction governance</h1><p className="mt-2 max-w-2xl text-[12px] leading-5 text-mr-muted">{isReraWorkspace ? 'Operational progress, cost-to-complete, professional certification, regulatory filing and controlled project change—connected to the same source records.' : 'Operational progress, work packages, schedules and cost-to-complete—connected to the same source records.'}</p></div>
          <div className="grid grid-cols-2 gap-x-7 gap-y-5 sm:grid-cols-4"><Metric label="Projects" value={workspace.projects.length}><HardHat className="h-4 w-4" /></Metric><Metric label="Actual cost" value={money(totals.actual, true)} tone="aqua"><IndianRupee className="h-4 w-4" /></Metric><Metric label="At completion" value={money(totals.forecast, true)} tone="amber"><TrendingUp className="h-4 w-4" /></Metric><Metric label="Attention" value={workspace.attention.length} tone="lime"><AlertTriangle className="h-4 w-4" /></Metric></div>
        </div>
      </section>

      <div className="flex flex-col gap-3 rounded-[24px] border border-mr-line bg-mr-surface p-3 sm:flex-row sm:items-center">
        <Select value={projectId || 'all'} onValueChange={(value) => setProjectId(value === 'all' ? '' : value)}><SelectTrigger className="h-10 rounded-full sm:w-72"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All construction projects</SelectItem>{workspace.projects.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select>
        <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto">{tabs.map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={cn('h-9 shrink-0 rounded-full px-4 text-[11px] font-medium transition', tab === key ? 'bg-mr-ink text-white' : 'text-mr-muted hover:bg-mr-surface-2 hover:text-mr-text')}>{label}</button>)}</nav>
        <Button variant="ghost" size="icon" className="shrink-0 rounded-full" onClick={() => load(true)} aria-label="Refresh governance"><RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} /></Button>
      </div>

      {loading ? <div className="flex min-h-96 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-mr-faint" /></div> : null}

      {!loading && tab === 'overview' && <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="overflow-hidden rounded-[26px] border border-mr-line bg-mr-surface"><div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-7"><div><h2 className="text-[15px] font-semibold">Portfolio delivery position</h2><p className="mt-1 text-[11px] text-mr-muted">Operational progress remains separate from independently certified progress.</p></div>{canWrite && <Button className="rounded-full bg-mr-ink" size="sm" onClick={() => openAction('PACKAGE')}><Plus className="mr-1.5 h-3.5 w-3.5" />Work package</Button>}</div><div className="divide-y divide-mr-line">{workspace.projects.map((item) => <article key={item.id} className="p-5 sm:p-7"><div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-[14px] font-semibold">{item.name}</h3><Status value={item.status} /></div><p className="mt-1 text-[10px] text-mr-muted">{item.rera_project_name || 'Unmapped regulatory project'} · {item.work_package_count || 0} packages</p></div><div className="grid grid-cols-3 gap-5 text-right"><div><p className="text-[15px] font-semibold">{Number(item.progress_pct || 0).toFixed(1)}%</p><p className="text-[9px] text-mr-faint">Operational</p></div><div><p className="text-[15px] font-semibold">{item.latest_certified_progress_pct == null ? '—' : `${Number(item.latest_certified_progress_pct).toFixed(1)}%`}</p><p className="text-[9px] text-mr-faint">Certified</p></div><div><p className="text-[15px] font-semibold">{money(item.estimate_at_completion, true)}</p><p className="text-[9px] text-mr-faint">EAC</p></div></div></div><Progress value={Number(item.progress_pct || 0)} className="mt-4 h-1.5" /></article>)}{!workspace.projects.length && <Empty heading="No construction project" copy="Create the execution project first, then govern packages, certifications and filings here." />}</div></section>
        <section className="overflow-hidden rounded-[26px] border border-mr-line bg-mr-surface"><div className="p-5 sm:p-7"><h2 className="text-[15px] font-semibold">Needs attention</h2><p className="mt-1 text-[11px] text-mr-muted">Source-linked blockers, risks and filing gaps.</p></div><div className="divide-y divide-mr-line">{workspace.attention.map((item, index) => <div key={`${item.type}-${item.id}-${index}`} className="flex gap-3 px-5 py-4 sm:px-7"><span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', item.severity === 'HIGH' || item.severity === 'CRITICAL' ? 'bg-mr-coral' : 'bg-mr-amber')} /><div className="min-w-0"><p className="truncate text-[12px] font-semibold">{item.title}</p><p className="mt-1 text-[10px] leading-4 text-mr-muted">{item.reason || 'Review required'}{item.owner ? ` · ${item.owner}` : ''}</p></div></div>)}{!workspace.attention.length && <Empty heading="No open blockers" copy="No source record currently meets the attention rules for this scope." />}</div></section>
      </div>}

      {!loading && tab === 'packages' && <section className="overflow-hidden rounded-[26px] border border-mr-line bg-mr-surface"><div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-7"><div><h2 className="text-[15px] font-semibold">Work package register</h2><p className="mt-1 text-[11px] text-mr-muted">Budget, owner, progress, next action and forecast on one controlled record.</p></div><div className="flex flex-wrap gap-2">{canWrite && <><Button variant="outline" size="sm" className="rounded-full" onClick={() => openAction('RISK')}>Record risk</Button><Button variant="outline" size="sm" className="rounded-full" onClick={() => openAction('FORECAST')}>Cost forecast</Button><Button variant="outline" size="sm" className="rounded-full" onClick={() => openAction('SCHEDULE')}>Revise schedule</Button><Button size="sm" className="rounded-full bg-mr-ink" onClick={() => openAction('PACKAGE')}><Plus className="mr-1.5 h-3.5 w-3.5" />Package</Button></>}</div></div><div className="divide-y divide-mr-line">{workspace.work_packages.map((item) => <article key={item.id} className="p-5 sm:p-7"><div className="grid gap-5 lg:grid-cols-[1fr_auto]"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-[13px] font-semibold">{item.code} · {item.name}</h3><Status value={item.status} /></div><p className="mt-1 text-[10px] text-mr-muted">{item.project_name} · {item.owner_name || 'Owner not assigned'} · next {item.next_action || 'not recorded'}</p><Progress value={Number(item.operational_progress_pct || 0)} className="mt-4 h-1.5" /></div><div className="grid grid-cols-3 gap-5 text-right"><div><p className="text-[14px] font-semibold">{Number(item.operational_progress_pct || 0).toFixed(1)}%</p><p className="text-[9px] text-mr-faint">Operational</p></div><div><p className="text-[14px] font-semibold">{item.certified_progress_pct == null ? '—' : `${Number(item.certified_progress_pct).toFixed(1)}%`}</p><p className="text-[9px] text-mr-faint">Certified</p></div><div><p className="text-[14px] font-semibold">{money(item.estimate_at_completion, true)}</p><p className="text-[9px] text-mr-faint">EAC</p></div></div></div>{canWrite && <div className="mt-4 flex justify-end"><Button variant="ghost" size="sm" className="rounded-full text-[11px]" onClick={() => openAction('DAILY', item)}>Record daily update <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button></div>}</article>)}{!workspace.work_packages.length && <Empty heading="No work packages in this scope" copy="Create a package to connect execution, materials, commitments, progress and certification." />}</div></section>}

      {!loading && tab === 'certifications' && <section className="overflow-hidden rounded-[26px] border border-mr-line bg-mr-surface"><div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-7"><div><h2 className="text-[15px] font-semibold">Professional certification register</h2><p className="mt-1 text-[11px] text-mr-muted">Proposed progress, evidence and final internal approval stay segregated.</p></div>{canEvidence && capabilities.construction_certification !== false && <Button size="sm" className="rounded-full bg-mr-ink" onClick={() => openAction('CERTIFICATION')}><Plus className="mr-1.5 h-3.5 w-3.5" />Certification</Button>}</div><div className="divide-y divide-mr-line">{workspace.certifications.map((item) => <article key={item.id} className="p-5 sm:p-7"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-[13px] font-semibold">Certification #{item.id} · {item.project_name}</h3><Status value={item.status} /></div><p className="mt-1 text-[10px] text-mr-muted">{formatDate(item.certification_period_start)} – {formatDate(item.certification_period_end)} · {item.professional_name || 'Professional unassigned'} · {(item.evidence || []).length} evidence records</p><p className="mt-3 text-[11px] leading-5 text-mr-muted">{item.review_notes || 'No review notes recorded.'}</p></div><div className="flex flex-wrap items-center justify-end gap-2"><div className="mr-3 text-right"><p className="text-xl font-semibold">{Number(item.proposed_certified_progress_pct || 0).toFixed(1)}%</p><p className="text-[9px] text-mr-faint">Proposed</p></div>{canEvidence && (CERT_TRANSITIONS[item.status] || []).map((next) => <Button key={next} variant="outline" size="sm" className="rounded-full text-[10px]" onClick={() => transitionCertification(item, next)}>{title(next)}</Button>)}</div></div></article>)}{!workspace.certifications.length && <Empty heading="No certification records" copy="A certification freezes its operational and cost source snapshot for evidence-based review." />}</div></section>}

      {!loading && tab === 'filings' && <section className="overflow-hidden rounded-[26px] border border-mr-line bg-mr-surface"><div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-7"><div><h2 className="text-[15px] font-semibold">Regulatory filing periods</h2><p className="mt-1 text-[11px] text-mr-muted">Ruleset-pinned requirements, reconciliation, immutable snapshots and submission evidence.</p></div>{canFile && capabilities.filing_preparation !== false && <Button size="sm" className="rounded-full bg-mr-ink" onClick={() => openAction('FILING')}><Plus className="mr-1.5 h-3.5 w-3.5" />Filing period</Button>}</div><div className="divide-y divide-mr-line">{visibleFilings.map((item) => <article key={item.id} className="p-5 sm:p-7"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-[13px] font-semibold">{title(item.filing_type)} · {item.project_name}</h3><Status value={item.status} /></div><p className="mt-1 text-[10px] text-mr-muted">{formatDate(item.period_start)} – {formatDate(item.period_end)} · due {formatDate(item.due_date)} · ruleset {item.version_label || item.ruleset_version}</p></div>{canFile && <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" className="rounded-full text-[10px]" onClick={() => filingAction(item, 'RECONCILE')}>Reconcile</Button><Button variant="outline" size="sm" className="rounded-full text-[10px]" onClick={() => filingAction(item, 'REVIEW')}>Review snapshot</Button><Button variant="outline" size="sm" className="rounded-full text-[10px]" onClick={() => filingAction(item, 'READY')}>Ready snapshot</Button>{item.status === 'READY' && <Button size="sm" className="rounded-full bg-mr-ink text-[10px]" onClick={() => openAction('SUBMISSION', item)}>Record submission</Button>}</div>}</div>{(item.requirements || []).length > 0 && <div className="mt-5 overflow-hidden rounded-panel-sm border border-mr-line"><div className="grid grid-cols-[1fr_auto] bg-mr-surface-2 px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.09em] text-mr-faint"><span>Requirement</span><span>Status</span></div>{item.requirements.slice(0, 12).map((requirement) => <div key={requirement.id} className="flex items-center gap-3 border-t border-mr-line px-4 py-3"><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-medium">{requirement.title}</p><p className="text-[9px] text-mr-faint">{requirement.requirement_code}</p></div><Status value={requirement.status} />{canFile && !['READY', 'SUBMITTED', 'ACCEPTED', 'SUPERSEDED'].includes(item.status) && <Button variant="ghost" size="sm" className="rounded-full text-[10px]" onClick={() => updateRequirement(item, requirement, 'COMPLETE')}>Mark complete</Button>}</div>)}</div>}</article>)}{!visibleFilings.length && <Empty heading="No filing periods" copy="Open a period only after the project is pinned to a reviewed ruleset version." />}</div></section>}

      {!loading && tab === 'controls' && <section className="overflow-hidden rounded-[26px] border border-mr-line bg-mr-surface"><div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-7"><div><h2 className="text-[15px] font-semibold">Project change and extension control</h2><p className="mt-1 text-[11px] text-mr-muted">Material change is reviewed as a workflow; source records are never silently rewritten.</p></div>{canFile && capabilities.project_change_control !== false && <div className="flex gap-2"><Button variant="outline" size="sm" className="rounded-full" onClick={() => openAction('EXTENSION')}>Extension</Button><Button size="sm" className="rounded-full bg-mr-ink" onClick={() => openAction('CHANGE')}><Plus className="mr-1.5 h-3.5 w-3.5" />Change request</Button></div>}</div><div className="grid xl:grid-cols-2"><div className="border-b border-mr-line xl:border-b-0 xl:border-r"><div className="px-5 pb-3 sm:px-7"><h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-mr-faint">Change requests</h3></div><div className="divide-y divide-mr-line">{visibleChanges.map((item) => <article key={item.id} className="p-5 sm:px-7"><div className="flex items-start justify-between gap-3"><div><p className="text-[12px] font-semibold">{title(item.change_type)} · {item.project_name}</p><p className="mt-1 text-[10px] leading-4 text-mr-muted">{item.reason}</p></div><Status value={item.status} /></div>{canUpdate && <div className="mt-3 flex flex-wrap justify-end gap-1">{(CONTROL_TRANSITIONS[item.status] || []).map((next) => <Button key={next} variant="ghost" size="sm" className="rounded-full text-[10px]" onClick={() => transitionControl('change', item, next)}>{title(next)}</Button>)}</div>}</article>)}{!visibleChanges.length && <Empty heading="No change requests" copy="Controlled scope, design and commercial changes appear here." />}</div></div><div><div className="px-5 pb-3 pt-5 sm:px-7 xl:pt-0"><h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-mr-faint">Extensions</h3></div><div className="divide-y divide-mr-line">{visibleExtensions.map((item) => <article key={item.id} className="p-5 sm:px-7"><div className="flex items-start justify-between gap-3"><div><p className="text-[12px] font-semibold">{item.project_name} · {formatDate(item.proposed_completion_date)}</p><p className="mt-1 text-[10px] leading-4 text-mr-muted">{item.reason}</p></div><Status value={item.status} /></div>{canUpdate && <div className="mt-3 flex flex-wrap justify-end gap-1">{(CONTROL_TRANSITIONS[item.status] || []).filter((next) => next !== 'APPROVED').map((next) => <Button key={next} variant="ghost" size="sm" className="rounded-full text-[10px]" onClick={() => transitionControl('extension', item, next)}>{title(next)}</Button>)}</div>}</article>)}{!visibleExtensions.length && <Empty heading="No extension requests" copy="Programme extensions retain the delay cause, progress snapshot and authority decision trail." />}</div></div></div></section>}

      <Dialog open={Boolean(action)} onOpenChange={(open) => { if (!open) { setAction(null); setTarget(null); } }}>
        <DialogContent className="max-w-2xl rounded-[26px] border-mr-line p-0">
          <form onSubmit={submitAction}>
            <DialogHeader className="border-b border-mr-line p-6 pr-12"><DialogTitle>{ACTION_LABELS[action] || 'Construction action'}</DialogTitle><DialogDescription>All entries are Site-scoped, audit logged and validated against the linked project.</DialogDescription></DialogHeader>
            <div className="grid max-h-[62vh] gap-4 overflow-y-auto p-6 sm:grid-cols-2">
              {action !== 'SUBMISSION' && <Field label="Construction project" span><Select required value={form.construction_project_id} onValueChange={(value) => setForm((current) => ({ ...current, construction_project_id: value, work_package_id: '' }))}><SelectTrigger className="h-11 rounded-control"><SelectValue placeholder="Select project" /></SelectTrigger><SelectContent>{workspace.projects.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></Field>}
              {['DAILY', 'FORECAST', 'SCHEDULE', 'CERTIFICATION', 'RISK'].includes(action) && <Field label={action === 'DAILY' ? 'Work package' : 'Work package (optional)'} span={action !== 'DAILY'}><Select required={action === 'DAILY'} value={form.work_package_id || 'none'} onValueChange={(value) => setForm((current) => ({ ...current, work_package_id: value === 'none' ? '' : value }))}><SelectTrigger className="h-11 rounded-control"><SelectValue /></SelectTrigger><SelectContent>{action !== 'DAILY' && <SelectItem value="none">Project-level</SelectItem>}{workspace.work_packages.filter((item) => String(item.construction_project_id) === String(form.construction_project_id)).map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.code} · {item.name}</SelectItem>)}</SelectContent></Select></Field>}
              {action === 'PACKAGE' && <><Field label="Package code"><Input required value={form.code} onChange={(e) => setForm((c) => ({ ...c, code: e.target.value }))} className="h-11 rounded-control" /></Field><Field label="Package name"><Input required value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} className="h-11 rounded-control" /></Field><Field label="Category"><Input value={form.category} onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))} className="h-11 rounded-control" placeholder="Civil, MEP, infrastructure…" /></Field><Field label="Approved budget"><Input type="number" min="0" value={form.approved_budget} onChange={(e) => setForm((c) => ({ ...c, approved_budget: e.target.value }))} className="h-11 rounded-control" /></Field><Field label="Baseline start"><Input type="date" value={form.baseline_start_date} onChange={(e) => setForm((c) => ({ ...c, baseline_start_date: e.target.value }))} className="h-11 rounded-control" /></Field><Field label="Baseline end"><Input type="date" value={form.baseline_end_date} onChange={(e) => setForm((c) => ({ ...c, baseline_end_date: e.target.value }))} className="h-11 rounded-control" /></Field></>}
              {action === 'DAILY' && <><Field label="Update date"><Input required type="date" value={form.update_date} onChange={(e) => setForm((c) => ({ ...c, update_date: e.target.value }))} className="h-11 rounded-control" /></Field><Field label="New operational progress %"><Input type="number" min="0" max="100" step="0.01" value={form.new_progress_pct} onChange={(e) => setForm((c) => ({ ...c, new_progress_pct: e.target.value }))} className="h-11 rounded-control" /></Field><Field label="Work completed" span><Textarea required value={form.work_completed} onChange={(e) => setForm((c) => ({ ...c, work_completed: e.target.value }))} className="min-h-24 rounded-control" /></Field><Field label="Next planned work"><Textarea value={form.work_planned} onChange={(e) => setForm((c) => ({ ...c, work_planned: e.target.value }))} className="min-h-20 rounded-control" /></Field><Field label="Blocker"><Textarea value={form.blocker} onChange={(e) => setForm((c) => ({ ...c, blocker: e.target.value }))} className="min-h-20 rounded-control" /></Field></>}
              {action === 'FORECAST' && <><Field label="As-of date"><Input required type="date" value={form.as_of_date} onChange={(e) => setForm((c) => ({ ...c, as_of_date: e.target.value }))} className="h-11 rounded-control" /></Field><Field label="Additional cost to complete"><Input required type="number" min="0" value={form.estimated_additional_cost} onChange={(e) => setForm((c) => ({ ...c, estimated_additional_cost: e.target.value }))} className="h-11 rounded-control" /></Field><Field label="Forecast basis" span><Textarea required value={form.reason} onChange={(e) => setForm((c) => ({ ...c, reason: e.target.value }))} className="min-h-24 rounded-control" /></Field></>}
              {action === 'SCHEDULE' && <><Field label="Revised start"><Input type="date" value={form.new_start_date} onChange={(e) => setForm((c) => ({ ...c, new_start_date: e.target.value }))} className="h-11 rounded-control" /></Field><Field label="Revised end"><Input required type="date" value={form.new_end_date} onChange={(e) => setForm((c) => ({ ...c, new_end_date: e.target.value }))} className="h-11 rounded-control" /></Field><Field label="Forecast end"><Input type="date" value={form.forecast_end_date} onChange={(e) => setForm((c) => ({ ...c, forecast_end_date: e.target.value }))} className="h-11 rounded-control" /></Field><Field label="Revision basis"><Textarea required value={form.reason} onChange={(e) => setForm((c) => ({ ...c, reason: e.target.value }))} className="min-h-20 rounded-control" /></Field></>}
              {action === 'CERTIFICATION' && <><Field label="Period start"><Input required type="date" value={form.certification_period_start} onChange={(e) => setForm((c) => ({ ...c, certification_period_start: e.target.value }))} className="h-11 rounded-control" /></Field><Field label="Period end"><Input required type="date" value={form.certification_period_end} onChange={(e) => setForm((c) => ({ ...c, certification_period_end: e.target.value }))} className="h-11 rounded-control" /></Field><Field label="Proposed certified progress %"><Input required type="number" min="0" max="100" step="0.01" value={form.proposed_certified_progress_pct} onChange={(e) => setForm((c) => ({ ...c, proposed_certified_progress_pct: e.target.value }))} className="h-11 rounded-control" /></Field><Field label="Certifying professional"><Select required value={form.professional_stakeholder_id} onValueChange={(value) => setForm((c) => ({ ...c, professional_stakeholder_id: value }))}><SelectTrigger className="h-11 rounded-control"><SelectValue placeholder="Select stakeholder" /></SelectTrigger><SelectContent>{workspace.options.stakeholders.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.legal_name} · {title(item.stakeholder_type)}</SelectItem>)}</SelectContent></Select></Field></>}
              {action === 'FILING' && <><Field label="Filing type"><Input required value={form.filing_type} onChange={(e) => setForm((c) => ({ ...c, filing_type: e.target.value.toUpperCase() }))} className="h-11 rounded-control" /></Field><Field label="Due date"><Input type="date" value={form.due_date} onChange={(e) => setForm((c) => ({ ...c, due_date: e.target.value }))} className="h-11 rounded-control" /></Field><Field label="Period start"><Input required type="date" value={form.period_start} onChange={(e) => setForm((c) => ({ ...c, period_start: e.target.value }))} className="h-11 rounded-control" /></Field><Field label="Period end"><Input required type="date" value={form.period_end} onChange={(e) => setForm((c) => ({ ...c, period_end: e.target.value }))} className="h-11 rounded-control" /></Field></>}
              {action === 'CHANGE' && <><Field label="Change type"><Input required value={form.change_type} onChange={(e) => setForm((c) => ({ ...c, change_type: e.target.value.toUpperCase() }))} className="h-11 rounded-control" /></Field><Field label="Proposed value"><Input required value={form.proposed_value} onChange={(e) => setForm((c) => ({ ...c, proposed_value: e.target.value }))} className="h-11 rounded-control" /></Field><Field label="Reason" span><Textarea required value={form.reason} onChange={(e) => setForm((c) => ({ ...c, reason: e.target.value }))} className="min-h-24 rounded-control" /></Field><Field label="Impact summary" span><Textarea value={form.impact} onChange={(e) => setForm((c) => ({ ...c, impact: e.target.value }))} className="min-h-20 rounded-control" /></Field></>}
              {action === 'EXTENSION' && <><Field label="Current completion"><Input required type="date" value={form.current_completion_date} onChange={(e) => setForm((c) => ({ ...c, current_completion_date: e.target.value }))} className="h-11 rounded-control" /></Field><Field label="Proposed completion"><Input required type="date" value={form.proposed_completion_date} onChange={(e) => setForm((c) => ({ ...c, proposed_completion_date: e.target.value }))} className="h-11 rounded-control" /></Field><Field label="Reason" span><Textarea required value={form.reason} onChange={(e) => setForm((c) => ({ ...c, reason: e.target.value }))} className="min-h-24 rounded-control" /></Field><Field label="Primary delay cause" span><Input value={form.blocker} onChange={(e) => setForm((c) => ({ ...c, blocker: e.target.value }))} className="h-11 rounded-control" /></Field></>}
              {action === 'RISK' && <><Field label="Risk type"><Input required value={form.risk_type} onChange={(e) => setForm((c) => ({ ...c, risk_type: e.target.value.toUpperCase() }))} className="h-11 rounded-control" /></Field><Field label="Severity"><Select value={form.severity} onValueChange={(value) => setForm((c) => ({ ...c, severity: value }))}><SelectTrigger className="h-11 rounded-control"><SelectValue /></SelectTrigger><SelectContent>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => <SelectItem key={value} value={value}>{title(value)}</SelectItem>)}</SelectContent></Select></Field><Field label="Description" span><Textarea required value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} className="min-h-24 rounded-control" /></Field><Field label="Impact"><Textarea value={form.impact} onChange={(e) => setForm((c) => ({ ...c, impact: e.target.value }))} className="min-h-20 rounded-control" /></Field><Field label="Due date"><Input type="date" value={form.due_date} onChange={(e) => setForm((c) => ({ ...c, due_date: e.target.value }))} className="h-11 rounded-control" /></Field></>}
              {action === 'SUBMISSION' && <><Field label="Ready snapshot" span><Select required value={form.filing_snapshot_id} onValueChange={(value) => setForm((c) => ({ ...c, filing_snapshot_id: value }))}><SelectTrigger className="h-11 rounded-control"><SelectValue placeholder="Select immutable ready snapshot" /></SelectTrigger><SelectContent>{(target?.snapshots || []).filter((item) => item.snapshot_kind === 'READY').map((item) => <SelectItem key={item.id} value={String(item.id)}>Snapshot #{item.id} · {formatDate(item.created_at)}</SelectItem>)}</SelectContent></Select></Field><Field label="Submission reference"><Input required value={form.submission_reference} onChange={(e) => setForm((c) => ({ ...c, submission_reference: e.target.value }))} className="h-11 rounded-control" /></Field><Field label="Submission date"><Input required type="date" value={form.submission_date} onChange={(e) => setForm((c) => ({ ...c, submission_date: e.target.value }))} className="h-11 rounded-control" /></Field><Field label="Portal or authority"><Input required value={form.portal_or_authority} onChange={(e) => setForm((c) => ({ ...c, portal_or_authority: e.target.value }))} className="h-11 rounded-control" /></Field><Field label="Acknowledgement number"><Input value={form.acknowledgement_number} onChange={(e) => setForm((c) => ({ ...c, acknowledgement_number: e.target.value }))} className="h-11 rounded-control" /></Field></>}
            </div>
            <DialogFooter className="border-t border-mr-line p-5"><Button type="button" variant="ghost" className="rounded-full" onClick={() => setAction(null)}>Cancel</Button><Button disabled={saving} className="rounded-full bg-mr-ink">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{ACTION_LABELS[action] || 'Save'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
