import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, FileCheck2, History,
  Loader2, MapPin, Save, Send, Settings2, ShieldCheck, TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import { useSitePolicy } from '../../hooks/useSitePolicy';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { EmptyBlock, SectionHead, StatusDot } from '../ui/page';
import PolicyNotice from '../policy/PolicyNotice';
import ProfileHistory from '../operating-profile/ProfileHistory';
import ProfilePreview from '../operating-profile/ProfilePreview';

const REGULATORY_OPERATING_MODELS = new Set([
  'RERA_PROJECT_PROMOTER',
  'RERA_ONGOING_PROJECT_REGULARISATION',
]);

const DEVELOPMENT_STEPS = [
  { id: 'model', label: 'Operating model' },
  { id: 'basis', label: 'Development basis' },
  { id: 'shape', label: 'Project shape' },
  { id: 'structure', label: 'Project structure' },
  { id: 'review', label: 'Review' },
  { id: 'history', label: 'History' },
];

const REGULATORY_STEPS = [
  { id: 'model', label: 'Operating model' },
  { id: 'jurisdiction', label: 'Jurisdiction' },
  { id: 'basis', label: 'Development basis' },
  { id: 'shape', label: 'Project shape' },
  { id: 'regulatory', label: 'Regulatory status' },
  { id: 'structure', label: 'Project structure' },
  { id: 'ruleset', label: 'Ruleset & controls' },
  { id: 'review', label: 'Review' },
  { id: 'history', label: 'History' },
];

const FALLBACK_OPTIONS = {
  operating_models: [
    ['GENERIC_LAND_DEVELOPER', 'Generic Land Developer'],
    ['DEVELOPMENT_AUTHORISED_BUILDER', 'Development Authorised Builder'],
    ['RERA_PROJECT_PROMOTER', 'RERA Project Promoter'],
    ['RERA_ONGOING_PROJECT_REGULARISATION', 'Ongoing Project Regularisation'],
  ],
  development_bases: [
    ['LANDOWNER', 'Landowner'],
    ['DEVELOPMENT_AGREEMENT', 'Development Agreement'],
    ['JOINT_DEVELOPMENT_AGREEMENT', 'Joint Development Agreement'],
    ['COLLABORATION_AGREEMENT', 'Collaboration Agreement'],
    ['CO_PROMOTER', 'Co-promoter'],
    ['POWER_OF_ATTORNEY', 'Power of Attorney'],
    ['OTHER', 'Other'],
  ],
  project_shapes: [
    ['PLOTTED_DEVELOPMENT', 'Plotted Development'],
    ['APARTMENT', 'Apartment'],
    ['COMMERCIAL', 'Commercial'],
    ['MIXED_USE', 'Mixed Use'],
  ],
  regulatory_statuses: [
    ['DRAFT', 'Draft'],
    ['APPLICABILITY_UNDER_REVIEW', 'Applicability Under Review'],
    ['EXEMPTION_UNDER_REVIEW', 'Exemption Under Review'],
    ['APPLICATION_IN_PREPARATION', 'Application In Preparation'],
    ['FILED', 'Filed'],
    ['REGISTERED', 'Registration Recorded'],
    ['AMENDMENT_PENDING', 'Amendment Pending'],
    ['EXTENSION_PENDING', 'Extension Pending'],
    ['EXPIRED', 'Expired'],
    ['LAPSED', 'Lapsed'],
    ['REVOKED', 'Revoked'],
    ['COMPLETED', 'Completed'],
  ],
  project_structures: [
    ['SINGLE_PROJECT', 'Single Project'],
    ['PHASE_WISE', 'Phase-wise'],
    ['MULTIPLE_RERA_PROJECTS', 'Multiple RERA Projects'],
  ],
};

const EMPTY = {
  operating_model: 'GENERIC_LAND_DEVELOPER',
  jurisdiction_country: 'INDIA',
  jurisdiction_state: '',
  authority_code: '',
  authority_name: '',
  district: '',
  development_basis: 'OTHER',
  development_basis_notes: '',
  project_shape: 'PLOTTED_DEVELOPMENT',
  regulatory_status: 'APPLICABILITY_UNDER_REVIEW',
  project_structure: 'SINGLE_PROJECT',
  fund_control_modes: [],
  ruleset_version_id: '',
  change_reason: '',
};

