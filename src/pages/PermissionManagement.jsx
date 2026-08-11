import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import api from '../api/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { useSitePolicy } from '../hooks/useSitePolicy';
import {
  AlertCircle,
  Banknote,
  BookOpen,
  Check,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  FileBox,
  FileSearch,
  FileText,
  Home,
  Landmark,
  LayoutGrid,
  Loader2,
  MessageSquare,
  QrCode,
  Save,
  Search,
  Settings,
  Sheet,
  Shield,
  ShieldCheck,
  ShieldOff,
  Store,
  Tractor,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
  Gavel,
  CalendarClock,
} from 'lucide-react';

const MODULE_CONFIG = [
  { key: 'dashboard', label: 'Dashboard', description: 'Business overview and KPI workspace', icon: Home, accessOnly: true },
  { key: 'clients', label: 'Member Management', description: 'Member profiles, KYC, and account records', icon: Users },
  { key: 'vendors', label: 'Inventory and Management', description: 'Vendors, inventory, and commitments', icon: Store },
  { key: 'farmers', label: 'Land Acquisition', description: 'Landowner acquisitions, agreements, terms and transactions', icon: Tractor },
  { key: 'commissions', label: 'Plot Commission', description: 'Commission records and settlements', icon: Landmark },
  { key: 'daybook', label: 'Day Book', description: 'Daily cash and bank entries', icon: BookOpen },
  { key: 'balance_sheet', label: 'Balance Sheet', description: 'Consolidated financial statements', icon: CircleDollarSign, accessOnly: true },
  { key: 'cashflow', label: 'Personal Ledgers', description: 'Personal cash-flow ledgers', icon: Wallet },
  { key: 'firm_transactions', label: 'Firm Transactions', description: 'Firm accounts and transfers', icon: Banknote },
  { key: 'plot_payments', label: 'Plot Payments', description: 'Bookings, installments, and plot documents', icon: LayoutGrid },
  { key: 'plot_registry', label: 'Plot Registry', description: 'Registry cases, NOC, and registry files', icon: ClipboardList },
  { key: 'document_search', label: 'Document Search', description: 'Search and manage indexed legal documents', icon: FileSearch, restricted: true },
  { key: 'expenses', label: 'Expenses', description: 'Expense records and categories', icon: CreditCard },
  { key: 'expense_approval', label: 'Expense Approval', description: 'Review, approve, and reject expenses', icon: ShieldCheck, restricted: true },
  { key: 'imprest', label: 'Imprest', description: 'Personal imprest activity and balances', icon: Wallet },
  { key: 'document_imprest', label: 'Document Imprest', description: 'Physical document handover tracking', icon: FileBox, restricted: true },
  { key: 'upi_collect', label: 'QR Payments', description: 'Generate and track UPI payment QR codes', icon: QrCode, restricted: true },
  { key: 'chat', label: 'Internal Chat', description: 'Team messages and conversations', icon: MessageSquare },
  { key: 'excel', label: 'Native Documents', description: 'Spreadsheet files and editor', icon: Sheet },
  { key: 'reports', label: 'Reports', description: 'Read-only reporting workspace', icon: FileText, accessOnly: true },
  { key: 'compliance', label: 'Compliance Control', description: 'Compliance register, calendar, licences, inspections, and evidence', icon: CalendarClock, restricted: true },
  { key: 'legal', label: 'Legal Matters', description: 'Sensitive legal cases, notices, hearings, replies, and exposure', icon: Gavel, restricted: true },
  { key: 'compliance_templates', label: 'Compliance Templates', description: 'Configure recurring obligations and reusable checklists', icon: ClipboardList, restricted: true },
  { key: 'compliance_settings', label: 'Compliance Administration', description: 'Authorities, approvals, audit trail, reminders, and workflow settings', icon: ShieldCheck, restricted: true },
  { key: 'operating_profile', label: 'Site Operating Profile', description: 'View, draft, review, and publish site operating behavior', icon: Settings, restricted: true },
  { key: 'rera_projects', label: 'RERA Project Workspace', description: 'Regulatory projects, phases, stakeholders, and control centre', icon: ShieldCheck, restricted: true },
  { key: 'rera_approvals', label: 'RERA Approval Register', description: 'Project approval records, owners, review, and expiry', icon: ClipboardList, restricted: true },
  { key: 'rera_evidence', label: 'RERA Evidence', description: 'Private project evidence, metadata, review, and version history', icon: FileSearch, restricted: true },
  { key: 'rera_rulesets', label: 'RERA Rulesets', description: 'Versioned and source-aware configuration catalogue', icon: Shield, restricted: true },
  { key: 'finance_forecast', label: 'Finance Forecast', description: 'Predictive cash-flow forecast and diagnostics', icon: TrendingUp, accessOnly: true },
  { key: 'settings', label: 'Settings', description: 'Personal and workspace preferences', icon: Settings, accessOnly: true },
];

