import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check, CheckCircle2, ChevronDown, History, Landmark, Loader2, MapPin, Save,
  ShieldCheck, SlidersHorizontal, TriangleAlert, WalletCards,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import { useSitePolicy } from '../../hooks/useSitePolicy';
import {
  INDIA_JURISDICTIONS,
  indiaJurisdictionCode,
  indiaJurisdictionName,
  rulesetMatchesJurisdiction,
} from '../../lib/indiaJurisdictions';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { EmptyBlock, StatusDot } from '../ui/page';
import PolicyNotice from '../policy/PolicyNotice';
import ProfileHistory from '../operating-profile/ProfileHistory';

const REGULATORY_OPERATING_MODELS = new Set([
  'RERA_PROJECT_PROMOTER',
  'RERA_ONGOING_PROJECT_REGULARISATION',
]);

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
  finance_payment_mode: 'ALL_MODES',
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
  ruleset_version_id: profile?.ruleset_code === 'INDIA_RERA_CENTRAL'
    ? ''
    : (profile?.ruleset_version_id ? String(profile.ruleset_version_id) : ''),
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
  finance_payment_mode: form.finance_payment_mode,
  fund_control_modes: form.fund_control_modes,
  ruleset_version_id: form.ruleset_version_id ? Number(form.ruleset_version_id) : null,
  change_reason: form.change_reason || null,
});

const signatureOf = (siteId, form) => JSON.stringify(payloadFrom(siteId, form));

function Field({ label, hint, error, complete = false, children, className = '' }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="flex items-center gap-1.5 text-[13px] font-medium text-mr-text">
        {label}
        {complete && <CheckCircle2 className="h-3.5 w-3.5 text-mr-lime-ink" aria-label="Complete" />}
      </Label>
      {children}
      {error ? <p className="text-[12px] text-mr-coral-ink">{error}</p> : hint ? <p className="text-[12px] leading-relaxed text-mr-muted">{hint}</p> : null}
    </div>
  );
}

