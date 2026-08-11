import { useMemo, useState } from 'react';
import { Link2, Loader2, Pencil, Plus, Unlink, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/api/api';
import UserAvatar from '@/components/UserAvatar';
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
  readable,
  writablePolicyPayload,
} from './reraUtils';

const ENTITY_TYPES = ['INDIVIDUAL', 'PROPRIETORSHIP', 'PARTNERSHIP', 'LLP', 'COMPANY', 'TRUST', 'SOCIETY', 'GOVERNMENT_BODY', 'OTHER'];
const PARTICIPANT_ROLES = [
  'PROMOTER',
  'CO_PROMOTER',
  'LANDOWNER',
  'DEVELOPER',
  'COLLABORATOR',
  'AUTHORIZED_SIGNATORY',
  'CONSULTANT',
  'CONTRACTOR',
  'OTHER',
];

const emptyStakeholder = {
  stakeholder_code: '',
  stakeholder_type: '',
  legal_name: '',
  trade_name: '',
  entity_type: '',
  pan: '',
  gstin: '',
  cin_or_llpin: '',
  registration_number: '',
  email: '',
  phone: '',
  address_text: '',
  authorized_signatory_name: '',
  record_review_status: 'RECORD_ONLY',
  status: 'ACTIVE',
};

const emptyParticipant = { stakeholder_id: '', role: '', phase_id: '' };

const entityRecord = (row) => row?.stakeholder && typeof row.stakeholder === 'object' ? row.stakeholder : row;
const stakeholderId = (row) => firstValue(row, ['rera_stakeholder_id', 'stakeholder_id', 'entity_id']) ?? firstValue(entityRecord(row), ['id']);
const participantId = (row) => firstValue(row, ['participant_id', 'relationship_id', 'project_participant_id'])
  ?? (row?.rera_stakeholder_id ? row.id : null);
const stakeholderName = (row) => firstValue(entityRecord(row), ['legal_name', 'name'], 'Unnamed stakeholder');

const addressText = (value) => {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  return firstValue(value, ['formatted', 'formatted_address', 'full_address', 'address_line'], '')
    || Object.values(value).filter((item) => typeof item === 'string' && item.trim()).join(', ');
};

const toForm = (row) => {
  const entity = entityRecord(row);
  return {
    stakeholder_code: firstValue(entity, ['stakeholder_code'], ''),
    stakeholder_type: firstValue(entity, ['stakeholder_type'], ''),
    legal_name: firstValue(entity, ['legal_name', 'name'], ''),
    trade_name: firstValue(entity, ['trade_name'], ''),
    entity_type: firstValue(entity, ['entity_type'], ''),
    pan: firstValue(entity, ['pan'], ''),
    gstin: firstValue(entity, ['gstin'], ''),
    cin_or_llpin: firstValue(entity, ['cin_or_llpin', 'cin_llpin', 'cin', 'llpin'], ''),
    registration_number: firstValue(entity, ['registration_number'], ''),
    email: firstValue(entity, ['email', 'contact_email'], ''),
    phone: firstValue(entity, ['phone', 'contact_phone'], ''),
    address_text: addressText(firstValue(entity, ['address', 'registered_address'], '')),
    authorized_signatory_name: firstValue(entity, ['authorized_signatory_name', 'contact_name'], ''),
    record_review_status: firstValue(entity, ['record_review_status'], 'RECORD_ONLY'),
    status: firstValue(entity, ['status'], 'ACTIVE'),
  };
};

