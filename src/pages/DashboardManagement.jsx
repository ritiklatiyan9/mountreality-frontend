import { useState, useEffect, useCallback } from 'react';
import api from '../api/api';
import { Switch } from '../components/ui/switch';
import { Skeleton } from '../components/ui/skeleton';
import {
  PageHeader, SectionHead, EmptyBlock, FIELD, GHOST_BTN, PRIMARY_BTN,
} from '../components/ui/page';
import { cn } from '@/lib/utils';
import {
  Users, UserCog, ChevronRight, Search, Check, X, Loader2,
  LayoutDashboard, BarChart2, IndianRupee, TrendingUp, TrendingDown,
  Wallet, Shield, PieChart, ClipboardList, BarChartHorizontalBig,
  Banknote, Bell, UserSearch, Activity, ShieldCheck, Save,
  RefreshCw, CheckSquare, Square,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Component catalog ──────────────────────────────────────────────────────────
const COMPONENT_GROUPS = [
  {
    group: 'Financial Overview (KPI Cards)',
    color: 'from-blue-50 to-indigo-50 border-blue-200',
    headerColor: 'text-blue-700',
    components: [
      { key: 'financial_overview', label: 'Financial Overview Section', desc: 'The entire KPI cards row + time filter', Icon: LayoutDashboard },
      { key: 'kpi_totalIncoming', label: 'Total Incoming Card', desc: 'Plot Payments + Installments + Ledger Credit', Icon: IndianRupee },
      { key: 'kpi_plotPayments', label: 'Plot Payments Card', desc: 'Raw plot payment totals', Icon: TrendingUp },
      { key: 'kpi_registryPayments', label: 'Registry Payments Card', desc: 'All money (cash + bank + other) received on plots with status REGISTRY', Icon: TrendingUp },
      { key: 'kpi_personalLedger', label: 'Personal Ledger Card', desc: 'Outstanding person-ledger balances', Icon: Users },
      { key: 'kpi_totalExpense', label: 'Total Expenses Card', desc: 'All expense sources combined', Icon: TrendingDown },
      { key: 'kpi_profit', label: 'Profit Card', desc: 'Incoming minus Expenses', Icon: Wallet },
      { key: 'kpi_siteBalance', label: 'Site Balance Card', desc: 'Alpha − Imprest Given (Gamma)', Icon: Shield },
    ],
  },
  {
    group: 'Analytics Charts',
    color: 'from-purple-50 to-violet-50 border-purple-200',
    headerColor: 'text-purple-700',
    components: [
      { key: 'revenue_charts', label: 'Revenue vs Expense Charts', desc: 'Line/bar charts for revenue & expense trends', Icon: BarChart2 },
      { key: 'expense_radar', label: 'Expense Radar Chart', desc: 'Expense breakdown by category (radar)', Icon: PieChart },
      { key: 'module_breakdown', label: 'Module Breakdown', desc: 'Progress bars per expense source', Icon: BarChartHorizontalBig },
    ],
  },
  {
    group: 'Transactions & Activity',
    color: 'from-sky-50 to-cyan-50 border-sky-200',
    headerColor: 'text-sky-700',
    components: [
      { key: 'recent_transactions', label: 'Recent Transactions', desc: 'Paginated latest day-book entries', Icon: ClipboardList },
      { key: 'site_cashflow', label: 'Site Cash Flow Summary', desc: 'Site ledger incoming / outgoing summary', Icon: Banknote },
      { key: 'approvals', label: 'Approvals Widget', desc: 'Pending approvals & edit requests', Icon: Bell },
      { key: 'compliance_watch', label: 'Compliance Watch Card', desc: 'Due, overdue, high-risk and expiry alerts', Icon: ShieldCheck },
      { key: 'activity_card', label: 'Activity Card', desc: 'Recent login and user activity', Icon: Activity },
    ],
  },
  {
    group: 'Utilities',
    color: 'from-slate-50 to-gray-50 border-slate-200',
    headerColor: 'text-slate-700',
    components: [
      { key: 'member_search', label: 'Member Search Bar', desc: 'Global search for users and ledgers', Icon: UserSearch },
      { key: 'verify_panel', label: 'Data Verification Panel', desc: 'Financial consistency checker', Icon: ShieldCheck },
    ],
  },
];

const ALL_KEYS = COMPONENT_GROUPS.flatMap(g => g.components.map(c => c.key));

// ── Role badge helper ──────────────────────────────────────────────────────────
const ROLE_LABEL = { admin: 'Admin', super_admin: 'Super Admin' };

const RoleBadge = ({ role }) => (
  <span className={cn(
    'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
    ROLE_LABEL[role] ? 'bg-mr-blue-soft text-mr-blue' : 'bg-mr-surface-2 text-mr-muted',
  )}>
    {ROLE_LABEL[role] || 'Sub-Admin'}
  </span>
);

// ── Main Page ──────────────────────────────────────────────────────────────────
export const DashboardManagement = () => {
  // User list
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');

  // Selected user
  const [selectedUser, setSelectedUser] = useState(null);

  // Permissions for selected user
  const [perms, setPerms] = useState({}); // component → boolean
  const [permsLoading, setPermsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // ── Fetch user list ──────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await api.get('/dashboard-permissions/users');
      setUsers(res.data.users || []);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Fetch component permissions when user selected ───────────────────────────
  const fetchPerms = useCallback(async (userId) => {
    setPermsLoading(true);
    setDirty(false);
    try {
      const res = await api.get(`/dashboard-permissions/${userId}`);
      setPerms(res.data.permissions || {});
    } catch {
      toast.error('Failed to load dashboard permissions');
    } finally {
      setPermsLoading(false);
    }
  }, []);

  const handleSelectUser = (u) => {
    setSelectedUser(u);
    fetchPerms(u.id);
  };

  // ── Toggle a component permission ────────────────────────────────────────────
  const toggle = (key) => {
    setPerms(prev => ({ ...prev, [key]: !prev[key] }));
    setDirty(true);
  };

  // ── Bulk select / deselect all ────────────────────────────────────────────────
  const setAll = (allowed) => {
    const next = {};
    for (const key of ALL_KEYS) next[key] = allowed;
    setPerms(next);
    setDirty(true);
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      await api.put(`/dashboard-permissions/${selectedUser.id}`, { permissions: perms });
      setDirty(false);
      // Update restricted_count in user list
      const restrictedCount = ALL_KEYS.filter(k => perms[k] === false).length;
      setUsers(prev => prev.map(u =>
        u.id === selectedUser.id ? { ...u, restricted_count: restrictedCount } : u
      ));
      toast.success('Dashboard permissions saved');
    } catch {
      toast.error('Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  // ── Filtered user list ────────────────────────────────────────────────────────
  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const allAllowed = ALL_KEYS.every(k => perms[k] !== false);
  const noneAllowed = ALL_KEYS.every(k => perms[k] === false);

  return (
    <div className="mx-auto w-full max-w-6xl pb-16">
      <PageHeader
        title="Dashboard management"
        description="Control which dashboard components each user can see. Admins always see all components."
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* ── User list ── */}
        <div className="min-w-0">
          <SectionHead
            title="Users"
            meta={usersLoading ? undefined : `${filteredUsers.length}`}
          />
          <div className="relative pt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mr-faint" strokeWidth={1.9} aria-hidden="true" />
            <input
              type="text"
              placeholder="Search name or email…"
              aria-label="Search users"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className={`${FIELD} w-full pl-9 outline-none`}
            />
          </div>

          <div className="mt-3 max-h-[calc(100vh-320px)] overflow-y-auto">
            {usersLoading ? (
              <div className="space-y-3 py-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <EmptyBlock icon={Users} title="No users found" />
            ) : (
              filteredUsers.map((u) => {
                const isSelected = selectedUser?.id === u.id;
                const restricted = parseInt(u.restricted_count, 10) || 0;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelectUser(u)}
                    aria-current={isSelected ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-center gap-3 border-b border-mr-line px-2 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue',
                      isSelected ? 'bg-mr-blue-soft' : 'hover:bg-mr-surface-2',
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mr-surface-2 text-[13px] font-semibold text-mr-muted">
                      {u.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-[13px] font-medium text-mr-text">{u.name}</span>
                        <RoleBadge role={u.role} />
                      </span>
                      <span className="block truncate text-[12px] text-mr-faint">{u.email}</span>
                      {restricted > 0 && (
                        <span className="mt-0.5 block text-[12px] text-mr-amber-ink">
                          {restricted} component{restricted === 1 ? '' : 's'} restricted
                        </span>
                      )}
                    </span>
                    {isSelected && <ChevronRight className="h-4 w-4 shrink-0 text-mr-blue" strokeWidth={2} aria-hidden="true" />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Permission grid ── */}
        <div className="min-w-0">
          {!selectedUser ? (
            <EmptyBlock
              icon={UserCog}
              title="Select a user"
              description="Pick someone on the left to manage which dashboard components they can see."
              tall
            />
          ) : (
            <>
              <SectionHead
                title={selectedUser.name}
                description={selectedUser.email}
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className={GHOST_BTN} onClick={() => setAll(true)} disabled={permsLoading || allAllowed}>
                      <CheckSquare className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" /> Allow all
                    </button>
                    <button type="button" className={GHOST_BTN} onClick={() => setAll(false)} disabled={permsLoading || noneAllowed}>
                      <Square className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" /> Restrict all
                    </button>
                  </div>
                }
              />

              {(selectedUser.role === 'admin' || selectedUser.role === 'super_admin') && (
                <p className="mt-5 flex items-start gap-2 rounded-control bg-mr-amber-soft px-4 py-3 text-[13px] leading-relaxed text-mr-amber-ink">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
                  <span>
                    <strong className="font-semibold">{selectedUser.name}</strong> is an{' '}
                    {selectedUser.role === 'super_admin' ? 'Super Admin' : 'Admin'} and will always see every dashboard
                    component regardless of these settings. You can still configure them here for reference.
                  </span>
                </p>
              )}

              {permsLoading ? (
                <div className="mt-8 space-y-8">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="space-y-3">
                      <Skeleton className="h-4 w-40" />
                      {[...Array(3)].map((_, j) => (
                        <div key={j} className="flex items-center justify-between gap-4">
                          <div className="flex-1 space-y-1.5">
                            <Skeleton className="h-3.5 w-36" />
                            <Skeleton className="h-3 w-48" />
                          </div>
                          <Skeleton className="h-5 w-10 rounded-full" />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                COMPONENT_GROUPS.map((group) => (
                  <section key={group.group} className="mt-8">
                    <h3 className="border-b border-mr-line pb-2.5 text-[13px] font-semibold text-mr-muted">{group.group}</h3>
                    {group.components.map((comp) => {
                      const allowed = perms[comp.key] !== false;
                      return (
                        <div key={comp.key} className="flex items-center justify-between gap-4 border-b border-mr-line py-3.5">
                          <div className="min-w-0">
                            <p className="text-[14px] font-medium text-mr-text">{comp.label}</p>
                            <p className="mt-0.5 text-[13px] text-mr-muted">{comp.desc}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <span className={cn('text-[12px] font-medium', allowed ? 'text-mr-muted' : 'text-mr-coral-ink')}>
                              {allowed ? 'Allowed' : 'Restricted'}
                            </span>
                            <Switch
                              checked={allowed}
                              onCheckedChange={() => toggle(comp.key)}
                              aria-label={`${comp.label} — ${allowed ? 'allowed' : 'restricted'}`}
                              className="data-[state=checked]:bg-mr-ink"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </section>
                ))
              )}

              {/* Save bar — only while something is genuinely unsaved. */}
              {dirty && !permsLoading && (
                <div className="sticky bottom-0 mt-6 flex items-center justify-between gap-3 border-t border-mr-line bg-mr-surface/95 py-3 backdrop-blur">
                  <p className="text-[13px] font-medium text-mr-muted">Unsaved changes</p>
                  <div className="flex items-center gap-2">
                    <button type="button" className={GHOST_BTN} onClick={() => fetchPerms(selectedUser.id)} disabled={saving}>
                      <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" /> Discard
                    </button>
                    <button type="button" className={PRIMARY_BTN} onClick={handleSave} disabled={saving}>
                      {saving
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        : <Save className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />}
                      Save changes
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardManagement;
