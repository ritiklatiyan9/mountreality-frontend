import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  AlertCircle, Building2, Camera, Check, CheckCircle2, ChevronRight,
  FileText, Fingerprint, Loader2, Phone, RefreshCw, ScanLine, Search, ShieldCheck,
  Sparkles, Upload, UserPlus, X,
} from 'lucide-react';
import {
  createSharedKycCase, getSharedKycAiPreview, getSharedKycCase,
  getSharedKycDocument, retrySharedKycDocument,
  uploadSharedKycDocument, verifySharedKycCase,
} from '../api/accountKycApi';
import api from '../api/api';
import { KYC_WORKSPACE_STEPS } from './memberKycFields';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';

const MotionDiv = motion.div;
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const toIsoDate = (value) => {
  if (!value) return '';
  const text = String(value).trim();
  const match = text.match(/^(\d{2})[/\-.](\d{2})[/\-.](\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
};

// Canonical aliases keep the Accounts form tolerant of older OCR result rows.
const EXTRACT_TO_MEMBER = {
  name: 'full_name', full_name: 'full_name',
  father_name: 'father_name', mother_name: 'mother_name', spouse_name: 'spouse_name',
  dob: ['date_of_birth', toIsoDate], date_of_birth: ['date_of_birth', toIsoDate],
  gender: 'gender', marital_status: 'marital_status', religion: 'religion',
  nationality: 'nationality', qualification: 'qualification', occupation: 'occupation',
  company_name: 'company_name', mobile: 'phone', phone: 'phone', alt_phone: 'alt_phone',
  whatsapp: 'whatsapp', email: 'email', address: 'address', city: 'city', state: 'state',
  pincode: 'pincode', aadhaar: 'aadhar_no', aadhar_no: 'aadhar_no', pan: 'pan_no',
  pan_no: 'pan_no', voter_id: 'voter_id', passport_no: 'passport_no',
  passport: 'passport_no', driving_license_no: 'driving_license_no', dl: 'driving_license_no',
  gst_no: 'gst_no',
  nominee_name: 'nominee_name',
  nominee_relation: 'nominee_relation', nominee_phone: 'nominee_phone', bank_name: 'bank_name',
  account_number: 'account_no', account_no: 'account_no', ifsc: 'ifsc_code',
  ifsc_code: 'ifsc_code', branch: 'branch',
};

const REVIEW_FIELDS = [
  ['full_name', 'Full name'], ['phone', 'Mobile number'], ['father_name', 'Father / husband'],
  ['mother_name', 'Mother name'], ['spouse_name', 'Spouse name'],
  ['date_of_birth', 'Date of birth'], ['gender', 'Gender'],
  ['marital_status', 'Marital status'], ['religion', 'Religion'],
  ['nationality', 'Nationality'], ['qualification', 'Qualification'],
  ['occupation', 'Occupation'], ['company_name', 'Company name'], ['address', 'Address'],
  ['city', 'City'], ['state', 'State'], ['pincode', 'Pincode'], ['aadhar_no', 'Aadhaar'],
  ['pan_no', 'PAN'], ['voter_id', 'Voter ID'], ['passport_no', 'Passport'],
  ['driving_license_no', 'Driving licence'], ['gst_no', 'GST number'], ['bank_name', 'Bank'],
  ['account_no', 'Account number'], ['ifsc_code', 'IFSC'], ['branch', 'Branch'],
  ['nominee_name', 'Nominee'], ['nominee_relation', 'Nominee relation'],
  ['nominee_phone', 'Nominee phone'], ['email', 'Email'], ['alt_phone', 'Alternate phone'],
  ['whatsapp', 'WhatsApp'],
];

const MEMBER_UPDATE_FIELDS = REVIEW_FIELDS.map(([key]) => key);

const errorMessage = (error, fallback) =>
  error?.response?.data?.message || (error?.code === 'ERR_NETWORK'
    ? 'The Accounts KYC service is unavailable. Please retry in a moment.'
    : fallback);

const mapExtraction = (extracted = {}) => {
  const mapped = {};
  for (const [sourceKey, rawValue] of Object.entries(extracted || {})) {
    if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') continue;
    const specification = EXTRACT_TO_MEMBER[sourceKey];
    if (!specification) continue;
    const [targetKey, transform] = Array.isArray(specification)
      ? specification
      : [specification, (value) => String(value).trim()];
    const value = transform(rawValue);
    if (value && !mapped[targetKey]) mapped[targetKey] = value;
  }
  return mapped;
};

const mapConfidence = (confidence = {}) => {
  const mapped = {};
  for (const [sourceKey, rawValue] of Object.entries(confidence || {})) {
    const specification = EXTRACT_TO_MEMBER[sourceKey];
    if (!specification) continue;
    const targetKey = Array.isArray(specification) ? specification[0] : specification;
    const score = Number(rawValue);
    if (Number.isFinite(score) && mapped[targetKey] === undefined) mapped[targetKey] = score;
  }
  return mapped;
};

const mergeOnlyEmpty = (current, extracted) => {
  const next = { ...current };
  const mapped = mapExtraction(extracted);
  for (const [key, value] of Object.entries(mapped)) if (!next[key]) next[key] = value;
  return next;
};

const latestDocument = (documents = []) => documents.reduce(
  (latest, document) => (!latest || Number(document.id) > Number(latest.id) ? document : latest),
  null,
);

const aadhaarDocumentsBySide = (definition, documents) => {
  const matching = (documents || []).filter((document) => document.type === definition.ocrType);
  let front = latestDocument(matching.filter(
    (document) => document.member_document_field === definition.memberFields[0],
  ));
  let back = latestDocument(matching.filter(
    (document) => document.member_document_field === definition.memberFields[1],
  ));
  const legacy = matching
    .filter((document) => !document.member_document_field)
    .sort((left, right) => Number(left.id) - Number(right.id));
  if (!front && !back) [front, back] = legacy.slice(-2);
  else if (!front) front = legacy.at(-1) || null;
  else if (!back) back = legacy.at(-1) || null;
  return [front || null, back || null];
};

const documentsForDefinition = (definition, documents) => {
  if (definition.key === 'aadhaar') {
    return aadhaarDocumentsBySide(definition, documents).filter(Boolean);
  }
  const matching = (documents || []).filter((document) => document.type === definition.ocrType);
  const labelled = matching.filter(
    (document) => document.member_document_field === definition.memberFields[0],
  );
  return [latestDocument(labelled.length ? labelled : matching)].filter(Boolean);
};

const documentForDefinition = (definition, documents, sideIndex = 0) => {
  if (definition.key === 'aadhaar') {
    return aadhaarDocumentsBySide(definition, documents)[sideIndex] || null;
  }
  return documentsForDefinition(definition, documents)[0] || null;
};

const completedCountForDefinition = (definition, documents) => {
  const matching = definition.key === 'aadhaar'
    ? aadhaarDocumentsBySide(definition, documents)
    : documentsForDefinition(definition, documents);
  return Math.min(
    definition.requiredCount || 1,
    matching.slice(0, definition.requiredCount || 1)
      .filter((document) => document?.ocr_status === 'DONE').length,
  );
};

const definitionIsComplete = (definition, documents) =>
  completedCountForDefinition(definition, documents) >= (definition.requiredCount || 1);

const previewKeyForDefinition = (definition, sideIndex = 0) =>
  definition.key === 'aadhaar' ? definition.memberFields[sideIndex] : definition.key;

const Pane = ({ className = '', children }) => (
  <section className={`h-full w-full min-h-0 overflow-hidden bg-white lg:rounded-2xl lg:border lg:border-slate-200 lg:shadow-sm ${className}`}>
    {children}
  </section>
);

const Pipeline = ({ status }) => {
  const steps = ['Store file', 'Read document', 'Extract fields', 'Ready to review'];
  const active = status === 'uploading' ? 0 : status === 'processing' ? 2 : status === 'done' ? 4 : 0;
  return (
    <div className="mx-auto w-full max-w-sm space-y-3">
      {steps.map((label, index) => {
        const complete = index < active;
        const running = index === active && active < 4;
        return (
          <div key={label} className="flex items-center gap-3">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${complete ? 'bg-emerald-500 text-white' : running ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
              {complete ? <Check className="h-3.5 w-3.5" /> : running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : index + 1}
            </span>
            <div className="flex-1"><p className={`text-xs font-medium ${complete ? 'text-emerald-700' : running ? 'text-slate-900' : 'text-slate-400'}`}>{label}</p><div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">{(complete || running) && <MotionDiv className={`h-full rounded-full ${complete ? 'bg-emerald-500' : 'bg-blue-500'}`} initial={{ width: complete ? '100%' : '12%' }} animate={{ width: complete ? '100%' : '84%' }} transition={{ duration: running ? 8 : 0.2 }} />}</div></div>
          </div>
        );
      })}
    </div>
  );
};

export const MemberKycDialog = ({
  open, onOpenChange, editingId, form, setForm, currentSite, docPreviews, photoPreview,
  onKycStarted, onVerified, presentation = 'dialog', autoStart = false,
}) => {
  const [screen, setScreen] = useState('start');
  const [kycCase, setKycCase] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [selectedKey, setSelectedKey] = useState(KYC_WORKSPACE_STEPS[0].key);
  const [selectedSide, setSelectedSide] = useState(0);
  const [mobilePane, setMobilePane] = useState('documents');
  const [localPreviews, setLocalPreviews] = useState({});
  const [confidence, setConfidence] = useState({});
  const [uploadState, setUploadState] = useState(null);
  const [starting, setStarting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const nameRef = useRef(null);
  const phoneRef = useRef(null);
  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const runIdRef = useRef(0);
  const autoStartKeyRef = useRef('');
  const startKycRef = useRef(null);

  const selectedDefinition = KYC_WORKSPACE_STEPS.find((document) => document.key === selectedKey) || KYC_WORKSPACE_STEPS[0];
  const selectedDocument = documentForDefinition(selectedDefinition, documents, selectedSide);
  const selectedMemberField = selectedDefinition.memberFields[selectedSide] || selectedDefinition.memberFields[0];
  const selectedPreviewKey = previewKeyForDefinition(selectedDefinition, selectedSide);
  const selectedPreview = localPreviews[selectedPreviewKey]
    || selectedDocument?.file_url
    || (selectedDefinition.photo ? photoPreview : docPreviews?.[selectedMemberField]);
  const completedDocuments = documents.filter((document) => document.ocr_status === 'DONE').length;
  const aadhaarDefinition = KYC_WORKSPACE_STEPS.find((definition) => definition.key === 'aadhaar');
  const aadhaarReadyCount = completedCountForDefinition(aadhaarDefinition, documents);
  const aadhaarFrontAvailable = documentForDefinition(aadhaarDefinition, documents, 0)?.ocr_status === 'DONE';
  const hasOcrInProgress = KYC_WORKSPACE_STEPS.some((definition) =>
    documentsForDefinition(definition, documents)
      .some((document) => ['PENDING', 'PROCESSING'].includes(document.ocr_status)))
    || ['uploading', 'processing'].includes(uploadState?.status);
  const visibleReviewFields = useMemo(() => {
    const populated = REVIEW_FIELDS.filter(([key]) => form[key]);
    const essentials = REVIEW_FIELDS.filter(([key]) => ['full_name', 'phone'].includes(key));
    return [...new Map([...essentials, ...populated].map((field) => [field[0], field])).values()];
  }, [form]);

  const resetWorkspace = () => {
    runIdRef.current += 1;
    setScreen('start');
    setKycCase(null);
    setDocuments([]);
    setSelectedKey(KYC_WORKSPACE_STEPS[0].key);
    setSelectedSide(0);
    setMobilePane('documents');
    setLocalPreviews({});
    setConfidence({});
    setUploadState(null);
    setStarting(false);
    setAiLoading(false);
    setVerifying(false);
    autoStartKeyRef.current = '';
  };

  const close = () => {
    if (starting || verifying) return;
    resetWorkspace();
    onOpenChange(false);
  };

  const mergeDocumentsIntoForm = (items, baseForm = form) => {
    let next = { ...baseForm };
    let nextConfidence = {};
    for (const document of items || []) {
      next = mergeOnlyEmpty(next, document.extracted_fields || {});
      nextConfidence = { ...nextConfidence, ...mapConfidence(document.confidence_map || {}) };
    }
    setForm(next);
    setConfidence((previous) => ({ ...previous, ...nextConfidence }));
  };

  const startKyc = async (event) => {
    event?.preventDefault();
    const fullName = String(form.full_name || '').trim();
    const phone = String(form.phone || '').replace(/\D/g, '');
    const hasMemberRef = Boolean(editingId);
    if (!fullName) return toast.error('Enter the customer name');
    if (!hasMemberRef && phone.length < 6) return toast.error('Enter a valid mobile number');
    if (!currentSite?.id) return toast.error('Select a site first');

    setStarting(true);
    try {
      const createPayload = editingId
        ? { site_id: Number(currentSite.id), client_member_id: Number(editingId) }
        : { site_id: Number(currentSite.id), full_name: fullName, phone };
      const created = await createSharedKycCase(createPayload);
      const createdClientPhone = String(created.client_phone || '').replace(/\D/g, '');

      const detail = await getSharedKycCase(created.id);
      const resolvedName = created.client_name || detail.client_name || fullName;
      const resolvedPhone = created.client_phone || detail.client_phone || createdClientPhone || phone;
      const sharedMemberForm = { ...form, full_name: resolvedName, phone: resolvedPhone };
      setKycCase(detail);
      setDocuments(detail.documents || []);
      mergeDocumentsIntoForm(detail.documents || [], sharedMemberForm);
      setScreen('workspace');
      setMobilePane('documents');
      onKycStarted?.({ ...created, client_name: resolvedName, client_phone: resolvedPhone });
      toast.success(`KYC opened for ${resolvedName}`);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not start the shared KYC'));
    } finally {
      setStarting(false);
    }
  };
  startKycRef.current = startKyc;

  useEffect(() => {
    if (!autoStart || !open || screen !== 'start' || starting || !editingId || !currentSite?.id) return;
    const key = `${editingId}:${currentSite.id}`;
    if (autoStartKeyRef.current === key) return;
    autoStartKeyRef.current = key;
    startKycRef.current?.();
  }, [autoStart, currentSite?.id, editingId, open, screen, starting]);

  const selectDocument = (definition) => {
    setSelectedKey(definition.key);
    setSelectedSide(definition.key === 'aadhaar'
      && completedCountForDefinition(definition, documents) === 1 ? 1 : 0);
    setUploadState(null);
    setMobilePane('preview');
  };

  const chooseNextMissing = (currentKey, nextDocuments) => {
    const currentIndex = KYC_WORKSPACE_STEPS.findIndex((definition) => definition.key === currentKey);
    const ordered = [
      ...KYC_WORKSPACE_STEPS.slice(currentIndex + 1),
      ...KYC_WORKSPACE_STEPS.slice(0, currentIndex + 1),
    ];
    const next = ordered.find((definition) => !definitionIsComplete(definition, nextDocuments));
    if (next) {
      setSelectedKey(next.key);
      setSelectedSide(next.key === 'aadhaar'
        && completedCountForDefinition(next, nextDocuments) === 1 ? 1 : 0);
      setMobilePane('documents');
    } else {
      setMobilePane('review');
    }
  };

  const readPreview = (file, key) => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setLocalPreviews((previous) => ({ ...previous, [key]: reader.result }));
      reader.readAsDataURL(file);
    } else {
      setLocalPreviews((previous) => ({ ...previous, [key]: 'pdf' }));
    }
  };

  const uploadDocument = async (file) => {
    if (!kycCase?.id || !file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error('Document must be smaller than 10 MB');
    const definition = selectedDefinition;
    const sideIndex = definition.key === 'aadhaar' ? selectedSide : 0;
    if (definition.key === 'aadhaar' && sideIndex === 1 && !aadhaarFrontAvailable) {
      setSelectedSide(0);
      return toast.error('Upload the Aadhaar front side first');
    }
    const memberDocumentField = definition.memberFields[sideIndex] || definition.memberFields[0];
    const previewKey = previewKeyForDefinition(definition, sideIndex);
    const thisRun = ++runIdRef.current;
    readPreview(file, previewKey);
    setUploadState({ key: definition.key, sideIndex, status: 'uploading', fileName: file.name });
    setMobilePane('preview');

    try {
      const payload = new FormData();
      payload.append('file', file);
      payload.append('kyc_case_id', kycCase.id);
      payload.append('type', definition.ocrType);
      payload.append('member_document_field', memberDocumentField);
      const uploaded = await uploadSharedKycDocument(payload);
      if (runIdRef.current !== thisRun) return;
      setUploadState({ key: definition.key, sideIndex, status: 'processing', documentId: uploaded.documentId, fileName: file.name });

      let result = null;
      // Backend OCR and field structuring each have a 120s safety timeout. Keep
      // the durable status poll alive beyond that combined upper bound.
      for (let attempt = 0; attempt < 240; attempt += 1) {
        await wait(attempt < 4 ? 700 : 1200);
        if (runIdRef.current !== thisRun) return;
        result = await getSharedKycDocument(uploaded.documentId);
        if (result.ocr_status === 'DONE' || result.ocr_status === 'FAILED') break;
      }
      if (!result || result.ocr_status !== 'DONE') {
        throw new Error(result?.ocr_error || 'AI processing did not finish. Use Retry.');
      }

      const nextDocuments = [...documents.filter((document) => document.id !== result.id), result];
      setDocuments(nextDocuments);
      setForm((previous) => mergeOnlyEmpty(previous, result.extracted_fields || {}));
      setConfidence((previous) => ({ ...previous, ...mapConfidence(result.confidence_map || {}) }));
      setUploadState({ key: definition.key, sideIndex, status: 'done', documentId: result.id, fileName: file.name });

      if (definition.key === 'aadhaar' && sideIndex === 0
        && completedCountForDefinition(definition, nextDocuments) < 2) {
        toast.success('Aadhaar front saved. Now upload the compulsory back side.');
        await wait(350);
        if (runIdRef.current === thisRun) {
          setSelectedSide(1);
          setUploadState(null);
          setMobilePane('preview');
        }
        return;
      }

      toast.success(definition.photo
        ? 'Customer photo saved to the Accounts KYC timeline'
        : `${definition.label} read by Accounts AI OCR`);
      await wait(450);
      if (runIdRef.current === thisRun) chooseNextMissing(definition.key, nextDocuments);
    } catch (error) {
      if (runIdRef.current !== thisRun) return;
      setUploadState((previous) => ({ ...previous, status: 'failed', error: errorMessage(error, error.message || 'Document processing failed') }));
      toast.error(errorMessage(error, error.message || 'Document processing failed'));
    }
  };

  const retryDocument = async () => {
    const documentId = uploadState?.documentId || selectedDocument?.id;
    if (!documentId) return;
    const thisRun = ++runIdRef.current;
    const sideIndex = selectedKey === 'aadhaar' ? (uploadState?.sideIndex ?? selectedSide) : 0;
    setUploadState({ key: selectedKey, sideIndex, status: 'processing', documentId });
    try {
      await retrySharedKycDocument(documentId);
      if (runIdRef.current !== thisRun) return;
      let result = null;
      for (let attempt = 0; attempt < 270; attempt += 1) {
        await wait(1000);
        if (runIdRef.current !== thisRun) return;
        result = await getSharedKycDocument(documentId);
        if (result.ocr_status === 'DONE' || result.ocr_status === 'FAILED') break;
      }
      if (runIdRef.current !== thisRun) return;
      if (!result || result.ocr_status !== 'DONE') throw new Error(result?.ocr_error || 'Retry failed');
      const nextDocuments = [...documents.filter((document) => document.id !== result.id), result];
      setDocuments(nextDocuments);
      setForm((previous) => mergeOnlyEmpty(previous, result.extracted_fields || {}));
      setConfidence((previous) => ({ ...previous, ...mapConfidence(result.confidence_map || {}) }));
      setUploadState({ key: selectedKey, sideIndex, status: 'done', documentId });
      if (selectedKey === 'aadhaar' && sideIndex === 0
        && completedCountForDefinition(selectedDefinition, nextDocuments) < 2) {
        setSelectedSide(1);
        setUploadState(null);
        setMobilePane('preview');
        toast.success('Aadhaar front is ready. Now upload the compulsory back side.');
        return;
      }
      toast.success('Document processed successfully');
    } catch (error) {
      if (runIdRef.current !== thisRun) return;
      setUploadState((previous) => ({ ...previous, status: 'failed', error: errorMessage(error, 'Retry failed') }));
      toast.error(errorMessage(error, 'Retry failed'));
    }
  };

  const runAiAutofill = async () => {
    if (!kycCase?.id) return;
    const thisRun = runIdRef.current;
    setAiLoading(true);
    try {
      const { extracted } = await getSharedKycAiPreview(kycCase.id);
      if (runIdRef.current !== thisRun) return;
      setForm((previous) => mergeOnlyEmpty(previous, extracted || {}));
      setMobilePane('review');
      toast.success('Accounts AI combined all documents into the member form');
    } catch (error) {
      if (runIdRef.current !== thisRun) return;
      toast.error(errorMessage(error, 'Could not build the AI preview'));
    } finally {
      if (runIdRef.current === thisRun) setAiLoading(false);
    }
  };

  const verify = async () => {
    if (!kycCase?.id) return;
    if (hasOcrInProgress) return toast.error('Wait for document processing to finish');
    if (aadhaarReadyCount < 2) {
      setSelectedKey('aadhaar');
      setSelectedSide(aadhaarReadyCount === 1 ? 1 : 0);
      setUploadState(null);
      setMobilePane('preview');
      return toast.error(`Aadhaar front and back are compulsory (${aadhaarReadyCount}/2 uploaded)`);
    }
    setVerifying(true);
    try {
      let finalForm = { ...form };
      try {
        const { extracted } = await getSharedKycAiPreview(kycCase.id);
        finalForm = mergeOnlyEmpty(finalForm, extracted || {});
        setForm(finalForm);
      } catch {
        // Per-document OCR fields are already merged, so verification can continue.
      }
      const memberUpdate = {};
      for (const key of MEMBER_UPDATE_FIELDS) if (finalForm[key] !== undefined && finalForm[key] !== '') memberUpdate[key] = finalForm[key];
      await verifySharedKycCase(kycCase.id, {
        member_update: memberUpdate,
        expected_member_updated_at: kycCase.member_updated_at,
      });
      toast.success('KYC verified — the Accounts member profile is updated');
      resetWorkspace();
      onVerified?.();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not verify this KYC'));
    } finally {
      setVerifying(false);
    }
  };

  const advanceOnEnter = (event) => {
    if (event.key !== 'Enter' || event.target.tagName !== 'INPUT' || event.target.type === 'file') return;
    const fields = [...event.currentTarget.querySelectorAll('[data-enter-field]')]
      .filter((element) => !element.disabled && element.offsetParent !== null);
    const index = fields.indexOf(event.target);
    if (index >= 0 && index < fields.length - 1) {
      event.preventDefault();
      fields[index + 1].focus();
      fields[index + 1].select?.();
    }
  };

  const renderStart = () => (
    <div className="p-5 sm:p-7">
      {presentation === 'page' ? (
        <div className="text-left">
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25"><ScanLine className="h-5 w-5" /></div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-950">{editingId ? 'Open member KYC' : 'Start a new KYC'}</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            {editingId
              ? 'Member profile and shared KYC case are opened from member data. Accounts AI fills the remaining details from uploaded documents.'
              : 'Only name and mobile are needed. Accounts AI fills the remaining profile from uploaded documents.'}
          </p>
        </div>
      ) : (
        <DialogHeader className="text-left">
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25"><ScanLine className="h-5 w-5" /></div>
          <DialogTitle className="text-xl">{editingId ? 'Open member KYC' : 'Start a new KYC'}</DialogTitle>
          <DialogDescription>
            {editingId
              ? 'Member profile and shared KYC case are opened from member data. Accounts AI fills the remaining details from uploaded documents.'
              : 'Only name and mobile are needed. Accounts AI fills the remaining profile from uploaded documents.'}
          </DialogDescription>
        </DialogHeader>
      )}
      <form onSubmit={startKyc} className="mt-6 space-y-4">
        <div className="space-y-1.5"><Label>Customer name <span className="text-red-500">*</span></Label><Input ref={nameRef} autoFocus data-enter-field value={form.full_name} onChange={(event) => setForm((previous) => ({ ...previous, full_name: event.target.value.toUpperCase() }))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); phoneRef.current?.focus(); } }} placeholder="Customer name" /></div>
        <div className="space-y-1.5"><Label>Mobile number {editingId ? <span className="text-xs text-slate-500">(optional if already saved)</span> : <span className="text-red-500">*</span>}</Label><div className="relative"><Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input ref={phoneRef} data-enter-field type="tel" inputMode="numeric" className="pl-9" value={form.phone} onChange={(event) => setForm((previous) => ({ ...previous, phone: event.target.value }))} placeholder="10-digit mobile number" /></div></div>
        <div className="flex gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-800"><Sparkles className="mt-0.5 h-4 w-4 shrink-0" /><p>A member record and shared KYC case are created immediately. Aadhaar, PAN, address and bank fields come from the next document step.</p></div>
        <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="outline" onClick={close} disabled={starting}>Cancel</Button><Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={starting}>{starting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ScanLine className="mr-1.5 h-4 w-4" />}{starting ? 'Opening KYC...' : 'Start KYC'}</Button></div>
      </form>
    </div>
  );

  const renderDocumentRail = () => (
    <Pane className={`${mobilePane === 'documents' ? 'flex' : 'hidden'} flex-col lg:flex`}>
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-3 py-2.5"><div><p className="text-xs font-semibold text-slate-900">KYC timeline</p><p className="text-[10px] text-slate-500">Photo and documents in one flow</p></div><Badge className="bg-blue-50 text-[10px] text-blue-700 hover:bg-blue-50">{completedDocuments} ready</Badge></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {KYC_WORKSPACE_STEPS.map((definition, index) => {
          const readyCount = completedCountForDefinition(definition, documents);
          const complete = definitionIsComplete(definition, documents);
          const hasSavedPreview = definition.photo
            ? Boolean(photoPreview || localPreviews.photo)
            : definition.memberFields.some((field) => Boolean(docPreviews?.[field] || localPreviews[field]));
          const hasPreview = documentsForDefinition(definition, documents).length > 0 || hasSavedPreview;
          const processing = uploadState?.key === definition.key && ['uploading', 'processing'].includes(uploadState.status);
          const active = definition.key === selectedKey;
          const status = processing
            ? (definition.photo ? 'Saving photo...' : 'Accounts AI is reading...')
            : definition.key === 'aadhaar'
              ? (readyCount === 2 ? 'Front + back complete' : readyCount === 1 ? '1/2 · back side required' : '0/2 · both sides required')
              : complete ? 'Uploaded' : hasPreview ? 'Saved on member · upload to verify' : definition.description;
          return (
            <button type="button" key={definition.key} onClick={() => selectDocument(definition)} className={`mb-1 flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition ${active ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20' : 'hover:bg-slate-50'}`}>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${active ? 'bg-white/15' : complete ? 'bg-emerald-50 text-emerald-600' : hasPreview ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : complete ? <Check className="h-3.5 w-3.5" /> : definition.photo ? <Camera className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 truncate text-xs font-semibold">{definition.label}{definition.required && <span className={`text-[8px] font-bold uppercase ${active ? 'text-blue-100' : 'text-red-500'}`}>Required</span>}</span>
                <span className={`block truncate text-[10px] ${active ? 'text-blue-100' : processing || (definition.required && !complete) ? 'text-amber-600' : 'text-slate-400'}`}>{status}</span>
              </span>
              <ChevronRight className="h-3.5 w-3.5 opacity-50" />
            </button>
          );
        })}
      </div>
    </Pane>
  );

  const renderPreview = () => {
    const currentUpload = uploadState?.key === selectedKey
      && (selectedKey !== 'aadhaar' || uploadState.sideIndex === selectedSide);
    const uploadLabel = selectedDefinition.key === 'aadhaar'
      ? `Aadhaar ${selectedDefinition.sideLabels[selectedSide].toLowerCase()}`
      : selectedDefinition.label;
    return (
      <Pane className={`${mobilePane === 'preview' ? 'flex' : 'hidden'} flex-col lg:flex`}>
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-xs font-semibold text-slate-900">{selectedDefinition.label}</p><Badge variant="outline" className="text-[9px]">ACCOUNTS AI</Badge></div><p className="truncate text-[10px] text-slate-500">{selectedDefinition.description}</p></div>{selectedDocument?.ocr_status === 'DONE' && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />}</div>
        {selectedDefinition.key === 'aadhaar' && (
          <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-slate-100 bg-white px-4 py-2">
            {selectedDefinition.sideLabels.map((label, index) => {
              const sideDocument = documentForDefinition(selectedDefinition, documents, index);
              const sideReady = sideDocument?.ocr_status === 'DONE';
              const disabled = index === 1 && !aadhaarFrontAvailable;
              return <button type="button" key={label} disabled={disabled} onClick={() => { setSelectedSide(index); setUploadState(null); }} className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-semibold transition ${selectedSide === index ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600/10' : disabled ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50/50'}`}><span className={`flex h-4 w-4 items-center justify-center rounded-full text-[8px] ${sideReady ? 'bg-emerald-500 text-white' : selectedSide === index ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{sideReady ? <Check className="h-2.5 w-2.5" /> : index + 1}</span>{label}<span className="text-[8px] font-bold uppercase opacity-70">Required</span></button>;
            })}
          </div>
        )}
        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-slate-50/70 p-4">
          {currentUpload && ['uploading', 'processing'].includes(uploadState.status) ? <Pipeline status={uploadState.status} /> : currentUpload && uploadState.status === 'failed' ? <div className="max-w-sm text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600"><AlertCircle className="h-6 w-6" /></div><p className="mt-3 text-sm font-semibold text-slate-900">AI could not finish this document</p><p className="mt-1 text-xs leading-5 text-slate-500">{uploadState.error}</p><Button type="button" variant="outline" size="sm" className="mt-4" onClick={retryDocument}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Retry</Button></div> : selectedPreview ? <div className="flex h-full w-full flex-col items-center justify-center">{selectedPreview === 'pdf' ? <div className="flex h-40 w-32 items-center justify-center rounded-xl border bg-white text-red-500 shadow-sm"><FileText className="h-12 w-12" /></div> : <img src={selectedPreview} alt={uploadLabel} className={selectedDefinition.photo ? 'h-56 w-44 rounded-3xl border-4 border-white object-cover shadow-lg ring-1 ring-slate-200' : 'max-h-[calc(100%-60px)] max-w-full rounded-xl border border-slate-200 object-contain shadow-sm'} />}<div className="mt-3 flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="mr-1.5 h-3.5 w-3.5" />Upload another</Button><Button type="button" variant="ghost" size="sm" onClick={() => setMobilePane('review')}>Review data<ChevronRight className="ml-1 h-3.5 w-3.5" /></Button></div></div> : <div className="max-w-sm text-center"><div className={`mx-auto flex h-16 w-16 items-center justify-center bg-white text-blue-600 shadow-sm ring-1 ring-slate-200 ${selectedDefinition.photo ? 'rounded-full' : 'rounded-2xl'}`}>{selectedDefinition.photo ? <Camera className="h-7 w-7" /> : <Upload className="h-7 w-7" />}</div><p className="mt-4 text-sm font-semibold text-slate-900">Upload {uploadLabel}</p><p className="mt-1 text-xs leading-5 text-slate-500">{selectedDefinition.photo ? 'Clear front-facing JPG, PNG or WebP' : 'Clear JPG, PNG or PDF'} · maximum 10 MB</p>{selectedDefinition.key === 'aadhaar' && <p className="mt-1 text-[10px] font-medium text-amber-600">Both front and back are compulsory to verify KYC.</p>}<div className="mt-4 flex justify-center gap-2"><Button type="button" size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => fileRef.current?.click()}><Upload className="mr-1.5 h-3.5 w-3.5" />Browse</Button><Button type="button" size="sm" variant="outline" onClick={() => cameraRef.current?.click()}><Camera className="mr-1.5 h-3.5 w-3.5" />Camera</Button></div></div>}
        </div>
        <input ref={fileRef} type="file" className="hidden" accept={selectedDefinition.accept} onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadDocument(file); event.target.value = ''; }} />
        <input ref={cameraRef} type="file" className="hidden" accept="image/*" capture={selectedDefinition.photo ? 'user' : 'environment'} onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadDocument(file); event.target.value = ''; }} />
      </Pane>
    );
  };

  const renderReview = () => (
    <Pane className={`${mobilePane === 'review' ? 'flex' : 'hidden'} flex-col lg:flex`}>
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-3 py-2.5"><div><p className="text-xs font-semibold text-slate-900">AI-filled member data</p><p className="text-[10px] text-slate-500">Press Enter to move to the next field</p></div><Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[10px]" onClick={runAiAutofill} disabled={aiLoading || completedDocuments === 0}>{aiLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}Autofill</Button></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3" onKeyDown={advanceOnEnter}>
        {visibleReviewFields.length <= 2 && completedDocuments === 0 && <div className="mb-3 rounded-xl border border-dashed border-slate-200 p-3 text-center text-xs leading-5 text-slate-500">Upload Aadhaar, PAN, cheque or the filled KYC form. Extracted fields will appear here automatically.</div>}
        <div className="space-y-2.5">
          {visibleReviewFields.map(([key, label]) => {
            const score = confidence[key];
            const low = score !== undefined && score <= 0.5;
            return <div key={key} className="space-y-1"><div className="flex items-center justify-between"><Label className="text-[10px] font-medium text-slate-500">{label}</Label>{score !== undefined && <span className={`text-[9px] font-semibold ${low ? 'text-amber-600' : 'text-emerald-600'}`}>{Math.round(score * 100)}% AI</span>}</div><Input data-enter-field value={form[key] || ''} onChange={(event) => { setForm((previous) => ({ ...previous, [key]: event.target.value })); setConfidence((previous) => ({ ...previous, [key]: 1 })); }} className={`h-8 text-xs ${low ? 'border-amber-300 bg-amber-50' : ''}`} /></div>;
          })}
        </div>
      </div>
    </Pane>
  );

  const renderWorkspace = () => (
    <div className="flex h-full min-h-0 flex-col bg-slate-100">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5"><div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white"><Fingerprint className="h-4 w-4" /></div><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold text-slate-950">{form.full_name}</p><Badge className="bg-emerald-50 text-[9px] text-emerald-700 hover:bg-emerald-50">SHARED KYC</Badge></div><p className="truncate text-[11px] text-slate-500">{form.phone} · {currentSite?.name} · KYC-{String(kycCase?.id || '').padStart(5, '0')}</p></div></div><button type="button" onClick={close} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close KYC"><X className="h-4 w-4" /></button></div>
      <div className="grid shrink-0 grid-cols-3 border-b border-slate-200 bg-white lg:hidden">{[['documents', 'Documents'], ['preview', 'Preview'], ['review', 'Review']].map(([key, label]) => <button type="button" key={key} onClick={() => setMobilePane(key)} className={`border-b-2 px-2 py-2 text-xs font-medium ${mobilePane === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>{label}</button>)}</div>
      <div className="flex min-h-0 flex-1 p-0 lg:grid lg:grid-cols-[190px_minmax(0,1fr)_330px] lg:gap-3 lg:p-3">{renderDocumentRail()}{renderPreview()}{renderReview()}</div>
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:px-5"><div className="hidden min-w-0 sm:block"><p className={`text-xs font-semibold ${aadhaarReadyCount === 2 ? 'text-emerald-700' : 'text-amber-700'}`}>Aadhaar {aadhaarReadyCount}/2 {aadhaarReadyCount === 2 ? 'complete' : 'required'}</p><p className="text-[10px] text-slate-400">{hasOcrInProgress ? 'AI is still processing a document.' : 'Front and back must be ready before verification.'}</p></div><div className="ml-auto flex gap-2"><Button type="button" variant="outline" onClick={runAiAutofill} disabled={aiLoading || completedDocuments === 0}>{aiLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}AI Autofill</Button><Button type="button" className="bg-blue-600 hover:bg-blue-700" onClick={verify} disabled={verifying || hasOcrInProgress}>{verifying || hasOcrInProgress ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1.5 h-4 w-4" />}{verifying ? 'Verifying...' : hasOcrInProgress ? 'Processing...' : 'Verify & Save'}</Button></div></div>
    </div>
  );

  const screenContent = (
    <AnimatePresence mode="wait" initial={false}>
      <MotionDiv key={screen} className="h-full min-h-0" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
        {screen === 'start' ? renderStart() : renderWorkspace()}
      </MotionDiv>
    </AnimatePresence>
  );

  if (presentation === 'page') {
    return (
      <main className={screen === 'start'
        ? 'flex min-h-[calc(100dvh-7rem)] items-center justify-center bg-slate-100 p-4'
        : 'min-h-[calc(100dvh-7rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm'}>
        <div className={screen === 'start' ? 'w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10' : 'h-[calc(100dvh-7rem)] min-h-[560px]'}>
          {screenContent}
        </div>
      </main>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) close(); }}>
      <DialogContent className={screen === 'start'
        ? 'w-[calc(100vw-24px)] max-h-[calc(100dvh-16px)] gap-0 overflow-y-auto p-0 sm:max-w-md sm:rounded-3xl'
        : 'h-[100dvh] max-h-none w-screen max-w-none gap-0 overflow-hidden rounded-none border-0 p-0 [&>button:last-child]:hidden sm:h-[min(760px,calc(100dvh-24px))] sm:w-[min(1180px,calc(100vw-24px))] sm:max-w-[1180px] sm:rounded-3xl sm:border'}>
        {screenContent}
      </DialogContent>
    </Dialog>
  );
};

export const SiteRegistrationDialog = ({ open, onOpenChange, member, sites = [], currentSite, onComplete }) => {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const visibleSites = useMemo(() => {
    const value = query.trim().toLowerCase();
    return sites.filter((site) => !value || [site.name, site.code, site.city].some((field) => String(field || '').toLowerCase().includes(value)));
  }, [query, sites]);

  const toggle = (siteId) => setSelected((previous) => {
    const next = new Set(previous);
    if (next.has(siteId)) next.delete(siteId); else next.add(siteId);
    return next;
  });
  const reset = () => { setQuery(''); setSelected(new Set()); };
  const close = () => { if (!saving) { reset(); onOpenChange(false); } };

  const register = async () => {
    if (!member || selected.size === 0) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/members/${member.id}/register-sites`, { site_ids: [...selected] });
      toast.success(data.message);
      reset();
      onOpenChange(false);
      onComplete?.(data);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not register this member in the selected sites');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) close(); }}>
      <DialogContent className="max-h-[calc(100dvh-24px)] overflow-hidden p-0 sm:max-w-xl sm:rounded-3xl [&>button]:text-white">
        <div className="relative bg-blue-600 px-5 py-5 text-white"><DialogHeader className="text-left"><div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white/15"><UserPlus className="h-4 w-4" /></div><DialogTitle className="text-lg text-white">Register in other sites</DialogTitle><DialogDescription className="text-xs text-blue-100">Create a site registration for {member?.full_name}. Existing records remain unchanged.</DialogDescription></DialogHeader></div>
        <div className="min-h-0 p-4"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sites..." /></div><div className="mt-3 max-h-[45dvh] space-y-2 overflow-y-auto">{visibleSites.map((site) => { const current = String(site.id) === String(currentSite?.id); const checked = current || selected.has(site.id); return <div role="button" tabIndex={current ? -1 : 0} key={site.id} onClick={() => { if (!current) toggle(site.id); }} onKeyDown={(event) => { if (!current && ['Enter', ' '].includes(event.key)) toggle(site.id); }} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${current ? 'border-emerald-200 bg-emerald-50' : checked ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}><Checkbox checked={checked} disabled={current} onClick={(event) => event.stopPropagation()} onCheckedChange={() => { if (!current) toggle(site.id); }} /><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm"><Building2 className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-900">{site.name}</span><span className="block text-xs text-slate-500">{[site.code, site.city].filter(Boolean).join(' · ') || 'Project site'}</span></span>{current && <Badge className="bg-emerald-600 text-[9px] hover:bg-emerald-600">CURRENT</Badge>}</div>; })}</div><div className="mt-4 flex items-center justify-between border-t pt-4"><p className="text-xs text-slate-500">{selected.size} selected</p><div className="flex gap-2"><Button variant="outline" onClick={close} disabled={saving}>Cancel</Button><Button className="bg-blue-600 hover:bg-blue-700" onClick={register} disabled={saving || selected.size === 0}>{saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <UserPlus className="mr-1.5 h-4 w-4" />}Register</Button></div></div></div>
      </DialogContent>
    </Dialog>
  );
};
