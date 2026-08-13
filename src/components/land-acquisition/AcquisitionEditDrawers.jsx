import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FileText, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import api from '@/api/api';
import BankAccountSelect from '@/components/BankAccountSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { apiMessage, money, readable } from './landAcquisitionUtils';

const Footer = ({ busy, onCancel, label }) => (
  <SheetFooter className="sticky bottom-0 border-t border-mr-line bg-mr-surface px-6 py-4">
    <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
    <Button type="submit" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{label}</Button>
  </SheetFooter>
);

const Frame = ({ open, onOpenChange, title, description, children, onSubmit, busy, submitLabel }) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent className="flex w-full flex-col p-0 sm:max-w-xl">
      <SheetHeader className="border-b border-mr-line px-6 py-5"><SheetTitle>{title}</SheetTitle><SheetDescription>{description}</SheetDescription></SheetHeader>
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">{children}</div>
        <Footer busy={busy} onCancel={() => onOpenChange(false)} label={submitLabel} />
      </form>
    </SheetContent>
  </Sheet>
);

export function LandDetailsSheet({ acquisition, open, onOpenChange, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({});
  useEffect(() => {
    if (open && acquisition) setForm({
      village: acquisition.village || '', tehsil: acquisition.tehsil || '', district: acquisition.district || '', state: acquisition.state || '',
      khasra_number: acquisition.khasra_number || '', survey_number: acquisition.survey_number || '', parcel_number: acquisition.parcel_number || '',
      land_area: acquisition.land_size_bigha || '', area_unit: acquisition.land_size_unit || 'BIGHA', land_type: acquisition.land_type || '',
      ownership_share: acquisition.ownership_share || '', notes: acquisition.land_notes || '', reason: '',
    });
  }, [acquisition, open]);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      const { data } = await api.patch(`/land-acquisitions/${acquisition.id}/land`, form);
      toast.success('Land details updated'); onOpenChange(false); onSaved?.(data);
    } catch (error) { toast.error(apiMessage(error, 'Land details could not be updated')); } finally { setBusy(false); }
  };
  return (
    <Frame open={open} onOpenChange={onOpenChange} title="Edit land details" description="Structured parcel information for this acquisition." onSubmit={submit} busy={busy} submitLabel="Save changes">
      <div className="grid gap-4 sm:grid-cols-2">
        {[['village', 'Village'], ['tehsil', 'Tehsil'], ['district', 'District'], ['state', 'State'], ['khasra_number', 'Khasra number'], ['survey_number', 'Survey number'], ['parcel_number', 'Parcel number'], ['land_type', 'Land type']].map(([key, label]) => <Field key={key} label={label}><Input value={form[key] || ''} onChange={(event) => set(key, event.target.value)} /></Field>)}
        <Field label="Land area"><Input type="number" min="0" step="0.0001" value={form.land_area || ''} onChange={(event) => set('land_area', event.target.value)} /></Field>
        <Field label="Area unit"><Select value={form.area_unit || 'BIGHA'} onValueChange={(value) => set('area_unit', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['BIGHA', 'ACRE', 'HECTARE', 'YARD', 'SQMT'].map((value) => <SelectItem key={value} value={value}>{readable(value)}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Ownership %"><Input type="number" min="0.0001" max="100" step="0.0001" value={form.ownership_share || ''} onChange={(event) => set('ownership_share', event.target.value)} /></Field>
      </div>
      <Field label="Notes"><Textarea rows={3} value={form.notes || ''} onChange={(event) => set('notes', event.target.value)} /></Field>
      <Field label="Reason for change" hint="Recommended when updating an existing parcel record."><Input value={form.reason || ''} onChange={(event) => set('reason', event.target.value)} /></Field>
    </Frame>
  );
}

export function AgreementSheet({ acquisition, agreement, open, onOpenChange, onSaved, onView }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({});
  const [attachment, setAttachment] = useState(null);
  useEffect(() => {
    if (open) {
      setAttachment(null);
      setForm({
        agreement_type: agreement?.agreement_type || 'Purchase Agreement', agreement_date: agreement?.agreement_date?.slice?.(0, 10) || '',
        agreement_number: agreement?.agreement_number || '', agreement_status: agreement?.agreement_status === 'EXECUTED' ? 'DRAFT' : agreement?.agreement_status || 'DRAFT',
        agreement_value: agreement?.agreement_value || acquisition?.total_amount || '', witness_parties: '', remarks: '', reason: '',
      });
    }
  }, [acquisition, agreement, open]);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      const payload = { ...form, witness_parties: form.witness_parties.split(',').map((item) => item.trim()).filter(Boolean) };
      const { data } = await api.post(`/land-acquisitions/${acquisition.id}/agreements`, payload);
      let attachmentUploaded = false;
      if (attachment) {
        try {
          const body = new FormData();
          body.append('file', attachment);
          body.append('title', form.agreement_number ? `Agreement ${form.agreement_number}` : attachment.name);
          body.append('category', 'AGREEMENT');
          body.append('document_type', 'AGREEMENT');
          body.append('document_number', form.agreement_number || '');
          body.append('issue_date', form.agreement_date || '');
          body.append('review_notes', form.remarks || '');
          body.append('confidentiality', 'INTERNAL');
          await api.post(`/compliance-documents/LAND_ACQUISITION/${acquisition.id}`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
          attachmentUploaded = true;
        } catch (attachmentError) {
          toast.warning(apiMessage(attachmentError, 'Agreement was saved, but the PDF could not be uploaded'));
        }
      }
      toast.success(attachmentUploaded ? 'Agreement revision and PDF saved' : 'Agreement revision saved'); onOpenChange(false); onSaved?.(data);
    } catch (error) { toast.error(apiMessage(error, 'Agreement could not be saved')); } finally { setBusy(false); }
  };
  return (
    <Frame open={open} onOpenChange={onOpenChange} title="Record agreement revision" description="Every save creates a traceable revision. Executed agreements are never silently overwritten." onSubmit={submit} busy={busy} submitLabel="Save agreement">
      {agreement && onView && <div className="flex items-center justify-between gap-4 border border-mr-line bg-mr-surface-2 px-4 py-3"><div><p className="text-[12px] font-semibold text-mr-text">Saved agreement available</p><p className="mt-0.5 text-[11px] text-mr-muted">Review the current revision before recording another one.</p></div><Button type="button" variant="outline" size="sm" onClick={onView}>View current agreement</Button></div>}
      <Field label="Agreement type"><Input value={form.agreement_type || ''} onChange={(event) => set('agreement_type', event.target.value)} required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status"><Select value={form.agreement_status || 'DRAFT'} onValueChange={(value) => set('agreement_status', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['DRAFT', 'UNDER_REVIEW', 'EXECUTED', 'CANCELLED'].map((value) => <SelectItem key={value} value={value}>{readable(value)}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Agreement date"><Input type="date" value={form.agreement_date || ''} onChange={(event) => set('agreement_date', event.target.value)} /></Field>
        <Field label="Agreement number"><Input value={form.agreement_number || ''} onChange={(event) => set('agreement_number', event.target.value)} /></Field>
        <Field label="Agreement value"><Input type="number" min="0" step="0.01" value={form.agreement_value || ''} onChange={(event) => set('agreement_value', event.target.value)} /></Field>
      </div>
      <Field label="Agreement PDF" hint="Optional. It will be stored with this acquisition and shown on the Agreement page."><label className="flex h-10 cursor-pointer items-center rounded-control border border-mr-line px-3 text-[12px] text-mr-muted"><Upload className="mr-2 h-4 w-4" />{attachment?.name || 'Select agreement PDF'}<input type="file" className="sr-only" accept=".pdf,.doc,.docx" onChange={(event) => setAttachment(event.target.files?.[0] || null)} /></label></Field>
      <Field label="Witnesses / parties" hint="Comma-separated names; do not repeat the landowner identity."><Input value={form.witness_parties || ''} onChange={(event) => set('witness_parties', event.target.value)} /></Field>
      <Field label="Remarks"><Textarea rows={3} value={form.remarks || ''} onChange={(event) => set('remarks', event.target.value)} /></Field>
      <Field label="Reason / amendment note"><Input value={form.reason || ''} onChange={(event) => set('reason', event.target.value)} /></Field>
    </Frame>
  );
}

const agreementParties = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {
    // Older records may contain a comma-separated value rather than JSON.
  }
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
};

