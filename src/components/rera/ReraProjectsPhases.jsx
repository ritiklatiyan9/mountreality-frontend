import { useEffect, useMemo, useState } from 'react';
import { Building2, Loader2, Pencil, Plus } from 'lucide-react';
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
import { SectionHead } from '@/components/ui/page';
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

const regulatoryValidationError = (form) => {
  if (form.regulatory_status === 'REGISTERED'
    && (!(form.authority_id || form.authority_code?.trim() || form.authority_name?.trim())
      || !form.registration_number.trim() || !form.registration_date)) {
    return 'Registered status requires an authority, registration number, and registration date';
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
  const [detail, setDetail] = useState(null);

  const openProject = (project = null) => {
    setProjectForm(project ? projectToForm(project) : emptyProject);
    setProjectDialog({ open: true, record: project });
  };

  const openPhase = (phase = null) => {
    setPhaseForm(phase ? phaseToForm(phase) : emptyPhase);
    setPhaseDialog({ open: true, record: phase });
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
    const validationError = isReraWorkspace ? regulatoryValidationError(projectForm) : null;
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

  return (
    <div className="space-y-9 py-2">
      <section>
        <SectionHead
          title={projectPlural}
          meta={projectRows.length ? String(projectRows.length) : null}
          description={isReraWorkspace
            ? 'Regulatory project records remain distinct from the selected Site.'
            : 'Development project records stay linked to the selected Site for planning and finance.'}
          actions={canWrite ? <Button type="button" size="sm" onClick={() => openProject()}><Plus />Add {projectTerm}</Button> : null}
        />
        {projectRows.length ? (
          <Table>
            <TableHeader>
              <TableRow className="border-mr-line hover:bg-transparent">
                <TableHead>Project</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>{isReraWorkspace ? 'Regulatory status' : 'Project status'}</TableHead>
                {isReraWorkspace && <TableHead>Authority</TableHead>}
                {isReraWorkspace && <TableHead>Registration</TableHead>}
                <TableHead className="w-24 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projectRows.map((project, index) => {
                const id = recordId(project);
                const selected = selectedProjectId && String(id) === String(selectedProjectId);
                const registration = firstValue(project, ['registration_number', 'rera_number']);
                return (
                  <TableRow key={`${id ?? 'project'}-${index}`} data-state={selected ? 'selected' : undefined} className="border-mr-line">
                    <TableCell>
                      <button type="button" onClick={() => { onProjectSelected?.(String(id)); setDetail({ type: 'project', record: project }); }} className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue">
                        <span className="block text-[13px] font-medium text-mr-text">{firstValue(project, ['name', 'project_name'], 'Untitled project')}</span>
                        <span className="mt-0.5 block text-[11px] text-mr-muted">{firstValue(project, ['project_code', 'code', 'internal_code'], 'No internal code')}</span>
                      </button>
                    </TableCell>
                    <TableCell className="text-[12px] text-mr-muted">{readable(firstValue(project, ['project_shape', 'project_type']))}</TableCell>
                    <TableCell><ReraStatus value={firstValue(project, ['regulatory_status', 'registration_status', 'status'])} label={isReraWorkspace && registration ? 'Registration recorded' : undefined} /></TableCell>
                    {isReraWorkspace && <TableCell className="text-[12px] text-mr-muted">{firstValue(project, ['authority', 'authority_name'], 'Not recorded')}</TableCell>}
                    {isReraWorkspace && <TableCell className="text-[12px] font-medium text-mr-text">{registration || 'Not recorded'}</TableCell>}
                    <TableCell className="text-right">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setDetail({ type: 'project', record: project })}>View</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <CompactEmpty
            icon={Building2}
            title={`No ${projectTerm} created`}
            description={isReraWorkspace
              ? 'Create a RERA Project only when this development is being managed through the applicable regulatory workflow.'
              : 'Create a Development Project to begin planning phases, customer collections and project finance.'}
            action={canWrite ? <Button type="button" variant="outline" onClick={() => openProject()}><Plus />Create {projectTerm}</Button> : null}
          />
        )}
      </section>

      <section>
        <SectionHead
          title="Project phases"
          meta={phaseRows.length ? String(phaseRows.length) : null}
          description={selectedProject ? `Phases recorded under ${firstValue(selectedProject, ['name', 'project_name'], 'the selected project')}.` : 'Select a project to manage phases.'}
          actions={canWrite && selectedProjectId ? <Button type="button" variant="outline" size="sm" onClick={() => openPhase()}><Plus />Add phase</Button> : null}
        />
        {!selectedProject ? (
          <CompactEmpty title={`Select a ${projectTerm}`} description={`Project phases are shown only within their parent ${projectTerm}.`} />
        ) : phaseRows.length ? (
          <Table>
            <TableHeader>
              <TableRow className="border-mr-line hover:bg-transparent">
                <TableHead>Phase</TableHead>
                <TableHead>{isReraWorkspace ? 'Regulatory status' : 'Phase status'}</TableHead>
                {isReraWorkspace && <TableHead>Registration</TableHead>}
                <TableHead>Committed completion</TableHead>
                <TableHead className="w-24 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {phaseRows.map((phase, index) => (
                <TableRow key={`${recordId(phase) ?? 'phase'}-${index}`} className="border-mr-line">
                  <TableCell>
                    <button type="button" onClick={() => setDetail({ type: 'phase', record: phase })} className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue">
                      <span className="block text-[13px] font-medium text-mr-text">{firstValue(phase, ['name', 'phase_name'], 'Untitled phase')}</span>
                      <span className="mt-0.5 block text-[11px] text-mr-muted">{firstValue(phase, ['phase_code', 'code'], 'No phase code')}</span>
                    </button>
                  </TableCell>
                  <TableCell><ReraStatus value={firstValue(phase, ['regulatory_status', 'status'])} label={isReraWorkspace && phase.registration_number ? 'Registration recorded' : undefined} /></TableCell>
                  {isReraWorkspace && <TableCell className="text-[12px] text-mr-muted">{phase.registration_number || 'Not recorded'}</TableCell>}
                  <TableCell className="text-[12px] text-mr-muted">{formatDate(firstValue(phase, ['proposed_completion_date', 'committed_completion_date', 'completion_date']))}</TableCell>
                  <TableCell className="text-right"><Button type="button" variant="ghost" size="sm" onClick={() => setDetail({ type: 'phase', record: phase })}>View</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <CompactEmpty title="No phases recorded" description="This project currently has no separately managed phases." action={canWrite ? <Button type="button" variant="outline" onClick={() => openPhase()}><Plus />Add phase</Button> : null} />
        )}
      </section>

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
                <Button type="button" variant="outline" className="mt-6" onClick={() => {
                  if (detail.type === 'project') openProject(detail.record);
                  else openPhase(detail.record);
                  setDetail(null);
                }}>
                  <Pencil />Edit details
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ProjectDialog({ state, setState, form, setForm, onSubmit, busy, projectTerm, isReraWorkspace }) {
  const editing = Boolean(state.record);
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
              <SelectContent>{PROJECT_STATUSES.map((value) => <SelectItem key={value} value={value}>{value === 'REGISTERED' ? 'Registered — registration recorded' : readable(value)}</SelectItem>)}</SelectContent>
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
                <SelectContent>{PHASE_STATUSES.map((value) => <SelectItem key={value} value={value}>{value === 'REGISTERED' ? 'Registration recorded' : readable(value)}</SelectItem>)}</SelectContent>
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
