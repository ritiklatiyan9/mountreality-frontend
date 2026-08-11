import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Button } from '../components/ui/button';
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
import { PageHeader, EmptyBlock, PRIMARY_BTN } from '../components/ui/page';
import { SkeletonBlock } from '../components/dashboard/primitives';
import VendorModuleTabs from '../components/inventory/VendorModuleTabs';
import { AlertCircle, Check, Pencil, Plus, Store, Tags, Trash2, X, Loader2 } from 'lucide-react';

const VendorCategories = () => {
  const navigate = useNavigate();
  const { currentSite, canManage, hasPermission } = useAuth();
  const canWrite = canManage && hasPermission('vendors', 'write');
  const canUpdate = canManage && hasPermission('vendors', 'update');
  const canDelete = canManage && hasPermission('vendors', 'delete');
  const siteId = currentSite?.id;

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [heads, setHeads] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [headName, setHeadName] = useState('');
  const [editingHead, setEditingHead] = useState(null);

  const loadHeads = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    // Watchdog — never let the spinner hang.
    const watchdog = setTimeout(() => setLoading(false), 15000);
    try {
      const res = await api.get('/vendors/heads', { params: { site_id: siteId } });
      setHeads(res.data.heads || []);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load categories' });
    } finally {
      clearTimeout(watchdog);
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { loadHeads(); }, [loadHeads]);

  useEffect(() => {
    if (!message.text) return;
    const t = setTimeout(() => setMessage({ type: '', text: '' }), 3500);
    return () => clearTimeout(t);
  }, [message]);

  const openCreateDialog = () => {
    setEditingHead(null);
    setHeadName('');
    setDialogOpen(true);
  };

  const openEditDialog = (head) => {
    setEditingHead(head);
    setHeadName(head.name || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!siteId || !headName.trim()) {
      setMessage({ type: 'error', text: 'Category name is required' });
      return;
    }
    setSubmitting(true);
    try {
      const { data } = editingHead
        ? await api.put(`/vendors/heads/${editingHead.id}`, { site_id: siteId, name: headName.trim().toUpperCase() })
        : await api.post('/vendors/heads', { site_id: siteId, name: headName.trim().toUpperCase() });
      // Optimistic add — close dialog instantly.
      if (data?.head) {
        setHeads((prev) => {
          const exists = prev.findIndex((h) => h.id === data.head.id);
          if (exists >= 0) {
            const next = prev.slice();
            next[exists] = { ...next[exists], ...data.head };
            return next;
          }
          return [...prev, { commitment_count: 0, ...data.head }];
        });
      }
      setMessage({ type: 'success', text: editingHead ? 'Category updated' : 'Category created' });
      setHeadName('');
      setEditingHead(null);
      setDialogOpen(false);
      loadHeads(); // background reconcile
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || `Failed to ${editingHead ? 'update' : 'create'} category` });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this category? Existing commitments using it will not be affected.')) return;
    const snapshot = heads;
    setHeads((prev) => prev.filter((h) => h.id !== id));
    try {
      await api.delete(`/vendors/heads/${id}`, { params: { site_id: siteId } });
      setMessage({ type: 'success', text: 'Category deleted' });
      loadHeads();
    } catch (err) {
      setHeads(snapshot); // rollback
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to delete category' });
    }
  };

  if (!currentSite) {
    return <EmptyBlock icon={Tags} title="Select a site to manage vendor categories" tall />;
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] pb-16">
      <PageHeader
        title="Vendor Categories"
        description={`Work / payment categories for ${currentSite.name}`}
        actions={canWrite && (
          <button type="button" className={PRIMARY_BTN} onClick={openCreateDialog}>
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> Add category
          </button>
        )}
      />

      <VendorModuleTabs active="categories" className="mt-6" />

      {message.text && (
        <div className={`mt-5 flex items-center gap-2 rounded-control border p-3 text-[13px] ${message.type === 'success' ? 'border-mr-lime-ink/15 bg-mr-lime-soft text-mr-lime-ink' : 'border-mr-coral-ink/15 bg-mr-coral-soft text-mr-coral-ink'}`}>
          {message.type === 'success' ? <Check className="h-4 w-4 shrink-0" strokeWidth={1.9} /> : <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.9} />}
          <span>{message.text}</span>
          <button className="ml-auto" onClick={() => setMessage({ type: '', text: '' })}><X className="h-3.5 w-3.5" strokeWidth={1.9} /></button>
        </div>
      )}

      <section className="mt-5 border-t border-mr-line">
        {loading ? (
          <div className="space-y-3 p-5 sm:p-6">
            {[0, 1, 2].map((i) => <SkeletonBlock key={i} className="h-12 w-full" />)}
          </div>
        ) : heads.length === 0 ? (
          <EmptyBlock
            icon={Tags}
            title="No categories yet"
            description="Add categories like CEMENT, BRICKS, JCB, CIVIL WORK"
            tall
          />
        ) : (
          <table className="w-full min-w-[560px] border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="border-b border-mr-line px-3 py-2.5 text-left text-[12px] font-medium text-mr-muted">#</th>
                <th className="border-b border-mr-line px-3 py-2.5 text-left text-[12px] font-medium text-mr-muted">Category name</th>
                <th className="border-b border-mr-line px-3 py-2.5 text-right text-[12px] font-medium text-mr-muted">Commitments</th>
                {(canUpdate || canDelete) && <th className="border-b border-mr-line px-3 py-2.5 text-right text-[12px] font-medium text-mr-muted w-20">Action</th>}
              </tr>
            </thead>
            <tbody>
              {heads.map((h, idx) => (
                <tr key={h.id} className="border-b border-mr-line transition-colors duration-150 hover:bg-mr-surface-2/70">
                  <td className="px-3 py-2.5 text-[12px] tabular-nums text-mr-faint">{idx + 1}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-mr-amber-soft text-mr-amber-ink">
                        <Store className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />
                      </span>
                      <span className="font-medium text-mr-text">{h.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button type="button" className="inline-flex items-center rounded-full bg-mr-surface-2 px-2.5 py-0.5 text-[12px] font-medium text-mr-muted transition-colors hover:bg-mr-blue-soft hover:text-mr-blue disabled:cursor-default disabled:hover:bg-mr-surface-2 disabled:hover:text-mr-muted" onClick={() => navigate(`/vendors?category=${h.id}`)} disabled={!Number(h.commitment_count)} title={Number(h.commitment_count) ? 'View commitments in this category' : 'No commitments in this category'}>
                      {h.commitment_count || 0}
                    </button>
                  </td>
                  {(canUpdate || canDelete) && (
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canUpdate && <button type="button" onClick={() => openEditDialog(h)} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-mr-faint transition-colors hover:bg-mr-surface-2 hover:text-mr-text" aria-label={`Edit ${h.name}`}><Pencil className="h-3.5 w-3.5" strokeWidth={1.9} /></button>}
                        {canDelete && <button type="button" onClick={() => handleDelete(h.id)} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-mr-faint transition-colors hover:bg-mr-coral-soft hover:text-mr-coral-ink" aria-label={`Delete ${h.name}`}><Trash2 className="h-3.5 w-3.5" strokeWidth={1.9} /></button>}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Add / edit category dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{editingHead ? 'Edit Category' : 'Add Category'}</DialogTitle>
            <DialogDescription className="text-sm">Create a work/payment category like CIVIL WORK, MATERIAL, CONTRACTOR LABOUR.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Category Name</Label>
            <Input
              value={headName}
              onChange={(e) => setHeadName(e.target.value.toUpperCase())}
              placeholder="CIVIL WORK"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={submitting}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : editingHead ? <Pencil className="w-3.5 h-3.5 mr-1.5" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
              {editingHead ? 'Save Changes' : 'Add Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorCategories;
