import { useEffect, useMemo, useState } from 'react';
import api from '../api/api';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Checkbox } from '../components/ui/checkbox';
import {
  PageHeader, SectionHead, EmptyBlock, StatusDot,
  FIELD, FIELD_LG, GHOST_BTN, PRIMARY_BTN,
} from '../components/ui/page';
import { cn } from '@/lib/utils';
import { AlertCircle, Check, Eye, EyeOff, Home, KeyRound, Lock, Search, ShieldCheck, Unlock } from 'lucide-react';

const UserIdManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  // Site access
  const [allSites, setAllSites] = useState([]);
  const [siteDialogOpen, setSiteDialogOpen] = useState(false);
  const [siteUser, setSiteUser] = useState(null);
  const [selectedSiteIds, setSelectedSiteIds] = useState([]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/sub-admins');
      setUsers(res.data.subAdmins || []);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to load users' });
    } finally {
      setLoading(false);
    }
  };

  const loadSites = async () => {
    try {
      const res = await api.get('/sites');
      setAllSites(res.data.sites || res.data || []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadUsers();
    loadSites();
  }, []);

  useEffect(() => {
    if (!message.text) return;
    const timer = setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      String(u.id).includes(q) ||
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  }, [users, query]);

  const handleToggleAccess = async (user) => {
    const nextState = !user.is_active;
    const action = nextState ? 'unblock' : 'block';
    if (!window.confirm(`Are you sure you want to ${action} user ${user.name}?`)) return;

    setSubmitting(true);
    try {
      await api.patch(`/admin/sub-admins/${user.id}/access`, { is_active: nextState });
      setMessage({ type: 'success', text: `User ${nextState ? 'unblocked' : 'blocked'} successfully` });
      await loadUsers();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update access' });
    } finally {
      setSubmitting(false);
    }
  };

  const openResetDialog = (user) => {
    setSelectedUser(user);
    setNewPassword('');
    setShowPassword(false);
    setResetDialogOpen(true);
  };

  const openSiteDialog = (user) => {
    setSiteUser(user);
    setSelectedSiteIds(user.site_ids || []);
    setSiteDialogOpen(true);
  };

  const toggleSite = (siteId) => {
    setSelectedSiteIds((prev) =>
      prev.includes(siteId) ? prev.filter((id) => id !== siteId) : [...prev, siteId]
    );
  };

  const handleSaveSites = async () => {
    if (!siteUser) return;
    setSubmitting(true);
    try {
      await api.put(`/admin/sub-admins/${siteUser.id}`, { site_ids: selectedSiteIds });
      setSiteDialogOpen(false);
      setMessage({ type: 'success', text: `Site access updated for ${siteUser.name}` });
      await loadUsers();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update site access' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    if (!newPassword || newPassword.length < 6) {
      setMessage({ type: 'error', text: 'New password must be at least 6 characters' });
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/admin/sub-admins/${selectedUser.id}/reset-password`, { new_password: newPassword });
      setResetDialogOpen(false);
      setMessage({ type: 'success', text: `Password reset for ${selectedUser.name}` });
      await loadUsers();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to reset password' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl pb-16">
      <PageHeader
        title="User ID management"
        description="Block or unblock sign-in, reset passwords, and grant site access."
      />

      {message.text && (
        <p className={`mt-6 flex items-center gap-2 rounded-control px-4 py-3 text-[13px] ${
          message.type === 'success' ? 'bg-mr-lime-soft text-mr-lime-ink' : 'bg-mr-coral-soft text-mr-coral-ink'
        }`}>
          {message.type === 'success'
            ? <Check className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            : <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />}
          {message.text}
        </p>
      )}

      <section className="mt-8">
        <SectionHead
          title="Users"
          meta={`${filteredUsers.length} user${filteredUsers.length === 1 ? '' : 's'}`}
          actions={
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mr-faint" strokeWidth={1.9} aria-hidden="true" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search user id, name or email…"
                aria-label="Search users"
                className={`${FIELD} pl-9`}
              />
            </div>
          }
        />

        {loading ? (
          <EmptyBlock title="Loading users…" />
        ) : filteredUsers.length === 0 ? (
          <EmptyBlock
            icon={ShieldCheck}
            title="No users found"
            description={query ? 'No one matches that search.' : 'Users appear here once they are created.'}
            tall
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-mr-line">
                  {['User ID', 'Name', 'Email', 'Role', 'Status', 'Joined'].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-3 text-left text-[12px] font-medium text-mr-muted">{h}</th>
                  ))}
                  <th className="px-3 py-3 text-right text-[12px] font-medium text-mr-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="border-b border-mr-line transition-colors hover:bg-mr-surface-2/60">
                    <td className="px-3 py-3 font-medium tabular-nums text-mr-text">#{u.id}</td>
                    <td className="px-3 py-3 text-mr-text">{u.name}</td>
                    <td className="px-3 py-3 text-mr-muted">{u.email}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-medium ${
                        u.role === 'admin' ? 'bg-mr-blue-soft text-mr-blue' : 'bg-mr-surface-2 text-mr-muted'
                      }`}>
                        {u.role === 'admin' ? 'Admin' : 'Sub-Admin'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <StatusDot tone={u.is_active ? 'positive' : 'negative'}>
                        {u.is_active ? 'Active' : 'Blocked'}
                      </StatusDot>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-mr-muted">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-control text-mr-faint transition-colors hover:bg-mr-surface-2 hover:text-mr-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue disabled:opacity-40"
                          disabled={submitting}
                          onClick={() => openSiteDialog(u)}
                          title="Manage site access"
                          aria-label={`Manage site access for ${u.name}`}
                        >
                          <Home className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className={cn(
                            'inline-flex h-8 items-center gap-1.5 rounded-control px-2.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue disabled:opacity-40',
                            u.is_active
                              ? 'text-mr-coral-ink hover:bg-mr-coral-soft'
                              : 'text-mr-lime-ink hover:bg-mr-lime-soft',
                          )}
                          disabled={submitting}
                          onClick={() => handleToggleAccess(u)}
                        >
                          {u.is_active
                            ? <Lock className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />
                            : <Unlock className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />}
                          {u.is_active ? 'Block' : 'Unblock'}
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-8 items-center gap-1.5 rounded-control border border-mr-line px-2.5 text-[12px] font-medium text-mr-text transition-colors hover:bg-mr-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue disabled:opacity-40"
                          disabled={submitting || !u.is_active}
                          onClick={() => openResetDialog(u)}
                        >
                          <KeyRound className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" /> Reset password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Site access ── */}
      <Dialog open={siteDialogOpen} onOpenChange={setSiteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-semibold tracking-[-0.015em]">Site access — {siteUser?.name}</DialogTitle>
            <DialogDescription className="text-[13px] text-mr-muted">
              Select which sites this user can access.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
            {allSites.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-mr-muted">No sites found.</p>
            ) : (
              allSites.map((site) => (
                <label
                  key={site.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-control border p-3 transition-colors',
                    selectedSiteIds.includes(site.id)
                      ? 'border-mr-blue/30 bg-mr-blue-soft'
                      : 'border-mr-line hover:bg-mr-surface-2',
                  )}
                >
                  <Checkbox
                    checked={selectedSiteIds.includes(site.id)}
                    onCheckedChange={() => toggleSite(site.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-mr-text">{site.name}</span>
                    {site.location && <span className="block truncate text-[12px] text-mr-faint">{site.location}</span>}
                  </span>
                  <span className="shrink-0 text-[12px] tabular-nums text-mr-faint">#{site.id}</span>
                </label>
              ))
            )}
          </div>

          <DialogFooter>
            <button type="button" className={GHOST_BTN} onClick={() => setSiteDialogOpen(false)} disabled={submitting}>
              Cancel
            </button>
            <button type="button" className={PRIMARY_BTN} onClick={handleSaveSites} disabled={submitting}>
              {submitting ? 'Saving…' : `Save (${selectedSiteIds.length} site${selectedSiteIds.length === 1 ? '' : 's'})`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Password reset ── */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-semibold tracking-[-0.015em]">Reset password</DialogTitle>
            <DialogDescription className="text-[13px] text-mr-muted">
              Set a new password for {selectedUser?.name || 'this user'}. Existing sessions will be signed out.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="reset-password" className="text-[13px] font-medium text-mr-text">New password *</Label>
            <div className="relative">
              <Input
                id="reset-password"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className={`${FIELD_LG} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-mr-faint transition-colors hover:text-mr-text"
              >
                {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
            <p className="inline-flex items-center gap-1.5 text-[12px] text-mr-muted">
              <ShieldCheck className="h-3.5 w-3.5 text-mr-faint" strokeWidth={1.9} aria-hidden="true" />
              The user will need to sign in again with the new password.
            </p>
          </div>

          <DialogFooter>
            <button type="button" className={GHOST_BTN} onClick={() => setResetDialogOpen(false)} disabled={submitting}>
              Cancel
            </button>
            <button type="button" className={PRIMARY_BTN} onClick={handleResetPassword} disabled={submitting}>
              {submitting ? 'Updating…' : 'Update password'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserIdManagement;