const ACTIONS = [
  { key: 'read', label: 'View' },
  { key: 'write', label: 'Create' },
  { key: 'update', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
];

const REGULATORY_MODULE_KEYS = new Set([
  'rera_approvals',
  'rera_evidence',
  'rera_rulesets',
]);

const permissionsForModule = (module) => {
  if (module?.restricted) {
    return { can_read: false, can_write: false, can_update: false, can_delete: false };
  }
  if (module?.accessOnly) {
    return { can_read: true, can_write: false, can_update: false, can_delete: false };
  }
  return { can_read: true, can_write: true, can_update: true, can_delete: false };
};

const availableActions = (module) => (module.accessOnly ? ACTIONS.slice(0, 1) : ACTIONS);

const PermissionManagement = () => {
  const { canUseCapability, getTerm } = useSitePolicy();
  const [subAdmins, setSubAdmins] = useState([]);
  const [subAdminsLoading, setSubAdminsLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [permissions, setPermissions] = useState({});
  const [serverModuleKeys, setServerModuleKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [loadedUserId, setLoadedUserId] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [moduleQuery, setModuleQuery] = useState('');
  const isReraWorkspace = canUseCapability('rera_workspace');

  const profileModuleConfig = useMemo(() => MODULE_CONFIG
    .filter((module) => isReraWorkspace || !REGULATORY_MODULE_KEYS.has(module.key))
    .map((module) => {
      if (module.key !== 'rera_projects') return module;
      return {
        ...module,
        label: getTerm(
          'compliance_workspace',
          isReraWorkspace ? 'RERA Project Workspace' : 'Development Project Workspace',
        ),
        description: isReraWorkspace
          ? 'Regulatory projects, phases, stakeholders, and control centre'
          : 'Development projects, phases, planning, and finance context',
      };
    }), [getTerm, isReraWorkspace]);

  useEffect(() => {
    const fetchSubAdmins = async () => {
      setSubAdminsLoading(true);
      try {
        const response = await api.get('/admin/sub-admins');
        const users = response.data.subAdmins || [];
        setSubAdmins(users.filter(user => (user.role || '').toLowerCase() === 'sub_admin'));
      } catch (error) {
        console.error('Failed to fetch sub-admins:', error);
        toast.error('Could not load sub-admin accounts');
      } finally {
        setSubAdminsLoading(false);
      }
    };
    fetchSubAdmins();
  }, []);

  const modules = useMemo(() => {
    const knownKeys = new Set(profileModuleConfig.map(module => module.key));
    const unknown = serverModuleKeys
      .filter(key => !knownKeys.has(key) && (isReraWorkspace || !REGULATORY_MODULE_KEYS.has(key)))
      .map(key => ({
        key,
        label: key.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()),
        description: 'Module access',
        icon: Shield,
      }));
    return [...profileModuleConfig, ...unknown];
  }, [isReraWorkspace, profileModuleConfig, serverModuleKeys]);

  useEffect(() => {
    if (!selectedUserId) {
      setPermissions({});
      setDirty(false);
      setLoadError('');
      setLoadedUserId('');
      return;
    }

    let active = true;
    const fetchPermissions = async () => {
      setPermissions({});
      setDirty(false);
      setLoadError('');
      setLoadedUserId('');
      setLoading(true);
      try {
        const response = await api.get(`/permissions/${selectedUserId}`);
        if (!active) return;

        const keys = response.data.modules || profileModuleConfig.map(module => module.key);
        setServerModuleKeys(keys.filter((key) => isReraWorkspace || !REGULATORY_MODULE_KEYS.has(key)));
        const permissionsMap = {};
        (response.data.permissions || []).forEach(permission => {
          permissionsMap[permission.module] = {
            can_read: permission.can_read === true,
            can_write: permission.can_write === true,
            can_update: permission.can_update === true,
            can_delete: permission.can_delete === true,
          };
        });
        profileModuleConfig.forEach(module => {
          if (!permissionsMap[module.key]) permissionsMap[module.key] = permissionsForModule(module);
          if (module.accessOnly) {
            permissionsMap[module.key] = {
              ...permissionsMap[module.key],
              can_write: false,
              can_update: false,
              can_delete: false,
            };
          }
        });
        setPermissions(permissionsMap);
        setDirty(false);
        setLoadedUserId(selectedUserId);
      } catch (error) {
        if (!active) return;
        console.error('Failed to fetch permissions:', error);
        const message = error.response?.data?.message || 'Could not load permissions';
        setPermissions({});
        setLoadError(message);
        setLoadedUserId('');
        toast.error(message);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchPermissions();
    return () => { active = false; };
  }, [isReraWorkspace, profileModuleConfig, selectedUserId]);

  const handleUserChange = (nextUserId) => {
    if (saving) return;
    if (dirty && !window.confirm('Discard unsaved permission changes?')) return;
    setSelectedUserId(nextUserId);
    setModuleQuery('');
  };

  const togglePermission = (module, action) => {
    setDirty(true);
    setPermissions(previous => {
      const current = previous[module.key] || permissionsForModule(module);
      const field = `can_${action}`;
      const nextValue = !current[field];
      const next = { ...current, [field]: nextValue };

      // Creating, editing, or deleting requires visibility into the module.
      if (action !== 'read' && nextValue) next.can_read = true;
      // Removing view access makes every stronger action ineffective, so clear it.
      if (action === 'read' && !nextValue) {
        next.can_write = false;
        next.can_update = false;
        next.can_delete = false;
      }
      return { ...previous, [module.key]: next };
    });
  };

  const setModuleAll = (module, enabled) => {
    setDirty(true);
    setPermissions(previous => ({
      ...previous,
      [module.key]: module.accessOnly
        ? { can_read: enabled, can_write: false, can_update: false, can_delete: false }
        : { can_read: enabled, can_write: enabled, can_update: enabled, can_delete: enabled },
    }));
  };

  const visibleModules = useMemo(() => {
    const query = moduleQuery.trim().toLowerCase();
    if (!query) return modules;
    return modules.filter(module =>
      module.label.toLowerCase().includes(query)
      || module.description.toLowerCase().includes(query)
      || module.key.includes(query)
    );
  }, [moduleQuery, modules]);

  const setVisibleModules = (enabled) => {
    setDirty(true);
    setPermissions(previous => {
      const next = { ...previous };
      visibleModules.forEach(module => {
        next[module.key] = module.accessOnly
          ? { can_read: enabled, can_write: false, can_update: false, can_delete: false }
          : { can_read: enabled, can_write: enabled, can_update: enabled, can_delete: enabled };
      });
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedUserId || loadedUserId !== selectedUserId) return;
    setSaving(true);
    try {
      const permissionsArray = modules.map(module => {
        const values = permissions[module.key] || permissionsForModule(module);
        return {
          module: module.key,
          can_read: values.can_read === true,
          can_write: module.accessOnly ? false : values.can_write === true,
          can_update: module.accessOnly ? false : values.can_update === true,
          can_delete: module.accessOnly ? false : values.can_delete === true,
        };
      });
      const response = await api.put(`/permissions/${selectedUserId}`, { permissions: permissionsArray });
      const savedMap = {};
      (response.data.permissions || permissionsArray).forEach(permission => {
        savedMap[permission.module] = {
          can_read: permission.can_read === true,
          can_write: permission.can_write === true,
          can_update: permission.can_update === true,
          can_delete: permission.can_delete === true,
        };
      });
      setPermissions(savedMap);
      setDirty(false);
      toast.success('Module permissions saved');
    } catch (error) {
      console.error('Failed to save permissions:', error);
      toast.error(error.response?.data?.message || 'Could not save permissions');
    } finally {
      setSaving(false);
    }
  };

  const selectedUser = subAdmins.find(user => String(user.id) === selectedUserId);
  const permissionsLoaded = Boolean(selectedUserId) && loadedUserId === selectedUserId;
  const totals = useMemo(() => modules.reduce((summary, module) => {
    const values = permissions[module.key] || {};
    const actions = availableActions(module);
    summary.available += actions.length;
    summary.granted += actions.filter(action => values[`can_${action.key}`]).length;
    return summary;
  }, { available: 0, granted: 0 }), [modules, permissions]);
  const progress = totals.available ? Math.round((totals.granted / totals.available) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-10">
      <header className="relative overflow-hidden rounded-panel border border-zinc-800 bg-mr-ink px-5 py-6 text-white shadow-none sm:px-7 sm:py-7">
        <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-mr-lime/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mr-lime text-mr-ink">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mr-lime">Access control</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Module Permissions</h1>
              <p className="mt-1.5 max-w-2xl text-sm font-medium text-zinc-300">Give each sub-admin exactly the access they need across every operational module.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <div className="rounded-control border border-white/10 bg-white/5 px-3.5 py-2">
              <p className="text-[10px] uppercase tracking-wider text-zinc-400">Modules</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums">{modules.length}</p>
            </div>
            <div className="rounded-control border border-white/10 bg-white/5 px-3.5 py-2">
              <p className="text-[10px] uppercase tracking-wider text-zinc-400">Coverage</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums">{selectedUserId ? `${progress}%` : '—'}</p>
            </div>
          </div>
        </div>
      </header>

      <section className="rounded-panel border border-mr-line bg-mr-surface p-4 shadow-none sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <label className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              <UserCog className="h-3.5 w-3.5 text-mr-muted" /> Sub-admin account
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select value={selectedUserId} onValueChange={handleUserChange} disabled={saving}>
                <SelectTrigger className="h-11 w-full rounded-control border-mr-line bg-mr-surface-2 text-sm sm:max-w-md">
                  <SelectValue placeholder="Choose a sub-admin" />
                </SelectTrigger>
                <SelectContent>
                  {subAdminsLoading ? (
                    <div className="flex items-center justify-center p-4 text-xs text-slate-500">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-600" /> Loading accounts...
                    </div>
                  ) : subAdmins.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-slate-500">No sub-admin accounts found</div>
                  ) : subAdmins.map(user => (
                    <SelectItem key={user.id} value={String(user.id)} className="text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mr-surface-2 text-[10px] font-bold text-mr-muted">
                          {user.name?.charAt(0)?.toUpperCase() || 'U'}
                        </span>
                        <span className="truncate">{user.name}</span>
                        <span className="truncate text-xs text-slate-400">{user.email}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedUser && (
                <Badge className={selectedUser.is_active
                  ? 'w-fit border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50'
                  : 'w-fit border border-red-200 bg-red-50 text-red-700 hover:bg-red-50'}>
                  {selectedUser.is_active ? 'Active account' : 'Inactive account'}
                </Badge>
              )}
            </div>
          </div>
          {permissionsLoaded && !loading && (
            <div className="min-w-52 rounded-panel-sm border border-mr-line bg-mr-surface-2 px-4 py-3">
              <div className="flex items-center justify-between gap-4 text-xs">
                <span className="text-slate-600">Granted actions</span>
                <span className="font-bold tabular-nums text-mr-text">{totals.granted} / {totals.available}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mr-line">
                <div className="h-full rounded-full bg-mr-lime-ink transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
      </section>

      {selectedUserId ? (
        <section className="overflow-hidden rounded-panel border border-mr-line bg-mr-surface shadow-none">
          <div className="flex flex-col gap-3 border-b border-mr-line bg-mr-surface-2/60 p-4 lg:flex-row lg:items-center lg:justify-between sm:p-5">
            <div>
              <h2 className="text-base font-bold tracking-tight text-mr-text">Permission matrix</h2>
              <p className="mt-1 text-xs text-mr-muted">View access is required before create, edit, or delete access can be used.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="h-10 w-full rounded-control border-mr-line bg-mr-surface pl-9 text-xs sm:w-56"
                  placeholder="Search modules"
                  value={moduleQuery}
                  disabled={saving || !permissionsLoaded}
                  onChange={event => setModuleQuery(event.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={saving || !permissionsLoaded} onClick={() => setVisibleModules(false)} className="h-10 flex-1 rounded-full border-mr-line text-xs sm:flex-none">
                  Revoke visible
                </Button>
                <Button variant="outline" size="sm" disabled={saving || !permissionsLoaded} onClick={() => setVisibleModules(true)} className="h-10 flex-1 rounded-full border-mr-lime-ink/20 bg-mr-lime-soft text-xs text-mr-lime-ink hover:bg-mr-lime-soft sm:flex-none">
                  Grant visible
                </Button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 9 }).map((_, index) => <Skeleton key={index} className="h-14 rounded-xl" />)}
            </div>
          ) : !permissionsLoaded ? (
            <div className="flex min-h-56 flex-col items-center justify-center px-6 py-12 text-center">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <p className="mt-3 text-sm font-semibold text-slate-800">Permissions could not be loaded</p>
              <p className="mt-1 max-w-sm text-xs text-slate-500">{loadError || 'Select the account again to retry.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[710px]">
                <div className="mr-dark-table grid grid-cols-[minmax(260px,1fr)_72px_repeat(4,76px)] items-center border-b border-zinc-700 bg-mr-ink px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                  <div>Module</div>
                  <div className="text-center">All</div>
                  {ACTIONS.map(action => (
                    <div key={action.key} className={action.key === 'delete' ? 'text-center text-red-500' : 'text-center'}>{action.label}</div>
                  ))}
                </div>
                <div className="divide-y divide-slate-100">
                  {visibleModules.length === 0 && (
                    <div className="px-5 py-14 text-center text-sm text-slate-500">No modules match “{moduleQuery}”.</div>
                  )}
                  {visibleModules.map(module => {
                    const Icon = module.icon;
                    const values = permissions[module.key] || permissionsForModule(module);
                    const actions = availableActions(module);
                    const allEnabled = actions.every(action => values[`can_${action.key}`]);
                    const anyEnabled = actions.some(action => values[`can_${action.key}`]);
                    return (
                    <div key={module.key} className="grid grid-cols-[minmax(260px,1fr)_72px_repeat(4,76px)] items-center px-4 py-3 transition-colors hover:bg-mr-surface-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={anyEnabled
                            ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-mr-lime-ink/20 bg-mr-lime-soft text-mr-lime-ink'
                            : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-mr-line bg-mr-surface-2 text-mr-faint'}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold text-mr-text">{module.label}</p>
                              {module.accessOnly && <Badge variant="outline" className="h-4 shrink-0 border-blue-100 bg-blue-50 px-1.5 text-[8px] uppercase text-blue-600">view only</Badge>}
                              {module.restricted && <Badge variant="outline" className="h-4 shrink-0 border-amber-200 bg-amber-50 px-1.5 text-[8px] uppercase text-amber-700">sensitive</Badge>}
                            </div>
                            <p className="mt-0.5 truncate text-[10px] font-medium text-slate-400">{module.description}</p>
                          </div>
                        </div>
                        <div className="flex justify-center">
                          <button
                            type="button"
                            disabled={saving}
                            title={allEnabled ? `Revoke ${module.label}` : `Grant ${module.label}`}
                            onClick={() => setModuleAll(module, !allEnabled)}
                              className={allEnabled
                              ? 'flex h-8 w-8 items-center justify-center rounded-full border border-mr-lime-ink bg-mr-lime-ink text-white transition-colors hover:brightness-110'
                              : 'flex h-8 w-8 items-center justify-center rounded-full border border-mr-line bg-mr-surface text-mr-faint transition-colors hover:border-mr-lime-ink hover:text-mr-lime-ink'}>
                            {allEnabled ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
                          </button>
                        </div>
                        {ACTIONS.map(action => {
                          const unavailable = module.accessOnly && action.key !== 'read';
                          return (
                            <div key={action.key} className="flex justify-center">
                              {unavailable ? (
                                <span className="text-xs text-slate-300">—</span>
                              ) : (
                                <Switch
                                  aria-label={`${action.label} ${module.label}`}
                                  checked={values[`can_${action.key}`] === true}
                                  disabled={saving}
                                  onCheckedChange={() => togglePermission(module, action.key)}
                                  className="data-[state=checked]:bg-mr-lime-ink"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {permissionsLoaded && <div className="sticky bottom-0 flex flex-col gap-3 border-t border-slate-200 bg-white/95 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className={dirty ? 'flex items-center gap-2 text-xs text-amber-700' : 'flex items-center gap-2 text-xs text-emerald-700'}>
              {dirty ? <AlertCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              {dirty ? 'Unsaved permission changes' : 'Permissions are up to date'}
            </p>
              <Button
              onClick={handleSave}
              disabled={saving || loading || !dirty}
              className="h-10 rounded-full bg-mr-ink px-5 text-xs text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {saving ? 'Saving permissions...' : dirty ? 'Save changes' : 'Saved'}
            </Button>
          </div>}
        </section>
      ) : (
        <section className="flex min-h-72 flex-col items-center justify-center rounded-panel border border-dashed border-mr-line bg-mr-surface-2/40 px-5 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-mr-line bg-mr-surface text-mr-muted">
            <Shield className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-base font-bold text-mr-text">Choose a sub-admin</h2>
          <p className="mt-1 max-w-sm text-sm font-medium text-mr-muted">Select an account above to review and configure access across all {modules.length} modules.</p>
        </section>
      )}
    </div>
  );
};

export default PermissionManagement;
