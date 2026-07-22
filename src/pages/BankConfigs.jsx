import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Skeleton } from '../components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  Landmark, Plus, Loader2, CheckCircle2, Edit2, Trash2, Building2,
  Lock, KeyRound, ShieldCheck, Eye, EyeOff,
} from 'lucide-react';

// ponytail: client-side gate only — real protection is the upi_collect API
// permission; this keeps casual eyes out of the bank details screen.
const GATE_PASSWORD = '9760302691';
const GATE_KEY = 'bankConfigsUnlocked';

const EMPTY_ACCOUNT = { label: '', payee_name: '', vpa: '', bank_name: '', account_no: '', ifsc: '' };

const BankConfigs = () => {
  const { currentSite, canManage, hasPermission } = useAuth();
  const siteId = currentSite?.id;
  const canWrite  = canManage && hasPermission('upi_collect', 'write');
  const canUpdate = canManage && hasPermission('upi_collect', 'update');
  const canDelete = canManage && hasPermission('upi_collect', 'delete');

  // ── Password gate ──
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(GATE_KEY) === '1');
  const [passInput, setPassInput] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [gateError, setGateError] = useState(false);

  const tryUnlock = () => {
    if (passInput === GATE_PASSWORD) {
      sessionStorage.setItem(GATE_KEY, '1');
      setUnlocked(true);
    } else {
      setGateError(true);
      setPassInput('');
    }
  };

  // ── Accounts ──
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accountDialog, setAccountDialog] = useState(false);
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchAccounts = useCallback(async () => {
    if (!siteId || !unlocked) return;
    try {
      setLoading(true);
      const res = await api.get('/upi/accounts', { params: { site_id: siteId } });
      setAccounts(res.data.accounts || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, [siteId, unlocked]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const openAdd = () => { setAccountForm(EMPTY_ACCOUNT); setEditingId(null); setAccountDialog(true); };
  const openEdit = (a) => {
    setAccountForm({
      label: a.label, payee_name: a.payee_name, vpa: a.vpa,
      bank_name: a.bank_name || '', account_no: a.account_no || '', ifsc: a.ifsc || '',
    });
    setEditingId(a.id);
    setAccountDialog(true);
  };

  const saveAccount = async () => {
    if (!accountForm.label.trim() || !accountForm.payee_name.trim() || !accountForm.vpa.trim()) {
      toast.error('Label, payee name and VPA / UPI ID are required');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const res = await api.put(`/upi/accounts/${editingId}`, accountForm);
        setAccounts((prev) => prev.map((a) => (a.id === editingId ? res.data.account : a)));
        toast.success('Account updated');
      } else {
        const res = await api.post('/upi/accounts', { ...accountForm, site_id: siteId });
        setAccounts((prev) => [...prev, res.data.account]);
        toast.success('Account added');
      }
      setAccountDialog(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save account');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (a, checked) => {
    try {
      const res = await api.put(`/upi/accounts/${a.id}`, { is_active: checked });
      setAccounts((prev) => prev.map((x) => (x.id === a.id ? res.data.account : x)));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update account');
    }
  };

  const removeAccount = async (a) => {
    if (!window.confirm(`Delete "${a.label}"?`)) return;
    try {
      const res = await api.delete(`/upi/accounts/${a.id}`);
      if (res.data.deactivated) {
        toast.info(res.data.message);
        fetchAccounts();
      } else {
        setAccounts((prev) => prev.filter((x) => x.id !== a.id));
        toast.success('Account deleted');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete account');
    }
  };

  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Building2 className="w-10 h-10 text-slate-200 mb-3" />
        <p className="text-sm text-slate-500">Select a site first</p>
      </div>
    );
  }

  // ── Locked view ──
  if (!unlocked) {
    return (
      <div className="max-w-md mx-auto mt-16">
        <Card className="border-border/50 shadow-lg rounded-2xl overflow-hidden">
          <CardContent className="pt-10 pb-8 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-lg mb-4">
              <Lock className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Bank Configs</h2>
            <p className="text-xs text-slate-500 mt-1 mb-6">This section is protected. Enter the access password.</p>
            <div className="w-full space-y-3">
              <div className="relative">
                <Input
                  type={showPass ? 'text' : 'password'}
                  value={passInput}
                  autoFocus
                  placeholder="Access password"
                  className={`h-11 text-center tracking-widest pr-10 ${gateError ? 'border-red-400 focus-visible:ring-red-300' : ''}`}
                  onChange={(e) => { setPassInput(e.target.value); setGateError(false); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') tryUnlock(); }}
                />
                <button type="button" tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPass((s) => !s)}>
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {gateError && <p className="text-xs text-red-600">Wrong password</p>}
              <Button className="w-full h-11" onClick={tryUnlock} disabled={!passInput}>
                <KeyRound className="w-4 h-4 mr-2" /> Unlock
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Unlocked view ──
  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Landmark className="w-5 h-5 text-slate-600" /> Bank Configs
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
              <ShieldCheck className="w-3 h-3" /> Unlocked
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Bank accounts and payment addresses used by Receive Money</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-slate-400"
            onClick={() => { sessionStorage.removeItem(GATE_KEY); setUnlocked(false); setPassInput(''); }}>
            <Lock className="w-3.5 h-3.5 mr-1.5" /> Lock
          </Button>
          {canWrite && (
            <Button size="sm" onClick={openAdd}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Account
            </Button>
          )}
        </div>
      </div>

      <Card className="border-border/50 shadow-lg shadow-black/5 rounded-2xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/50 bg-gradient-to-r from-slate-50/80 to-transparent">
          <CardTitle className="text-sm font-semibold">Accounts ({accounts.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-5 space-y-3"><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></div>
          ) : accounts.length === 0 ? (
            <div className="py-10 text-center">
              <Landmark className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No bank accounts yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Add your account with its VPA / UPI ID (e.g. <span className="font-mono">yourname@sbi</span>)
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="text-xs pl-5">Label</TableHead>
                    <TableHead className="text-xs">Payee Name</TableHead>
                    <TableHead className="text-xs">VPA / UPI ID</TableHead>
                    <TableHead className="text-xs">Bank</TableHead>
                    <TableHead className="text-xs">Account No</TableHead>
                    <TableHead className="text-xs">IFSC</TableHead>
                    <TableHead className="text-xs text-center">Active</TableHead>
                    <TableHead className="text-xs text-right pr-5">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((a) => (
                    <TableRow key={a.id} className={`group ${!a.is_active ? 'opacity-50' : ''}`}>
                      <TableCell className="text-sm font-medium pl-5">{a.label}</TableCell>
                      <TableCell className="text-sm">{a.payee_name}</TableCell>
                      <TableCell>
                        <span className="text-xs font-mono text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-2 py-0.5">
                          {a.vpa}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">{a.bank_name || '—'}</TableCell>
                      <TableCell className="text-xs font-mono text-slate-500">{a.account_no || '—'}</TableCell>
                      <TableCell className="text-xs font-mono text-slate-500">{a.ifsc || '—'}</TableCell>
                      <TableCell className="text-center">
                        <Switch checked={a.is_active} disabled={!canUpdate}
                          onCheckedChange={(c) => toggleActive(a, c)} />
                      </TableCell>
                      <TableCell className="text-right pr-5">
                        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {canUpdate && (
                            <Button variant="ghost" size="sm" title="Edit"
                              className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                              onClick={() => openEdit(a)}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="ghost" size="sm" title="Delete"
                              className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => removeAccount(a)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit dialog */}
      <Dialog open={accountDialog} onOpenChange={setAccountDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Landmark className="w-4 h-4 text-slate-600" />
              {editingId ? 'Edit Bank Account' : 'Add Bank Account'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              The VPA / UPI ID is what the money is routed to — get it from your bank app or business UPI app.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Label *</Label>
              <Input value={accountForm.label} placeholder="e.g. Main SBI Current A/c"
                onChange={(e) => setAccountForm((f) => ({ ...f, label: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Payee Name *</Label>
                <Input value={accountForm.payee_name} placeholder="Shown in customer's UPI app"
                  onChange={(e) => setAccountForm((f) => ({ ...f, payee_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">VPA / UPI ID *</Label>
                <Input value={accountForm.vpa} placeholder="name@bank" className="font-mono"
                  onChange={(e) => setAccountForm((f) => ({ ...f, vpa: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Bank Name</Label>
                <Input value={accountForm.bank_name}
                  onChange={(e) => setAccountForm((f) => ({ ...f, bank_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">IFSC</Label>
                <Input value={accountForm.ifsc}
                  onChange={(e) => setAccountForm((f) => ({ ...f, ifsc: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Account Number <span className="text-slate-400">(reference only)</span></Label>
              <Input value={accountForm.account_no}
                onChange={(e) => setAccountForm((f) => ({ ...f, account_no: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setAccountDialog(false)}>Cancel</Button>
            <Button size="sm" onClick={saveAccount} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
              {editingId ? 'Save Changes' : 'Add Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BankConfigs;
