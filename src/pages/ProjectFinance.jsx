import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Banknote, Building2, Link2, Plus, RefreshCw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import api from '@/api/api';
import { useAuth } from '@/context/AuthContext';
import { useSitePolicy } from '@/hooks/useSitePolicy';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import EvidenceDocumentSelect from '@/components/project-finance/EvidenceDocumentSelect';
import ReraWorkflowNotice from '@/components/policy/ReraWorkflowNotice';
import { cn } from '@/lib/utils';
import { getFinancePaymentPolicy } from '@/lib/financePaymentPolicy';
import { isReraOperatingProfile } from '@/lib/sitePolicy';

const ReraFundControls = lazy(() => import('@/components/project-finance/ReraFundControls'));

// ponytail: module-level stale-while-revalidate cache. Survives route changes so
// returning to this page paints the last view instantly instead of flashing the
// setup wizard, then skeletons, then data. Swap for react-query if more pages need it.
const cache = new Map();
const EMPTY = {
  metrics: {}, collections: [], expenses: [], unassigned_expenses: [], accounts: [], allocations: [], evidence_documents: [],
};
const bootKeyOf = (siteId) => `pf:boot:${siteId}`;
const dataKeyOf = (siteId, projectId, phaseId) => `pf:data:${siteId}:${projectId}:${phaseId}`;

const currency = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const date = (value) => value
  ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
  : '—';
const title = (value) => String(value || 'Not set').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const today = () => new Date().toISOString().slice(0, 10);
const bankTransactionLabel = (transaction) => {
  const direction = Number(transaction.debit || 0) > 0 ? 'Debit' : 'Credit';
  const amount = Number(transaction.debit || transaction.credit || 0);
  const reference = transaction.reference || transaction.transaction_no
    || transaction.cheque_no || transaction.description || 'Bank transaction';
  return `${date(transaction.date)} · ${direction} ${currency(amount)} · ${reference}`;
};

function Field({ label, children }) {
  return <label className="block space-y-1.5"><Label className="text-xs font-medium text-slate-600">{label}</Label>{children}</label>;
}

function Empty({ children }) {
  return <TableRow><TableCell colSpan={8} className="h-44 text-center text-sm text-slate-500">{children}</TableCell></TableRow>;
}

