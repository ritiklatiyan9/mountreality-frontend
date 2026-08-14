import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowRight, FileCheck2, Landmark, Loader2,
  Plus, RefreshCw, ShieldCheck, WalletCards,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/api/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import EvidenceDocumentSelect from '@/components/project-finance/EvidenceDocumentSelect';

const EMPTY = Object.freeze({
  policy: null,
  project: null,
  reserve: null,
  withdrawals: null,
  designated_accounts: [],
  deposit_allocations: [],
  withdrawal_requests: [],
  evidence_documents: [],
});

const complianceCache = new Map();
const cacheKey = (siteId, projectId, phaseId) => `rera-funds:${siteId}:${projectId}:${phaseId || 'all'}`;
const today = () => new Date().toISOString().slice(0, 10);
const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const readable = (value) => String(value || 'Not set')
  .replaceAll('_', ' ')
  .toLowerCase()
  .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
const date = (value) => value
  ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
  : '—';
const optionalId = (value) => (String(value || '').trim() ? Number(value) : null);
const isPositiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) > 0;
const accountMatchesPhase = (account, selectedPhaseId) => (
  selectedPhaseId
    ? (!account.rera_project_phase_id || String(account.rera_project_phase_id) === String(selectedPhaseId))
    : !account.rera_project_phase_id
);
const idempotencyKey = (prefix) => (
  globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
);

function Field({ label, hint, required = false, children }) {
  return (
    <label className="block space-y-1.5">
      <Label className="text-xs font-medium text-slate-700">{label}{required && <span className="ml-1 text-red-500">*</span>}</Label>
      {children}
      {hint && <span className="block text-[10px] leading-relaxed text-slate-400">{hint}</span>}
    </label>
  );
}

const transactionMatchesAccount = (transaction, account) => {
  if (!account) return false;
  if (transaction.project_account_mapping_id) {
    return String(transaction.project_account_mapping_id) === String(account.id);
  }
  const firmId = transaction.firm_id ?? transaction.account_firm_id
    ?? transaction.account_id ?? transaction.bank_account_id;
  return firmId && String(firmId) === String(account.firm_id);
};

const bankTransactionLabel = (transaction) => {
  const occurredAt = transaction.date || transaction.transaction_date || transaction.created_at;
  const amount = transaction.amount ?? transaction.credit ?? transaction.debit;
  const reference = transaction.reference || transaction.transaction_reference
    || transaction.narration || transaction.remarks || transaction.particular;
  return [occurredAt ? date(occurredAt) : null, money(amount), reference].filter(Boolean).join(' · ');
};