export function AgreementViewSheet({ acquisition, agreement, agreements = [], documents = [], open, onOpenChange, onEdit, onOpenDocument, onUpload }) {
  if (!agreement) return null;
  const parties = agreementParties(agreement.witness_parties);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-mr-line px-6 py-5">
          <SheetTitle>Agreement view</SheetTitle>
          <SheetDescription>{acquisition?.acquisition_reference} · {acquisition?.landowner_name}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <div className="grid gap-x-6 border-y border-mr-line sm:grid-cols-2">
            {[
              ['Status', readable(agreement.agreement_status)],
              ['Revision', `Revision ${agreement.revision_number}`],
              ['Type', agreement.agreement_type],
              ['Date', agreement.agreement_date ? new Date(agreement.agreement_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not recorded'],
              ['Agreement number', agreement.agreement_number],
              ['Agreement value', money(agreement.agreement_value)],
              ['Created by', agreement.created_by_name],
              ['Reviewed by', agreement.reviewed_by_name],
            ].map(([label, value]) => <div key={label} className="border-b border-mr-line py-3"><p className="text-[11px] font-medium uppercase tracking-[0.08em] text-mr-faint">{label}</p><p className="mt-1 break-words text-[13px] font-medium text-mr-text">{value || 'Not recorded'}</p></div>)}
          </div>
          <div>
            <p className="text-[12px] font-semibold text-mr-text">Witnesses / parties</p>
            <p className="mt-2 text-[13px] text-mr-muted">{parties.length ? parties.join(', ') : 'Not recorded'}</p>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-mr-text">Remarks</p>
            <p className="mt-2 whitespace-pre-wrap text-[13px] text-mr-muted">{agreement.remarks || 'No remarks recorded.'}</p>
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[12px] font-semibold text-mr-text">Agreement PDF</p>{!documents.length && onUpload && <Button type="button" variant="outline" size="sm" onClick={onUpload}><Upload className="mr-1.5 h-3.5 w-3.5" />Upload PDF</Button>}</div>
            {documents.length ? <div className="mt-2 divide-y divide-mr-line border-y border-mr-line">{documents.map((document) => <button key={document.id} type="button" onClick={() => onOpenDocument?.(document)} className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-mr-surface-2"><span className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-mr-faint" /><span className="min-w-0"><span className="block truncate text-[13px] font-medium text-mr-text">{document.title || document.original_name || 'Agreement PDF'}</span><span className="block text-[11px] text-mr-muted">{document.original_name || 'Agreement document'}</span></span></span><span className="shrink-0 text-[11px] font-medium text-mr-blue">Open PDF</span></button>)}</div> : <p className="mt-2 text-[13px] text-mr-muted">No agreement PDF has been uploaded yet.</p>}
          </div>
          {agreements.length > 1 && <div><p className="text-[12px] font-semibold text-mr-text">Revision history</p><div className="mt-2 divide-y divide-mr-line border-y border-mr-line">{agreements.map((item) => <div key={item.id} className="grid grid-cols-[90px_1fr_110px] gap-3 py-3 text-[12px]"><span className="text-mr-muted">Revision {item.revision_number}</span><span className="font-medium text-mr-text">{readable(item.agreement_status)}</span><span className="text-right text-mr-muted">{item.agreement_date ? new Date(item.agreement_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No date'}</span></div>)}</div></div>}
        </div>
        <SheetFooter className="sticky bottom-0 border-t border-mr-line bg-mr-surface px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {onEdit && <Button type="button" onClick={onEdit}>Record new revision</Button>}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function FinancialTermsSheet({ acquisition, schedule = [], open, onOpenChange, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ total: '', cash: '', bank: '', reason: '' });
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!open) return;
    setForm({ total: acquisition?.total_amount || '', cash: acquisition?.cash_amount || '', bank: acquisition?.bank_amount || '', reason: '' });
    setItems(schedule.length ? schedule.map((item) => ({ description: item.description, amount: item.expected_amount, due_date: item.due_date?.slice?.(0, 10) || '', preferred_mode: item.preferred_mode || '' })) : []);
  }, [acquisition, open, schedule]);
  const scheduleTotal = useMemo(() => items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0), [items]);
  const setItem = (index, key, value) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  const submit = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      const payload = { total_agreed_value: form.total, cash_component: form.cash || 0, bank_component: form.bank || 0, reason: form.reason, schedule: items };
      const { data } = await api.post(`/land-acquisitions/${acquisition.id}/financial-terms`, payload);
      toast.success('Financial terms confirmed'); onOpenChange(false); onSaved?.(data);
    } catch (error) { toast.error(apiMessage(error, 'Financial terms could not be confirmed')); } finally { setBusy(false); }
  };
  return (
    <Frame open={open} onOpenChange={onOpenChange} title="Confirm financial terms" description="This defines what was agreed. Actual money continues to come only from posted transactions." onSubmit={submit} busy={busy} submitLabel="Confirm terms">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Total consideration"><Input type="number" min="0" step="0.01" value={form.total} onChange={(event) => setForm((current) => ({ ...current, total: event.target.value }))} required /></Field>
        <Field label="Cash component"><Input type="number" min="0" step="0.01" value={form.cash} onChange={(event) => setForm((current) => ({ ...current, cash: event.target.value }))} /></Field>
        <Field label="Bank component"><Input type="number" min="0" step="0.01" value={form.bank} onChange={(event) => setForm((current) => ({ ...current, bank: event.target.value }))} /></Field>
      </div>
      <div className="border-y border-mr-line py-3 text-[12px] text-mr-muted">Split total: <span className="font-semibold text-mr-text">{money((Number(form.cash) || 0) + (Number(form.bank) || 0))}</span> · Schedule total: <span className="font-semibold text-mr-text">{money(scheduleTotal)}</span></div>
      <div>
        <div className="flex items-center justify-between"><Label>Payment schedule</Label><Button type="button" variant="outline" size="sm" onClick={() => setItems((current) => [...current, { description: '', amount: '', due_date: '', preferred_mode: '' }])}><Plus className="mr-1 h-3.5 w-3.5" />Add installment</Button></div>
        <div className="mt-3 space-y-3">{items.map((item, index) => <div key={index} className="grid gap-2 border-b border-mr-line pb-3 sm:grid-cols-[1.4fr_1fr_1fr_38px]"><Input placeholder="Description" value={item.description} onChange={(event) => setItem(index, 'description', event.target.value)} /><Input type="number" min="0" step="0.01" placeholder="Amount" value={item.amount} onChange={(event) => setItem(index, 'amount', event.target.value)} /><Input type="date" value={item.due_date} onChange={(event) => setItem(index, 'due_date', event.target.value)} /><Button type="button" variant="ghost" size="icon" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button></div>)}</div>
      </div>
      {acquisition?.financial_terms_status === 'CONFIRMED' && <Field label="Reason for revision" hint="Required when changing confirmed amounts."><Textarea rows={2} value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} /></Field>}
    </Frame>
  );
}