const readable = (value) => String(value || '—')
  .replaceAll('_', ' ')
  .toLowerCase()
  .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());

const normalizeOptionRows = (rows, fallback) => {
  if (!Array.isArray(rows) || !rows.length) return fallback;
  return rows.map((row) => (Array.isArray(row)
    ? row
    : [row.value ?? row.id ?? row.code, row.label ?? row.name ?? readable(row.value ?? row.code)]));
};

const formFrom = (profile) => ({
  ...EMPTY,
  ...(profile || {}),
  jurisdiction_country: profile?.jurisdiction_country || 'INDIA',
  ruleset_version_id: profile?.ruleset_version_id ? String(profile.ruleset_version_id) : '',
  fund_control_modes: Array.isArray(profile?.fund_control_modes) ? profile.fund_control_modes : [],
  change_reason: profile?.change_reason || '',
});

const payloadFrom = (siteId, form) => ({
  site_id: siteId,
  operating_model: form.operating_model,
  jurisdiction_country: form.jurisdiction_country || 'INDIA',
  jurisdiction_state: form.jurisdiction_state || null,
  authority_code: form.authority_code || null,
  authority_name: form.authority_name || null,
  district: form.district || null,
  development_basis: form.development_basis,
  development_basis_notes: form.development_basis_notes || null,
  project_shape: form.project_shape,
  regulatory_status: form.regulatory_status,
  project_structure: form.project_structure,
  fund_control_modes: form.fund_control_modes,
  ruleset_version_id: form.ruleset_version_id ? Number(form.ruleset_version_id) : null,
  change_reason: form.change_reason || null,
});

const statusTone = (status) => ({
  PUBLISHED: 'positive', REVIEW: 'info', VALIDATION: 'attention', REJECTED: 'negative', SUPERSEDED: 'neutral',
}[status] || 'neutral');

function ChoiceGrid({ value, onChange, options, disabled }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map(([key, label]) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(key)}
            className={`group flex min-h-14 items-center justify-between rounded-control border px-4 py-3 text-left text-[13px] transition-all duration-150 ${
              selected
                ? 'border-mr-blue/45 bg-mr-blue-soft/55 font-semibold text-mr-text shadow-sm shadow-mr-blue/10'
                : 'border-mr-line bg-mr-surface text-mr-muted hover:-translate-y-0.5 hover:border-mr-blue/30 hover:bg-mr-surface-2 hover:shadow-sm'
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <span>{label}</span>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${selected ? 'bg-mr-blue text-white' : 'bg-mr-surface-2 text-transparent group-hover:text-mr-faint'}`}>
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px] font-medium text-mr-text">{label}</Label>
      {children}
      {hint && <p className="text-[12px] leading-relaxed text-mr-muted">{hint}</p>}
    </div>
  );
}