export default function ReraStakeholders({
  siteId,
  project,
  phases,
  stakeholders,
  stakeholderCatalog,
  canWrite,
  canUpdate,
  canDelete,
  onChanged,
}) {
  const { getFieldPolicy } = useSitePolicy();
  const rows = asList(stakeholders);
  const phaseRows = asList(phases);
  const projectId = firstValue(project, ['id', 'project_id']);
  const [busy, setBusy] = useState(false);
  const [entityDialog, setEntityDialog] = useState({ open: false, record: null });
  const [entityForm, setEntityForm] = useState(emptyStakeholder);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkForm, setLinkForm] = useState(emptyParticipant);
  const [detail, setDetail] = useState(null);
  const [unlinkTarget, setUnlinkTarget] = useState(null);
  const [localCatalog, setLocalCatalog] = useState([]);
  const catalogRows = useMemo(() => {
    const catalog = new Map();
    [...asList(stakeholderCatalog), ...localCatalog, ...rows].forEach((row) => {
      const id = stakeholderId(row);
      if (id) catalog.set(String(id), row);
    });
    return [...catalog.values()];
  }, [localCatalog, rows, stakeholderCatalog]);

  const openEntity = (record = null) => {
    setEntityForm(record ? toForm(record) : emptyStakeholder);
    setEntityDialog({ open: true, record });
  };

  const saveEntity = async (event) => {
    event.preventDefault();
    if (!entityForm.legal_name.trim()) return toast.error('Enter the stakeholder legal name');
    if (!entityForm.stakeholder_type) return toast.error('Select a stakeholder type');
    if (!entityForm.entity_type) return toast.error('Select an entity type');
    setBusy(true);
    try {
      const { address_text: formattedAddress, ...stakeholderFields } = entityForm;
      const existingAddress = entityDialog.record
        ? firstValue(entityRecord(entityDialog.record), ['address'])
        : null;
      const address = existingAddress && typeof existingAddress === 'object'
        && addressText(existingAddress) === formattedAddress.trim()
        ? existingAddress
        : (formattedAddress.trim() ? { formatted: formattedAddress.trim() } : {});
      const writableStakeholder = writablePolicyPayload(
        { ...stakeholderFields, address }, 'rera_stakeholders', getFieldPolicy,
      );
      // Review decisions are not exposed by this form; never replay a stored
      // reviewer state while editing ordinary stakeholder details.
      delete writableStakeholder.record_review_status;
      const payload = cleanPayload({
        site_id: siteId,
        ...writableStakeholder,
      });
      const id = entityDialog.record ? stakeholderId(entityDialog.record) : null;
      const { data } = await (id
        ? api.patch(`/rera/stakeholders/${id}`, payload)
        : api.post('/rera/stakeholders', payload));
      const saved = data?.stakeholder ?? data;
      const savedId = stakeholderId(saved);
      toast.success(id ? 'Stakeholder details updated' : 'Stakeholder created');
      setEntityDialog({ open: false, record: null });
      if (!id && savedId) {
        setLocalCatalog((current) => [saved, ...current.filter((row) => String(stakeholderId(row)) !== String(savedId))]);
        if (projectId) {
          setLinkForm({ stakeholder_id: String(savedId), role: '', phase_id: '' });
          setLinkOpen(true);
        }
      }
      onChanged?.();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Stakeholder could not be saved');
    } finally {
      setBusy(false);
    }
  };

  const linkParticipant = async (event) => {
    event.preventDefault();
    if (!projectId) return toast.error('Select a RERA Project first');
    if (!linkForm.stakeholder_id || !linkForm.role) return toast.error('Choose a stakeholder and project role');
    setBusy(true);
    try {
      await api.post(`/rera/projects/${projectId}/participants`, cleanPayload({
        site_id: siteId,
        ...writablePolicyPayload({
          rera_stakeholder_id: linkForm.stakeholder_id,
          participant_role: linkForm.role,
          rera_project_phase_id: linkForm.phase_id,
        }, 'rera_participants', getFieldPolicy),
      }));
      toast.success('Stakeholder linked to the project');
      setLinkOpen(false);
      setLinkForm(emptyParticipant);
      onChanged?.();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Stakeholder could not be linked');
    } finally {
      setBusy(false);
    }
  };

  const unlinkParticipant = async () => {
    const id = participantId(unlinkTarget);
    if (!id) return;
    setBusy(true);
    try {
      await api.delete(`/rera/participants/${id}`, { data: { site_id: siteId } });
      toast.success('Stakeholder unlinked from the project');
      setUnlinkTarget(null);
      setDetail(null);
      onChanged?.();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Stakeholder could not be unlinked');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-7 py-2">
      <SectionHead
        title="Project stakeholders"
        meta={rows.length ? String(rows.length) : null}
        description={project ? `Reusable legal entities and their recorded roles in ${firstValue(project, ['name', 'project_name'], 'the selected project')}.` : 'Select a RERA Project to manage participant relationships.'}
        actions={canWrite ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => openEntity()}><Plus />New stakeholder</Button>
            <Button type="button" size="sm" disabled={!projectId || !catalogRows.length} onClick={() => { setLinkForm(emptyParticipant); setLinkOpen(true); }}><Link2 />Link to project</Button>
          </div>
        ) : null}
      />

      {!project ? (
        <CompactEmpty icon={UsersRound} title="No RERA Project selected" description="Select a project before assigning promoter, landowner, developer, or signatory roles." />
      ) : rows.length ? (
        <Table>
          <TableHeader>
            <TableRow className="border-mr-line hover:bg-transparent">
              <TableHead>Stakeholder</TableHead>
              <TableHead>Entity type</TableHead>
              <TableHead>Project role</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => {
              const entity = entityRecord(row);
              const name = stakeholderName(row);
              return (
                <TableRow key={`${participantId(row) ?? stakeholderId(row) ?? 'stakeholder'}-${index}`} className="border-mr-line">
                  <TableCell>
                    <button type="button" onClick={() => setDetail(row)} className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue">
                      <UserAvatar name={name} size="md" />
                      <span>
                        <span className="block text-[13px] font-medium text-mr-text">{name}</span>
                        <span className="mt-0.5 block text-[11px] text-mr-muted">{firstValue(entity, ['cin_or_llpin', 'cin_llpin', 'cin', 'llpin', 'gstin'], 'No entity reference recorded')}</span>
                      </span>
                    </button>
                  </TableCell>
                  <TableCell className="text-[12px] text-mr-muted">{readable(entity.entity_type)}</TableCell>
                  <TableCell className="text-[12px] font-medium text-mr-text">{readable(firstValue(row, ['participant_role', 'role', 'project_role']))}</TableCell>
                  <TableCell className="text-[12px] text-mr-muted">{firstValue(entity, ['authorized_signatory_name', 'email', 'phone'], 'Not recorded')}</TableCell>
                  <TableCell><ReraStatus value={firstValue(entity, ['status'])} /></TableCell>
                  <TableCell className="text-right"><Button type="button" variant="ghost" size="sm" onClick={() => setDetail(row)}>View</Button></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <CompactEmpty
          icon={UsersRound}
          title="No stakeholders linked"
          description="Create a stakeholder once, then link it to this project with the appropriate role."
          action={canWrite ? (
            <div className="flex flex-wrap justify-center gap-2">
              {catalogRows.length ? <Button type="button" onClick={() => { setLinkForm(emptyParticipant); setLinkOpen(true); }}><Link2 />Link existing stakeholder</Button> : null}
              <Button type="button" variant="outline" onClick={() => openEntity()}><Plus />Create stakeholder</Button>
            </div>
          ) : null}
        />
      )}

      <StakeholderDialog
        state={entityDialog}
        setState={setEntityDialog}
        form={entityForm}
        setForm={setEntityForm}
        onSubmit={saveEntity}
        busy={busy}
      />

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link stakeholder to project</DialogTitle>
            <DialogDescription>Create a relationship without duplicating the underlying legal entity.</DialogDescription>
          </DialogHeader>
          <form onSubmit={linkParticipant} className="space-y-4">
            <FormField policyId="rera_participants.rera_stakeholder_id" label="Stakeholder" required>
              <Select value={linkForm.stakeholder_id || undefined} onValueChange={(value) => setLinkForm((current) => ({ ...current, stakeholder_id: value }))}>
                <SelectTrigger><SelectValue placeholder="Choose stakeholder" /></SelectTrigger>
                <SelectContent>
                  {catalogRows.map((row, index) => {
                    const id = stakeholderId(row);
                    return id ? <SelectItem key={`${id}-${index}`} value={String(id)}>{stakeholderName(row)}</SelectItem> : null;
                  })}
                </SelectContent>
              </Select>
            </FormField>
            <FormField policyId="rera_participants.participant_role" label="Project role" required>
              <Select value={linkForm.role || undefined} onValueChange={(value) => setLinkForm((current) => ({ ...current, role: value }))}>
                <SelectTrigger><SelectValue placeholder="Choose role" /></SelectTrigger>
                <SelectContent>{PARTICIPANT_ROLES.map((value) => <SelectItem key={value} value={value}>{readable(value)}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField policyId="rera_participants.rera_project_phase_id" label="Phase" hint="Leave at project level unless the relationship applies to one recorded phase.">
              <Select value={linkForm.phase_id || 'PROJECT'} onValueChange={(value) => setLinkForm((current) => ({ ...current, phase_id: value === 'PROJECT' ? '' : value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROJECT">Project level</SelectItem>
                  {phaseRows.map((phase, index) => {
                    const id = firstValue(phase, ['id', 'phase_id']);
                    return id ? <SelectItem key={`${id}-${index}`} value={String(id)}>{firstValue(phase, ['name', 'phase_name'], `Phase ${id}`)}</SelectItem> : null;
                  })}
                </SelectContent>
              </Select>
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLinkOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Link stakeholder</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(unlinkTarget)} onOpenChange={(open) => { if (!open) setUnlinkTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unlink project stakeholder?</DialogTitle>
            <DialogDescription>The stakeholder record remains available. Only this project relationship is removed.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setUnlinkTarget(null)}>Cancel</Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={unlinkParticipant}>{busy && <Loader2 className="animate-spin" />}Unlink</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={Boolean(detail)} onOpenChange={(open) => { if (!open) setDetail(null); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader className="pr-8">
            <SheetTitle>{detail ? stakeholderName(detail) : 'Stakeholder'}</SheetTitle>
            <SheetDescription>Legal entity and its recorded relationship to the selected project.</SheetDescription>
          </SheetHeader>
          {detail && (
            <div className="mt-6">
              <DetailFact label="Entity type" value={readable(entityRecord(detail).entity_type)} />
              <DetailFact label="Stakeholder type" value={readable(entityRecord(detail).stakeholder_type)} />
              <DetailFact label="Project role" value={readable(firstValue(detail, ['participant_role', 'role', 'project_role']))} />
              <DetailFact label="PAN" value={entityRecord(detail).pan} />
              <DetailFact label="GSTIN" value={entityRecord(detail).gstin} />
              <DetailFact label="CIN / LLPIN" value={firstValue(entityRecord(detail), ['cin_or_llpin', 'cin_llpin', 'cin', 'llpin'])} />
              <DetailFact label="Registered address" value={addressText(firstValue(entityRecord(detail), ['address', 'registered_address']))} />
              <DetailFact label="Contact" value={firstValue(entityRecord(detail), ['authorized_signatory_name', 'email', 'phone'])} />
              <DetailFact label="Record status"><ReraStatus value={firstValue(entityRecord(detail), ['status'])} /></DetailFact>
              {canUpdate && (
                <div className="mt-6 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => { openEntity(detail); setDetail(null); }}><Pencil />Edit stakeholder</Button>
                  {participantId(detail) && canDelete && <Button type="button" variant="outline" onClick={() => setUnlinkTarget(detail)}><Unlink />Unlink from project</Button>}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StakeholderDialog({ state, setState, form, setForm, onSubmit, busy }) {
  const editing = Boolean(state.record);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <Dialog open={state.open} onOpenChange={(open) => setState((current) => ({ ...current, open }))}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit stakeholder' : 'Create stakeholder'}</DialogTitle>
          <DialogDescription>Record the reusable legal entity. Project roles are assigned separately.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <FormField policyId="rera_stakeholders.legal_name" label="Legal name" required className="sm:col-span-2"><Input value={form.legal_name} onChange={(event) => set('legal_name', event.target.value)} /></FormField>
          <FormField policyId="rera_stakeholders.stakeholder_code" label="Stakeholder code"><Input value={form.stakeholder_code} onChange={(event) => set('stakeholder_code', event.target.value)} /></FormField>
          <FormField policyId="rera_stakeholders.stakeholder_type" label="Stakeholder type" required>
            <Select value={form.stakeholder_type || undefined} onValueChange={(value) => set('stakeholder_type', value)}>
              <SelectTrigger><SelectValue placeholder="Select stakeholder type" /></SelectTrigger>
              <SelectContent>{PARTICIPANT_ROLES.map((value) => <SelectItem key={value} value={value}>{readable(value)}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField policyId="rera_stakeholders.entity_type" label="Entity type" required>
            <Select value={form.entity_type || undefined} onValueChange={(value) => set('entity_type', value)}>
              <SelectTrigger><SelectValue placeholder="Select entity type" /></SelectTrigger>
              <SelectContent>{ENTITY_TYPES.map((value) => <SelectItem key={value} value={value}>{readable(value)}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField policyId="rera_stakeholders.status" label="Record status">
            <Select value={form.status} onValueChange={(value) => set('status', value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="DRAFT">Draft</SelectItem><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="INACTIVE">Inactive</SelectItem><SelectItem value="ARCHIVED">Archived</SelectItem></SelectContent>
            </Select>
          </FormField>
          <FormField policyId="rera_stakeholders.trade_name" label="Trade name"><Input value={form.trade_name} onChange={(event) => set('trade_name', event.target.value)} /></FormField>
          <FormField policyId="rera_stakeholders.registration_number" label="Entity registration number"><Input value={form.registration_number} onChange={(event) => set('registration_number', event.target.value)} /></FormField>
          <FormField policyId="rera_stakeholders.pan" label="PAN"><Input value={form.pan} onChange={(event) => set('pan', event.target.value.toUpperCase())} /></FormField>
          <FormField policyId="rera_stakeholders.gstin" label="GSTIN"><Input value={form.gstin} onChange={(event) => set('gstin', event.target.value.toUpperCase())} /></FormField>
          <FormField policyId="rera_stakeholders.cin_or_llpin" label="CIN / LLPIN"><Input value={form.cin_or_llpin} onChange={(event) => set('cin_or_llpin', event.target.value.toUpperCase())} /></FormField>
          <FormField policyId="rera_stakeholders.authorized_signatory_name" label="Authorized signatory"><Input value={form.authorized_signatory_name} onChange={(event) => set('authorized_signatory_name', event.target.value)} /></FormField>
          <FormField policyId="rera_stakeholders.email" label="Email"><Input type="email" value={form.email} onChange={(event) => set('email', event.target.value)} /></FormField>
          <FormField policyId="rera_stakeholders.phone" label="Phone"><Input value={form.phone} onChange={(event) => set('phone', event.target.value)} /></FormField>
          <FormField policyId="rera_stakeholders.address" label="Registered address" className="sm:col-span-2"><Textarea value={form.address_text} onChange={(event) => set('address_text', event.target.value)} /></FormField>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setState({ open: false, record: null })}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />}{editing ? 'Save changes' : 'Create stakeholder'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