function BankTransactionField({ label, value, onChange, transactions, required = false, kind }) {
  if (!Array.isArray(transactions)) {
    return (
      <Field label={`${label} transaction ID`} required={required} hint="A readable bank selector will replace this fallback when the bank feed exposes eligible transactions.">
        <Input inputMode="numeric" value={value || ''} onChange={(event) => onChange(event.target.value)} />
      </Field>
    );
  }
  const placeholder = `Choose eligible bank ${kind}`;
  return (
    <Field label={label} required={required} hint={`Only approved ${kind}s from the selected designated account are shown.`}>
      <Select value={value ? String(value) : 'none'} onValueChange={(next) => onChange(next === 'none' ? '' : next)}>
        <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{placeholder}</SelectItem>
          {transactions.map((transaction) => (
            <SelectItem key={transaction.id} value={String(transaction.id)}>{bankTransactionLabel(transaction)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!transactions.length && <p className="text-[10px] text-amber-700">No eligible bank {kind} is available for this designated account.</p>}
    </Field>
  );
}

function Status({ value }) {
  const status = String(value || '').toUpperCase();
  const className = status === 'VERIFIED' || status === 'POSTED' || status === 'APPROVED'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : status === 'REJECTED'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-amber-200 bg-amber-50 text-amber-700';
  return <Badge variant="outline" className={`text-[10px] ${className}`}>{readable(status)}</Badge>;
}

function DepositSheet({ open, onOpenChange, siteId, project, phaseId, accounts, collections, allocations, evidenceDocuments, bankCredits, onSaved }) {
  const allocatedByPayment = useMemo(() => allocations.reduce((totals, row) => {
    if (String(row.status).toUpperCase() === 'REJECTED') return totals;
    const key = String(row.plot_payment_id);
    totals[key] = (totals[key] || 0) + Number(row.amount || 0);
    return totals;
  }, {}), [allocations]);
  const eligibleCollections = useMemo(() => collections.map((row) => {
    const serverRemaining = Number(row.remaining_for_deposit);
    return {
      ...row,
      remaining_for_deposit: Math.max(
        0,
        Number.isFinite(serverRemaining)
          ? serverRemaining
          : Number(row.amount || 0) - Number(allocatedByPayment[String(row.id)] || 0),
      ),
    };
  }).filter((row) => row.remaining_for_deposit > 0.005), [allocatedByPayment, collections]);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const selectedCollection = eligibleCollections.find((row) => String(row.id) === String(form.plot_payment_id));
  const selectedPhaseId = selectedCollection?.rera_project_phase_id
    ?? (phaseId === 'all' ? null : phaseId);
  const eligibleAccounts = accounts.filter((account) => accountMatchesPhase(account, selectedPhaseId));
  const selectedAccount = eligibleAccounts.find((account) => String(account.id) === String(form.project_account_mapping_id));
  const eligibleBankCredits = Array.isArray(bankCredits)
    ? bankCredits.filter((transaction) => transactionMatchesAccount(transaction, selectedAccount))
    : null;

  useEffect(() => {
    if (!open) return;
    setForm({
      plot_payment_id: '', project_account_mapping_id: accounts[0]?.id ? String(accounts[0].id) : '',
      amount: '', deposit_date: today(), firm_transaction_id: '', evidence_document_id: '',
      deposit_reference: '', idempotency_key: idempotencyKey('rera-deposit'),
    });
  }, [accounts, open]);

  const chooseCollection = (value) => {
    const collection = eligibleCollections.find((row) => String(row.id) === String(value));
    const collectionPhase = collection?.rera_project_phase_id ?? (phaseId === 'all' ? null : phaseId);
    const matchingAccount = accounts.find((account) => accountMatchesPhase(account, collectionPhase));
    setForm((current) => ({
      ...current,
      plot_payment_id: value,
      amount: collection ? String(collection.remaining_for_deposit) : '',
      project_account_mapping_id: matchingAccount?.id ? String(matchingAccount.id) : '',
    }));
  };

  const submit = async () => {
    if (!selectedCollection || !form.project_account_mapping_id || Number(form.amount) <= 0) {
      return toast.error('Select a customer receipt, designated account and deposit amount.');
    }
    if (!form.deposit_date) return toast.error('Choose the separate-account deposit date.');
    if (Number(form.amount) > Number(selectedCollection.remaining_for_deposit) + 0.005) {
      return toast.error('Deposit amount cannot exceed the unallocated receipt balance.');
    }
    if (form.firm_transaction_id && !isPositiveInteger(form.firm_transaction_id)) {
      return toast.error('Bank credit transaction ID must be a positive whole number.');
    }
    if (form.evidence_document_id && !isPositiveInteger(form.evidence_document_id)) {
      return toast.error('Choose a valid deposit evidence document.');
    }
    if (!form.firm_transaction_id && !form.evidence_document_id && !(form.deposit_reference || '').trim()) {
      return toast.error('Link a bank credit, evidence document, or deposit reference.');
    }
    setBusy(true);
    try {
      await api.post('/property-lifecycle/project-finance/rera/deposits', {
        site_id: siteId,
        rera_project_id: project.id,
        rera_project_phase_id: selectedPhaseId ? Number(selectedPhaseId) : null,
        plot_payment_id: Number(form.plot_payment_id),
        project_account_mapping_id: Number(form.project_account_mapping_id),
        amount: Number(form.amount),
        deposit_date: form.deposit_date,
        firm_transaction_id: optionalId(form.firm_transaction_id),
        evidence_document_id: optionalId(form.evidence_document_id),
        deposit_reference: (form.deposit_reference || '').trim() || null,
        idempotency_key: form.idempotency_key,
      });
      toast.success(form.firm_transaction_id ? 'Deposit linked and system-verified.' : 'Deposit recorded for administrator review.');
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error.response?.data?.message || 'RERA separate-account deposit could not be recorded.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-[620px]">
        <SheetHeader className="border-b border-slate-200 px-6 py-5">
          <SheetTitle>Record separate-account deposit</SheetTitle>
          <SheetDescription>Map one approved customer receipt to a reviewed RERA designated account. The source receipt remains authoritative.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <Field label="Customer receipt" required>
            <Select value={form.plot_payment_id || 'none'} onValueChange={chooseCollection}>
              <SelectTrigger><SelectValue placeholder="Choose receipt" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none" disabled>Choose receipt</SelectItem>
                {eligibleCollections.map((row) => (
                  <SelectItem key={row.id} value={String(row.id)}>
                    {row.receipt_no || `Payment #${row.id}`} · Plot {row.plot_no || '—'} · {money(row.remaining_for_deposit)} available
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {!eligibleCollections.length && <p className="border-y border-amber-100 bg-amber-50/60 px-3 py-2 text-xs text-amber-700">No unallocated approved collection is available in this project scope.</p>}
          <Field label="Reviewed designated account" required>
            <Select value={form.project_account_mapping_id || 'none'} onValueChange={(value) => setForm((current) => ({ ...current, project_account_mapping_id: value }))}>
              <SelectTrigger><SelectValue placeholder="Choose account" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none" disabled>Choose account</SelectItem>
                {eligibleAccounts.map((account) => <SelectItem key={account.id} value={String(account.id)}>{account.firm_name} · {account.account_number || account.bank_name || 'Account'}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Deposit amount" required hint={selectedCollection ? `Maximum from this receipt: ${money(selectedCollection.remaining_for_deposit)}` : null}>
              <Input type="number" min="0.01" step="0.01" value={form.amount || ''} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
            </Field>
            <Field label="Deposit date" required><Input type="date" value={form.deposit_date || ''} onChange={(event) => setForm((current) => ({ ...current, deposit_date: event.target.value }))} /></Field>
          </div>
          <div className="border-y border-slate-100 py-4">
            <p className="mb-3 text-xs font-semibold text-slate-700">Verification evidence</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <BankTransactionField label="Bank credit" kind="credit" value={form.firm_transaction_id} onChange={(value) => setForm((current) => ({ ...current, firm_transaction_id: value }))} transactions={eligibleBankCredits} />
              <EvidenceDocumentSelect
                label="Deposit evidence"
                value={form.evidence_document_id}
                onChange={(value) => setForm((current) => ({ ...current, evidence_document_id: value }))}
                documents={evidenceDocuments}
                placeholder="Choose deposit slip or bank proof"
              />
            </div>
            <Field label="Deposit reference" hint="Required when no bank transaction or evidence document is linked.">
              <Input className="mt-4" value={form.deposit_reference || ''} onChange={(event) => setForm((current) => ({ ...current, deposit_reference: event.target.value }))} placeholder="UTR, deposit slip, or bank reference" />
            </Field>
          </div>
        </div>
        <SheetFooter className="border-t border-slate-200 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !eligibleCollections.length}>{busy ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Recording…</> : 'Record deposit'}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function WithdrawalSheet({ open, onOpenChange, siteId, project, phaseId, accounts, available, evidenceDocuments, onSaved }) {
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setForm({
      project_account_mapping_id: accounts[0]?.id ? String(accounts[0].id) : '',
      amount: '', certified_eligible_amount: '', completion_percentage: '', requested_date: today(),
      purpose: '', engineer_document_id: '', architect_document_id: '', ca_document_id: '',
      idempotency_key: idempotencyKey('rera-withdrawal'),
    });
  }, [accounts, open]);

  const submit = async () => {
    const documentIds = [form.engineer_document_id, form.architect_document_id, form.ca_document_id]
      .map((value) => String(value || '').trim());
    if (!form.project_account_mapping_id || Number(form.amount) <= 0 || Number(form.certified_eligible_amount) <= 0 || !form.purpose?.trim()) {
      return toast.error('Complete the account, certified amount, withdrawal amount and purpose.');
    }
    if (!form.requested_date) return toast.error('Choose the certified-withdrawal request date.');
    if (Number(form.amount) > Number(form.certified_eligible_amount) + 0.005) {
      return toast.error('Withdrawal amount cannot exceed the certified eligible amount.');
    }
    if (Number(form.amount) > Number(available) + 0.005) {
      return toast.error('Withdrawal amount cannot exceed the verified, unreserved balance.');
    }
    if (!Number.isFinite(Number(form.completion_percentage)) || Number(form.completion_percentage) <= 0 || Number(form.completion_percentage) > 100) {
      return toast.error('Completion percentage must be greater than 0 and at most 100.');
    }
    if (documentIds.some((value) => !isPositiveInteger(value)) || new Set(documentIds).size !== 3) {
      return toast.error('Link three separate engineer, architect and CA certificate documents.');
    }
    setBusy(true);
    try {
      await api.post('/property-lifecycle/project-finance/rera/withdrawals', {
        site_id: siteId,
        rera_project_id: project.id,
        rera_project_phase_id: phaseId === 'all' ? null : Number(phaseId),
        project_account_mapping_id: Number(form.project_account_mapping_id),
        amount: Number(form.amount),
        certified_eligible_amount: Number(form.certified_eligible_amount),
        completion_percentage: Number(form.completion_percentage),
        requested_date: form.requested_date,
        purpose: form.purpose.trim(),
        engineer_document_id: Number(form.engineer_document_id),
        architect_document_id: Number(form.architect_document_id),
        ca_document_id: Number(form.ca_document_id),
        idempotency_key: form.idempotency_key,
      });
      toast.success('Certified withdrawal sent for administrator review.');
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error.response?.data?.message || 'RERA withdrawal request could not be created.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-[660px]">
        <SheetHeader className="border-b border-slate-200 px-6 py-5">
          <SheetTitle>Request certified withdrawal</SheetTitle>
          <SheetDescription>Available verified reserve: {money(available)}. Approval does not post a bank debit; posting is a separate controlled step.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <Field label="Reviewed designated account" required>
            <Select value={form.project_account_mapping_id || 'none'} onValueChange={(value) => setForm((current) => ({ ...current, project_account_mapping_id: value }))}>
              <SelectTrigger><SelectValue placeholder="Choose account" /></SelectTrigger>
              <SelectContent><SelectItem value="none" disabled>Choose account</SelectItem>{accounts.map((account) => <SelectItem key={account.id} value={String(account.id)}>{account.firm_name} · {account.account_number || account.bank_name || 'Account'}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Certified eligible amount" required><Input type="number" min="0.01" step="0.01" value={form.certified_eligible_amount || ''} onChange={(event) => setForm((current) => ({ ...current, certified_eligible_amount: event.target.value }))} /></Field>
            <Field label="Withdrawal amount" required hint={`Cannot exceed ${money(available)} verified reserve.`}><Input type="number" min="0.01" max={available || undefined} step="0.01" value={form.amount || ''} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} /></Field>
            <Field label="Completion percentage" required><Input type="number" min="0.01" max="100" step="0.01" value={form.completion_percentage || ''} onChange={(event) => setForm((current) => ({ ...current, completion_percentage: event.target.value }))} /></Field>
            <Field label="Request date" required><Input type="date" value={form.requested_date || ''} onChange={(event) => setForm((current) => ({ ...current, requested_date: event.target.value }))} /></Field>
          </div>
          <Field label="Withdrawal purpose" required><Textarea rows={3} value={form.purpose || ''} onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))} placeholder="Project cost and certified work context" /></Field>
          <div className="border-y border-slate-100 py-4">
            <div className="mb-3 flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-blue-600" /><p className="text-xs font-semibold text-slate-700">Three-certificate evidence</p></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <EvidenceDocumentSelect label="Engineer certificate" required value={form.engineer_document_id} onChange={(value) => setForm((current) => ({ ...current, engineer_document_id: value }))} documents={evidenceDocuments} placeholder="Choose engineer certificate" />
              <EvidenceDocumentSelect label="Architect certificate" required value={form.architect_document_id} onChange={(value) => setForm((current) => ({ ...current, architect_document_id: value }))} documents={evidenceDocuments} placeholder="Choose architect certificate" />
              <EvidenceDocumentSelect label="CA certificate" required value={form.ca_document_id} onChange={(value) => setForm((current) => ({ ...current, ca_document_id: value }))} documents={evidenceDocuments} placeholder="Choose CA certificate" />
            </div>
          </div>
        </div>
        <SheetFooter className="border-t border-slate-200 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !accounts.length || available <= 0}>{busy ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Requesting…</> : 'Request withdrawal'}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function DecisionSheet({ action, onOpenChange, siteId, accounts, bankDebits, onSaved }) {
  const [notes, setNotes] = useState('');
  const [bankTransactionId, setBankTransactionId] = useState('');
  const [busy, setBusy] = useState(false);
  const open = Boolean(action);
  useEffect(() => { if (open) { setNotes(''); setBankTransactionId(''); } }, [open, action]);
  if (!action) return null;
  const posting = action.kind === 'withdrawal-post';
  const noun = action.kind.startsWith('deposit') ? 'deposit' : 'withdrawal';
  const selectedAccount = accounts.find((account) => String(account.id) === String(action.item.project_account_mapping_id));
  const eligibleBankDebits = Array.isArray(bankDebits)
    ? bankDebits.filter((transaction) => transactionMatchesAccount(transaction, selectedAccount))
    : null;

  const submit = async () => {
    if (posting && !isPositiveInteger(bankTransactionId)) return toast.error('Enter a valid designated-account bank debit transaction ID.');
    if (!posting && !notes.trim()) return toast.error('Add review notes for the audit trail.');
    setBusy(true);
    try {
      if (posting) {
        await api.post(`/property-lifecycle/project-finance/rera/withdrawals/${action.item.id}/post`, {
          site_id: siteId, firm_transaction_id: Number(bankTransactionId),
        });
      } else {
        const resource = action.kind === 'deposit-review' ? 'deposits' : 'withdrawals';
        await api.patch(`/property-lifecycle/project-finance/rera/${resource}/${action.item.id}/review`, {
          site_id: siteId, decision: action.decision, review_notes: notes.trim(),
        });
      }
      toast.success(posting ? 'Withdrawal posted to the linked bank debit.' : `${readable(noun)} marked ${readable(action.decision).toLowerCase()}.`);
      onOpenChange(null);
      onSaved();
    } catch (error) {
      toast.error(error.response?.data?.message || `The ${noun} action could not be completed.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onOpenChange(null); }}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-[500px]">
        <SheetHeader className="border-b border-slate-200 px-6 py-5">
          <SheetTitle>{posting ? 'Post approved withdrawal' : `${readable(action.decision)} ${noun}`}</SheetTitle>
          <SheetDescription>{posting ? 'Link the actual debit from the reviewed designated account.' : 'This decision is retained in the compliance audit trail.'}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="flex items-center justify-between border-y border-slate-100 py-3 text-sm"><span className="text-slate-500">Amount</span><span className="font-semibold tabular-nums text-slate-900">{money(action.item.amount)}</span></div>
          {posting ? (
            <BankTransactionField label="Bank debit" kind="debit" required value={bankTransactionId} onChange={setBankTransactionId} transactions={eligibleBankDebits} />
          ) : (
            <Field label="Review notes" required><Textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Evidence checked and reason for this decision" /></Field>
          )}
        </div>
        <SheetFooter className="border-t border-slate-200 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(null)}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className={action.decision === 'REJECTED' ? 'bg-red-600 hover:bg-red-700' : ''}>{busy ? 'Saving…' : posting ? 'Post withdrawal' : `${readable(action.decision)} ${noun}`}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default function ReraFundControls({ siteId, project, phaseId, collections, evidenceDocuments, canUpdate, isAdmin, onFinanceReload }) {
  const key = cacheKey(siteId, project?.id, phaseId);
  const [snapshot, setSnapshot] = useState(() => ({ key, data: complianceCache.get(key) || EMPTY }));
  const [loading, setLoading] = useState(!complianceCache.has(key));
  const [error, setError] = useState('');
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);
  const [decision, setDecision] = useState(null);
  const requestRef = useRef(0);
  const data = snapshot.key === key ? snapshot.data : EMPTY;
  const scopeLoading = snapshot.key !== key || loading;
  const projectHasPhases = Boolean(data.project?.has_phases ?? project?.phases?.length);
  const aggregatePhaseScope = phaseId === 'all' && projectHasPhases;

  useEffect(() => {
    if (!aggregatePhaseScope) return;
    setDepositOpen(false);
    setWithdrawalOpen(false);
  }, [aggregatePhaseScope]);

  const load = useCallback(async ({ force = false } = {}) => {
    if (!siteId || !project?.id) return;
    const request = ++requestRef.current;
    const cached = !force ? complianceCache.get(key) : null;
    if (cached) setSnapshot({ key, data: cached });
    else if (!force) setSnapshot({ key, data: EMPTY });
    setLoading(!cached);
    setError('');
    try {
      const response = await api.get('/property-lifecycle/project-finance/rera-compliance', {
        params: { site_id: siteId, project_id: project.id, ...(phaseId !== 'all' ? { phase_id: phaseId } : {}) },
      });
      if (request !== requestRef.current) return;
      const next = { ...EMPTY, ...(response.data || {}) };
      complianceCache.set(key, next);
      setSnapshot({ key, data: next });
    } catch (requestError) {
      if (request !== requestRef.current) return;
      setError(requestError.response?.data?.message || 'RERA fund controls could not be loaded.');
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [key, phaseId, project?.id, siteId]);

  useEffect(() => {
    load();
    return () => { requestRef.current += 1; };
  }, [load]);

  const refresh = () => {
    complianceCache.delete(key);
    load({ force: true });
    onFinanceReload?.();
  };

  if (scopeLoading && !data.reserve) {
    return <div className="space-y-px">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-14 w-full rounded-none" />)}</div>;
  }
  if (error && !data.reserve) {
    return <div className="py-16 text-center"><p className="text-sm font-semibold text-red-700">RERA fund controls are unavailable</p><p className="mt-1 text-xs text-slate-500">{error}</p><Button variant="outline" size="sm" className="mt-4" onClick={refresh}>Try again</Button></div>;
  }
  if (!data.policy?.applicable || !data.reserve) {
    return <div className="py-16 text-center"><ShieldCheck className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">RERA fund controls are not active for this project context.</p></div>;
  }

  const reserve = data.reserve;
  const withdrawals = data.withdrawals || {};
  const accounts = data.designated_accounts || [];
  const deposits = data.deposit_allocations || [];
  const requests = data.withdrawal_requests || [];
  const depositCollections = Array.isArray(data.eligible_collections)
    ? data.eligible_collections
    : collections;
  const availableEvidenceDocuments = data.evidence_documents?.length
    ? data.evidence_documents
    : (evidenceDocuments || []);
  const eligibleBankCredits = Array.isArray(data.eligible_bank_credits)
    ? data.eligible_bank_credits
    : null;
  const eligibleBankDebits = Array.isArray(data.eligible_bank_debits)
    ? data.eligible_bank_debits
    : null;
  const selectedPhaseId = phaseId === 'all' ? null : phaseId;
  const withdrawalAccounts = accounts.filter((account) => accountMatchesPhase(account, selectedPhaseId));
  const canReview = Boolean(isAdmin && canUpdate);
  const coverage = Math.min(100, Math.max(0, Number(reserve.coverage_percentage || 0)));
  const hasShortfall = Number(reserve.shortfall || 0) > 0.005;

  return (
    <div>
      <div className="grid border-b border-slate-200 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Required reserve', money(reserve.required_deposit), `${reserve.minimum_percentage}% of ${money(reserve.collected)}`],
          ['Verified deposits', money(reserve.verified_deposits), `${reserve.deposit_review_count || 0} awaiting review`],
          [hasShortfall ? 'Reserve shortfall' : 'Reserve coverage', hasShortfall ? money(reserve.shortfall) : `${Number(reserve.coverage_percentage || 0).toFixed(1)}%`, hasShortfall ? 'Additional verified deposits needed' : 'Minimum reserve covered'],
          ['Available to request', money(withdrawals.available_verified_reserve), `${money(withdrawals.posted)} already posted`],
        ].map(([label, value, helper], index) => (
          <div key={label} className={`px-5 py-4 ${index ? 'border-t border-slate-100 sm:border-l sm:border-t-0' : ''}`}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
            <p className={`mt-1 text-lg font-semibold tabular-nums ${label === 'Reserve shortfall' ? 'text-red-700' : 'text-slate-950'}`}>{value}</p>
            <p className="mt-0.5 text-[10px] text-slate-400">{helper}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 text-[11px]"><span className="font-medium text-slate-700">Separate-account coverage</span><span className={hasShortfall ? 'font-semibold text-red-700' : 'font-semibold text-emerald-700'}>{Number(reserve.coverage_percentage || 0).toFixed(1)}%</span></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-[width] ${hasShortfall ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${coverage}%` }} /></div>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">{data.policy.percentage_source === 'CENTRAL_RERA_BASELINE' ? 'Central RERA baseline' : 'Reviewed operating-profile ruleset'} · {accounts.length} reviewed designated account{accounts.length === 1 ? '' : 's'} in scope.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="ghost" size="icon" onClick={refresh} aria-label="Refresh fund controls"><RefreshCw className={`h-4 w-4 ${scopeLoading ? 'animate-spin' : ''}`} /></Button>
          {canUpdate && <Button variant="outline" size="sm" onClick={() => setDepositOpen(true)} disabled={aggregatePhaseScope || !accounts.length || !depositCollections.length}><Plus className="mr-1.5 h-3.5 w-3.5" />Record deposit</Button>}
          {canUpdate && <Button size="sm" onClick={() => setWithdrawalOpen(true)} disabled={aggregatePhaseScope || !withdrawalAccounts.length || Number(withdrawals.available_verified_reserve || 0) <= 0}><WalletCards className="mr-1.5 h-3.5 w-3.5" />Request withdrawal</Button>}
        </div>
      </div>

      {aggregatePhaseScope && (
        <div className="flex items-start gap-2 border-b border-blue-100 bg-blue-50/50 px-5 py-3 text-xs text-blue-800"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span>This is the aggregate project view. Select a phase above to record a deposit or request a certified withdrawal.</span></div>
      )}
      {!accounts.length && (
        <div className="flex items-start gap-2 border-b border-amber-100 bg-amber-50/60 px-5 py-3 text-xs text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>Map and review a project account with purpose “RERA separate account” before recording deposits or withdrawals.</span></div>
      )}
      {error && <div className="border-b border-amber-100 bg-amber-50/50 px-5 py-2 text-[11px] text-amber-700">Latest refresh failed: {error}</div>}

      <div className="grid xl:grid-cols-2">
        <section className="border-b border-slate-200 xl:border-b-0 xl:border-r">
          <div className="flex items-center justify-between px-5 py-4"><div><h3 className="text-sm font-semibold text-slate-900">Separate-account deposits</h3><p className="mt-0.5 text-[10px] text-slate-400">Approved receipts mapped to reviewed accounts</p></div><Landmark className="h-4 w-4 text-slate-300" /></div>
          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {deposits.length ? deposits.map((row) => (
              <article key={row.id} className="flex items-start gap-3 px-5 py-3">
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold text-slate-800">{row.receipt_no || `Payment #${row.plot_payment_id}`} · Plot {row.plot_no || '—'}</p><Status value={row.status} /></div><p className="mt-1 truncate text-[10px] text-slate-400">{date(row.deposit_date)} · {row.account_name || 'Designated account'}{row.deposit_reference ? ` · ${row.deposit_reference}` : ''}</p></div>
                <div className="shrink-0 text-right"><p className="text-xs font-semibold tabular-nums text-slate-900">{money(row.amount)}</p>{canReview && row.status === 'RECORDED' && <div className="mt-1 flex gap-1"><Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-emerald-700" onClick={() => setDecision({ kind: 'deposit-review', item: row, decision: 'VERIFIED' })}>Verify</Button><Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-red-600" onClick={() => setDecision({ kind: 'deposit-review', item: row, decision: 'REJECTED' })}>Reject</Button></div>}</div>
              </article>
            )) : <p className="px-5 py-12 text-center text-xs text-slate-400">No separate-account deposits recorded yet.</p>}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between px-5 py-4"><div><h3 className="text-sm font-semibold text-slate-900">Certified withdrawals</h3><p className="mt-0.5 text-[10px] text-slate-400">Three-certificate review and bank posting</p></div><FileCheck2 className="h-4 w-4 text-slate-300" /></div>
          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {requests.length ? requests.map((row) => (
              <article key={row.id} className="flex items-start gap-3 px-5 py-3">
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-xs font-semibold text-slate-800">{row.purpose || `Withdrawal #${row.id}`}</p><Status value={row.status} /></div><p className="mt-1 text-[10px] text-slate-400">{date(row.requested_date)} · {Number(row.completion_percentage || 0).toFixed(1)}% complete · certified {money(row.certified_eligible_amount)}</p></div>
                <div className="shrink-0 text-right"><p className="text-xs font-semibold tabular-nums text-slate-900">{money(row.amount)}</p>{canReview && row.status === 'PENDING' && <div className="mt-1 flex gap-1"><Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-emerald-700" onClick={() => setDecision({ kind: 'withdrawal-review', item: row, decision: 'APPROVED' })}>Approve</Button><Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-red-600" onClick={() => setDecision({ kind: 'withdrawal-review', item: row, decision: 'REJECTED' })}>Reject</Button></div>}{canReview && row.status === 'APPROVED' && <Button variant="ghost" size="sm" className="mt-1 h-6 px-2 text-[10px] text-blue-700" onClick={() => setDecision({ kind: 'withdrawal-post', item: row })}>Post bank debit <ArrowRight className="ml-1 h-3 w-3" /></Button>}</div>
              </article>
            )) : <p className="px-5 py-12 text-center text-xs text-slate-400">No certified withdrawals requested yet.</p>}
          </div>
        </section>
      </div>

      <DepositSheet open={depositOpen} onOpenChange={setDepositOpen} siteId={siteId} project={project} phaseId={phaseId} accounts={accounts} collections={depositCollections} allocations={deposits} evidenceDocuments={availableEvidenceDocuments} bankCredits={eligibleBankCredits} onSaved={refresh} />
      <WithdrawalSheet open={withdrawalOpen} onOpenChange={setWithdrawalOpen} siteId={siteId} project={project} phaseId={phaseId} accounts={withdrawalAccounts} available={Number(withdrawals.available_verified_reserve || 0)} evidenceDocuments={availableEvidenceDocuments} onSaved={refresh} />
      <DecisionSheet action={decision} onOpenChange={setDecision} siteId={siteId} accounts={accounts} bankDebits={eligibleBankDebits} onSaved={refresh} />
    </div>
  );
}
