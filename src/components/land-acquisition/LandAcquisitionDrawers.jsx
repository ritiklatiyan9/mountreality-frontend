import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FileText, Loader2, MapPin } from 'lucide-react';
import api from '@/api/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { StatusDot } from '@/components/ui/page';
import {
  apiMessage, areaLabel, dateLabel, initials, money, readable, statusTone,
} from './landAcquisitionUtils';

const EMPTY_CREATE = {
  member_id: '', acquisition_type: 'DIRECT_PURCHASE', rera_project_id: '', responsible_user_id: '', village: '', tehsil: '', district: '', state: '',
  khasra_number: '', land_area: '', area_unit: 'BIGHA', ownership_share: '100', notes: '',
};

export function CreateAcquisitionSheet({ open, onOpenChange, siteId, onCreated }) {
  const [members, setMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_CREATE);

  useEffect(() => {
    if (!open || !siteId) return undefined;
    const controller = new AbortController();
    setLoadingMembers(true);
    api.get('/land-acquisitions/options', { params: { site_id: siteId }, signal: controller.signal })
      .then(({ data }) => {
        setMembers(data.landowners || []);
        setProjects(data.projects || []);
        setEmployees(data.responsible_employees || []);
      })
      .catch((error) => {
        if (error?.code !== 'ERR_CANCELED') toast.error(apiMessage(error, 'Registered landowners could not be loaded'));
      })
      .finally(() => setLoadingMembers(false));
    return () => controller.abort();
  }, [open, siteId]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!form.member_id) return toast.error('Select a registered landowner');
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        site_id: Number(siteId),
        member_id: Number(form.member_id),
        rera_project_id: form.rera_project_id ? Number(form.rera_project_id) : undefined,
        responsible_user_id: form.responsible_user_id ? Number(form.responsible_user_id) : undefined,
        land_area: form.land_area || undefined,
        ownership_share: form.ownership_share || undefined,
      };
      const { data } = await api.post('/land-acquisitions', payload);
      toast.success(`${data.acquisition?.acquisition_reference || 'Land acquisition'} created`);
      setForm(EMPTY_CREATE);
      onOpenChange(false);
      onCreated?.(data.acquisition);
    } catch (error) {
      toast.error(apiMessage(error, 'The land acquisition could not be created'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-mr-line px-6 py-5">
          <SheetTitle>Create land acquisition</SheetTitle>
          <SheetDescription>Select an existing registered landowner, then record the parcel. Financial terms come later.</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            <section className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-mr-faint">Landowner</p>
              <div>
                <Label>Registered landowner</Label>
                {loadingMembers ? <Skeleton className="mt-2 h-10 w-full" /> : (
                  <Select value={form.member_id} onValueChange={(value) => set('member_id', value)}>
                    <SelectTrigger className="mt-2"><SelectValue placeholder="Select a Farmer / Landowner" /></SelectTrigger>
                    <SelectContent>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={String(member.id)}>{member.full_name} · {member.phone || 'No phone'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {!loadingMembers && !members.length && (
                  <p className="mt-2 text-[12px] text-mr-amber-ink">Register a Farmer in User Management before creating an acquisition.</p>
                )}
              </div>
              <div>
                <Label>Acquisition type</Label>
                <Select value={form.acquisition_type} onValueChange={(value) => set('acquisition_type', value)}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['DIRECT_PURCHASE', 'DEVELOPMENT_RIGHTS', 'JOINT_DEVELOPMENT', 'COLLABORATION', 'LEASE', 'OTHER'].map((value) => (
                      <SelectItem key={value} value={value}>{readable(value)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Project, if applicable</Label>
                  <Select value={form.rera_project_id || 'none'} onValueChange={(value) => set('rera_project_id', value === 'none' ? '' : value)}>
                    <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">No linked project</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Responsible employee</Label>
                  <Select value={form.responsible_user_id || 'none'} onValueChange={(value) => set('responsible_user_id', value === 'none' ? '' : value)}>
                    <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Not assigned</SelectItem>{employees.map((employee) => <SelectItem key={employee.id} value={String(employee.id)}>{employee.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </section>
            <section className="space-y-4 border-t border-mr-line pt-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-mr-faint">Land details</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {[['village', 'Village'], ['tehsil', 'Tehsil'], ['district', 'District'], ['state', 'State'], ['khasra_number', 'Khasra / Survey number']].map(([key, label]) => (
                  <div key={key} className={key === 'khasra_number' ? 'sm:col-span-2' : ''}>
                    <Label htmlFor={`create-${key}`}>{label}</Label>
                    <Input id={`create-${key}`} className="mt-2" value={form[key]} onChange={(event) => set(key, event.target.value)} />
                  </div>
                ))}
                <div>
                  <Label htmlFor="create-area">Land area</Label>
                  <Input id="create-area" className="mt-2" type="number" min="0" step="0.0001" value={form.land_area} onChange={(event) => set('land_area', event.target.value)} />
                </div>
                <div>
                  <Label>Area unit</Label>
                  <Select value={form.area_unit} onValueChange={(value) => set('area_unit', value)}>
                    <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                    <SelectContent>{['BIGHA', 'ACRE', 'HECTARE', 'YARD', 'SQMT'].map((value) => <SelectItem key={value} value={value}>{readable(value)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="create-share">Ownership %</Label>
                  <Input id="create-share" className="mt-2" type="number" min="0.0001" max="100" step="0.0001" value={form.ownership_share} onChange={(event) => set('ownership_share', event.target.value)} />
                </div>
              </div>
              <div>
                <Label htmlFor="create-notes">Notes</Label>
                <Textarea id="create-notes" className="mt-2" rows={3} value={form.notes} onChange={(event) => set('notes', event.target.value)} />
              </div>
            </section>
          </div>
          <SheetFooter className="sticky bottom-0 border-t border-mr-line bg-mr-surface px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting || loadingMembers || !members.length}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create acquisition
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function LandownerDrawer({ memberId, siteId, open, onOpenChange, onOpenAcquisition }) {
  const [state, setState] = useState({ scope: '', data: null, error: '' });
  const requestScope = `${siteId || ''}:${memberId || ''}`;
  useEffect(() => {
    if (!open || !memberId || !siteId) return undefined;
    const controller = new AbortController();
    api.get(`/land-acquisitions/landowners/${memberId}/summary`, { params: { site_id: siteId }, signal: controller.signal })
      .then(({ data }) => setState({ scope: requestScope, data, error: '' }))
      .catch((error) => {
        if (error?.code !== 'ERR_CANCELED') setState({ scope: requestScope, data: null, error: apiMessage(error, 'Landowner summary could not be loaded') });
      });
    return () => controller.abort();
  }, [memberId, open, requestScope, siteId]);
  const scopeMatches = state.scope === requestScope;
  const landowner = scopeMatches ? state.data?.landowner : null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Landowner quick view</SheetTitle>
          <SheetDescription>Acquisitions and financial position at the selected Site.</SheetDescription>
        </SheetHeader>
        {!scopeMatches ? <div className="mt-8 space-y-3"><Skeleton className="h-16" /><Skeleton className="h-36" /></div> : state.error ? (
          <p className="mt-8 text-[13px] text-mr-coral-ink">{state.error}</p>
        ) : landowner ? (
          <div className="mt-7 space-y-7">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-mr-blue-soft text-[13px] font-semibold text-mr-blue">{initials(landowner.name)}</span>
              <div><p className="font-semibold text-mr-text">{landowner.name}</p><p className="text-[12px] text-mr-muted">{landowner.phone || 'Landowner'}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-4 border-y border-mr-line py-4">
              {[['Acquisitions', landowner.acquisitions], ['Total land', Number(landowner.total_land).toLocaleString('en-IN')], ['Consideration', money(landowner.total_consideration, true)], ['Outstanding', money(landowner.outstanding, true)]].map(([label, value]) => (
                <div key={label}><p className="text-[11px] uppercase tracking-wide text-mr-faint">{label}</p><p className="mt-1 text-[16px] font-semibold text-mr-text">{value}</p></div>
              ))}
            </div>
            <div>
              <p className="text-[12px] font-semibold text-mr-text">Active acquisitions</p>
              <div className="mt-2 divide-y divide-mr-line border-y border-mr-line">
                {(state.data.acquisitions || []).map((item) => (
                  <button key={item.id} type="button" className="flex w-full items-center justify-between gap-4 py-3 text-left hover:bg-mr-surface-2" onClick={() => onOpenAcquisition?.(item.id)}>
                    <span><span className="block text-[13px] font-medium text-mr-text">{item.acquisition_reference}</span><span className="mt-0.5 flex items-center gap-1 text-[11px] text-mr-muted"><MapPin className="h-3 w-3" />{item.village || 'Location not recorded'} · {areaLabel(item)}</span></span>
                    <StatusDot tone={statusTone(item.financial_status)}>{readable(item.financial_status)}</StatusDot>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function TransactionDrawer({ transaction, open, onOpenChange }) {
  if (!transaction) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{money(transaction.amount)}</SheetTitle>
          <SheetDescription>{transaction.landowner_name || 'Landowner'} · {transaction.acquisition_reference || `Legacy ${transaction.farmer_id}`}</SheetDescription>
        </SheetHeader>
        <div className="mt-7 divide-y divide-mr-line border-y border-mr-line">
          {[
            ['Date', dateLabel(transaction.date)], ['Mode', readable(transaction.payment_mode)],
            ['Account', transaction.bank_account_no ? `••••${String(transaction.bank_account_no).slice(-4)}` : 'Not applicable'],
            ['Reference', transaction.bank_reference || transaction.cheque_no || 'Not recorded'],
            ['Allocated against', transaction.allocated_schedule || 'Unallocated'],
            ['Recorded by', transaction.recorded_by_name || transaction.created_by_name || 'MountReality user'],
            ['Status', readable(transaction.status)], ['Remarks', transaction.remarks || 'None'],
          ].map(([label, value]) => (
            <div key={label} className="grid grid-cols-[130px_1fr] gap-4 py-3"><p className="text-[12px] text-mr-muted">{label}</p><p className="break-words text-[13px] font-medium text-mr-text">{value}</p></div>
          ))}
        </div>
        {transaction.voucher_url && (
          <a href={transaction.voucher_url} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-[13px] font-medium text-mr-blue hover:underline"><FileText className="h-4 w-4" />View payment proof</a>
        )}
      </SheetContent>
    </Sheet>
  );
}
