import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Building2, CalendarCheck2, CheckCircle2, Edit2, Eye, Landmark, Loader2, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';
import { Switch } from '../components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { money } from '../lib/utils';

const EMPTY_ACCOUNT = {
  label: '', bank_name: '', account_no: '', ifsc: '', account_type: 'CURRENT',
  payee_name: '', vpa: '', notes: '', is_active: true,
};

export default function BankConfigs() {
  const navigate = useNavigate();
  const { currentSite, hasPermission } = useAuth();
  const siteId = currentSite?.id;
  const canWrite = hasPermission('plot_payments', 'write');
  const canUpdate = hasPermission('plot_payments', 'update');
  const canDelete = hasPermission('plot_payments', 'delete');
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_ACCOUNT);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const { data } = await api.get('/bank-accounts', { params: { site_id: siteId } });
      setAccounts(data.accounts || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Bank accounts could not be loaded');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => accounts.reduce((summary, account) => ({
    active: summary.active + (account.is_active ? 1 : 0),
    transactions: summary.transactions + Number(account.transaction_count || 0),
    balance: summary.balance + Number(account.ledger_balance || 0),
    closed: summary.closed + (account.reconciliation_status === 'CLOSED' ? 1 : 0),
    exceptions: summary.exceptions + Number(account.exception_lines || 0),
  }), { active: 0, transactions: 0, balance: 0, closed: 0, exceptions: 0 }), [accounts]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return accounts;
    return accounts.filter((account) => [account.label, account.bank_name, account.masked_account_no, account.ifsc]
      .some((value) => String(value || '').toLowerCase().includes(normalized)));
  }, [accounts, query]);

  const openCreate = () => { setEditingId(null); setForm(EMPTY_ACCOUNT); setDialogOpen(true); };
  const openEdit = (account) => {
    setEditingId(account.id);
    setForm({
      label: account.label || '', bank_name: account.bank_name || '', account_no: account.account_no || '',
      ifsc: account.ifsc || '', account_type: account.account_type || 'CURRENT', payee_name: account.payee_name || '',
      vpa: account.vpa || '', notes: account.notes || '', is_active: account.is_active !== false,
    });
    setDialogOpen(true);
  };
  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!form.label.trim() || !form.bank_name.trim()) return toast.error('Account label and bank name are required');
    setSaving(true);
    try {
      const payload = { ...form };
      if (editingId && !payload.account_no.trim()) delete payload.account_no;
      if (editingId) await api.put(`/bank-accounts/${editingId}`, payload);
      else await api.post('/bank-accounts', { ...payload, site_id: siteId });
      toast.success(editingId ? 'Bank account updated' : 'Bank account created');
      window.dispatchEvent(new Event('bank-accounts:changed'));
      setDialogOpen(false);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Bank account could not be saved');
    } finally { setSaving(false); }
  };

  const toggle = async (account, isActive) => {
    try {
      await api.put(`/bank-accounts/${account.id}`, { is_active: isActive });
      setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, is_active: isActive } : item));
      window.dispatchEvent(new Event('bank-accounts:changed'));
    } catch (error) { toast.error(error.response?.data?.message || 'Account status could not be changed'); }
  };

  const remove = async (account) => {
    if (!window.confirm(`Remove ${account.bank_name || account.label}?`)) return;
    try {
      const { data } = await api.delete(`/bank-accounts/${account.id}`);
      toast.success(data.message || 'Bank account removed');
      window.dispatchEvent(new Event('bank-accounts:changed'));
      await load();
    } catch (error) { toast.error(error.response?.data?.message || 'Bank account could not be removed'); }
  };

  if (!currentSite) return <div className="flex min-h-72 flex-col items-center justify-center text-center"><Building2 className="h-9 w-9 text-mr-faint" /><p className="mt-3 text-sm text-mr-muted">Select a Site to manage its bank accounts.</p></div>;

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-10">
      <header className="rounded-panel bg-mr-ink p-5 text-white sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div><span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10"><Landmark className="h-5 w-5" /></span><p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-mr-lime">Treasury controls</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.045em]">Banking & Reconciliation</h1><p className="mt-2 max-w-2xl text-sm text-zinc-300">One bank register for transactions posted from every module, statement matching, exception review and month-end close.</p></div>
          {canWrite ? <Button onClick={openCreate} className="rounded-full bg-mr-lime-ink text-white hover:brightness-110"><Plus className="mr-2 h-4 w-4" /> Add account</Button> : null}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-4">{[['Active accounts', totals.active], ['Mapped transactions', totals.transactions], ['Combined balance', money(totals.balance)], ['Open exceptions', totals.exceptions]].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur"><p className="text-[10px] uppercase tracking-wider text-zinc-400">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>)}</div>
      </header>

      <section className="overflow-hidden rounded-panel border border-mr-line bg-mr-surface">
        <div className="flex flex-col gap-3 border-b border-mr-line p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-base font-semibold text-mr-text">Configured accounts</h2><p className="text-xs text-mr-muted">Select a row to open its ledger.</p></div><div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mr-faint" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search bank or account" className="h-10 rounded-full border-mr-line pl-9" /></div></div>
        {loading ? <div className="space-y-3 p-5"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : filtered.length === 0 ? <div className="py-16 text-center"><Landmark className="mx-auto h-9 w-9 text-mr-faint" /><p className="mt-3 text-sm font-medium text-mr-text">No bank accounts found</p><p className="mt-1 text-xs text-mr-muted">Add ICICI, Axis, SBI, or any other operating account.</p></div> : (
          <div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-mr-surface-2"><TableHead>Account</TableHead><TableHead>Type</TableHead><TableHead>IFSC</TableHead><TableHead className="text-right">Transactions</TableHead><TableHead className="text-right">Ledger balance</TableHead><TableHead>Latest reconciliation</TableHead><TableHead className="text-center">Active</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{filtered.map((account) => {
            const statementLines = Number(account.statement_lines || 0);
            const matchedLines = Number(account.matched_lines || 0);
            const progress = statementLines ? Math.round((matchedLines / statementLines) * 100) : 0;
            return <TableRow key={account.id} className="cursor-pointer" onClick={() => navigate(`/bank-configs/${account.id}`)}><TableCell><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mr-surface-2"><Landmark className="h-4 w-4 text-mr-muted" /></span><div><p className="font-semibold text-mr-text">{account.bank_name || account.label}</p><p className="text-xs text-mr-muted">{account.label}{account.masked_account_no ? ` · ${account.masked_account_no}` : ''}</p></div></div></TableCell><TableCell><Badge variant="outline" className="rounded-full border-mr-line">{account.account_type || 'BANK'}</Badge></TableCell><TableCell className="font-mono text-xs text-mr-muted">{account.ifsc || '—'}</TableCell><TableCell className="text-right tabular-nums">{account.transaction_count || 0}</TableCell><TableCell className={`text-right font-semibold tabular-nums ${Number(account.ledger_balance) < 0 ? 'text-mr-coral-ink' : 'text-mr-lime-ink'}`}>{money(account.ledger_balance)}</TableCell><TableCell className="min-w-48">{account.reconciliation_id ? <div><div className="flex items-center gap-2">{account.reconciliation_status === 'CLOSED' ? <CalendarCheck2 className="h-3.5 w-3.5 text-emerald-600" /> : Number(account.exception_lines) ? <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> : <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />}<span className="text-xs font-medium text-mr-text">{String(account.statement_month).slice(0, 7)} · {account.reconciliation_status === 'CLOSED' ? 'Closed' : `${account.exception_lines || 0} exceptions`}</span></div><Progress value={progress} className="mt-2 h-1.5 bg-slate-100 [&>div]:bg-emerald-500" /></div> : <span className="text-xs text-mr-muted">No statement imported</span>}</TableCell><TableCell className="text-center" onClick={(event) => event.stopPropagation()}><Switch checked={account.is_active} disabled={!canUpdate} onCheckedChange={(checked) => toggle(account, checked)} /></TableCell><TableCell onClick={(event) => event.stopPropagation()}><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => navigate(`/bank-configs/${account.id}`)} title="Open workspace"><Eye className="h-4 w-4" /></Button>{canUpdate ? <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => openEdit(account)} title="Edit"><Edit2 className="h-4 w-4" /></Button> : null}{canDelete ? <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-mr-coral-ink" onClick={() => remove(account)} title="Delete"><Trash2 className="h-4 w-4" /></Button> : null}</div></TableCell></TableRow>;
          })}</TableBody></Table></div>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{editingId ? 'Edit bank account' : 'Create bank account'}</DialogTitle><DialogDescription>Account details are Site-scoped. VPA is optional unless this account receives UPI QR payments.</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><div className="space-y-1.5"><Label>Account label *</Label><Input value={form.label} onChange={(event) => setField('label', event.target.value)} placeholder="Collections account" /></div><div className="space-y-1.5"><Label>Bank name *</Label><Input value={form.bank_name} onChange={(event) => setField('bank_name', event.target.value)} placeholder="ICICI / AXIS" /></div><div className="space-y-1.5"><Label>Account number</Label><Input value={form.account_no} onChange={(event) => setField('account_no', event.target.value)} inputMode="numeric" placeholder={editingId ? 'Leave blank to keep existing' : ''} /></div><div className="space-y-1.5"><Label>Account type</Label><Input value={form.account_type} onChange={(event) => setField('account_type', event.target.value)} placeholder="CURRENT" /></div><div className="space-y-1.5"><Label>IFSC</Label><Input value={form.ifsc} onChange={(event) => setField('ifsc', event.target.value.toUpperCase())} placeholder="ICIC0001234" /></div><div className="space-y-1.5"><Label>UPI ID / VPA</Label><Input value={form.vpa} onChange={(event) => setField('vpa', event.target.value)} placeholder="business@icici" /></div><div className="space-y-1.5 sm:col-span-2"><Label>Payee name</Label><Input value={form.payee_name} onChange={(event) => setField('payee_name', event.target.value)} placeholder="Name shown to payer" /></div><div className="space-y-1.5 sm:col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={(event) => setField('notes', event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}{editingId ? 'Save changes' : 'Create account'}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
