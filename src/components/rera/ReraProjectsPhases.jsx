import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  CircleDot,
  FileCheck2,
  Loader2,
  Pencil,
  Plus,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/api/api';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useSitePolicy } from '@/hooks/useSitePolicy';
import {
  CompactEmpty,
  DetailFact,
  FormField,
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

const PROJECT_TYPES = ['PLOTTED_DEVELOPMENT', 'APARTMENT', 'COMMERCIAL', 'MIXED_USE'];
const DEVELOPMENT_BASES = [
  'LANDOWNER',
  'DEVELOPMENT_AGREEMENT',
  'JOINT_DEVELOPMENT_AGREEMENT',
  'COLLABORATION_AGREEMENT',
  'CO_PROMOTER',
  'POWER_OF_ATTORNEY',
  'OTHER',
];
const PROJECT_STATUSES = [
  'DRAFT',
  'APPLICABILITY_UNDER_REVIEW',
  'EXEMPTION_UNDER_REVIEW',
  'APPLICATION_IN_PREPARATION',
  'FILED',
  'REGISTERED',
  'AMENDMENT_PENDING',
  'EXTENSION_PENDING',
  'COMPLETED',
  'EXPIRED',
  'LAPSED',
  'REVOKED',
];
const PHASE_STATUSES = PROJECT_STATUSES;

const REGULATORY_JOURNEY = [
  { label: 'Draft', description: 'Project identity recorded' },
  { label: 'Application', description: 'Application being prepared' },
  { label: 'Filed', description: 'Submission recorded' },
  { label: 'Registered', description: 'Registration details recorded' },
];

const STATUS_STAGE = Object.freeze({
  DRAFT: 0,
  APPLICABILITY_UNDER_REVIEW: 0,
  EXEMPTION_UNDER_REVIEW: 0,
  APPLICATION_IN_PREPARATION: 1,
  FILED: 2,
  REGISTERED: 3,
  AMENDMENT_PENDING: 3,
  EXTENSION_PENDING: 3,
  COMPLETED: 3,
  EXPIRED: 3,
  LAPSED: 2,
  REVOKED: 3,
});

const PRIMARY_STATUS_ACTION = Object.freeze({
  DRAFT: { target: 'APPLICATION_IN_PREPARATION', label: 'Start application' },
  APPLICABILITY_UNDER_REVIEW: { target: 'APPLICATION_IN_PREPARATION', label: 'Prepare application' },
  EXEMPTION_UNDER_REVIEW: { target: 'APPLICATION_IN_PREPARATION', label: 'Prepare application' },
  APPLICATION_IN_PREPARATION: { target: 'FILED', label: 'Mark as filed' },
  FILED: { target: 'REGISTERED', label: 'Record registration' },
  AMENDMENT_PENDING: { target: 'REGISTERED', label: 'Record amendment outcome' },
  EXTENSION_PENDING: { target: 'REGISTERED', label: 'Record extension outcome' },
  EXPIRED: { target: 'EXTENSION_PENDING', label: 'Start extension' },
  LAPSED: { target: 'APPLICATION_IN_PREPARATION', label: 'Restart application' },
});

const ALLOWED_STATUS_TRANSITIONS = Object.freeze({
  DRAFT: ['APPLICABILITY_UNDER_REVIEW', 'EXEMPTION_UNDER_REVIEW', 'APPLICATION_IN_PREPARATION', 'FILED'],
  APPLICABILITY_UNDER_REVIEW: ['DRAFT', 'EXEMPTION_UNDER_REVIEW', 'APPLICATION_IN_PREPARATION'],
  EXEMPTION_UNDER_REVIEW: ['DRAFT', 'APPLICABILITY_UNDER_REVIEW', 'APPLICATION_IN_PREPARATION'],
  APPLICATION_IN_PREPARATION: ['DRAFT', 'APPLICABILITY_UNDER_REVIEW', 'FILED'],
  FILED: ['APPLICATION_IN_PREPARATION', 'REGISTERED', 'LAPSED'],
  REGISTERED: ['AMENDMENT_PENDING', 'EXTENSION_PENDING', 'EXPIRED', 'LAPSED', 'REVOKED', 'COMPLETED'],
  AMENDMENT_PENDING: ['REGISTERED', 'EXTENSION_PENDING', 'EXPIRED', 'LAPSED', 'REVOKED'],
  EXTENSION_PENDING: ['REGISTERED', 'AMENDMENT_PENDING', 'EXPIRED', 'LAPSED', 'REVOKED'],
  EXPIRED: ['EXTENSION_PENDING', 'LAPSED', 'REVOKED', 'COMPLETED'],
  LAPSED: ['APPLICATION_IN_PREPARATION', 'EXTENSION_PENDING', 'REVOKED'],
  REVOKED: [],
  COMPLETED: [],
});

const availableStatusOptions = (currentStatus) => {
  const current = String(currentStatus || 'DRAFT').toUpperCase();
  return [current, ...(ALLOWED_STATUS_TRANSITIONS[current] || [])];
};

const emptyProject = {
  name: '',
  project_code: '',
  project_shape: '',
  development_basis: '',
  regulatory_status: 'DRAFT',
  authority_id: '',
  authority_code: '',
  authority_name: '',
  district: '',
  state: '',
  address: '',
  registration_number: '',
  registration_date: '',
  registration_expiry_date: '',
  proposed_start_date: '',
  proposed_completion_date: '',
  actual_completion_date: '',
  source_reference: '',
  status_reason: '',
  notes: '',
};

const emptyPhase = {
  name: '',
  phase_code: '',
  regulatory_status: 'DRAFT',
  authority_id: '',
  authority_code: '',
  authority_name: '',
  registration_number: '',
  registration_date: '',
  registration_expiry_date: '',
  proposed_start_date: '',
  proposed_completion_date: '',
  actual_completion_date: '',
  status_reason: '',
  notes: '',
};

const dateInput = (value) => (value ? String(value).slice(0, 10) : '');

const projectToForm = (project) => ({
  name: firstValue(project, ['name', 'project_name'], ''),
  project_code: firstValue(project, ['project_code', 'code', 'internal_code'], ''),
  project_shape: firstValue(project, ['project_shape', 'project_type'], ''),
  development_basis: firstValue(project, ['development_basis'], ''),
  regulatory_status: firstValue(project, ['regulatory_status', 'registration_status', 'status'], 'DRAFT'),
  authority_id: firstValue(project, ['authority_id'], ''),
  authority_code: firstValue(project, ['authority_code'], ''),
  authority_name: firstValue(project, ['authority_name', 'authority'], ''),
  district: firstValue(project, ['district'], ''),
  state: firstValue(project, ['state'], ''),
  address: firstValue(project, ['address', 'location'], ''),
  registration_number: firstValue(project, ['registration_number', 'rera_number'], ''),
  registration_date: dateInput(firstValue(project, ['registration_date'])),
  registration_expiry_date: dateInput(firstValue(project, ['registration_expiry_date', 'valid_until'])),
  proposed_start_date: dateInput(firstValue(project, ['proposed_start_date'])),
  proposed_completion_date: dateInput(firstValue(project, ['proposed_completion_date', 'committed_completion_date'])),
  actual_completion_date: dateInput(firstValue(project, ['actual_completion_date'])),
  source_reference: firstValue(project, ['source_reference', 'official_source_url', 'source_url', 'portal_reference'], ''),
  status_reason: firstValue(project, ['status_reason'], ''),
  notes: firstValue(project, ['notes'], ''),
});

const phaseToForm = (phase) => ({
  name: firstValue(phase, ['name', 'phase_name'], ''),
  phase_code: firstValue(phase, ['phase_code', 'code'], ''),
  regulatory_status: firstValue(phase, ['regulatory_status', 'status'], 'DRAFT'),
  authority_id: firstValue(phase, ['authority_id'], ''),
  authority_code: firstValue(phase, ['authority_code'], ''),
  authority_name: firstValue(phase, ['authority_name', 'authority'], ''),
  registration_number: firstValue(phase, ['registration_number'], ''),
  registration_date: dateInput(firstValue(phase, ['registration_date'])),
  registration_expiry_date: dateInput(firstValue(phase, ['registration_expiry_date'])),
  proposed_start_date: dateInput(firstValue(phase, ['proposed_start_date'])),
  proposed_completion_date: dateInput(firstValue(phase, ['proposed_completion_date', 'committed_completion_date'])),
  actual_completion_date: dateInput(firstValue(phase, ['actual_completion_date'])),
  status_reason: firstValue(phase, ['status_reason'], ''),
  notes: firstValue(phase, ['notes'], ''),
});

const isHttpReference = (value) => {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
};

const regulatoryValidationError = (form, { requireSourceUrl = false } = {}) => {
  if (form.regulatory_status === 'REGISTERED'
    && (!(form.authority_id || form.authority_code?.trim() || form.authority_name?.trim())
      || !form.registration_number.trim() || !form.registration_date)) {
    return 'Registered status requires an authority, registration number, and registration date';
  }
  if (form.regulatory_status === 'REGISTERED' && requireSourceUrl && !isHttpReference(form.source_reference)) {
    return 'Registered project status requires an official http(s) source URL';
  }
  if (form.regulatory_status === 'EXPIRED' && !form.registration_expiry_date) {
    return 'Expired status requires a registration expiry date';
  }
  if (form.regulatory_status === 'COMPLETED' && !form.actual_completion_date) {
    return 'Completed status requires an actual completion date';
  }
  if (['EXEMPTION_UNDER_REVIEW', 'REVOKED'].includes(form.regulatory_status) && !form.status_reason.trim()) {
    return `${readable(form.regulatory_status)} requires a status reason`;
  }
  return null;
};

export default function ReraProjectsPhases({
  siteId,
  projects,
  selectedProject,
  phases,
  canWrite,
  canUpdate,
  onProjectSelected,
  onChanged,
  createProjectRequestKey,
  onCreateProjectRequestConsumed,
  projectTerm = 'Project',
  isReraWorkspace = false,
}) {
  const { getFieldPolicy } = useSitePolicy();
  const projectStatusPolicy = getFieldPolicy('rera_projects.regulatory_status') || {};
  const phaseStatusPolicy = getFieldPolicy('rera_phases.regulatory_status') || {};
  const canUpdateProjectStatus = canUpdate && projectStatusPolicy.visible !== false && projectStatusPolicy.readOnly !== true;
  const canUpdatePhaseStatus = canUpdate && phaseStatusPolicy.visible !== false && phaseStatusPolicy.readOnly !== true;
  const projectPlural = `${projectTerm}s`;
  const projectRows = asList(projects);
  const selectedProjectId = recordId(selectedProject);
  const phaseRows = useMemo(() => asList(phases).filter((phase) => {
    const projectId = firstValue(phase, ['project_id', 'rera_project_id']);
    return !selectedProjectId || !projectId || String(projectId) === String(selectedProjectId);
  }), [phases, selectedProjectId]);

  const [busy, setBusy] = useState(false);
  const [projectDialog, setProjectDialog] = useState({ open: false, record: null });
  const [projectForm, setProjectForm] = useState(emptyProject);
  const [phaseDialog, setPhaseDialog] = useState({ open: false, record: null });
  const [phaseForm, setPhaseForm] = useState(emptyPhase);
  const [statusDialog, setStatusDialog] = useState({ open: false, type: 'project', record: null, form: null });
  const [detail, setDetail] = useState(null);
  const [projectSearch, setProjectSearch] = useState('');
  const filteredProjects = useMemo(() => {
    const query = projectSearch.trim().toLowerCase();
    if (!query) return projectRows;
    return projectRows.filter((project) => [
      firstValue(project, ['name', 'project_name']),
      firstValue(project, ['project_code', 'code', 'internal_code']),
      firstValue(project, ['registration_number', 'rera_number']),
      firstValue(project, ['authority', 'authority_name']),
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [projectRows, projectSearch]);

  const openProject = (project = null) => {
    setProjectForm(project ? projectToForm(project) : emptyProject);
    setProjectDialog({ open: true, record: project });
  };

  const openPhase = (phase = null) => {
    setPhaseForm(phase ? phaseToForm(phase) : emptyPhase);
    setPhaseDialog({ open: true, record: phase });
  };

  const openStatusUpdate = (type, record, targetStatus) => {
    const form = type === 'phase' ? phaseToForm(record) : projectToForm(record);
    setStatusDialog({
      open: true,
      type,
      record,
      form: { ...form, regulatory_status: targetStatus },
    });
  };

  useEffect(() => {
    if (!createProjectRequestKey || !canWrite) return;
    setProjectForm(emptyProject);
    setProjectDialog({ open: true, record: null });
    onCreateProjectRequestConsumed?.();
  }, [canWrite, createProjectRequestKey, onCreateProjectRequestConsumed]);

  const saveProject = async (event) => {
    event.preventDefault();
    if (!projectForm.name.trim()) return toast.error('Enter a project name');
    if (!projectForm.project_code.trim()) return toast.error('Enter an internal project code');
    if (!projectForm.project_shape) return toast.error('Select a project shape');
    if (!projectForm.development_basis) return toast.error('Select a development basis');
    const validationError = isReraWorkspace ? regulatoryValidationError(projectForm, { requireSourceUrl: true }) : null;
    if (validationError) return toast.error(validationError);

    setBusy(true);
    try {
      const payload = cleanPayload({
        site_id: siteId,
        ...writablePolicyPayload(projectForm, 'rera_projects', getFieldPolicy),
      });
      const id = recordId(projectDialog.record);
      const { data } = id
        ? await api.patch(`/rera/projects/${id}`, payload)
        : await api.post('/rera/projects', payload);
      const saved = data?.project ?? data;
      const savedId = recordId(saved) ?? id;
      toast.success(id ? `${projectTerm} details updated` : `${projectTerm} created`);
      setProjectDialog({ open: false, record: null });
      if (savedId) onProjectSelected?.(String(savedId));
      onChanged?.(savedId);
    } catch (error) {
      toast.error(error.response?.data?.message || `${projectTerm} could not be saved`);
    } finally {
      setBusy(false);
    }
  };

  const savePhase = async (event) => {
    event.preventDefault();
    if (!selectedProjectId) return toast.error(`Select a ${projectTerm} first`);
    if (!phaseForm.name.trim()) return toast.error('Enter a phase name');
    if (!phaseForm.phase_code.trim()) return toast.error('Enter a phase code');
    const validationError = isReraWorkspace ? regulatoryValidationError(phaseForm) : null;
    if (validationError) return toast.error(validationError);

    setBusy(true);
    try {
      const payload = cleanPayload({
        site_id: siteId,
        rera_project_id: selectedProjectId,
        ...writablePolicyPayload(phaseForm, 'rera_phases', getFieldPolicy),
      });
      const id = recordId(phaseDialog.record);
      if (id) await api.patch(`/rera/phases/${id}`, payload);
      else await api.post(`/rera/projects/${selectedProjectId}/phases`, payload);
      toast.success(id ? 'Phase details updated' : `${projectTerm} phase created`);
      setPhaseDialog({ open: false, record: null });
      onChanged?.();
    } catch (error) {
      toast.error(error.response?.data?.message || `${projectTerm} phase could not be saved`);
    } finally {
      setBusy(false);
    }
  };

  const saveStatus = async (event) => {
    event.preventDefault();
    const { type, record, form } = statusDialog;
    const id = recordId(record);
    if (!id || !form) return;
    const validationError = regulatoryValidationError(form, { requireSourceUrl: type === 'project' });
    if (validationError) return toast.error(validationError);

    const section = type === 'phase' ? 'rera_phases' : 'rera_projects';
    const details = {
      regulatory_status: form.regulatory_status,
      ...(form.status_reason?.trim() ? { status_reason: form.status_reason } : {}),
      ...(form.regulatory_status === 'REGISTERED' ? {
        authority_id: form.authority_id || null,
        authority_code: form.authority_code,
        authority_name: form.authority_name,
        registration_number: form.registration_number,
        registration_date: form.registration_date,
        registration_expiry_date: form.registration_expiry_date || null,
        ...(type === 'project' ? { source_reference: form.source_reference } : {}),
      } : {}),
      ...(form.regulatory_status === 'EXPIRED' ? { registration_expiry_date: form.registration_expiry_date } : {}),
      ...(form.regulatory_status === 'COMPLETED' ? { actual_completion_date: form.actual_completion_date } : {}),
    };

    setBusy(true);
    try {
      const payload = cleanPayload(writablePolicyPayload(details, section, getFieldPolicy));
      const { data } = type === 'phase'
        ? await api.patch(`/rera/phases/${id}`, payload)
        : await api.patch(`/rera/projects/${id}`, payload);
      const saved = data?.[type] ?? data;
      toast.success(`${type === 'phase' ? 'Phase' : projectTerm} moved to ${readable(form.regulatory_status)}`);
      setStatusDialog({ open: false, type: 'project', record: null, form: null });
      setDetail(null);
      onChanged?.(type === 'project' ? recordId(saved) || id : undefined);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Regulatory status could not be updated');
    } finally {
      setBusy(false);
    }
  };

  const selectedStatus = String(firstValue(selectedProject, ['regulatory_status', 'registration_status', 'status'], 'DRAFT')).toUpperCase();
  const selectedStatusAction = PRIMARY_STATUS_ACTION[selectedStatus];

  return (
    <div className="py-1">
      <section className="flex flex-col gap-4 border-y border-mr-line bg-mr-surface px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <div className="flex items-center gap-2"><h2 className="text-[15px] font-semibold text-mr-text">Project structure</h2><span className="rounded-full bg-mr-surface-2 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-mr-muted">{projectRows.length} {projectRows.length === 1 ? 'project' : 'projects'}</span></div>
          <p className="mt-1 text-[12px] leading-5 text-mr-muted">Select a project to manage its regulatory identity and phase-level registrations.</p>
        </div>
        {canWrite && <Button type="button" size="sm" onClick={() => openProject()}><Plus className="h-4 w-4" />Add {projectTerm}</Button>}
      </section>

      {projectRows.length ? (
        <div className="grid min-h-[480px] border-b border-mr-line bg-mr-surface lg:grid-cols-[minmax(290px,0.78fr)_minmax(0,1.7fr)]">
          <aside className="border-b border-mr-line lg:border-b-0 lg:border-r">
            <div className="border-b border-mr-line p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mr-faint" />
                <Input value={projectSearch} onChange={(event) => setProjectSearch(event.target.value)} placeholder={`Search ${projectPlural.toLowerCase()}…`} className="h-9 bg-mr-canvas/60 pl-9 text-xs" />
              </div>
            </div>
            <div className="max-h-[620px] divide-y divide-mr-line overflow-y-auto">
              {filteredProjects.map((project, index) => {
                const id = recordId(project);
                const selected = selectedProjectId && String(id) === String(selectedProjectId);
                const registration = firstValue(project, ['registration_number', 'rera_number']);
                return <button key={`${id ?? 'project'}-${index}`} type="button" onClick={() => onProjectSelected?.(String(id))} className={`group relative flex w-full items-start gap-3 px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mr-blue ${selected ? 'bg-mr-blue-soft/70' : 'hover:bg-mr-surface-2/70'}`}>
                  {selected && <span className="absolute inset-y-0 left-0 w-0.5 bg-mr-blue" />}
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-mr-blue text-white' : 'bg-mr-surface-2 text-mr-muted'}`}><Building2 className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-mr-text">{firstValue(project, ['name', 'project_name'], 'Untitled project')}</span><span className="mt-0.5 block truncate text-[10px] font-medium uppercase tracking-wide text-mr-faint">{firstValue(project, ['project_code', 'code', 'internal_code'], 'No internal code')}</span><span className="mt-2 flex items-center justify-between gap-2"><ReraStatus value={firstValue(project, ['regulatory_status', 'registration_status', 'status'])} /><span className="truncate text-[10px] text-mr-faint">{registration || (isReraWorkspace ? 'No registration' : readable(firstValue(project, ['project_shape', 'project_type'])))}</span></span></span>
                  <ChevronRight className={`mt-2 h-4 w-4 shrink-0 ${selected ? 'text-mr-blue' : 'text-mr-faint group-hover:text-mr-muted'}`} />
                </button>;
              })}
              {!filteredProjects.length && <div className="px-5 py-12 text-center"><p className="text-xs font-semibold text-mr-text">No project found</p><p className="mt-1 text-[11px] text-mr-muted">Try a name, code, registration number or authority.</p></div>}
            </div>
          </aside>

          <section className="min-w-0">
            {!selectedProject ? (
              <CompactEmpty title={`Select a ${projectTerm}`} description={`Choose a project from the list to review its identity and manage phases.`} />
            ) : <>
              <div className="flex flex-col gap-4 border-b border-mr-line px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mr-faint">Selected {projectTerm}</p><div className="mt-1 flex flex-wrap items-center gap-2"><h3 className="truncate text-lg font-semibold text-mr-text">{firstValue(selectedProject, ['name', 'project_name'], 'Untitled project')}</h3>{isReraWorkspace && <ReraStatus value={selectedStatus} />}</div><div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-mr-muted"><span>{firstValue(selectedProject, ['project_code', 'code', 'internal_code'], 'No internal code')}</span>{isReraWorkspace && <span>{firstValue(selectedProject, ['authority', 'authority_name'], 'Authority not recorded')}</span>}{isReraWorkspace && <span>{firstValue(selectedProject, ['registration_number', 'rera_number'], 'Registration not recorded')}</span>}</div></div>
                <div className="flex shrink-0 flex-wrap gap-2">{canUpdate ? <Button type="button" variant="outline" size="sm" onClick={() => openProject(selectedProject)}><Pencil className="h-3.5 w-3.5" />Edit project</Button> : <Button type="button" variant="outline" size="sm" onClick={() => setDetail({ type: 'project', record: selectedProject })}>View details</Button>}{canWrite && <Button type="button" variant="outline" size="sm" onClick={() => openPhase()}><Plus className="h-4 w-4" />Add phase</Button>}</div>
              </div>
              {isReraWorkspace && <RegulatoryJourney
                status={selectedStatus}
                action={selectedStatusAction}
                canUpdate={canUpdateProjectStatus}
                onAction={() => openStatusUpdate('project', selectedProject, selectedStatusAction?.target)}
              />}
              <div className="flex items-center justify-between border-b border-mr-line bg-mr-surface-2/45 px-4 py-3 sm:px-5"><div><p className="text-[13px] font-semibold text-mr-text">Project phases</p><p className="mt-0.5 text-[10px] text-mr-muted">{phaseRows.length ? `${phaseRows.length} separately managed ${phaseRows.length === 1 ? 'phase' : 'phases'}` : 'No separate phases recorded'}</p></div><span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-mr-muted"><CalendarClock className="h-3.5 w-3.5" />Dates are project-specific</span></div>
              {phaseRows.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-mr-line hover:bg-transparent"><TableHead className="pl-5">Phase</TableHead><TableHead>{isReraWorkspace ? 'Regulatory status' : 'Phase status'}</TableHead>{isReraWorkspace && <TableHead>Registration</TableHead>}<TableHead>Committed completion</TableHead><TableHead className="w-20 pr-5 text-right">Details</TableHead></TableRow></TableHeader><TableBody>{phaseRows.map((phase, index) => <TableRow key={`${recordId(phase) ?? 'phase'}-${index}`} className="group cursor-pointer border-mr-line hover:bg-mr-blue-soft/30" onClick={() => setDetail({ type: 'phase', record: phase })}><TableCell className="pl-5"><span className="block text-[13px] font-medium text-mr-text">{firstValue(phase, ['name', 'phase_name'], 'Untitled phase')}</span><span className="mt-0.5 block text-[10px] text-mr-faint">{firstValue(phase, ['phase_code', 'code'], 'No phase code')}</span></TableCell><TableCell><ReraStatus value={firstValue(phase, ['regulatory_status', 'status'])} label={isReraWorkspace && phase.registration_number ? 'Registration recorded' : undefined} /></TableCell>{isReraWorkspace && <TableCell className="text-[12px] font-medium text-mr-text">{phase.registration_number || 'Not recorded'}</TableCell>}<TableCell className="text-[12px] text-mr-muted">{formatDate(firstValue(phase, ['proposed_completion_date', 'committed_completion_date', 'completion_date']))}</TableCell><TableCell className="pr-5 text-right"><ChevronRight className="ml-auto h-4 w-4 text-mr-faint transition group-hover:translate-x-0.5 group-hover:text-mr-blue" /></TableCell></TableRow>)}</TableBody></Table></div> : <CompactEmpty title="No phases recorded" description="Add a phase only when it has a separate timeline or regulatory registration." action={canWrite ? <Button type="button" variant="outline" onClick={() => openPhase()}><Plus />Add first phase</Button> : null} />}
            </>}
          </section>
        </div>
      ) : <div className="border-b border-mr-line bg-mr-surface"><CompactEmpty icon={Building2} title={`No ${projectTerm} created`} description={isReraWorkspace ? 'Create the first regulatory project, then add phases only where the registration or delivery timeline differs.' : 'Create a Development Project to begin planning phases, customer collections and project finance.'} action={canWrite ? <Button type="button" variant="outline" onClick={() => openProject()}><Plus />Create {projectTerm}</Button> : null} /></div>}

      <ProjectDialog
        state={projectDialog}
        setState={setProjectDialog}
        form={projectForm}
        setForm={setProjectForm}
        onSubmit={saveProject}
        busy={busy}
        projectTerm={projectTerm}
        isReraWorkspace={isReraWorkspace}
      />
      <PhaseDialog
        state={phaseDialog}
        setState={setPhaseDialog}
        form={phaseForm}
        setForm={setPhaseForm}
        onSubmit={savePhase}
        busy={busy}
        projectTerm={projectTerm}
        isReraWorkspace={isReraWorkspace}
      />
      <StatusUpdateDialog
        state={statusDialog}
        setState={setStatusDialog}
        onSubmit={saveStatus}
        busy={busy}
        projectTerm={projectTerm}
      />

      <Sheet open={Boolean(detail)} onOpenChange={(open) => { if (!open) setDetail(null); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader className="pr-8">
            <SheetTitle>{detail?.type === 'phase' ? firstValue(detail?.record, ['name', 'phase_name'], 'Project phase') : firstValue(detail?.record, ['name', 'project_name'], projectTerm)}</SheetTitle>
            <SheetDescription>{detail?.type === 'phase' ? `Phase record within the selected ${projectTerm}.` : isReraWorkspace ? 'Recorded regulatory project details.' : 'Recorded development project details.'}</SheetDescription>
          </SheetHeader>
          {detail?.record && (
            <div className="mt-6">
              <DetailFact label="Internal code" value={firstValue(detail.record, ['project_code', 'phase_code', 'code', 'internal_code'])} />
              <DetailFact label={isReraWorkspace ? 'Regulatory status' : 'Project status'}><ReraStatus value={firstValue(detail.record, ['regulatory_status', 'registration_status', 'status'])} label={isReraWorkspace && detail.record.registration_number ? 'Registration recorded' : undefined} /></DetailFact>
              {detail.type === 'project' && <DetailFact label="Project shape" value={readable(firstValue(detail.record, ['project_shape', 'project_type']))} />}
              {isReraWorkspace && detail.type === 'project' && <DetailFact label="Authority" value={firstValue(detail.record, ['authority', 'authority_name'])} />}
              {isReraWorkspace && <DetailFact label="Registration number" value={firstValue(detail.record, ['registration_number', 'rera_number'])} />}
              {isReraWorkspace && <DetailFact label="Registration date" value={formatDate(detail.record.registration_date)} />}
              <DetailFact label="Proposed completion" value={formatDate(firstValue(detail.record, ['proposed_completion_date', 'committed_completion_date', 'completion_date']))} />
              {isReraWorkspace && detail.type === 'project' && <DetailFact label="Ruleset" value={firstValue(detail.record, ['ruleset_name', 'active_ruleset_name', 'ruleset_id'])} />}
              {detail.type === 'project' && <DetailFact label="Source reference" value={firstValue(detail.record, ['source_reference', 'official_source_url', 'source_url', 'portal_reference'])} />}
              {((detail.type === 'project' && canUpdate) || (detail.type === 'phase' && canUpdate)) && (
                <div className="mt-6 flex flex-wrap gap-2">
                  {isReraWorkspace && (detail.type === 'phase' ? canUpdatePhaseStatus : canUpdateProjectStatus) && PRIMARY_STATUS_ACTION[String(firstValue(detail.record, ['regulatory_status', 'registration_status', 'status'], 'DRAFT')).toUpperCase()] && <Button type="button" onClick={() => {
                    const action = PRIMARY_STATUS_ACTION[String(firstValue(detail.record, ['regulatory_status', 'registration_status', 'status'], 'DRAFT')).toUpperCase()];
                    setDetail(null);
                    openStatusUpdate(detail.type, detail.record, action.target);
                  }}>Update status <ArrowRight className="h-4 w-4" /></Button>}
                  <Button type="button" variant="outline" onClick={() => {
                    if (detail.type === 'project') openProject(detail.record);
                    else openPhase(detail.record);
                    setDetail(null);
                  }}>
                    <Pencil />Edit details
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function RegulatoryJourney({ status, action, canUpdate, onAction }) {
  const currentStage = STATUS_STAGE[status] ?? 0;
  const registrationRecorded = status === 'REGISTERED';

  return (
    <section className="border-b border-mr-line bg-mr-blue-soft/20 px-4 py-5 sm:px-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[13px] font-semibold text-mr-text">Regulatory journey</p>
              <p className="mt-0.5 text-[10px] text-mr-muted">Update the internal record as the authority process moves forward.</p>
            </div>
            <p className="text-[10px] text-mr-faint">This does not publish to a government portal.</p>
          </div>
          <div className="mt-4 grid grid-cols-4">
            {REGULATORY_JOURNEY.map((step, index) => {
              const completed = index < currentStage || (registrationRecorded && index === currentStage);
              const active = index === currentStage && !completed;
              return (
                <div key={step.label} className="relative min-w-0 pr-2 last:pr-0">
                  {index < REGULATORY_JOURNEY.length - 1 && <span className={`absolute left-6 right-0 top-3 h-px ${index < currentStage ? 'bg-emerald-400' : 'bg-mr-line'}`} />}
                  <div className="relative flex items-start gap-2 sm:gap-3">
                    <span className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${completed ? 'border-emerald-500 bg-emerald-500 text-white' : active ? 'border-mr-blue bg-mr-blue text-white' : 'border-mr-line bg-mr-surface text-mr-faint'}`}>
                      {completed ? <Check className="h-3.5 w-3.5" /> : active ? <CircleDot className="h-3.5 w-3.5" /> : index + 1}
                    </span>
                    <span className="min-w-0 pt-0.5">
                      <span className={`block truncate text-[10px] font-semibold sm:text-[11px] ${completed || active ? 'text-mr-text' : 'text-mr-faint'}`}>{step.label}</span>
                      <span className="mt-0.5 hidden text-[9px] text-mr-muted lg:block">{step.description}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="shrink-0 xl:w-44">
          {action && canUpdate ? <Button type="button" className="w-full" onClick={onAction}>{action.label}<ArrowRight className="h-4 w-4" /></Button> : (
            <div className="flex items-center gap-2 text-[11px] font-medium text-mr-muted xl:justify-end">
              <FileCheck2 className="h-4 w-4 text-emerald-600" />
              {registrationRecorded ? 'Registration recorded' : 'No next action'}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StatusUpdateDialog({ state, setState, onSubmit, busy, projectTerm }) {
  const form = state.form;
  const targetStatus = form?.regulatory_status || '';
  const entityLabel = state.type === 'phase' ? 'Phase' : projectTerm;
  const needsRegistration = targetStatus === 'REGISTERED';
  const needsExpiry = targetStatus === 'EXPIRED';
  const needsCompletion = targetStatus === 'COMPLETED';
  const needsReason = ['EXEMPTION_UNDER_REVIEW', 'REVOKED'].includes(targetStatus);
  const set = (key, value) => setState((current) => ({
    ...current,
    form: { ...current.form, [key]: value },
  }));

  return (
    <Dialog open={state.open} onOpenChange={(open) => setState((current) => ({ ...current, open }))}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{readable(targetStatus)}</DialogTitle>
          <DialogDescription>
            Update only the information needed for this {entityLabel.toLowerCase()} step. The change is saved to the audit trail.
          </DialogDescription>
        </DialogHeader>
        {form && <form onSubmit={onSubmit} className="space-y-5">
          <div className="flex items-center gap-3 border-y border-mr-line bg-mr-surface-2/45 px-1 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mr-blue-soft text-mr-blue"><FileCheck2 className="h-4 w-4" /></span>
            <div><p className="text-[11px] text-mr-muted">New regulatory status</p><p className="text-[13px] font-semibold text-mr-text">{readable(targetStatus)}</p></div>
          </div>

          {needsRegistration && <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Authority name" required><Input value={form.authority_name} onChange={(event) => set('authority_name', event.target.value)} placeholder="e.g. State RERA authority" /></FormField>
            <FormField label="Authority code"><Input value={form.authority_code} onChange={(event) => set('authority_code', event.target.value)} /></FormField>
            <FormField label="Registration number" required><Input value={form.registration_number} onChange={(event) => set('registration_number', event.target.value)} /></FormField>
            <FormField label="Registration date" required><Input type="date" value={form.registration_date} onChange={(event) => set('registration_date', event.target.value)} /></FormField>
            <FormField label="Registration expiry"><Input type="date" value={form.registration_expiry_date} onChange={(event) => set('registration_expiry_date', event.target.value)} /></FormField>
            {state.type === 'project' && <FormField label="Official source URL" required hint="Authority portal or official registration page."><Input type="url" value={form.source_reference} onChange={(event) => set('source_reference', event.target.value)} placeholder="https://…" /></FormField>}
          </div>}

          {needsExpiry && <FormField label="Registration expiry date" required><Input type="date" value={form.registration_expiry_date} onChange={(event) => set('registration_expiry_date', event.target.value)} /></FormField>}
          {needsCompletion && <FormField label="Actual completion date" required><Input type="date" value={form.actual_completion_date} onChange={(event) => set('actual_completion_date', event.target.value)} /></FormField>}
          <FormField label={needsReason ? 'Reason' : 'Status note'} required={needsReason} hint={needsReason ? undefined : 'Optional internal context for the audit trail.'}><Textarea rows={3} value={form.status_reason} onChange={(event) => set('status_reason', event.target.value)} /></FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setState({ open: false, type: 'project', record: null, form: null })}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Confirm update</Button>
          </DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>
  );
}

function ProjectDialog({ state, setState, form, setForm, onSubmit, busy, projectTerm, isReraWorkspace }) {
  const editing = Boolean(state.record);
  const statusOptions = editing
    ? availableStatusOptions(firstValue(state.record, ['regulatory_status', 'registration_status', 'status'], 'DRAFT'))
    : PROJECT_STATUSES;
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <Dialog open={state.open} onOpenChange={(open) => setState((current) => ({ ...current, open }))}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${projectTerm}` : `Create ${projectTerm}`}</DialogTitle>
          <DialogDescription>{isReraWorkspace
            ? 'Record the regulatory project independently from the Site. Values shown here are internal records unless separately reviewed.'
            : 'Start with the project basics. Add phases only when the development is managed phase-wise.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <FormField policyId="rera_projects.name" label="Project name" required><Input value={form.name} onChange={(event) => set('name', event.target.value)} /></FormField>
          <FormField policyId="rera_projects.project_code" label="Internal project code" required><Input value={form.project_code} onChange={(event) => set('project_code', event.target.value)} /></FormField>
          <FormField policyId="rera_projects.project_shape" label="Project shape" required>
            <Select value={form.project_shape || undefined} onValueChange={(value) => set('project_shape', value)}>
              <SelectTrigger><SelectValue placeholder="Select project shape" /></SelectTrigger>
              <SelectContent>{PROJECT_TYPES.map((value) => <SelectItem key={value} value={value}>{readable(value)}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField policyId="rera_projects.development_basis" label="Development basis" required>
            <Select value={form.development_basis || undefined} onValueChange={(value) => set('development_basis', value)}>
              <SelectTrigger><SelectValue placeholder="Select development basis" /></SelectTrigger>
              <SelectContent>{DEVELOPMENT_BASES.map((value) => <SelectItem key={value} value={value}>{readable(value)}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          {isReraWorkspace && <FormField policyId="rera_projects.regulatory_status" label="Regulatory status" hint="This records an internal status and does not represent authority verification.">
            <Select value={form.regulatory_status} onValueChange={(value) => set('regulatory_status', value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{statusOptions.map((value) => <SelectItem key={value} value={value}>{value === 'REGISTERED' ? 'Registered — registration recorded' : readable(value)}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>}
          {isReraWorkspace && <FormField policyId="rera_projects.authority_name" label="Authority name" hint="Record the authority explicitly; it is never inferred from the address."><Input value={form.authority_name} onChange={(event) => set('authority_name', event.target.value)} /></FormField>}
          {isReraWorkspace && <FormField policyId="rera_projects.authority_code" label="Authority code"><Input value={form.authority_code} onChange={(event) => set('authority_code', event.target.value)} /></FormField>}
          <FormField policyId="rera_projects.state" label="State"><Input value={form.state} onChange={(event) => set('state', event.target.value)} /></FormField>
          <FormField policyId="rera_projects.district" label="District"><Input value={form.district} onChange={(event) => set('district', event.target.value)} /></FormField>
          {isReraWorkspace && <FormField policyId="rera_projects.registration_number" label="Registration number"><Input value={form.registration_number} onChange={(event) => set('registration_number', event.target.value)} /></FormField>}
          {isReraWorkspace && <FormField policyId="rera_projects.registration_date" label="Registration date"><Input type="date" value={form.registration_date} onChange={(event) => set('registration_date', event.target.value)} /></FormField>}
          {isReraWorkspace && <FormField policyId="rera_projects.registration_expiry_date" label="Registration expiry"><Input type="date" value={form.registration_expiry_date} onChange={(event) => set('registration_expiry_date', event.target.value)} /></FormField>}
          <FormField policyId="rera_projects.proposed_start_date" label="Proposed start"><Input type="date" value={form.proposed_start_date} onChange={(event) => set('proposed_start_date', event.target.value)} /></FormField>
          <FormField policyId="rera_projects.proposed_completion_date" label="Proposed completion"><Input type="date" value={form.proposed_completion_date} onChange={(event) => set('proposed_completion_date', event.target.value)} /></FormField>
          <FormField policyId="rera_projects.actual_completion_date" label="Actual completion"><Input type="date" value={form.actual_completion_date} onChange={(event) => set('actual_completion_date', event.target.value)} /></FormField>
          <FormField policyId="rera_projects.address" label="Project address" className="sm:col-span-2"><Textarea value={form.address} onChange={(event) => set('address', event.target.value)} /></FormField>
          {isReraWorkspace && <FormField policyId="rera_projects.status_reason" label="Status reason" className="sm:col-span-2"><Textarea value={form.status_reason} onChange={(event) => set('status_reason', event.target.value)} /></FormField>}
          <FormField policyId="rera_projects.source_reference" label={isReraWorkspace ? 'Official/source reference' : 'Reference document or portal link'} className="sm:col-span-2"><Input value={form.source_reference} onChange={(event) => set('source_reference', event.target.value)} /></FormField>
          <FormField policyId="rera_projects.notes" label="Internal notes" className="sm:col-span-2"><Textarea value={form.notes} onChange={(event) => set('notes', event.target.value)} /></FormField>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setState({ open: false, record: null })}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />}{editing ? 'Save changes' : 'Create project'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PhaseDialog({ state, setState, form, setForm, onSubmit, busy, projectTerm, isReraWorkspace }) {
  const editing = Boolean(state.record);
  const statusOptions = editing
    ? availableStatusOptions(firstValue(state.record, ['regulatory_status', 'status'], 'DRAFT'))
    : PHASE_STATUSES;
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <Dialog open={state.open} onOpenChange={(open) => setState((current) => ({ ...current, open }))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${projectTerm} phase` : `Add ${projectTerm} phase`}</DialogTitle>
          <DialogDescription>Record a phase only when the project is managed phase-wise.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField policyId="rera_phases.name" label="Phase name" required><Input value={form.name} onChange={(event) => set('name', event.target.value)} /></FormField>
            <FormField policyId="rera_phases.phase_code" label="Phase code" required><Input value={form.phase_code} onChange={(event) => set('phase_code', event.target.value)} /></FormField>
            {isReraWorkspace && <FormField policyId="rera_phases.regulatory_status" label="Regulatory status" hint="This is an internal workflow record.">
              <Select value={form.regulatory_status} onValueChange={(value) => set('regulatory_status', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{statusOptions.map((value) => <SelectItem key={value} value={value}>{value === 'REGISTERED' ? 'Registration recorded' : readable(value)}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>}
            {isReraWorkspace && <FormField policyId="rera_phases.authority_name" label="Authority name"><Input value={form.authority_name} onChange={(event) => set('authority_name', event.target.value)} /></FormField>}
            {isReraWorkspace && <FormField policyId="rera_phases.authority_code" label="Authority code"><Input value={form.authority_code} onChange={(event) => set('authority_code', event.target.value)} /></FormField>}
            {isReraWorkspace && <FormField policyId="rera_phases.registration_number" label="Registration number"><Input value={form.registration_number} onChange={(event) => set('registration_number', event.target.value)} /></FormField>}
            {isReraWorkspace && <FormField policyId="rera_phases.registration_date" label="Registration date"><Input type="date" value={form.registration_date} onChange={(event) => set('registration_date', event.target.value)} /></FormField>}
            {isReraWorkspace && <FormField policyId="rera_phases.registration_expiry_date" label="Registration expiry"><Input type="date" value={form.registration_expiry_date} onChange={(event) => set('registration_expiry_date', event.target.value)} /></FormField>}
            <FormField policyId="rera_phases.proposed_start_date" label="Proposed start"><Input type="date" value={form.proposed_start_date} onChange={(event) => set('proposed_start_date', event.target.value)} /></FormField>
            <FormField policyId="rera_phases.proposed_completion_date" label="Proposed completion"><Input type="date" value={form.proposed_completion_date} onChange={(event) => set('proposed_completion_date', event.target.value)} /></FormField>
            <FormField policyId="rera_phases.actual_completion_date" label="Actual completion"><Input type="date" value={form.actual_completion_date} onChange={(event) => set('actual_completion_date', event.target.value)} /></FormField>
            {isReraWorkspace && <FormField policyId="rera_phases.status_reason" label="Status reason" className="sm:col-span-2"><Textarea value={form.status_reason} onChange={(event) => set('status_reason', event.target.value)} /></FormField>}
            <FormField policyId="rera_phases.notes" label="Notes" className="sm:col-span-2"><Textarea value={form.notes} onChange={(event) => set('notes', event.target.value)} /></FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setState({ open: false, record: null })}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />}{editing ? 'Save changes' : 'Add phase'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
