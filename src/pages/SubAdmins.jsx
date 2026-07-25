import { useState, useEffect } from 'react';
import api from '../api/api';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
  DialogTrigger, DialogFooter,
} from '../components/ui/dialog';
import {
  PageHeader, SectionHead, EmptyBlock, StatusDot,
  FIELD, FIELD_LG, GHOST_BTN, PRIMARY_BTN,
} from '../components/ui/page';
import {
  UserPlus, Edit2, Trash2, Shield, Eye, EyeOff, AlertCircle, Check, Search, Loader2,
} from 'lucide-react';

export const SubAdmins = () => {
  const [subAdmins, setSubAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showPass, setShowPass] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', password: '', role: 'sub_admin',
  });

  const fetchSubAdmins = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/sub-admins');
      setSubAdmins(response.data.subAdmins || []);
    } catch (err) {
      console.error('Failed to fetch sub-admins:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSubAdmins(); }, []);

  const resetForm = () => {
    setFormData({ name: '', email: '', phone: '', password: '', role: 'sub_admin' });
    setEditingId(null);
    setShowPass(false);
    setMessage({ type: '', text: '' });
  };

  const handleOpenCreate = () => { resetForm(); setDialogOpen(true); };

  const handleOpenEdit = (admin) => {
    setFormData({
      name: admin.name,
      email: admin.email,
      phone: admin.phone || '',
      password: '',
      role: (admin.role || 'sub_admin').toLowerCase(),
    });
    setEditingId(admin.id);
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    try {
      if (editingId) {
        const payload = { ...formData };
        if (!payload.password) delete payload.password;
        await api.put(`/admin/sub-admins/${editingId}`, payload);
        setMessage({ type: 'success', text: 'Sub-admin updated' });
      } else {
        if (!formData.password) { setMessage({ type: 'error', text: 'Password is required' }); return; }
        await api.post('/admin/sub-admins', formData);
        setMessage({ type: 'success', text: 'Sub-admin created' });
      }
      await fetchSubAdmins();
      setTimeout(() => setDialogOpen(false), 500);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Operation failed' });
    }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('Deactivate this sub-admin?')) return;
    try { await api.delete(`/admin/sub-admins/${id}`); await fetchSubAdmins(); } catch (err) { console.error('Failed:', err); }
  };

  const handleToggleActive = async (admin) => {
    try { await api.put(`/admin/sub-admins/${admin.id}`, { is_active: !admin.is_active }); await fetchSubAdmins(); } catch (err) { console.error('Failed:', err); }
  };

  const filteredAdmins = subAdmins.filter(
    (a) => a.name?.toLowerCase().includes(searchQuery.toLowerCase()) || a.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mx-auto w-full max-w-5xl pb-16">
      <PageHeader
        title="Admin management"
        description="Admins and sub-admins who can sign in to this workspace."
        actions={
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <button type="button" className={PRIMARY_BTN} onClick={handleOpenCreate}>
                <UserPlus className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" /> Add admin
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-[17px] font-semibold tracking-[-0.015em]">
                  {editingId ? 'Edit user' : 'New admin or sub-admin'}
                </DialogTitle>
                <DialogDescription className="text-[13px] text-mr-muted">
                  {editingId ? 'Update user details and role.' : 'Create an account that can sign in to this workspace.'}
                </DialogDescription>
              </DialogHeader>

              {message.text && (
                <p className={`flex gap-2 rounded-control px-3 py-2.5 text-[13px] ${
                  message.type === 'success' ? 'bg-mr-lime-soft text-mr-lime-ink' : 'bg-mr-coral-soft text-mr-coral-ink'
                }`}>
                  {message.type === 'success'
                    ? <Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                    : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />}
                  {message.text}
                </p>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="admin-name" className="text-[13px] font-medium text-mr-text">Full name *</Label>
                    <Input id="admin-name" placeholder="John Doe" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className={FIELD_LG} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-phone" className="text-[13px] font-medium text-mr-text">Phone</Label>
                    <Input id="admin-phone" placeholder="+91 9876543210" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className={FIELD_LG} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-email" className="text-[13px] font-medium text-mr-text">Email *</Label>
                  <Input id="admin-email" type="email" placeholder="john@company.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required className={FIELD_LG} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-role" className="text-[13px] font-medium text-mr-text">Role *</Label>
                  <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                    <SelectTrigger id="admin-role" className={FIELD_LG}>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="sub_admin">Sub-Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-password" className="text-[13px] font-medium text-mr-text">
                    {editingId ? 'New password (optional)' : 'Password *'}
                  </Label>
                  <div className="relative">
                    <Input
                      id="admin-password"
                      type={showPass ? 'text' : 'password'}
                      placeholder={editingId ? 'Leave blank to keep' : 'Min. 6 characters'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required={!editingId}
                      className={`${FIELD_LG} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      tabIndex={-1}
                      aria-label={showPass ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-mr-faint transition-colors hover:text-mr-text"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  </div>
                </div>
                <DialogFooter>
                  <button type="button" className={GHOST_BTN} onClick={() => setDialogOpen(false)}>Cancel</button>
                  <button type="submit" className={PRIMARY_BTN}>{editingId ? 'Update' : 'Create'}</button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <section className="mt-8">
        <SectionHead
          title="Team"
          meta={`${filteredAdmins.length} member${filteredAdmins.length === 1 ? '' : 's'}`}
          actions={
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mr-faint" strokeWidth={1.9} aria-hidden="true" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name or email…"
                aria-label="Search admins"
                className={`${FIELD} pl-9`}
              />
            </div>
          }
        />

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-mr-faint" aria-hidden="true" />
          </div>
        ) : filteredAdmins.length === 0 ? (
          <EmptyBlock
            icon={Shield}
            title="No admins or sub-admins found"
            description={searchQuery ? 'No one matches that search.' : 'Add your first admin or sub-admin to get started.'}
            tall
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-mr-line">
                  {['Name', 'Contact', 'Role', 'Status', 'Joined'].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-3 text-left text-[12px] font-medium text-mr-muted">{h}</th>
                  ))}
                  <th className="px-3 py-3 text-right text-[12px] font-medium text-mr-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdmins.map((admin) => (
                  <tr key={admin.id} className="border-b border-mr-line transition-colors hover:bg-mr-surface-2/60">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mr-surface-2 text-[13px] font-semibold text-mr-muted">
                          {admin.name?.charAt(0)?.toUpperCase()}
                        </span>
                        <span className="font-medium text-mr-text">{admin.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="block text-mr-muted">{admin.email}</span>
                      {admin.phone && <span className="mt-0.5 block text-[12px] text-mr-faint">{admin.phone}</span>}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-medium ${
                        admin.role === 'admin' ? 'bg-mr-blue-soft text-mr-blue' : 'bg-mr-surface-2 text-mr-muted'
                      }`}>
                        {admin.role === 'admin' ? 'Admin' : 'Sub-Admin'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(admin)}
                        aria-label={`${admin.is_active ? 'Deactivate' : 'Activate'} ${admin.name}`}
                        className="rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
                      >
                        <StatusDot tone={admin.is_active ? 'positive' : 'negative'}>
                          {admin.is_active ? 'Active' : 'Inactive'}
                        </StatusDot>
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-mr-muted">
                      {admin.created_at
                        ? new Date(admin.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(admin)}
                          aria-label={`Edit ${admin.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-control text-mr-faint transition-colors hover:bg-mr-surface-2 hover:text-mr-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
                        >
                          <Edit2 className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeactivate(admin.id)}
                          aria-label={`Deactivate ${admin.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-control text-mr-faint transition-colors hover:bg-mr-coral-soft hover:text-mr-coral-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />
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
    </div>
  );
};

export default SubAdmins;