export default function OperatingProfileSettings() {
  const { currentSite, isAdmin, hasPermission } = useAuth();
  const { refreshPolicy } = useSitePolicy();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [action, setAction] = useState(null);
  const [published, setPublished] = useState(null);
  const [draft, setDraft] = useState(null);
  const [history, setHistory] = useState([]);
  const [rulesets, setRulesets] = useState([]);
  const [options, setOptions] = useState({});
  const [form, setForm] = useState(EMPTY);
  const [preview, setPreview] = useState(null);
  const [validation, setValidation] = useState(null);
  const [step, setStep] = useState('model');
  const requestId = useRef(0);

  const canCreate = isAdmin || hasPermission('operating_profile', 'write');
  const canEdit = isAdmin || hasPermission('operating_profile', 'update');
  const canReviewPublish = isAdmin;
  const editable = (draft?.id ? canEdit : canCreate)
    && ['DRAFT', 'REJECTED'].includes(draft?.lifecycle_status || 'DRAFT');

  const load = useCallback(async () => {
    if (!currentSite?.id) {
      setLoading(false);
      setPublished(null);
      setDraft(null);
      setHistory([]);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    try {
      const { data } = await api.get('/settings/operating-profile', { params: { site_id: currentSite.id } });
      if (id !== requestId.current) return;
      const nextDraft = data.draft_profile || null;
      const nextPublished = data.published_profile || null;
      setDraft(nextDraft);
      setPublished(nextPublished);
      setHistory(data.history || []);
      setRulesets(data.rulesets || []);
      setOptions(data.options || {});
      setForm(formFrom(nextDraft || nextPublished));
      setValidation(nextDraft?.validation_results || null);
      setPreview(null);
    } catch (error) {
      if (id === requestId.current) toast.error(error.response?.data?.message || 'Could not load the operating profile');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [currentSite?.id]);

  useEffect(() => { void load(); }, [load]);

  const optionRows = useMemo(() => ({
    operating_models: normalizeOptionRows(options.operating_models, FALLBACK_OPTIONS.operating_models),
    development_bases: normalizeOptionRows(options.development_bases, FALLBACK_OPTIONS.development_bases),
    project_shapes: normalizeOptionRows(options.project_shapes, FALLBACK_OPTIONS.project_shapes),
    regulatory_statuses: normalizeOptionRows(options.regulatory_statuses, FALLBACK_OPTIONS.regulatory_statuses),
    project_structures: normalizeOptionRows(options.project_structures, FALLBACK_OPTIONS.project_structures),
  }), [options]);

  const isReraProfile = REGULATORY_OPERATING_MODELS.has(form.operating_model);
  const steps = isReraProfile ? REGULATORY_STEPS : DEVELOPMENT_STEPS;
  const projectStructureOptions = useMemo(() => (
    isReraProfile
      ? optionRows.project_structures
      : optionRows.project_structures.filter(([value]) => value !== 'MULTIPLE_RERA_PROJECTS')
  ), [isReraProfile, optionRows.project_structures]);

  useEffect(() => {
    if (!steps.some((item) => item.id === step)) setStep('model');
  }, [step, steps]);

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));

  const saveDraft = async ({ quiet = false } = {}) => {
    if (!currentSite?.id || (draft?.id ? !canEdit : !canCreate)) return null;
    setSaving(true);
    try {
      const payload = payloadFrom(currentSite.id, form);
      const { data } = draft?.id
        ? await api.patch(`/settings/operating-profile/drafts/${draft.id}`, payload)
        : await api.post('/settings/operating-profile/drafts', payload);
      const saved = data.profile || data.draft_profile;
      setDraft(saved);
      setForm(formFrom(saved));
      setValidation(saved?.validation_results || null);
      if (!quiet) toast.success('Operating profile draft saved');
      return saved;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not save the profile draft');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const newRevision = async () => {
    setDraft(null);
    setForm(formFrom(published));
    setValidation(null);
    setPreview(null);
    setStep('model');
    toast.info('Edit the proposed revision, then save it as a draft');
  };

  const runAction = async (name, body = {}) => {
    let profile = draft;
    if (editable && ['validate', 'preview'].includes(name)) profile = await saveDraft({ quiet: true });
    if (!profile?.id) return;
    setAction(name);
    try {
      if (name === 'preview') {
        const { data } = await api.get(`/settings/operating-profile/${profile.id}/preview`);
        setPreview(data.preview || data);
        setStep('review');
        return;
      }
      const { data } = await api.post(`/settings/operating-profile/${profile.id}/${name}`, body);
      const updated = data.profile || profile;
      setDraft(updated.lifecycle_status === 'PUBLISHED' ? null : updated);
      setValidation(data.validation || updated.validation_results || null);
      toast.success(data.message || `Profile ${name.replace('-', ' ')} completed`);
      if (updated.lifecycle_status === 'PUBLISHED') {
        await Promise.all([load(), refreshPolicy()]);
      } else {
        await load();
      }
    } catch (error) {
      const serverValidation = error.response?.data?.validation;
      if (serverValidation) setValidation(serverValidation);
      toast.error(error.response?.data?.message || `Could not ${name.replace('-', ' ')} this revision`);
    } finally {
      setAction(null);
    }
  };

  if (!currentSite?.id) {
    return <EmptyBlock icon={MapPin} title="Select a Site" description="Operating behavior is configured independently for each Site." tall />;
  }

  if (loading) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-mr-blue" aria-label="Loading operating profile" />
      </div>
    );
  }

  const currentStepIndex = steps.findIndex((item) => item.id === step);
  const nextStep = () => setStep(steps[Math.min(currentStepIndex + 1, steps.length - 1)].id);
  const previousStep = () => setStep(steps[Math.max(currentStepIndex - 1, 0)].id);
  const stepComplete = (stepId) => {
    if (stepId === 'model') return Boolean(form.operating_model);
    if (stepId === 'jurisdiction') return Boolean(form.jurisdiction_country && form.jurisdiction_state);
    if (stepId === 'basis') return Boolean(form.development_basis);
    if (stepId === 'shape') return Boolean(form.project_shape);
    if (stepId === 'regulatory') return Boolean(form.regulatory_status);
    if (stepId === 'structure') return Boolean(form.project_structure);
    if (stepId === 'ruleset') return Boolean(form.ruleset_version_id || form.fund_control_modes.length);
    if (stepId === 'review') return Boolean(validation?.valid || preview);
    return history.length > 0;
  };
  const selectAndAdvance = (patch) => {
    setForm((current) => {
      const next = { ...current, ...patch };
      if (Object.prototype.hasOwnProperty.call(patch, 'operating_model')
        && !REGULATORY_OPERATING_MODELS.has(patch.operating_model)) {
        next.jurisdiction_state = '';
        next.authority_code = '';
        next.authority_name = '';
        next.regulatory_status = 'APPLICABILITY_UNDER_REVIEW';
        next.ruleset_version_id = '';
        next.fund_control_modes = [];
        if (next.project_structure === 'MULTIPLE_RERA_PROJECTS') next.project_structure = 'SINGLE_PROJECT';
      }
      return next;
    });
    const nextSteps = Object.prototype.hasOwnProperty.call(patch, 'operating_model')
      && !REGULATORY_OPERATING_MODELS.has(patch.operating_model)
      ? DEVELOPMENT_STEPS
      : steps;
    if (currentStepIndex < 0 || currentStepIndex >= nextSteps.length - 1) return;
    window.setTimeout(() => setStep(nextSteps[currentStepIndex + 1].id), 220);
  };
  const invalidRows = validation?.errors || [];

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-mr-line bg-mr-surface shadow-sm shadow-mr-ink/[0.03]">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 sm:px-7">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mr-faint">Site operating profile</p>
          <h2 className="mt-1 text-[23px] font-semibold tracking-[-0.025em] text-mr-text">Configure {currentSite.name}</h2>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-mr-muted">Shape the modules, terminology and controls this Site uses. Changes stay in draft until they are reviewed and published.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusDot tone={statusTone(published?.lifecycle_status)}>
              {published ? `Effective v${published.revision_number ?? published.revision}` : 'Legacy compatible'}
            </StatusDot>
            {published?.authority_name && <span className="text-[12px] text-mr-muted">{published.authority_name}</span>}
            {published?.ruleset_name && <span className="text-[12px] text-mr-muted">· {published.ruleset_name} {published.ruleset_version}</span>}
          </div>
        </div>
        <div className="min-w-[190px] text-left sm:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mr-faint">Setup progress</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-mr-text">{Math.round(((currentStepIndex + 1) / steps.length) * 100)}%</p>
          <p className="text-[12px] text-mr-muted">Step {currentStepIndex + 1} of {steps.length} · {steps[currentStepIndex]?.label}</p>
        </div>
        </div>
        <div className="h-1 bg-mr-surface-2"><div className="h-full bg-mr-blue transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }} /></div>
        <div className="flex flex-wrap gap-2 border-t border-mr-line px-5 py-3 sm:px-7">
          {published && !draft && canCreate && (
            <Button variant="outline" onClick={newRevision} className="h-10 rounded-full border-mr-line text-[13px]">
              <History className="mr-1.5 h-4 w-4" /> Propose revision
            </Button>
          )}
          {editable && (
            <Button onClick={() => saveDraft()} disabled={saving} className="h-10 rounded-full bg-mr-ink px-4 text-[13px] font-semibold text-white">
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />} Save draft
            </Button>
          )}
        </div>
      </div>

      {!published && !draft && (
        <PolicyNotice
          variant="info"
          title="Legacy-compatible behavior is active"
          description="Existing modules and records continue unchanged. Create and publish a profile only when this Site's operating basis has been confirmed."
        />
      )}
      {isReraProfile && published?.regulatory_status === 'REGISTERED' && (
        <PolicyNotice
          variant="neutral"
          title="Registration recorded"
          description="This is an internal project status backed by recorded metadata and reviewed evidence; it is not a government verification badge."
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Operating profile steps" className="flex gap-1 overflow-x-auto pb-1 lg:sticky lg:top-20 lg:block lg:space-y-1 lg:overflow-visible">
          <div className="mb-3 hidden px-3 text-[11px] font-semibold uppercase tracking-[0.13em] text-mr-faint lg:block">Configuration checklist</div>
          {steps.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStep(item.id)}
              className={`inline-flex min-w-[170px] items-center gap-3 rounded-control px-3 py-2.5 text-left text-[13px] transition-all duration-150 lg:flex lg:min-w-0 ${
                step === item.id ? 'bg-mr-ink font-semibold text-white' : 'text-mr-muted hover:bg-mr-surface-2 hover:text-mr-text'
              }`}
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] ${step === item.id ? 'bg-white/15' : stepComplete(item.id) ? 'bg-emerald-100 text-emerald-700' : 'bg-mr-surface-2 text-mr-faint'}`}>
                {stepComplete(item.id) && step !== item.id ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {step === item.id && <ArrowRight className="h-3.5 w-3.5 opacity-60" />}
            </button>
          ))}
        </nav>

        <div className="min-w-0">
          {step === 'model' && (
            <div className="space-y-5">
              <SectionHead title="Operating model" description="Choose the role this Site is being used to manage. Development profiles stay free of regulatory-only workflows unless a RERA operating model is selected." />
              <ChoiceGrid value={form.operating_model} onChange={(operating_model) => selectAndAdvance({ operating_model })} options={optionRows.operating_models} disabled={!editable} />
            </div>
          )}

          {step === 'jurisdiction' && (
            <div className="space-y-5">
              <SectionHead title="Jurisdiction and authority" description="Authority is always selected explicitly; MountReality never infers HRERA from a Haryana address." />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Country"><Input value={form.jurisdiction_country} onChange={(event) => set({ jurisdiction_country: event.target.value })} disabled={!editable} className="h-11 rounded-control border-mr-line" /></Field>
                <Field label="State / jurisdiction"><Input value={form.jurisdiction_state || ''} onChange={(event) => set({ jurisdiction_state: event.target.value })} disabled={!editable} placeholder="Haryana" className="h-11 rounded-control border-mr-line" /></Field>
                <Field label="Authority name" hint="Example: Haryana Real Estate Regulatory Authority, Gurugram bench — enter only after confirming it."><Input value={form.authority_name || ''} onChange={(event) => set({ authority_name: event.target.value })} disabled={!editable} placeholder="Select or record the confirmed authority" className="h-11 rounded-control border-mr-line" /></Field>
                <Field label="Authority code"><Input value={form.authority_code || ''} onChange={(event) => set({ authority_code: event.target.value.toUpperCase() })} disabled={!editable} placeholder="HRERA-GGM" className="h-11 rounded-control border-mr-line" /></Field>
                <Field label="District"><Input value={form.district || ''} onChange={(event) => set({ district: event.target.value })} disabled={!editable} placeholder="Gurugram" className="h-11 rounded-control border-mr-line" /></Field>
              </div>
            </div>
          )}

          {step === 'basis' && (
            <div className="space-y-5">
              <SectionHead title="Development basis" description="Record the business/legal basis without claiming that the underlying document has been externally verified." />
              <ChoiceGrid value={form.development_basis} onChange={(development_basis) => selectAndAdvance({ development_basis })} options={optionRows.development_bases} disabled={!editable} />
              <Field label="Basis notes / reference" hint="Use the Evidence workspace for the actual agreement or authority document.">
                <Textarea value={form.development_basis_notes || ''} onChange={(event) => set({ development_basis_notes: event.target.value })} disabled={!editable} rows={4} className="rounded-control border-mr-line" placeholder="Internal context, instrument reference or review note" />
              </Field>
            </div>
          )}

          {step === 'shape' && (
            <div className="space-y-5">
              <SectionHead title="Project shape" description="Controls applicable presentation and modules. Apartment/unit hierarchy remains deferred to Phase 2." />
              <ChoiceGrid value={form.project_shape} onChange={(project_shape) => selectAndAdvance({ project_shape })} options={optionRows.project_shapes} disabled={!editable} />
            </div>
          )}

          {step === 'regulatory' && (
            <div className="space-y-5">
              <SectionHead title="Regulatory status" description="These are internal workflow states. “Registration recorded” requires registration metadata and evidence before publication." />
              <ChoiceGrid value={form.regulatory_status} onChange={(regulatory_status) => selectAndAdvance({ regulatory_status })} options={optionRows.regulatory_statuses} disabled={!editable} />
              {form.regulatory_status === 'REGISTERED' && (
                <PolicyNotice variant="attention" title="Evidence gate applies" description="Create the RERA Project, record its registration number and authority/source, and upload registration evidence before this status can be published." />
              )}
            </div>
          )}

          {step === 'structure' && (
            <div className="space-y-5">
              <SectionHead title="Project structure" description={isReraProfile ? 'A Site and a RERA Project remain separate. Phase records are optional unless this profile is phase-wise.' : 'A Site and a Development Project remain separate. Phase records are optional unless this profile is phase-wise.'} />
              <ChoiceGrid value={form.project_structure} onChange={(project_structure) => selectAndAdvance({ project_structure })} options={projectStructureOptions} disabled={!editable} />
            </div>
          )}

          {step === 'ruleset' && (
            <div className="space-y-6">
              <SectionHead title="Ruleset and control references" description="Only versioned, source-aware configuration is selectable. Phase 1 does not invent legal deadlines or filing rules." />
              <Field label="Active ruleset version" hint="Configuration-only or review-pending rulesets are clearly identified and do not claim legal validation.">
                <Select value={form.ruleset_version_id || 'none'} onValueChange={(value) => set({ ruleset_version_id: value === 'none' ? '' : value })} disabled={!editable}>
                  <SelectTrigger className="h-11 rounded-control border-mr-line"><SelectValue placeholder="No ruleset selected" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No ruleset selected</SelectItem>
                    {rulesets.map((ruleset) => (
                      <SelectItem key={ruleset.version_id || ruleset.id} value={String(ruleset.version_id || ruleset.id)}>
                        {ruleset.name} · v{ruleset.version} {!['REVIEWED', 'NOT_APPLICABLE'].includes(ruleset.review_status) ? '(source review pending)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Financial control references" hint="Metadata only. No designated-account accounting, 70% calculation or withdrawal certification is implemented in Phase 1.">
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    ['COLLECTION_TRACKING', 'Customer collection tracking'],
                    ['DESIGNATED_ACCOUNT_REFERENCE', 'Designated account reference'],
                    ['EXTERNAL_CERTIFICATION_REFERENCE', 'External certification reference'],
                    ['NO_SPECIAL_CONTROL', 'No special control configured'],
                  ].map(([key, label]) => {
                    const selected = form.fund_control_modes.includes(key);
                    return (
                      <label key={key} className="flex cursor-pointer items-center gap-2.5 rounded-control border border-mr-line px-3.5 py-3 text-[13px] text-mr-text">
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={!editable}
                          onChange={() => set({ fund_control_modes: selected ? form.fund_control_modes.filter((item) => item !== key) : [...form.fund_control_modes, key] })}
                          className="h-4 w-4 rounded border-mr-line accent-mr-ink"
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </Field>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-7">
              <ProfilePreview preview={preview} />
              {invalidRows.length > 0 && (
                <PolicyNotice variant="attention" title="Validation needs attention" role="alert">
                  <ul className="space-y-1">
                    {invalidRows.map((row, index) => <li key={index}>• {row.message || row}</li>)}
                  </ul>
                </PolicyNotice>
              )}
              <Field label="Reason for this revision" hint="Required for review and publication; becomes part of the audit record.">
                <Textarea value={form.change_reason || ''} onChange={(event) => set({ change_reason: event.target.value })} disabled={draft?.id ? !canEdit : !canCreate} rows={3} className="rounded-control border-mr-line" placeholder="Why this operating behavior is being introduced or changed" />
              </Field>
              <div className="flex flex-wrap gap-2 border-t border-mr-line pt-5">
                <Button variant="outline" onClick={() => runAction('preview')} disabled={Boolean(action)} className="h-10 rounded-full border-mr-line text-[13px]"><Settings2 className="mr-1.5 h-4 w-4" /> Refresh preview</Button>
                {draft?.lifecycle_status === 'DRAFT' && canEdit && <Button onClick={() => runAction('validate')} disabled={Boolean(action)} className="h-10 rounded-full bg-mr-ink text-[13px]"><FileCheck2 className="mr-1.5 h-4 w-4" /> Validate</Button>}
                {draft?.lifecycle_status === 'VALIDATION' && canEdit && <Button onClick={() => runAction('submit-review', { reason: form.change_reason })} disabled={Boolean(action) || !form.change_reason.trim()} className="h-10 rounded-full bg-mr-ink text-[13px]"><Send className="mr-1.5 h-4 w-4" /> Submit for review</Button>}
                {draft?.lifecycle_status === 'REVIEW' && draft.review_decision !== 'APPROVED' && canReviewPublish && <Button onClick={() => runAction('review', { decision: 'APPROVED', notes: form.change_reason })} disabled={Boolean(action)} className="h-10 rounded-full bg-mr-blue text-[13px] text-white"><ShieldCheck className="mr-1.5 h-4 w-4" /> Approve review</Button>}
                {draft?.lifecycle_status === 'REVIEW' && draft.review_decision === 'APPROVED' && canReviewPublish && <Button onClick={() => runAction('publish', { reason: form.change_reason })} disabled={Boolean(action) || !form.change_reason.trim()} className="h-10 rounded-full bg-mr-lime-ink text-[13px] text-white"><CheckCircle2 className="mr-1.5 h-4 w-4" /> Publish profile</Button>}
                {action && <span className="inline-flex items-center text-[13px] text-mr-muted"><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Working…</span>}
              </div>
            </div>
          )}

          {step === 'history' && <ProfileHistory rows={history} />}

          {!['review', 'history'].includes(step) && (
            <div className="mt-8 flex items-center justify-between border-t border-mr-line pt-5">
              <Button variant="ghost" onClick={previousStep} disabled={currentStepIndex === 0} className="h-10 rounded-full text-[13px]"><ArrowLeft className="mr-1.5 h-4 w-4" /> Back</Button>
              <div className="flex items-center gap-2">
                {editable && <Button variant="outline" onClick={() => saveDraft()} disabled={saving} className="h-10 rounded-full border-mr-line text-[13px]"><Save className="mr-1.5 h-4 w-4" /> Save draft</Button>}
                <Button onClick={nextStep} className="h-10 rounded-full bg-mr-ink text-[13px] text-white">Continue <ArrowRight className="ml-1.5 h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 border-t border-mr-line pt-6 sm:grid-cols-3">
        {[
          { icon: Clock3, label: 'Drafts do not affect runtime' },
          { icon: TriangleAlert, label: 'No automatic legal conclusions' },
          { icon: ShieldCheck, label: 'Published revisions are audited' },
        ].map(({ icon, label }) => {
          const Icon = icon;
          return <div key={label} className="flex items-center gap-2 text-[12px] text-mr-muted"><Icon className="h-4 w-4 text-mr-faint" /> {label}</div>;
        })}
      </div>
    </div>
  );
}