function AccountSheet({ open, onOpenChange, siteId, project, phaseId, firms, evidenceDocuments, isReraProfile, onSaved }) {
  const [form, setForm] = useState({ firm_id: '', purpose: '', effective_from: today(), evidence_document_id: '' });
  const [busy, setBusy] = useState(false);
  const eligibleFirms = isReraProfile
    ? firms.filter((firm) => String(firm.bank_name || '').trim() && String(firm.account_number || '').trim())
    : firms;
  const selectedFirm = firms.find((firm) => String(firm.id) === String(form.firm_id));
  useEffect(() => {
    if (open) setForm({
      firm_id: '',
      purpose: isReraProfile ? 'RERA_SEPARATE_ACCOUNT' : '',
      effective_from: today(),
      evidence_document_id: '',
    });
  }, [isReraProfile, open]);

  const submit = async () => {
    if (!form.firm_id || !form.purpose.trim()) return toast.error('Select an existing account and enter its project purpose.');
    if (isReraProfile && (!selectedFirm?.bank_name || !selectedFirm?.account_number)) {
      return toast.error('Choose a bank account with both bank name and account number.');
    }
    if (isReraProfile && (!Number.isInteger(Number(form.evidence_document_id)) || Number(form.evidence_document_id) <= 0)) {
      return toast.error('Link the bank letter or account-proof document before mapping a RERA designated account.');
    }
    setBusy(true);
    try {
      await api.post('/property-lifecycle/project-finance/accounts', {
        site_id: siteId,
        firm_id: form.firm_id,
        rera_project_id: project.id,
        rera_project_phase_id: phaseId === 'all' ? null : phaseId,
        purpose: form.purpose,
        effective_from: form.effective_from,
        evidence_document_id: form.evidence_document_id ? Number(form.evidence_document_id) : null,
      });
      toast.success(`${firms.find((firm) => String(firm.id) === String(form.firm_id))?.name || 'Account'} mapped to ${project.name}.`);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Project account could not be mapped.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-[560px]">
        <SheetHeader className="border-b border-slate-200 px-6 py-5">
          <SheetTitle>Map an existing account</SheetTitle>
          <SheetDescription>{project?.name} · this adds project context; it does not create a bank account.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <Field label="Existing account">
            <Select value={form.firm_id || 'none'} onValueChange={(value) => setForm((current) => ({ ...current, firm_id: value === 'none' ? '' : value }))}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select account</SelectItem>
                {eligibleFirms.map((firm) => <SelectItem key={firm.id} value={String(firm.id)}>{firm.name} · {isReraProfile ? `${firm.bank_name} · ${firm.account_number}` : (firm.account_number || firm.bank_name || 'Account')}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {isReraProfile && !eligibleFirms.length && <p className="border-y border-amber-100 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">Create a bank ledger with bank name and account number before mapping the RERA separate account.</p>}
          <Field label="Purpose">
            {isReraProfile ? (
              <Select value={form.purpose} onValueChange={(value) => setForm((current) => ({ ...current, purpose: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RERA_SEPARATE_ACCOUNT">RERA separate account · recommended</SelectItem>
                  <SelectItem value="SEPARATE_ACCOUNT">Separate account</SelectItem>
                  <SelectItem value="DESIGNATED_COLLECTION_ACCOUNT">Designated collection account</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input value={form.purpose} onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))} placeholder="Customer collections / project expenses" />
            )}
          </Field>
          <Field label="Effective from"><Input type="date" value={form.effective_from} onChange={(event) => setForm((current) => ({ ...current, effective_from: event.target.value }))} /></Field>
          <EvidenceDocumentSelect
            label={isReraProfile ? 'Bank letter / account proof' : 'Evidence document'}
            value={form.evidence_document_id}
            onChange={(value) => setForm((current) => ({ ...current, evidence_document_id: value }))}
            documents={evidenceDocuments}
            required={isReraProfile}
            placeholder={isReraProfile ? 'Choose bank letter or account proof' : 'No evidence document'}
            hint={isReraProfile ? 'Use a bank-issued letter, statement, cancelled cheque, or equivalent account proof retained in DMS.' : 'Optional supporting record from Document Search.'}
          />
          <p className="border-l-2 border-blue-300 bg-blue-50/60 px-3 py-2 text-xs text-blue-800">A reviewer must verify this mapping before it is treated as reviewed project-account evidence.</p>
        </div>
        <SheetFooter className="border-t border-slate-200 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || (isReraProfile && !eligibleFirms.length)}>{busy ? 'Mapping…' : 'Map account'}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function AllocationSheet({ open, onOpenChange, siteId, project, phaseId, isReraProfile, onSaved }) {
  const [form, setForm] = useState({ source_module: 'EXPENSE', source_id: '', allocation_method: 'DIRECT', amount: '', percentage: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const [eligibleTransactions, setEligibleTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState('');
  const complianceRequest = useRef(0);
  useEffect(() => {
    if (!open) {
      complianceRequest.current += 1;
      return undefined;
    }
    setForm({ source_module: isReraProfile ? 'FIRM_TRANSACTION' : 'EXPENSE', source_id: '', allocation_method: 'DIRECT', amount: '', percentage: '', reason: '' });
    setEligibleTransactions([]);
    setTransactionsError('');
    if (!isReraProfile || !siteId || !project?.id) {
      setTransactionsLoading(false);
      return undefined;
    }

    const sequence = ++complianceRequest.current;
    setTransactionsLoading(true);
    api.get('/property-lifecycle/project-finance/rera-compliance', {
      params: {
        site_id: siteId,
        project_id: project.id,
        ...(phaseId !== 'all' ? { phase_id: phaseId } : {}),
      },
    }).then(({ data }) => {
      if (sequence !== complianceRequest.current) return;
      const credits = Array.isArray(data.eligible_bank_credits) ? data.eligible_bank_credits : [];
      const debits = Array.isArray(data.eligible_bank_debits) ? data.eligible_bank_debits : [];
      setEligibleTransactions([...debits, ...credits].sort((left, right) => (
        String(right.date || '').localeCompare(String(left.date || '')) || Number(right.id) - Number(left.id)
      )));
    }).catch((error) => {
      if (sequence !== complianceRequest.current) return;
      setEligibleTransactions([]);
      setTransactionsError(error.response?.data?.message || 'Eligible bank transactions could not be loaded.');
    }).finally(() => {
      if (sequence === complianceRequest.current) setTransactionsLoading(false);
    });

    return () => {
      if (sequence === complianceRequest.current) complianceRequest.current += 1;
    };
  }, [isReraProfile, open, phaseId, project?.id, siteId]);

  const submit = async () => {
    if (!form.source_id || !form.reason.trim()) return toast.error('Enter the source transaction and allocation reason.');
    if (isReraProfile && !eligibleTransactions.some((transaction) => String(transaction.id) === String(form.source_id))) {
      return toast.error('Choose an eligible transaction from the designated-account bank feed.');
    }
    setBusy(true);
    try {
      await api.post('/property-lifecycle/project-finance/allocations', {
        site_id: siteId,
        ...form,
        rera_project_id: project.id,
        rera_project_phase_id: phaseId === 'all' ? null : phaseId,
        amount: form.allocation_method === 'DIRECT' ? undefined : form.amount,
        percentage: form.allocation_method === 'PERCENTAGE' ? form.percentage : undefined,
      });
      toast.success(isReraProfile
        ? `Selected designated-account transaction linked to ${project.name}.`
        : `Source ${form.source_module} #${form.source_id} linked to ${project.name}.`);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Source transaction could not be linked.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-[600px]">
        <SheetHeader className="border-b border-slate-200 px-6 py-5">
          <SheetTitle>Link an existing transaction</SheetTitle>
          <SheetDescription>The original accounting row remains authoritative; this only adds project/phase context.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {isReraProfile ? (
            <Field label="Eligible designated-account transaction">
              <Select
                value={form.source_id || 'none'}
                onValueChange={(value) => setForm((current) => ({ ...current, source_id: value === 'none' ? '' : value }))}
                disabled={transactionsLoading || Boolean(transactionsError)}
              >
                <SelectTrigger><SelectValue placeholder={transactionsLoading ? 'Loading eligible transactions…' : 'Choose a bank transaction'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Choose a bank transaction</SelectItem>
                  {eligibleTransactions.map((transaction) => (
                    <SelectItem key={transaction.id} value={String(transaction.id)}>{bankTransactionLabel(transaction)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {transactionsError && <p className="mt-1 text-xs text-red-600">{transactionsError}</p>}
              {!transactionsLoading && !transactionsError && !eligibleTransactions.length && (
                <p className="mt-1 text-xs text-amber-700">No eligible transaction is available in the selected project and phase.</p>
              )}
            </Field>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Source module">
                <Select value={form.source_module} onValueChange={(value) => setForm((current) => ({ ...current, source_module: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['EXPENSE', 'VENDOR_PAYMENT', 'FARMER_PAYMENT', 'FIRM_TRANSACTION', 'DAY_BOOK'].map((value) => <SelectItem key={value} value={value}>{title(value)}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Source transaction ID"><Input inputMode="numeric" value={form.source_id} onChange={(event) => setForm((current) => ({ ...current, source_id: event.target.value }))} /></Field>
            </div>
          )}
          <Field label="How should it be linked?">
            <Select value={form.allocation_method} onValueChange={(value) => setForm((current) => ({ ...current, allocation_method: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DIRECT">Entire transaction</SelectItem>
                <SelectItem value="AMOUNT">Specific amount</SelectItem>
                <SelectItem value="PERCENTAGE">Percentage</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {form.allocation_method !== 'DIRECT' && (
            <div className="grid gap-4 sm:grid-cols-2">
              {form.allocation_method === 'PERCENTAGE' && <Field label="Percentage"><Input type="number" min="0.0001" max="100" step="0.0001" value={form.percentage} onChange={(event) => setForm((current) => ({ ...current, percentage: event.target.value }))} /></Field>}
              <Field label="Amount"><Input type="number" min="0" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} disabled={form.allocation_method === 'PERCENTAGE'} placeholder={form.allocation_method === 'PERCENTAGE' ? 'Calculated by server' : ''} /></Field>
            </div>
          )}
          <Field label="Reason"><Textarea value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Why this original transaction belongs to this project or phase" /></Field>
        </div>
        <SheetFooter className="border-t border-slate-200 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || transactionsLoading || (isReraProfile && (!eligibleTransactions.length || Boolean(transactionsError)))}>{busy ? 'Linking…' : 'Link transaction'}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ProjectSetup({ projects, canCreateProject, onOpenSetup, onCreateProject, projectTerm }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]">
      <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-5 sm:px-7">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white"><Building2 className="h-5 w-5" /></div>
        <h2 className="mt-4 text-lg font-semibold tracking-tight text-slate-950">{projects.length ? `Choose a ${projectTerm} to begin` : `Set up your first ${projectTerm}`}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">Project Finance reads the existing collections, expenses and bank activity. It does not create a second accounting system.</p>
      </div>
      <div className="grid divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {[
          ['1', `Create ${projectTerm}`, `Record the ${projectTerm.toLowerCase()} name, internal code, shape and development basis in Project Setup.`],
          ['2', 'Add phases only if needed', 'Use phases only when the project is managed phase-wise.'],
          ['3', 'Return to Project Finance', `Choose the ${projectTerm.toLowerCase()} here to see existing collections and costs in one view.`],
        ].map(([number, heading, description]) => (
          <div key={number} className="px-5 py-5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Step {number}</span>
            <p className="mt-2 text-sm font-semibold text-slate-800">{heading}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-slate-200 px-5 py-4 sm:px-7">
        <Button variant="outline" onClick={onOpenSetup}>Open {projectTerm} setup <ArrowRight className="ml-1.5 h-4 w-4" /></Button>
        {canCreateProject && <Button onClick={onCreateProject}><Plus className="mr-1.5 h-4 w-4" />Create {projectTerm}</Button>}
      </div>
    </section>
  );
}

export default function ProjectFinance() {
  const navigate = useNavigate();
  const { currentSite, user, hasPermission } = useAuth();
  const sitePolicy = useSitePolicy();
  const { canUseCapability, getTerm } = sitePolicy;
  const financePaymentPolicy = getFinancePaymentPolicy(sitePolicy);
  const siteId = currentSite?.id;
  const isReraProfile = isReraOperatingProfile(sitePolicy);
  const isReraWorkspace = isReraProfile || canUseCapability('rera_workspace');
  const projectTerm = getTerm('project', isReraWorkspace ? 'RERA Project' : 'Development Project');
  const boot = cache.get(bootKeyOf(siteId));
  const [projects, setProjects] = useState(boot?.projects || []);
  const [firms, setFirms] = useState(boot?.firms || []);
  const [bankAccounts, setBankAccounts] = useState(boot?.bankAccounts || []);
  const [projectId, setProjectId] = useState(boot?.selected || '');
  const [phaseId, setPhaseId] = useState('all');
  const [tab, setTab] = useState('collections');
  const [ready, setReady] = useState(Boolean(boot));
  const [loadedSiteId, setLoadedSiteId] = useState(boot ? String(siteId) : '');
  const [data, setData] = useState(() => cache.get(dataKeyOf(siteId, boot?.selected || '', 'all')) || EMPTY);
  const [loading, setLoading] = useState(!cache.has(dataKeyOf(siteId, boot?.selected || '', 'all')));
  const [error, setError] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [allocationOpen, setAllocationOpen] = useState(false);
  const canUpdate = hasPermission('plot_payments', 'update');
  const canCreateProject = hasPermission('rera_projects', 'write');
  const isAdmin = ['admin', 'super_admin'].includes(user?.role);
  const project = projects.find((item) => String(item.id) === String(projectId));
  const phases = project?.phases || [];
  const projectSetupPath = '/rera?tab=projects-phases';
  const createProjectPath = '/rera?tab=projects-phases&create=project';

  useEffect(() => {
    setPhaseId('all');
    setAccountOpen(false);
    setAllocationOpen(false);
    if (!siteId) {
      setProjects([]);
      setFirms([]);
      setBankAccounts([]);
      setProjectId('');
      setLoadedSiteId('');
      setReady(true);
      setLoading(false);
      return undefined;
    }
    const cached = cache.get(bootKeyOf(siteId));
    if (cached) {
      setProjects(cached.projects);
      setFirms(cached.firms);
      setBankAccounts(cached.bankAccounts || []);
      setProjectId((current) => (cached.projects.some((row) => String(row.id) === String(current))
        ? current
        : (cached.selected || (cached.projects[0]?.id ? String(cached.projects[0].id) : ''))));
      setLoadedSiteId(String(siteId));
      setReady(true);
    } else {
      setProjects([]);
      setFirms([]);
      setBankAccounts([]);
      setProjectId('');
      setLoadedSiteId('');
      setReady(false);
      setLoading(true);
    }
    let alive = true;
    Promise.allSettled([
      // projects_only skips the control centre's per-project workspace queries;
      // this page needs nothing but the project list and its phases.
      api.get('/rera/control-centre', { params: { site_id: siteId, projects_only: 1 } }),
      api.get('/firms', { params: { site_id: siteId } }),
      api.get('/bank-accounts', { params: { site_id: siteId } }),
    ]).then(([projectResult, firmResult, bankAccountResult]) => {
      if (!alive) return;
      const rows = projectResult.status === 'fulfilled' ? (projectResult.value.data.projects || []) : (cached?.projects || []);
      const firmRows = firmResult.status === 'fulfilled' ? (firmResult.value.data.firms || []) : (cached?.firms || []);
      const bankAccountRows = bankAccountResult.status === 'fulfilled' ? (bankAccountResult.value.data.accounts || []) : (cached?.bankAccounts || []);
      setProjects(rows);
      setFirms(firmRows);
      setBankAccounts(bankAccountRows);
      // A project carried over from another Site would 404 the finance request.
      setProjectId((current) => (rows.some((row) => String(row.id) === String(current))
        ? current
        : (rows[0]?.id ? String(rows[0].id) : '')));
      setLoadedSiteId(String(siteId));
      setReady(true);
    });
    return () => { alive = false; };
  }, [siteId]);

  useEffect(() => {
    if (siteId && ready && loadedSiteId === String(siteId)) {
      cache.set(bootKeyOf(siteId), { projects, firms, bankAccounts, selected: projectId });
    }
  }, [bankAccounts, firms, loadedSiteId, projectId, projects, ready, siteId]);

  const financeRequest = useRef(0);
  const load = useCallback(async () => {
    if (!siteId || !projectId || !ready || loadedSiteId !== String(siteId)) {
      if (ready) setLoading(false);
      return;
    }
    const sequence = ++financeRequest.current;
    const key = dataKeyOf(siteId, projectId, phaseId);
    const cached = cache.get(key);
    setError('');
    // Keep the last good view on screen while revalidating; only an uncached
    // combination is allowed to fall back to skeletons.
    setData(cached || EMPTY);
    setLoading(!cached);
    try {
      const { data: response } = await api.get('/property-lifecycle/project-finance', {
        params: { site_id: siteId, project_id: projectId, ...(phaseId !== 'all' ? { phase_id: phaseId } : {}) },
      });
      if (sequence !== financeRequest.current) return;
      cache.set(key, response);
      setData(response);
    } catch (requestError) {
      if (sequence !== financeRequest.current) return;
      setError(requestError.response?.data?.message || 'Project Finance could not be loaded.');
    } finally {
      if (sequence === financeRequest.current) setLoading(false);
    }
  }, [loadedSiteId, phaseId, projectId, ready, siteId]);

  useEffect(() => {
    load();
    return () => {
      financeRequest.current += 1;
    };
  }, [load]);

  // A write invalidates more than the current project/phase view, so drop every view.
  const reload = useCallback(() => {
    cache.forEach((_, key) => { if (key.startsWith('pf:data:')) cache.delete(key); });
    load();
  }, [load]);
  const busy = loading || !ready;

  const metrics = useMemo(() => [
    ['Booked', data.metrics?.booked],
    ['Collected', data.metrics?.collected],
    ['Project costs', data.metrics?.project_cost],
    ['To collect', data.metrics?.receivable],
    ['Overdue', data.metrics?.overdue],
    ['Unassigned costs', data.metrics?.unassigned_cost],
    ['Unmatched', data.metrics?.unreconciled],
  ], [data.metrics]);
  const accountRows = bankAccounts.length ? bankAccounts : (data.accounts || []);
  const costRows = useMemo(() => [
    ...(data.expenses || []).map((row) => ({ ...row, project_scope: row.project_scope || 'PROJECT' })),
    ...(data.unassigned_expenses || []),
  ], [data.expenses, data.unassigned_expenses]);
  const tabs = [
    ['collections', 'Collections', data.collections?.length],
    ['expenses', 'Costs', costRows.length],
    ['accounts', 'Accounts', accountRows.length],
    ['allocations', 'Source links', data.allocations?.length],
    ...(isReraProfile ? [['rera-funds', 'RERA fund controls', null]] : []),
  ];

  useEffect(() => {
    if (!isReraProfile && tab === 'rera-funds') setTab('collections');
  }, [isReraProfile, tab]);
  return (
    <div className="min-h-full bg-slate-50/50">
      <div className="mx-auto max-w-[1640px] px-4 py-5 sm:px-6">
        <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <button onClick={() => navigate('/customer-inventory')} className="mb-2 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900">
              <ArrowLeft className="h-3.5 w-3.5" />Customer & inventory
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Project finance</h1>
              <Badge variant="outline" className={financePaymentPolicy.bankOnly
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-600'}>
                {financePaymentPolicy.bankOnly ? 'Bank-only entry' : 'All payment modes'}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">Select one {projectTerm.toLowerCase()} to see its existing customer collections, costs and linked accounts.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => navigate(projectSetupPath)}>
              <Building2 className="mr-1.5 h-4 w-4" />{projectTerm} setup
            </Button>
            <Select value={projectId || 'none'} onValueChange={(value) => { setProjectId(value === 'none' ? '' : value); setPhaseId('all'); }}>
              <SelectTrigger className="w-[240px] bg-white"><SelectValue placeholder={`Choose ${projectTerm}`} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Choose {projectTerm}</SelectItem>
                {projects.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={phaseId} onValueChange={setPhaseId} disabled={!project}>
              <SelectTrigger className="w-[170px] bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All phases</SelectItem>
                {phases.map((phase) => <SelectItem key={phase.id} value={String(phase.id)}>{phase.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={reload} aria-label="Refresh">
              <RefreshCw className={cn('h-4 w-4', busy && 'animate-spin motion-reduce:animate-none')} />
            </Button>
          </div>
        </header>

        {isReraProfile && (
          <div className="mb-5 overflow-hidden rounded-xl">
            <ReraWorkflowNotice
              policy={sitePolicy}
              area="finance"
              actions={[{ label: 'RERA project workspace', href: projectSetupPath }]}
            />
          </div>
        )}

        {ready && !projectId ? (
          <ProjectSetup
            projects={projects}
            canCreateProject={canCreateProject}
            onOpenSetup={() => navigate(projectSetupPath)}
            onCreateProject={() => navigate(createProjectPath)}
            projectTerm={projectTerm}
          />
        ) : (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]">
            <div className="flex flex-wrap border-b border-slate-200">
              {metrics.map(([label, value], index) => (
                <div key={label} className={cn('min-w-[150px] flex-1 px-5 py-3', index && 'border-l border-slate-100')}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400">{label}</p>
                  {busy ? <Skeleton className="mt-1 h-5 w-24" /> : <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-950">{currency(value)}</p>}
                </div>
              ))}
            </div>
            <div className="flex flex-col border-b border-slate-200 px-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-5 overflow-x-auto">
                {tabs.map(([value, label, count]) => (
                  <button key={value} onClick={() => setTab(value)} className={cn('border-b-2 py-3 text-xs font-medium transition-colors', tab === value ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-900')}>
                    {label}{count !== null && <span className="ml-1 tabular-nums text-slate-400">{count || 0}</span>}
                  </button>
                ))}
              </div>
              <div className="py-2 sm:py-0">
                {tab === 'accounts' && canUpdate && (bankAccounts.length
                  ? <Button size="sm" variant="outline" onClick={() => navigate('/bank-configs')}><Banknote className="mr-1.5 h-3.5 w-3.5" />Manage bank accounts</Button>
                  : <Button size="sm" variant="outline" onClick={() => setAccountOpen(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />Map account</Button>)}
                {tab === 'allocations' && isAdmin && canUpdate && <Button size="sm" variant="outline" onClick={() => setAllocationOpen(true)}><Link2 className="mr-1.5 h-3.5 w-3.5" />Link transaction</Button>}
              </div>
            </div>

            {error ? (
              <div className="py-20 text-center">
                <p className="text-sm font-semibold text-red-700">Project Finance is unavailable</p>
                <p className="mt-1 text-xs text-slate-500">{error}</p>
                <Button className="mt-4" variant="outline" size="sm" onClick={reload}>Try again</Button>
              </div>
            ) : busy ? (
              <div className="space-y-px">{Array.from({ length: 7 }).map((_, index) => <div key={index} className="grid grid-cols-5 gap-5 border-b border-slate-100 px-4 py-3"><Skeleton className="h-8 w-36" /><Skeleton className="h-8 w-28" /><Skeleton className="h-8 w-32" /><Skeleton className="h-8 w-24" /><Skeleton className="h-8 w-20" /></div>)}</div>
            ) : tab === 'collections' ? (
              <Table>
                <TableHeader className="sticky top-0 bg-slate-50"><TableRow><TableHead>Receipt</TableHead><TableHead>Customer / Property</TableHead><TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead>Amount</TableHead><TableHead>Bank match</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.collections.length ? data.collections.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell><p className="font-medium text-slate-800">{row.receipt_no || ('Payment #' + row.id)}</p><p className="text-[10px] text-slate-400">{row.booking_no}</p></TableCell>
                      <TableCell><p className="text-sm font-medium text-slate-800">{row.customer_name || 'Customer'}</p><p className="text-[10px] text-slate-400">Plot {row.plot_no}</p></TableCell>
                      <TableCell className="text-xs">{date(row.date)}</TableCell>
                      <TableCell className="text-xs">{title(row.payment_type)}</TableCell>
                      <TableCell className="font-semibold tabular-nums">{currency(row.amount)}</TableCell>
                      <TableCell><Badge variant="outline" className={row.reconciliation_status === 'MATCHED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>{title(row.reconciliation_status)}</Badge></TableCell>
                    </TableRow>
                  )) : <Empty>No customer collections are mapped to this project and phase yet.</Empty>}
                </TableBody>
              </Table>
            ) : tab === 'expenses' ? (
              <Table>
                <TableHeader><TableRow><TableHead>Cost</TableHead><TableHead>Date</TableHead><TableHead>Scope</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {costRows.length ? costRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell><p className="font-medium text-slate-800">{row.description || ('Expense #' + row.id)}</p><p className="text-[10px] text-slate-400">Existing expense #{row.id}</p></TableCell>
                      <TableCell>{date(row.date)}</TableCell>
                      <TableCell><Badge variant="outline" className={row.project_scope === 'UNASSIGNED' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-blue-200 bg-blue-50 text-blue-700'}>{row.project_scope === 'UNASSIGNED' ? 'Needs project tag' : 'Project cost'}</Badge></TableCell>
                      <TableCell><Badge variant="outline">{title(row.status)}</Badge></TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{currency(Math.max(Number(row.amount || 0), Number(row.credit || 0)))}</TableCell>
                    </TableRow>
                  )) : <Empty>No costs are available for this Site yet.</Empty>}
                </TableBody>
              </Table>
            ) : tab === 'accounts' ? (
              <Table>
                <TableHeader><TableRow><TableHead>Bank account</TableHead><TableHead>Type</TableHead><TableHead>Activity</TableHead><TableHead>Balance</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {accountRows.length ? accountRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell><p className="font-medium text-slate-800">{row.label || row.firm_name || 'Bank account'}</p><p className="text-[10px] text-slate-400">{row.bank_name || 'Bank'} · {row.masked_account_no || row.account_number || 'Account number not recorded'}</p></TableCell>
                      <TableCell>{title(row.account_type || row.bank_account_type || 'BANK')}</TableCell>
                      <TableCell>{Number(row.transaction_count || 0).toLocaleString('en-IN')} transactions</TableCell>
                      <TableCell className="font-semibold tabular-nums">{currency(row.ledger_balance)}</TableCell>
                      <TableCell><Badge variant="outline" className={row.is_active === false ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}>{row.is_active === false ? 'Inactive' : 'Active'}</Badge></TableCell>
                      <TableCell className="text-right">{row.id && bankAccounts.length > 0 && <Button variant="ghost" size="sm" onClick={() => navigate(`/bank-configs/${row.id}`)}>Open</Button>}</TableCell>
                    </TableRow>
                  )) : <Empty>No bank accounts are configured for this Site yet.</Empty>}
                </TableBody>
              </Table>
            ) : tab === 'allocations' ? (
              <Table>
                <TableHeader><TableRow><TableHead>Source</TableHead><TableHead>Method</TableHead><TableHead>Phase</TableHead><TableHead>Reason</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.allocations.length ? data.allocations.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell><p className="font-medium text-slate-800">{title(row.source_module)}</p><p className="text-[10px] text-slate-400">Transaction #{row.source_id}</p></TableCell>
                      <TableCell>{title(row.allocation_method)}{row.percentage ? (' · ' + row.percentage + '%') : ''}</TableCell>
                      <TableCell>{row.rera_project_phase_id ? phases.find((phase) => String(phase.id) === String(row.rera_project_phase_id))?.name || ('Phase #' + row.rera_project_phase_id) : 'All phases'}</TableCell>
                      <TableCell className="max-w-[320px] truncate text-xs text-slate-600">{row.reason}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{currency(row.amount)}</TableCell>
                    </TableRow>
                  )) : <Empty>No source transactions are linked to this project or phase.</Empty>}
                </TableBody>
              </Table>
            ) : (
              <Suspense fallback={<div className="space-y-px">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-14 w-full rounded-none" />)}</div>}>
                <ReraFundControls
                  siteId={siteId}
                  project={project}
                  phaseId={phaseId}
                  collections={data.collections || []}
                  evidenceDocuments={data.evidence_documents || []}
                  canUpdate={canUpdate}
                  isAdmin={isAdmin}
                  onFinanceReload={reload}
                />
              </Suspense>
            )}
          </section>
        )}
        <AccountSheet open={accountOpen} onOpenChange={setAccountOpen} siteId={siteId} project={project} phaseId={phaseId} firms={firms} evidenceDocuments={data.evidence_documents || []} isReraProfile={isReraProfile} onSaved={reload} />
        <AllocationSheet open={allocationOpen} onOpenChange={setAllocationOpen} siteId={siteId} project={project} phaseId={phaseId} isReraProfile={isReraProfile} onSaved={reload} />
      </div>
    </div>
  );
}
