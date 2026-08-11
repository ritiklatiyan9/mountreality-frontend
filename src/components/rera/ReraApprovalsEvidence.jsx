import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, FileText, Loader2, Pencil, Plus, Upload } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/api/api';
import { useDocViewer } from '@/components/DocViewer';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { SectionHead } from '@/components/ui/page';
import { useSitePolicy } from '@/hooks/useSitePolicy';
import {
  CompactEmpty,
  DetailFact,
  FormField,
  InlineError,
  ReraStatus,
} from './ReraUi';
import {
  asList,
  cleanPayload,
  firstValue,
  formatDate,
  readable,
  recordId,
  writablePolicyPayload,
} from './reraUtils';

const APPROVAL_STATUSES = [
  'MISSING',
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'RENEWAL_DUE',
  'EXPIRED',
  'REJECTED',
  'NOT_APPLICABLE',
];

const emptyApproval = {
  approval_type: '',
  phase_id: '',
  authority: '',
  reference_number: '',
  issue_date: '',
  valid_from: '',
  valid_until: '',
  status: 'DRAFT',
  source_reference: '',
  owner_name: '',
  review_status: 'NOT_REVIEWED',
  notes: '',
};

const emptyUpload = {
  file: null,
  title: '',
  category: 'RERA_EVIDENCE',
  confidentiality: 'INTERNAL',
  issue_date: '',
  expiry_date: '',
  issuing_authority: '',
};

const dateInput = (value) => (value ? String(value).slice(0, 10) : '');

const approvalToForm = (approval) => ({
  approval_type: firstValue(approval, ['approval_type', 'type', 'name'], ''),
  phase_id: firstValue(approval, ['phase_id'], ''),
  authority: firstValue(approval, ['authority', 'issuer'], ''),
  reference_number: firstValue(approval, ['reference_number', 'reference'], ''),
  issue_date: dateInput(firstValue(approval, ['issue_date', 'issued_at'])),
  valid_from: dateInput(firstValue(approval, ['valid_from'])),
  valid_until: dateInput(firstValue(approval, ['valid_until', 'expiry_date'])),
  status: firstValue(approval, ['status'], 'DRAFT'),
  source_reference: firstValue(approval, ['source_reference', 'source_url'], ''),
  owner_name: firstValue(approval, ['owner_name', 'responsible_user_name', 'owner'], ''),
  review_status: firstValue(approval, ['review_status'], 'NOT_REVIEWED'),
  notes: firstValue(approval, ['notes'], ''),
});

const evidenceReview = (document) => {
  const recorded = firstValue(document, ['review_status', 'verification_status']);
  if (!recorded) return { value: null, label: 'Review not recorded' };
  const value = String(recorded).toUpperCase();
  if (['REVIEWED', 'VERIFIED'].includes(value)) return { value, label: 'Evidence reviewed' };
  if (value === 'UNVERIFIED' || value === 'NOT_REVIEWED') return { value: 'PENDING', label: 'Review pending' };
  return { value, label: readable(value) };
};