function SetupPath({ sections }) {
  const required = sections.filter((section) => !section.optional);
  const complete = required.filter((section) => section.complete).length;
  const progress = required.length ? Math.round((complete / required.length) * 100) : 100;
  return (
    <div className="border-y border-mr-line py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[12px] font-semibold text-mr-text">Setup path</p>
          <p className="mt-0.5 text-[11px] text-mr-muted">Complete the required areas in any order.</p>
        </div>
        <span className="text-[11px] font-semibold text-mr-muted">{complete} of {required.length} required areas complete</span>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-mr-surface-2" aria-label={`${progress}% setup complete`}>
        <div className="h-full rounded-full bg-mr-lime-ink transition-[width] duration-300" style={{ width: `${progress}%` }} />
      </div>
      <ol className="grid gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
        {sections.map((section, index) => (
          <li key={section.id}>
            <a href={`#${section.id}`} className="group flex items-center gap-2.5 rounded-lg py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors ${
                section.complete
                  ? 'border-mr-lime-ink/20 bg-mr-lime-soft text-mr-lime-ink'
                  : 'border-mr-line bg-mr-surface-2 text-mr-faint group-hover:border-mr-blue/35 group-hover:text-mr-blue'
              }`}>
                {section.complete ? <Check className="h-3.5 w-3.5" strokeWidth={2.7} aria-hidden="true" /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-semibold text-mr-text">{section.label}</span>
                <span className={`block text-[10px] font-medium ${section.complete ? 'text-mr-lime-ink' : 'text-mr-faint'}`}>
                  {section.complete ? 'Complete' : section.optional ? 'Optional' : section.pendingLabel || 'Needs details'}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SettingSection({ id, eyebrow, title, description, children }) {
  return (
    <section id={id} className="scroll-mt-24 py-7 first:pt-0 last:pb-0">
      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mr-faint">{eyebrow}</p>
          <h3 className="mt-1 text-[16px] font-semibold tracking-[-0.015em] text-mr-text">{title}</h3>
          <p className="mt-1.5 text-[12px] leading-relaxed text-mr-muted">{description}</p>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

function FinanceModeChoice({ value, selected, title, description, icon, onSelect, disabled }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      disabled={disabled}
      aria-pressed={selected}
      className={`flex min-h-24 w-full items-start gap-3 rounded-control border p-4 text-left transition-colors ${
        selected
          ? 'border-mr-blue/45 bg-mr-blue-soft/45'
          : 'border-mr-line bg-mr-surface hover:border-mr-blue/30 hover:bg-mr-surface-2/60'
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${selected ? 'bg-mr-blue text-white' : 'bg-mr-surface-2 text-mr-muted'}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-semibold text-mr-text">{title}</span>
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${selected ? 'bg-mr-blue text-white' : 'border border-mr-line text-transparent'}`}>
            <Check className="h-3 w-3" strokeWidth={2.7} aria-hidden="true" />
          </span>
        </span>
        <span className="mt-1 block text-[12px] leading-relaxed text-mr-muted">{description}</span>
      </span>
    </button>
  );
}

export default function OperatingProfileSettings({ onStatusChange }) {
  const { currentSite, isAdmin, hasPermission } = useAuth();
  const { refreshPolicy } = useSitePolicy();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [published, setPublished] = useState(null);
  const [pendingRevision, setPendingRevision] = useState(null);
  const [history, setHistory] = useState([]);
  const [rulesets, setRulesets] = useState([]);
  const [options, setOptions] = useState({});
  const [form, setForm] = useState(EMPTY);
  const [baseline, setBaseline] = useState('');
  const [validation, setValidation] = useState(null);
  const requestId = useRef(0);

  const canCreate = isAdmin || hasPermission('operating_profile', 'write');
  const canEdit = isAdmin || hasPermission('operating_profile', 'update');
  const canSave = isAdmin && ((published?.id || pendingRevision?.id) ? canEdit : canCreate);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!currentSite?.id) {
      setLoading(false);
      setPublished(null);
      setPendingRevision(null);
      setHistory([]);
      return;
    }
    const id = ++requestId.current;
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get('/settings/operating-profile', { params: { site_id: currentSite.id } });
      if (id !== requestId.current) return;
      const nextPublished = data.published_profile || null;
      const nextPending = data.draft_profile || null;
      const nextForm = formFrom(nextPending || nextPublished);
      const availableRulesets = Array.isArray(data.rulesets) ? data.rulesets : [];
      const selectedRulesetIsCompatible = availableRulesets.some((ruleset) => (
        String(ruleset.version_id || ruleset.id) === String(nextForm.ruleset_version_id)
        && !ruleset.is_central_rera
        && rulesetMatchesJurisdiction(ruleset, nextForm.jurisdiction_state)
      ));
      if (nextForm.ruleset_version_id && !selectedRulesetIsCompatible) {
        nextForm.ruleset_version_id = '';
      }
      setPublished(nextPublished);
      setPendingRevision(nextPending);
      setHistory(data.history || []);
      setRulesets(availableRulesets);
      setOptions(data.options || {});
      setForm(nextForm);
      setBaseline(signatureOf(currentSite.id, nextForm));
      setValidation(null);
    } catch (error) {
      if (id === requestId.current) toast.error(error.response?.data?.message || 'Could not load the operating profile');
    } finally {
      if (id === requestId.current && !silent) setLoading(false);
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
  const jurisdictionCode = indiaJurisdictionCode(form.jurisdiction_state);
  const jurisdictionName = indiaJurisdictionName(form.jurisdiction_state);
  const jurisdictionRulesets = useMemo(() => (
    jurisdictionCode
      ? rulesets.filter((ruleset) => (
        !ruleset.is_central_rera
        && ruleset.code !== 'GENERIC_FOUNDATION'
        && rulesetMatchesJurisdiction(ruleset, form.jurisdiction_state)
      ))
      : []
  ), [form.jurisdiction_state, jurisdictionCode, rulesets]);
  const selectedJurisdictionRuleset = jurisdictionRulesets.some((ruleset) => (
    String(ruleset.version_id || ruleset.id) === String(form.ruleset_version_id)
  )) ? form.ruleset_version_id : '';
  const projectStructureOptions = useMemo(() => (
    isReraProfile
      ? optionRows.project_structures
      : optionRows.project_structures.filter(([value]) => value !== 'MULTIPLE_RERA_PROJECTS')
  ), [isReraProfile, optionRows.project_structures]);

  const projectChoices = [
    form.operating_model,
    form.development_basis,
    form.project_shape,
    form.project_structure,
  ];
  const projectChoiceCount = projectChoices.filter(Boolean).length;
  const projectSetupComplete = projectChoiceCount === projectChoices.length;
  const financeSetupComplete = ['ALL_MODES', 'BANK_ONLY'].includes(form.finance_payment_mode);
  const registeredNeedsAuthority = form.regulatory_status === 'REGISTERED';
  const regulatorySetupComplete = !isReraProfile || Boolean(
    jurisdictionCode
      && form.regulatory_status
      && (!registeredNeedsAuthority || form.authority_name || form.authority_code),
  );
  const changeNoteComplete = Boolean(String(form.change_reason || '').trim());
  const setupSections = [
    { id: 'profile-basics', label: 'Project setup', complete: projectSetupComplete },
    { id: 'profile-finance', label: 'Finance', complete: financeSetupComplete },
    ...(isReraProfile ? [{ id: 'profile-regulatory', label: 'Regulatory', complete: regulatorySetupComplete, pendingLabel: 'Select jurisdiction' }] : []),
    { id: 'profile-note', label: 'Change note', complete: changeNoteComplete, optional: true },
  ];

  useEffect(() => {
    onStatusChange?.({
      loading,
      active: Boolean(published?.id),
      complete: Boolean(
        published?.id
          && projectSetupComplete
          && financeSetupComplete
          && regulatorySetupComplete,
      ),
    });
  }, [
    financeSetupComplete, loading, onStatusChange, projectSetupComplete,
    published?.id, regulatorySetupComplete,
  ]);

  const currentSignature = useMemo(() => signatureOf(currentSite?.id, form), [currentSite?.id, form]);

  useEffect(() => {
    if (!form.ruleset_version_id || selectedJurisdictionRuleset) return;
    setValidation(null);
    setForm((current) => ({ ...current, ruleset_version_id: '' }));
  }, [form.ruleset_version_id, selectedJurisdictionRuleset]);

  const isDirty = Boolean(baseline && currentSignature !== baseline);
  const hasChanges = Boolean(baseline && (isDirty || pendingRevision?.id || !published?.id));
  const errorByField = useMemo(() => Object.fromEntries(
    (validation?.errors || []).map((row) => [row.field, row.message || String(row)]),
  ), [validation]);

  useEffect(() => {
    if (!isDirty) return undefined;
    const warnBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isDirty]);

  const set = (patch) => {
    setValidation(null);
    setForm((current) => {
      const next = { ...current, ...patch };
      if (Object.prototype.hasOwnProperty.call(patch, 'jurisdiction_state')
          && patch.jurisdiction_state !== current.jurisdiction_state) {
        next.ruleset_version_id = '';
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'operating_model')
          && !REGULATORY_OPERATING_MODELS.has(patch.operating_model)) {
        next.jurisdiction_state = '';
        next.authority_code = '';
        next.authority_name = '';
        next.district = '';
        next.regulatory_status = 'APPLICABILITY_UNDER_REVIEW';
        next.ruleset_version_id = '';
        next.fund_control_modes = [];
        if (next.project_structure === 'MULTIPLE_RERA_PROJECTS') next.project_structure = 'SINGLE_PROJECT';
      } else if (Object.prototype.hasOwnProperty.call(patch, 'operating_model')
          && patch.operating_model !== current.operating_model) {
        next.ruleset_version_id = '';
      }
      return next;
    });
  };

  const saveChanges = async () => {
    if (!currentSite?.id || !canSave || !hasChanges) return;
    setSaving(true);
    setValidation(null);
    try {
      const { data } = await api.put('/settings/operating-profile', payloadFrom(currentSite.id, form));
      const saved = data.profile;
      const savedForm = formFrom(saved);
      setPublished(saved);
      setPendingRevision(null);
      setForm(savedForm);
      setBaseline(signatureOf(currentSite.id, savedForm));
      setValidation(data.validation || null);
      await Promise.all([load({ silent: true }), refreshPolicy()]);
      toast.success('Operating profile saved. Changes are active now.');
    } catch (error) {
      const serverValidation = error.response?.data?.validation;
      if (serverValidation) setValidation(serverValidation);
      toast.error(error.response?.data?.message || 'Could not save the operating profile');
    } finally {
      setSaving(false);
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

  const updatedAt = published?.published_at || published?.updated_at;

  return (
    <div className="space-y-7 pb-8">
      <header className="border-b border-mr-line pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mr-faint">Site settings</p>
            <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.03em] text-mr-text">Operating profile</h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-mr-muted">
              Configure how {currentSite.name} operates. One save validates and applies every change immediately.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusDot tone={published ? 'positive' : 'neutral'}>
                {published ? `Active · v${published.revision_number ?? published.revision}` : 'Using compatible defaults'}
              </StatusDot>
              {updatedAt && <span className="text-[12px] text-mr-faint">Last saved {new Date(updatedAt).toLocaleString('en-IN')}</span>}
            </div>
          </div>
          <Button
            type="button"
            onClick={saveChanges}
            disabled={!canSave || !hasChanges || saving}
            className="h-10 rounded-full bg-mr-ink px-5 text-[13px] font-semibold text-white"
          >
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : hasChanges ? <Save className="mr-1.5 h-4 w-4" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
            {saving ? 'Saving…' : hasChanges ? 'Save changes' : 'Up to date'}
          </Button>
        </div>
      </header>

      {!canSave && (
        <PolicyNotice
          variant="neutral"
          title="View-only access"
          description="An organization administrator can change and immediately apply this Site profile."
        />
      )}

      {(validation?.errors || []).length > 0 && (
        <PolicyNotice variant="attention" title="Fix these settings before saving" role="alert">
          <ul className="mt-1 space-y-1 text-[12px]">
            {validation.errors.map((row, index) => <li key={`${row.field || 'setting'}-${index}`}>• {row.message || row}</li>)}
          </ul>
        </PolicyNotice>
      )}

      <SetupPath sections={setupSections} />

      <div className="divide-y divide-mr-line border-y border-mr-line">
        <SettingSection
          id="profile-basics"
          eyebrow="Project"
          title="Project setup"
          description="Make four straightforward choices. They determine the correct workflows and terminology for this Site."
        >
          <div className="mb-4 flex items-center gap-3 border-b border-mr-line pb-3">
            <span className={`flex h-8 w-8 items-center justify-center rounded-full ${projectSetupComplete ? 'bg-mr-lime-soft text-mr-lime-ink' : 'bg-mr-blue-soft text-mr-blue'}`}>
              {projectSetupComplete ? <Check className="h-4 w-4" strokeWidth={2.6} /> : <span className="text-[11px] font-semibold">{projectChoiceCount}/4</span>}
            </span>
            <span>
              <span className="block text-[12px] font-semibold text-mr-text">{projectSetupComplete ? 'Project setup complete' : `${projectChoiceCount} of 4 choices complete`}</span>
              <span className="block text-[11px] text-mr-muted">You can change these later without deleting historical records.</span>
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Operating model" hint="Who operates and governs this project." complete={Boolean(form.operating_model)} error={errorByField.operating_model}>
              <Select value={form.operating_model} onValueChange={(operating_model) => set({ operating_model })} disabled={!canSave}>
                <SelectTrigger className="h-11 rounded-control border-mr-line"><SelectValue /></SelectTrigger>
                <SelectContent>{optionRows.operating_models.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Development basis" hint="How development rights are held." complete={Boolean(form.development_basis)} error={errorByField.development_basis}>
              <Select value={form.development_basis} onValueChange={(development_basis) => set({ development_basis })} disabled={!canSave}>
                <SelectTrigger className="h-11 rounded-control border-mr-line"><SelectValue /></SelectTrigger>
                <SelectContent>{optionRows.development_bases.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Project type" hint="The inventory format used by this Site." complete={Boolean(form.project_shape)} error={errorByField.project_shape}>
              <Select value={form.project_shape} onValueChange={(project_shape) => set({ project_shape })} disabled={!canSave}>
                <SelectTrigger className="h-11 rounded-control border-mr-line"><SelectValue /></SelectTrigger>
                <SelectContent>{optionRows.project_shapes.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Portfolio structure" hint="One project, phase-wise work, or multiple registrations." complete={Boolean(form.project_structure)} error={errorByField.project_structure}>
              <Select value={form.project_structure} onValueChange={(project_structure) => set({ project_structure })} disabled={!canSave}>
                <SelectTrigger className="h-11 rounded-control border-mr-line"><SelectValue /></SelectTrigger>
                <SelectContent>{projectStructureOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Basis notes" hint="Optional internal context or agreement reference." className="sm:col-span-2">
              <Textarea value={form.development_basis_notes || ''} onChange={(event) => set({ development_basis_notes: event.target.value })} disabled={!canSave} rows={3} className="rounded-control border-mr-line" placeholder="Agreement or operating context" />
            </Field>
          </div>
        </SettingSection>

        <SettingSection
          id="profile-finance"
          eyebrow="Finance"
          title="Payment modes"
          description="Choose the payment experience used by Project Payments, Project Finance, and Customer & Inventory."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <FinanceModeChoice
              value="ALL_MODES"
              selected={form.finance_payment_mode === 'ALL_MODES'}
              title="All payment modes"
              description="Cash and every bank/non-cash mode are available."
              icon={<WalletCards className="h-4 w-4" aria-hidden="true" />}
              onSelect={(finance_payment_mode) => set({ finance_payment_mode })}
              disabled={!canSave}
            />
            <FinanceModeChoice
              value="BANK_ONLY"
              selected={form.finance_payment_mode === 'BANK_ONLY'}
              title="Bank only"
              description="Cash is removed; Bank, Cheque, UPI, NEFT, RTGS and IMPS remain available."
              icon={<Landmark className="h-4 w-4" aria-hidden="true" />}
              onSelect={(finance_payment_mode) => set({ finance_payment_mode })}
              disabled={!canSave}
            />
          </div>
          <div className="mt-3 flex items-start gap-2 text-[12px] leading-relaxed text-mr-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-mr-blue" aria-hidden="true" />
            Saving applies this choice immediately. Historical records remain stored; operational screens follow the active mode.
          </div>
        </SettingSection>

        {isReraProfile && (
          <SettingSection
            id="profile-regulatory"
            eyebrow="Regulatory"
            title="Jurisdiction and controls"
            description="Record confirmed regulatory metadata. The software does not infer an authority from the Site address."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Country"><Input value="India" readOnly disabled className="h-11 rounded-control border-mr-line bg-mr-surface-2" /></Field>
              <Field label="State / union territory" error={errorByField.jurisdiction_state}>
                <Select
                  value={jurisdictionCode || 'none'}
                  onValueChange={(code) => set({
                    jurisdiction_country: 'INDIA',
                    jurisdiction_state: code === 'none' ? '' : indiaJurisdictionName(code),
                  })}
                  disabled={!canSave}
                >
                  <SelectTrigger className="h-11 rounded-control border-mr-line"><SelectValue placeholder="Select state or union territory" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select state or union territory</SelectItem>
                    {INDIA_JURISDICTIONS.map(([code, name]) => <SelectItem key={code} value={code}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Authority name" error={errorByField.authority_name}><Input value={form.authority_name || ''} onChange={(event) => set({ authority_name: event.target.value })} disabled={!canSave} placeholder="Confirmed authority" className="h-11 rounded-control border-mr-line" /></Field>
              <Field label="Authority code"><Input value={form.authority_code || ''} onChange={(event) => set({ authority_code: event.target.value.toUpperCase() })} disabled={!canSave} placeholder="Authority code" className="h-11 rounded-control border-mr-line" /></Field>
              <Field label="District"><Input value={form.district || ''} onChange={(event) => set({ district: event.target.value })} disabled={!canSave} placeholder="District" className="h-11 rounded-control border-mr-line" /></Field>
              <Field label="Regulatory status" error={errorByField.regulatory_status}>
                <Select value={form.regulatory_status} onValueChange={(regulatory_status) => set({ regulatory_status })} disabled={!canSave}>
                  <SelectTrigger className="h-11 rounded-control border-mr-line"><SelectValue /></SelectTrigger>
                  <SelectContent>{optionRows.regulatory_statuses.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field
                label="State regulatory extension · optional"
                error={errorByField.ruleset_version_id}
                hint="Nationwide RERA workflow controls apply automatically. Only a reviewed extension matching the selected state can appear here."
                className="sm:col-span-2"
              >
                <Select
                  value={selectedJurisdictionRuleset || 'none'}
                  onValueChange={(value) => set({ ruleset_version_id: value === 'none' ? '' : value })}
                  disabled={!canSave || !jurisdictionCode || jurisdictionRulesets.length === 0}
                >
                  <SelectTrigger className="h-11 rounded-control border-mr-line">
                    <SelectValue placeholder="Use nationwide controls" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Use nationwide controls</SelectItem>
                    {jurisdictionRulesets.map((ruleset) => (
                      <SelectItem key={ruleset.version_id || ruleset.id} value={String(ruleset.version_id || ruleset.id)}>
                        {ruleset.name} · v{ruleset.version} {!['REVIEWED', 'NOT_APPLICABLE'].includes(ruleset.review_status) ? '(source review pending)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {jurisdictionCode && jurisdictionRulesets.length === 0 && (
                  <p className="text-[12px] leading-relaxed text-mr-muted">
                    No reviewed {jurisdictionName} extension is configured. Nationwide central controls remain active.
                  </p>
                )}
              </Field>
              <Field label="Financial control references" hint="Configuration metadata only; no legal conclusion is generated." className="sm:col-span-2">
                <div className="grid gap-x-5 gap-y-2 border-y border-mr-line py-3 sm:grid-cols-2">
                  {[
                    ['COLLECTION_TRACKING', 'Customer collection tracking'],
                    ['DESIGNATED_ACCOUNT_REFERENCE', 'Designated account reference'],
                    ['EXTERNAL_CERTIFICATION_REFERENCE', 'External certification reference'],
                    ['NO_SPECIAL_CONTROL', 'No special control configured'],
                  ].map(([key, label]) => {
                    const selected = form.fund_control_modes.includes(key);
                    return (
                      <label key={key} className="flex cursor-pointer items-center gap-2.5 py-1.5 text-[13px] text-mr-text">
                        <input type="checkbox" checked={selected} disabled={!canSave} onChange={() => set({ fund_control_modes: selected ? form.fund_control_modes.filter((item) => item !== key) : [...form.fund_control_modes, key] })} className="h-4 w-4 rounded border-mr-line accent-mr-ink" />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </Field>
            </div>
            {form.regulatory_status === 'REGISTERED' && (
              <div className="mt-4">
                <PolicyNotice variant="attention" title="Registration evidence required" description="Record the RERA Project registration number, authority/source, and supporting evidence before saving this status." />
              </div>
            )}
          </SettingSection>
        )}

        <SettingSection
          id="profile-note"
          eyebrow="Audit"
          title="Change note"
          description="Optional context is stored with the revision history so future administrators understand the change."
        >
          <Textarea value={form.change_reason || ''} onChange={(event) => set({ change_reason: event.target.value })} disabled={!canSave} rows={3} className="rounded-control border-mr-line" placeholder="Example: Restrict this Site to bank collections" />
        </SettingSection>
      </div>

      {(validation?.warnings || []).length > 0 && (
        <div className="flex items-start gap-2 border-y border-mr-line py-3 text-[12px] text-mr-muted">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-mr-amber-ink" aria-hidden="true" />
          <span>{validation.warnings.map((row) => row.message || row).join(' ')}</span>
        </div>
      )}

      <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mr-line bg-mr-surface/95 px-4 py-3 shadow-lg shadow-mr-ink/10 backdrop-blur sm:px-5">
        <div className="flex items-center gap-2 text-[12px] text-mr-muted">
          {hasChanges ? <SlidersHorizontal className="h-4 w-4 text-mr-blue" /> : <CheckCircle2 className="h-4 w-4 text-mr-lime-ink" />}
          {hasChanges ? 'Unsaved changes — one save applies them immediately.' : 'All settings are saved and active.'}
        </div>
        <Button type="button" onClick={saveChanges} disabled={!canSave || !hasChanges || saving} className="h-10 rounded-full bg-mr-ink px-5 text-[13px] font-semibold text-white">
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>

      <details className="group border-t border-mr-line pt-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-2 text-[13px] font-semibold text-mr-text">
          <span className="flex items-center gap-2"><History className="h-4 w-4 text-mr-muted" /> Change history <span className="font-normal text-mr-faint">({history.length})</span></span>
          <ChevronDown className="h-4 w-4 text-mr-faint transition-transform group-open:rotate-180" />
        </summary>
        <div className="pt-4"><ProfileHistory rows={history} /></div>
      </details>
    </div>
  );
}