export function RecordPaymentSheet({ acquisition, schedule = [], open, onOpenChange, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState(null);
  const [form, setForm] = useState({ amount: '', date: new Date().toISOString().slice(0, 10), mode: 'BANK', bank_account_id: '', bank_reference: '', cheque_no: '', schedule_item_id: '', remarks: '' });
  useEffect(() => { if (open) { setProof(null); setForm((current) => ({ ...current, amount: '', date: new Date().toISOString().slice(0, 10), bank_account_id: '', bank_reference: '', cheque_no: '', remarks: '' })); } }, [open]);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (form.mode !== 'CASH' && !form.bank_account_id) {
      toast.error('Select the bank account used for this payment');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        date: form.date, particular: 'LAND ACQUISITION PAYMENT', amount: Number(form.amount), payment_mode: form.mode,
        cash_amount: form.mode === 'CASH' ? Number(form.amount) : 0,
        bank_amount: form.mode === 'CASH' ? 0 : Number(form.amount),
        bank_account_id: form.bank_account_id || null,
        bank_reference: form.bank_reference || null, cheque_no: form.cheque_no || null,
        schedule_item_id: form.schedule_item_id || null, remarks: form.remarks || null,
        idempotency_key: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      };
      const { data } = await api.post(`/land-acquisitions/${acquisition.id}/transactions`, payload);
      if (proof && data.payment?.id) {
        const evidence = new FormData();
        evidence.append('file', proof);
        evidence.append('title', `Payment proof #${data.payment.id}`);
        evidence.append('category', 'PAYMENT_PROOF');
        evidence.append('document_type', 'PAYMENT_PROOF');
        evidence.append('source_reference', `farmer_payment:${data.payment.id}`);
        evidence.append('confidentiality', 'INTERNAL');
        try {
          await api.post(`/compliance-documents/LAND_ACQUISITION/${acquisition.id}`, evidence, { headers: { 'Content-Type': 'multipart/form-data' } });
        } catch (proofError) {
          toast.warning(apiMessage(proofError, 'Payment was recorded, but its proof could not be uploaded'));
        }
      }
      toast.success(data.replayed ? 'Payment was already recorded' : 'Payment recorded and sent for approval');
      onOpenChange(false); onSaved?.(data);
    } catch (error) { toast.error(apiMessage(error, 'Payment could not be recorded')); } finally { setBusy(false); }
  };
  const nonCash = form.mode !== 'CASH';
  return (
    <Frame open={open} onOpenChange={onOpenChange} title="Record payment" description={`${acquisition?.landowner_name || 'Landowner'} · ${acquisition?.acquisition_reference || ''} · Outstanding ${money(acquisition?.outstanding)}`} onSubmit={submit} busy={busy} submitLabel="Record payment">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount"><Input type="number" min="0.01" max={acquisition?.outstanding || undefined} step="0.01" value={form.amount} onChange={(event) => set('amount', event.target.value)} required /></Field>
        <Field label="Payment date"><Input type="date" value={form.date} onChange={(event) => set('date', event.target.value)} required /></Field>
        <Field label="Mode"><Select value={form.mode} onValueChange={(value) => set('mode', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CASH">Cash</SelectItem><SelectItem value="BANK">Bank transfer</SelectItem><SelectItem value="CHEQUE">Cheque</SelectItem></SelectContent></Select></Field>
        <Field label="Allocate against"><Select value={form.schedule_item_id || 'unallocated'} onValueChange={(value) => set('schedule_item_id', value === 'unallocated' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unallocated">Unallocated</SelectItem>{schedule.filter((item) => item.effective_status !== 'PAID').map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.description} · {money(item.outstanding)}</SelectItem>)}</SelectContent></Select></Field>
      </div>
      {nonCash && <div className="space-y-4"><BankAccountSelect value={form.bank_account_id} onChange={(value) => set('bank_account_id', value)} paymentMode={form.mode} disabled={busy} required /><div className="grid gap-4 sm:grid-cols-2"><Field label={form.mode === 'CHEQUE' ? 'Bank reference' : 'UTR / reference'}><Input value={form.bank_reference} onChange={(event) => set('bank_reference', event.target.value)} /></Field>{form.mode === 'CHEQUE' && <Field label="Cheque number"><Input value={form.cheque_no} onChange={(event) => set('cheque_no', event.target.value)} /></Field>}</div></div>}
      <Field label="Remarks"><Textarea rows={3} value={form.remarks} onChange={(event) => set('remarks', event.target.value)} /></Field>
      <Field label="Optional payment proof"><label className="flex h-10 cursor-pointer items-center rounded-control border border-mr-line px-3 text-[12px] text-mr-muted"><Upload className="mr-2 h-4 w-4" />{proof?.name || 'Select receipt, PDF or image'}<input type="file" className="sr-only" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={(event) => setProof(event.target.files?.[0] || null)} /></label></Field>
      <p className="text-[11px] leading-relaxed text-mr-muted">The payment is written once to the existing Farmer Payment engine. Day Book, Cash/Bank, approvals and personal ledger continue to update through the established accounting flow.</p>
    </Frame>
  );
}

export function DocumentUploadSheet({ acquisition, open, onOpenChange, onSaved, initialCategory = 'LAND_RECORD' }) {
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ title: '', category: 'LAND_RECORD', document_number: '', issue_date: '', remarks: '' });
  useEffect(() => {
    if (open) {
      setFile(null);
      setForm({ title: '', category: initialCategory, document_number: '', issue_date: '', remarks: '' });
    }
  }, [initialCategory, open]);
  const submit = async (event) => {
    event.preventDefault(); if (!file) return toast.error('Select a document'); setBusy(true);
    try {
      const body = new FormData(); body.append('file', file); body.append('title', form.title || file.name); body.append('category', form.category); body.append('document_type', form.category); body.append('document_number', form.document_number); body.append('issue_date', form.issue_date); body.append('review_notes', form.remarks); body.append('confidentiality', 'INTERNAL');
      const { data } = await api.post(`/compliance-documents/LAND_ACQUISITION/${acquisition.id}`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Document uploaded'); setFile(null); onOpenChange(false); onSaved?.(data);
    } catch (error) { toast.error(apiMessage(error, 'Document could not be uploaded')); } finally { setBusy(false); }
  };
  return (
    <Frame open={open} onOpenChange={onOpenChange} title="Upload acquisition document" description="Documents use MountReality’s existing private evidence storage and version history." onSubmit={submit} busy={busy} submitLabel="Upload document">
      <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-control border border-dashed border-mr-line bg-mr-surface-2 text-center"><Upload className="mb-2 h-5 w-5 text-mr-faint" /><span className="text-[13px] font-medium text-mr-text">{file?.name || 'Select PDF, DOCX or image'}</span><input type="file" className="sr-only" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
      <Field label="Title"><Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Document type"><Select value={form.category} onValueChange={(value) => setForm((current) => ({ ...current, category: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['LAND_RECORD', 'KHASRA', 'OWNERSHIP_PROOF', 'AGREEMENT', 'PAYMENT_PROOF', 'REGISTRY', 'KYC', 'OTHER'].map((value) => <SelectItem key={value} value={value}>{readable(value)}</SelectItem>)}</SelectContent></Select></Field><Field label="Document number"><Input value={form.document_number} onChange={(event) => setForm((current) => ({ ...current, document_number: event.target.value }))} /></Field></div>
      <Field label="Issue date"><Input type="date" value={form.issue_date} onChange={(event) => setForm((current) => ({ ...current, issue_date: event.target.value }))} /></Field>
      <Field label="Remarks"><Textarea rows={3} value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} /></Field>
    </Frame>
  );
}

function Field({ label, hint, children }) {
  return <div><Label className="text-[12px] font-medium text-mr-text">{label}</Label><div className="mt-1.5">{children}</div>{hint && <p className="mt-1 text-[11px] text-mr-muted">{hint}</p>}</div>;
}