export default function ReraApprovalsEvidence({
  siteId,
  project,
  phases,
  approvals,
  evidence,
  canReadApprovals,
  canWriteApprovals,
  canUpdateApprovals,
  canReviewApprovals,
  canReadEvidence,
  canWriteEvidence,
  onChanged,
}) {
  const { getFieldPolicy } = useSitePolicy();
  const projectId = firstValue(project, ['id', 'project_id']);
  const approvalRows = useMemo(() => asList(approvals).filter((approval) => {
    const ownerProject = firstValue(approval, ['project_id', 'rera_project_id']);
    return !projectId || !ownerProject || String(ownerProject) === String(projectId);
  }), [approvals, projectId]);
  const phaseRows = asList(phases);
  const openDoc = useDocViewer();
  const [documents, setDocuments] = useState(asList(evidence));
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState('');
  const [busy, setBusy] = useState(false);
  const [approvalDialog, setApprovalDialog] = useState({ open: false, record: null });
  const [approvalForm, setApprovalForm] = useState(emptyApproval);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState(emptyUpload);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    const fallbackDocuments = asList(evidence);
    setDocuments(fallbackDocuments);
    setDocumentsError('');
    if (!projectId || !canReadEvidence) {
      setDocumentsLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setDocumentsLoading(true);
    api.get(`/compliance-documents/RERA_PROJECT/${projectId}`, {
      params: { site_id: siteId },
      signal: controller.signal,
    }).then(({ data }) => {
      setDocuments(asList(data?.documents ?? data));
    }).catch((error) => {
      if (error?.code === 'ERR_CANCELED') return;
      setDocumentsError(error.response?.data?.message || 'Evidence list could not be refreshed.');
    }).finally(() => {
      if (!controller.signal.aborted) setDocumentsLoading(false);
    });

    return () => controller.abort();
  }, [canReadEvidence, evidence, projectId, siteId]);

  const openApproval = (record = null) => {
    setApprovalForm(record ? approvalToForm(record) : emptyApproval);
    setApprovalDialog({ open: true, record });
  };

  const saveApproval = async (event) => {
    event.preventDefault();
    if (!projectId) return toast.error('Select a RERA Project first');
    if (!approvalForm.approval_type.trim()) return toast.error('Enter an approval type');
    setBusy(true);
    try {
      const writableApproval = writablePolicyPayload(approvalForm, 'rera_approvals', getFieldPolicy);
      if (!canReviewApprovals) delete writableApproval.review_status;
      const payload = cleanPayload({
        site_id: siteId,
        project_id: projectId,
        ...writableApproval,
      });
      const id = recordId(approvalDialog.record);
      await (id ? api.patch(`/rera/approvals/${id}`, payload) : api.post('/rera/approvals', payload));
      toast.success(id ? 'Approval record updated' : 'Approval record created');
      setApprovalDialog({ open: false, record: null });
      onChanged?.();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Approval record could not be saved');
    } finally {
      setBusy(false);
    }
  };

  const uploadEvidence = async (event) => {
    event.preventDefault();
    if (!projectId) return toast.error('Select a RERA Project first');
    if (!uploadForm.file) return toast.error('Select a document');
    setBusy(true);
    try {
      const body = new FormData();
      body.append('site_id', String(siteId));
      Object.entries(writablePolicyPayload(
        uploadForm,
        'rera_evidence',
        getFieldPolicy,
      )).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') body.append(key, value);
      });
      const { data } = await api.post(`/compliance-documents/RERA_PROJECT/${projectId}`, body);
      const document = data?.document;
      if (document) setDocuments((current) => [document, ...current.filter((item) => item.id !== document.id)]);
      toast.success('Evidence uploaded and queued for document processing');
      setUploadOpen(false);
      setUploadForm(emptyUpload);
      onChanged?.();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Evidence upload failed');
    } finally {
      setBusy(false);
    }
  };

  const previewDocument = async (document) => {
    const id = recordId(document);
    if (!id) return;
    try {
      const { data, headers } = await api.get(`/compliance-documents/file/${id}/content`, {
        params: { site_id: siteId },
        responseType: 'blob',
      });
      const mime = headers['content-type'] || document.mime_type || 'application/octet-stream';
      const objectUrl = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: mime }));
      openDoc({
        url: objectUrl,
        title: firstValue(document, ['title', 'original_name'], 'RERA evidence'),
        subtitle: evidenceReview(document).label,
        mime,
        revokeOnClose: true,
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Document access was not available');
    }
  };

  if (!project) {
    return (
      <CompactEmpty
        icon={FileText}
        title="Select a RERA Project"
        description="Approvals and evidence are always maintained in a specific project context."
        tall
      />
    );
  }

  return (
    <div className="space-y-9 py-2">
      {canReadApprovals && <section>
        <SectionHead
          title="Approval matrix"
          meta={approvalRows.length ? String(approvalRows.length) : null}
          description="Structured approval records; applicability comes from the active project configuration."
          actions={canWriteApprovals ? <Button type="button" size="sm" onClick={() => openApproval()}><Plus />Add approval</Button> : null}
        />
        {approvalRows.length ? (
          <Table>
            <TableHeader>
              <TableRow className="border-mr-line hover:bg-transparent">
                <TableHead>Approval</TableHead>
                <TableHead>Authority</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Valid until</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">Evidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvalRows.map((approval, index) => (
                <TableRow key={`${recordId(approval) ?? 'approval'}-${index}`} className="border-mr-line">
                  <TableCell>
                    <button type="button" onClick={() => setDetail({ type: 'approval', record: approval })} className="text-left text-[13px] font-medium text-mr-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue">
                      {firstValue(approval, ['approval_type', 'type', 'name'], 'Untitled approval')}
                    </button>
                  </TableCell>
                  <TableCell className="text-[12px] text-mr-muted">{firstValue(approval, ['authority', 'issuer'], 'Not recorded')}</TableCell>
                  <TableCell className="text-[12px] text-mr-muted">{firstValue(approval, ['reference_number', 'reference'], 'Not recorded')}</TableCell>
                  <TableCell><ReraStatus value={approval.status} /></TableCell>
                  <TableCell className="text-[12px] text-mr-muted">{formatDate(firstValue(approval, ['issue_date', 'issued_at']))}</TableCell>
                  <TableCell className="text-[12px] text-mr-muted">{formatDate(firstValue(approval, ['valid_until', 'expiry_date']))}</TableCell>
                  <TableCell className="text-[12px] text-mr-muted">{firstValue(approval, ['owner_name', 'responsible_user_name', 'owner'], 'Not assigned')}</TableCell>
                  <TableCell className="text-right text-[12px] font-medium tabular-nums text-mr-text">{firstValue(approval, ['evidence_count', 'document_count'], '—')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <CompactEmpty title="No approvals recorded" description="Add only approvals relevant to this project or generated by its active ruleset." action={canWriteApprovals ? <Button type="button" variant="outline" onClick={() => openApproval()}><Plus />Add approval</Button> : null} />
        )}
      </section>}

      {canReadEvidence && <section>
        <SectionHead
          title="Evidence"
          meta={documents.length ? String(documents.length) : null}
          description="Project evidence reuses the existing compliance document store and version metadata."
          actions={canWriteEvidence ? <Button type="button" variant="outline" size="sm" onClick={() => { setUploadForm(emptyUpload); setUploadOpen(true); }}><Upload />Upload evidence</Button> : null}
        />
        <InlineError>{documentsError}</InlineError>
        {documentsLoading && !documents.length ? (
          <div className="grid gap-3 py-4 sm:grid-cols-2 lg:grid-cols-3"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
        ) : documents.length ? (
          <div className="divide-y divide-mr-line">
            {documents.map((document, index) => {
              const review = evidenceReview(document);
              return (
                <button
                  type="button"
                  key={`${recordId(document) ?? 'evidence'}-${index}`}
                  onClick={() => setDetail({ type: 'evidence', record: document })}
                  className="flex w-full items-start gap-3 py-4 text-left transition-colors hover:bg-mr-surface-2/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-mr-blue-soft text-mr-blue"><FileText className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-mr-text">{firstValue(document, ['title', 'original_name'], 'Untitled evidence')}</span>
                    <span className="mt-1 block text-[11px] text-mr-muted">{document.version_no ? `v${document.version_no}` : 'Version not recorded'} · {readable(document.category)} · uploaded {formatDate(document.created_at)}</span>
                  </span>
                  <ReraStatus value={review.value} label={review.label} />
                </button>
              );
            })}
          </div>
        ) : (
          <CompactEmpty title="No project evidence uploaded" description="Upload supporting documents into the existing compliance document store." action={canWriteEvidence ? <Button type="button" variant="outline" onClick={() => setUploadOpen(true)}><Upload />Upload evidence</Button> : null} />
        )}
      </section>}

      <ApprovalDialog
        state={approvalDialog}
        setState={setApprovalDialog}
        form={approvalForm}
        setForm={setApprovalForm}
        phases={phaseRows}
        canReviewApprovals={canReviewApprovals}
        onSubmit={saveApproval}
        busy={busy}
      />

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload project evidence</DialogTitle>
            <DialogDescription>The file is stored with the existing compliance document service. Internal review does not represent authority verification.</DialogDescription>
          </DialogHeader>
          <form onSubmit={uploadEvidence} className="grid gap-4 sm:grid-cols-2">
            <FormField policyId="rera_evidence.file" label="File" required className="sm:col-span-2"><Input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={(event) => setUploadForm((current) => ({ ...current, file: event.target.files?.[0] || null }))} /></FormField>
            <FormField policyId="rera_evidence.title" label="Document title"><Input value={uploadForm.title} onChange={(event) => setUploadForm((current) => ({ ...current, title: event.target.value }))} /></FormField>
            <FormField policyId="rera_evidence.category" label="Document category"><Input value={uploadForm.category} onChange={(event) => setUploadForm((current) => ({ ...current, category: event.target.value }))} /></FormField>
            <FormField policyId="rera_evidence.confidentiality" label="Confidentiality">
              <Select value={uploadForm.confidentiality} onValueChange={(value) => setUploadForm((current) => ({ ...current, confidentiality: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="INTERNAL">Internal</SelectItem><SelectItem value="CONFIDENTIAL">Confidential</SelectItem><SelectItem value="RESTRICTED">Restricted</SelectItem></SelectContent>
              </Select>
            </FormField>
            <FormField policyId="rera_evidence.issuing_authority" label="Issuing authority"><Input value={uploadForm.issuing_authority} onChange={(event) => setUploadForm((current) => ({ ...current, issuing_authority: event.target.value }))} /></FormField>
            <FormField policyId="rera_evidence.issue_date" label="Issue date"><Input type="date" value={uploadForm.issue_date} onChange={(event) => setUploadForm((current) => ({ ...current, issue_date: event.target.value }))} /></FormField>
            <FormField policyId="rera_evidence.expiry_date" label="Expiry date"><Input type="date" value={uploadForm.expiry_date} onChange={(event) => setUploadForm((current) => ({ ...current, expiry_date: event.target.value }))} /></FormField>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Upload evidence</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={Boolean(detail)} onOpenChange={(open) => { if (!open) setDetail(null); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader className="pr-8">
            <SheetTitle>{detail?.type === 'approval' ? firstValue(detail?.record, ['approval_type', 'type', 'name'], 'Approval detail') : firstValue(detail?.record, ['title', 'original_name'], 'Evidence detail')}</SheetTitle>
            <SheetDescription>{detail?.type === 'approval' ? 'Structured project approval record.' : 'Document metadata from the existing evidence store.'}</SheetDescription>
          </SheetHeader>
          {detail?.type === 'approval' && detail.record && (
            <div className="mt-6">
              <DetailFact label="Status"><ReraStatus value={detail.record.status} /></DetailFact>
              <DetailFact label="Authority" value={firstValue(detail.record, ['authority', 'issuer'])} />
              <DetailFact label="Reference" value={firstValue(detail.record, ['reference_number', 'reference'])} />
              <DetailFact label="Issue date" value={formatDate(firstValue(detail.record, ['issue_date', 'issued_at']))} />
              <DetailFact label="Valid from" value={formatDate(detail.record.valid_from)} />
              <DetailFact label="Valid until" value={formatDate(firstValue(detail.record, ['valid_until', 'expiry_date']))} />
              <DetailFact label="Owner" value={firstValue(detail.record, ['owner_name', 'responsible_user_name', 'owner'])} />
              <DetailFact label="Review status" value={readable(detail.record.review_status)} />
              <DetailFact label="Source reference" value={firstValue(detail.record, ['source_reference', 'source_url'])} />
              <DetailFact label="Notes" value={detail.record.notes} />
              {canUpdateApprovals && <Button type="button" variant="outline" className="mt-6" onClick={() => { openApproval(detail.record); setDetail(null); }}><Pencil />Edit approval</Button>}
            </div>
          )}
          {detail?.type === 'evidence' && detail.record && (() => {
            const review = evidenceReview(detail.record);
            return (
              <div className="mt-6">
                <DetailFact label="Review status"><ReraStatus value={review.value} label={review.label} /></DetailFact>
                <DetailFact label="Category" value={readable(detail.record.category)} />
                <DetailFact label="Version" value={detail.record.version_no ? `v${detail.record.version_no}` : 'Not recorded'} />
                <DetailFact label="Issuing authority" value={detail.record.issuing_authority} />
                <DetailFact label="Issue date" value={formatDate(detail.record.issue_date)} />
                <DetailFact label="Expiry date" value={formatDate(detail.record.expiry_date)} />
                <DetailFact label="Uploaded by" value={detail.record.uploaded_by_name} />
                <DetailFact label="Document processing" value={readable(detail.record.ocr_status)} />
                <Button type="button" variant="outline" className="mt-6" onClick={() => previewDocument(detail.record)}><ExternalLink />Preview document</Button>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ApprovalDialog({ state, setState, form, setForm, phases, canReviewApprovals, onSubmit, busy }) {
  const editing = Boolean(state.record);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <Dialog open={state.open} onOpenChange={(open) => setState((current) => ({ ...current, open }))}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit approval record' : 'Add approval record'}</DialogTitle>
          <DialogDescription>Approval type is entered from the applicable project requirement; the UI does not assume universal applicability.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <FormField policyId="rera_approvals.approval_type" label="Approval type" required><Input value={form.approval_type} onChange={(event) => set('approval_type', event.target.value)} /></FormField>
          <FormField policyId="rera_approvals.phase_id" label="Phase">
            <Select value={form.phase_id || 'PROJECT'} onValueChange={(value) => set('phase_id', value === 'PROJECT' ? '' : value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PROJECT">Project level</SelectItem>
                {phases.map((phase, index) => {
                  const id = firstValue(phase, ['id', 'phase_id']);
                  return id ? <SelectItem key={`${id}-${index}`} value={String(id)}>{firstValue(phase, ['name', 'phase_name'], `Phase ${id}`)}</SelectItem> : null;
                })}
              </SelectContent>
            </Select>
          </FormField>
          <FormField policyId="rera_approvals.authority" label="Authority / issuer"><Input value={form.authority} onChange={(event) => set('authority', event.target.value)} /></FormField>
          <FormField policyId="rera_approvals.reference_number" label="Reference number"><Input value={form.reference_number} onChange={(event) => set('reference_number', event.target.value)} /></FormField>
          <FormField policyId="rera_approvals.status" label="Status">
            <Select value={form.status} onValueChange={(value) => set('status', value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{APPROVAL_STATUSES.map((value) => <SelectItem key={value} value={value}>{readable(value)}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField policyId="rera_approvals.review_status" label="Review status">
            <Select value={form.review_status} onValueChange={(value) => set('review_status', value)} disabled={!canReviewApprovals}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="NOT_REVIEWED">Not reviewed</SelectItem><SelectItem value="UNDER_REVIEW">Under review</SelectItem><SelectItem value="REVIEWED">Evidence reviewed</SelectItem><SelectItem value="RETURNED">Returned</SelectItem><SelectItem value="NOT_REQUIRED">Review not required</SelectItem></SelectContent>
            </Select>
          </FormField>
          <FormField policyId="rera_approvals.issue_date" label="Issue date"><Input type="date" value={form.issue_date} onChange={(event) => set('issue_date', event.target.value)} /></FormField>
          <FormField policyId="rera_approvals.valid_from" label="Valid from"><Input type="date" value={form.valid_from} onChange={(event) => set('valid_from', event.target.value)} /></FormField>
          <FormField policyId="rera_approvals.valid_until" label="Valid until"><Input type="date" value={form.valid_until} onChange={(event) => set('valid_until', event.target.value)} /></FormField>
          <FormField policyId="rera_approvals.owner_name" label="Responsible owner"><Input value={form.owner_name} onChange={(event) => set('owner_name', event.target.value)} /></FormField>
          <FormField policyId="rera_approvals.source_reference" label="Source reference" className="sm:col-span-2"><Input value={form.source_reference} onChange={(event) => set('source_reference', event.target.value)} /></FormField>
          <FormField policyId="rera_approvals.notes" label="Notes" className="sm:col-span-2"><Textarea value={form.notes} onChange={(event) => set('notes', event.target.value)} /></FormField>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setState({ open: false, record: null })}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />}{editing ? 'Save changes' : 'Add approval'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
