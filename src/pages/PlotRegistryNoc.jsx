import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Skeleton } from '../components/ui/skeleton';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from '../components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '../components/ui/tooltip';
import {
  ArrowLeft, BadgeCheck, Banknote, CalendarDays, FileCheck2, IndianRupee,
  Landmark, Loader2, MapPin, Plus, Printer, Save, ScrollText, Trash2, TriangleAlert, User,
  ShieldCheck,
} from 'lucide-react';
import { fmtINR, fmtDateIN, todayISO, amountInWordsINR, paymentModeOf, isBadCheque } from '../lib/nocUtils';
import BankAccountSelect from '../components/BankAccountSelect';

const MODE_OPTIONS = ['CASH', 'BANK', 'UPI', 'NEFT', 'RTGS', 'CHEQUE', 'TRANSFER'];

const MODE_STYLES = {
  CASH: 'bg-amber-50 text-amber-700 border-amber-200',
  BANK: 'bg-blue-50 text-blue-700 border-blue-200',
  CHEQUE: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  UPI: 'bg-teal-50 text-teal-700 border-teal-200',
  NEFT: 'bg-sky-50 text-sky-700 border-sky-200',
  RTGS: 'bg-sky-50 text-sky-700 border-sky-200',
  TRANSFER: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};
const modeBadgeCls = (mode) => MODE_STYLES[mode] || 'bg-slate-50 text-slate-600 border-slate-200';

const listVariants = { show: { transition: { staggerChildren: 0.045 } } };
const rowVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

const PlotRegistryNoc = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, currentSite, hasPermission, canManage, isAdmin } = useAuth();
  const canUpdate = canManage && hasPermission('plot_registry', 'update');
  const canDelete = canManage && hasPermission('plot_registry', 'delete');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [meta, setMeta] = useState({ noc_no: '', noc_date: todayISO(), noc_place: '', noc_notes: '' });
  const [selected, setSelected] = useState(() => new Set());
  const [inline, setInline] = useState([]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetForm, setSheetForm] = useState({ payment_date: todayISO(), amount: '', payment_mode: 'CASH', bank_account_id: '', notes: '' });

  const hydrate = useCallback((payload) => {
    setData(payload);
    const r = payload.registry || {};
    setMeta({
      noc_no: r.noc_no || payload.suggested_noc_no || '',
      noc_date: r.noc_date ? String(r.noc_date).split('T')[0] : todayISO(),
      noc_place: r.noc_place || payload.site?.city || '',
      noc_notes: r.noc_notes || '',
    });
    setSelected(new Set((payload.plotPayments || []).filter((p) => p.included).map((p) => p.id)));
    setInline(
      (payload.inlinePayments || []).map((p) => ({
        id: p.id,
        _key: `db-${p.id}`,
        payment_date: p.payment_date ? String(p.payment_date).split('T')[0] : todayISO(),
        amount: String(p.amount ?? ''),
        payment_mode: p.payment_mode || 'BANK',
        bank_account_id: p.bank_account_id ? String(p.bank_account_id) : '',
        notes: p.notes || '',
        include_in_noc: p.include_in_noc !== false,
      }))
    );
    setDirty(false);
  }, []);

  const fetchNoc = useCallback(async () => {
    setLoading(true);
    try {
      const { data: payload } = await api.get(`/registries/${id}/noc`);
      hydrate(payload);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load NOC data');
    } finally {
      setLoading(false);
    }
  }, [id, hydrate]);

  useEffect(() => { fetchNoc(); }, [fetchNoc]);

  const registry = data?.registry;
  const plot = data?.plot;
  const plotPayments = data?.plotPayments || [];
  const workflowUnlocked = Boolean(data?.workflow_unlocked);

  const includedInline = inline.filter((r) => r.include_in_noc && parseFloat(r.amount) > 0);
  const includedPlotRows = plotPayments.filter((p) => selected.has(p.id));
  const includedTotal =
    includedPlotRows.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) +
    includedInline.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const includedCount = includedPlotRows.length + includedInline.length;
  const registryPayment = parseFloat(registry?.registry_payment) || 0;
  const coveragePct = registryPayment > 0 ? Math.min((includedTotal / registryPayment) * 100, 100) : 0;

  const togglePlotPayment = (p) => {
    if (!canUpdate) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
      return next;
    });
    setDirty(true);
  };

  const toggleInline = (key) => {
    if (!canUpdate) return;
    setInline((rows) => rows.map((r) => (r._key === key ? { ...r, include_in_noc: !r.include_in_noc } : r)));
    setDirty(true);
  };

  const removeInline = async (row) => {
    if (row.id ? !canDelete : !canUpdate) return;
    if (row.id) {
      if (!window.confirm('Delete this manual payment permanently?')) return;
      const snapshot = inline;
      setInline((rows) => rows.filter((r) => r._key !== row._key));
      try {
        await api.delete(`/registries/payments/${row.id}`);
        toast.success('Manual payment deleted');
      } catch (err) {
        setInline(snapshot);
        toast.error(err.response?.data?.message || 'Delete failed');
      }
    } else {
      setInline((rows) => rows.filter((r) => r._key !== row._key));
      setDirty(true);
    }
  };

  const handleAddManual = () => {
    const amount = parseFloat(sheetForm.amount) || 0;
    if (amount <= 0) { toast.error('Enter a valid amount'); return; }
    if (sheetForm.payment_mode !== 'CASH' && !sheetForm.bank_account_id) {
      toast.error('Select the bank account used for this transaction');
      return;
    }
    setInline((rows) => [
      ...rows,
      { ...sheetForm, _key: `new-${Date.now()}`, include_in_noc: true },
    ]);
    setSheetForm({ payment_date: todayISO(), amount: '', payment_mode: 'CASH', bank_account_id: '', notes: '' });
    setSheetOpen(false);
    setDirty(true);
    toast.success('Manual payment added — remember to save');
  };

  const saveNoc = async ({ silent = false } = {}) => {
    if (!canUpdate) return true;
    setSaving(true);
    try {
      const payload = {
        ...meta,
        included_plot_payment_ids: [...selected],
        inline_payments: inline
          .filter((row) => parseFloat(row.amount) > 0)
          .map((row) => ({
            id: row.id,
            payment_date: row.payment_date,
            amount: row.amount,
            payment_mode: row.payment_mode,
            bank_account_id: row.bank_account_id || null,
            notes: row.notes,
            include_in_noc: row.include_in_noc,
          })),
      };
      const { data: fresh } = await api.put(`/registries/${id}/noc`, payload);
      hydrate(fresh);
      if (!silent) toast.success('NOC saved');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save NOC');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const [approving, setApproving] = useState(false);
  const approveNoc = async () => {
    // Save any pending edits first so what gets approved is what's on screen.
    if (dirty) { const ok = await saveNoc({ silent: true }); if (!ok) return; }
    setApproving(true);
    try {
      const { data: res } = await api.put(`/registries/${id}/noc/approve`);
      setData((d) => (d ? { ...d, registry: { ...d.registry, ...res.registry } } : d));
      toast.success(res.plot_status_updated
        ? 'NOC approved — plot status is now REGISTRY'
        : 'NOC approved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve NOC');
    } finally {
      setApproving(false);
    }
  };

  const handlePreview = async () => {
    if (dirty || !registry?.noc_generated_at) {
      const ok = await saveNoc({ silent: true });
      if (!ok) return;
    }
    navigate(`/plot-registry/${id}/noc/print`);
  };

  const setMetaField = (field, value) => { setMeta((m) => ({ ...m, [field]: value })); setDirty(true); };

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="max-w-350 space-y-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div className="space-y-2"><Skeleton className="h-5 w-56" /><Skeleton className="h-3 w-40" /></div>
        </div>
        <div className="grid xl:grid-cols-[1fr_360px] gap-5">
          <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!registry) {
    return (
      <div className="max-w-350 py-16 text-center space-y-3">
        <TriangleAlert className="w-8 h-8 text-amber-500 mx-auto" />
        <p className="text-sm text-slate-600">Registry not found or you don't have access.</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/plot-registry')}>Back to Plot Registry</Button>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="max-w-350 space-y-5 pb-10">
        {/* ── Header ── */}
        <Motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between flex-wrap gap-3"
        >
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/plot-registry/${id}`)} className="h-8 w-8 p-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold text-slate-900">NOC — Plot {registry.plot_no}</h1>
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-wider">
                  No Objection Certificate
                </span>
                {registry.noc_generated_at && (
                  <span className="text-[10px] text-slate-400">Last saved {fmtDateIN(registry.noc_generated_at)}</span>
                )}
                {workflowUnlocked && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700">
                    <ShieldCheck className="h-3 w-3" /> Workflow override
                  </span>
                )}
                {registry.noc_approved_at ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-green-100 text-green-700 uppercase tracking-wider">
                    <BadgeCheck className="w-3 h-3" /> Approved {fmtDateIN(registry.noc_approved_at)}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-100 text-amber-700 uppercase tracking-wider">
                    Pending approval
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                {registry.customer_name && <span className="font-medium text-slate-600">{registry.customer_name}</span>}
                {plot?.block && <span className="text-slate-400"> · Block {plot.block}</span>}
                {registry.registry_date && <span className="text-slate-400"> · Registry date {fmtDateIN(registry.registry_date)}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canUpdate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => saveNoc()}
                disabled={saving || (!dirty && Boolean(registry.noc_generated_at))}
                className="text-xs gap-1.5"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {!registry.noc_generated_at ? 'Generate NOC' : dirty ? 'Save changes' : 'Saved'}
              </Button>
            )}
            {isAdmin && !registry.noc_approved_at && (
              <Button size="sm" onClick={approveNoc} disabled={approving || saving || !registry.noc_generated_at}
                title={registry.noc_generated_at ? 'Approve this NOC — the plot becomes REGISTRY' : 'Save/generate the NOC first'}
                className="text-xs gap-1.5 bg-green-600 hover:bg-green-700">
                {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />}
                Approve NOC
              </Button>
            )}
            <Button size="sm" onClick={handlePreview} disabled={saving} className="text-xs gap-1.5 bg-emerald-700 hover:bg-emerald-800">
              <Printer className="w-3.5 h-3.5" /> Preview & Print NOC
            </Button>
          </div>
        </Motion.div>

        <div className="grid xl:grid-cols-[1fr_360px] gap-5 items-start">
          {/* ── LEFT: payments ── */}
          <div className="space-y-5 min-w-0">
            {/* Plot account payments timeline */}
            <Motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <Card className="shadow-none border-slate-200 overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                    <div className="flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-slate-500" />
                      <h2 className="text-sm font-semibold text-slate-800">Plot Account Payments</h2>
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-slate-500">{plotPayments.length}</Badge>
                    </div>
                    <span className="text-[11px] text-slate-400">Toggle to include on the NOC</span>
                  </div>

                  {!plot && (
                    <div className="px-4 py-8 text-center text-sm text-slate-500">
                      No plot record is linked to this registry — only manual payments can appear on the NOC.
                    </div>
                  )}
                  {plot && plotPayments.length === 0 && (
                    <div className="px-4 py-8 text-center text-sm text-slate-500">No payments recorded on this plot yet.</div>
                  )}

                  {plotPayments.length > 0 && (
                    <Motion.ul variants={listVariants} initial="hidden" animate="show" className="relative">
                      {/* timeline rail */}
                      <Motion.span
                        initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.6, ease: 'easeOut' }}
                        className="absolute left-[27px] top-4 bottom-4 w-px bg-slate-200 origin-top"
                      />
                      {plotPayments.map((p) => {
                        const on = selected.has(p.id);
                        const mode = paymentModeOf(p);
                        const bad = isBadCheque(p);
                        const foreignLink = p.linked_registry_id && String(p.linked_registry_id) !== String(id);
                        const disabled = !canUpdate || bad || foreignLink;
                        return (
                          <Motion.li
                            key={p.id} variants={rowVariants} layout
                            className={`relative flex items-center gap-3 pl-4 pr-4 py-3 border-b border-slate-50 last:border-0 transition-colors duration-300 ${on ? 'bg-emerald-50/50' : 'bg-white hover:bg-slate-50/60'}`}
                          >
                            {/* node */}
                            <Motion.span
                              layout animate={{ scale: on ? 1 : 0.8 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                              className={`relative z-10 flex items-center justify-center w-6 h-6 rounded-full border-2 shrink-0 transition-colors duration-300 ${
                                bad ? 'border-red-300 bg-red-50' : on ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-white'
                              }`}
                            >
                              {on && !bad && <BadgeCheck className="w-3.5 h-3.5 text-white" />}
                              {bad && <TriangleAlert className="w-3 h-3 text-red-500" />}
                            </Motion.span>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-slate-700 tabular-nums">{fmtDateIN(p.date)}</span>
                                <Badge variant="outline" className={`text-[9px] h-4 px-1.5 uppercase tracking-wide ${modeBadgeCls(mode)}`}>{mode}</Badge>
                                {bad && <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-red-50 text-red-600 border-red-200 uppercase">{p.cheque_status}</Badge>}
                                {foreignLink && (
                                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-amber-50 text-amber-700 border-amber-200">Linked to another registry</Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                {[p.narration, p.bank_name, p.received_by ? `Received by ${p.received_by}` : ''].filter(Boolean).join(' · ') || '—'}
                              </p>
                            </div>

                            <span className={`text-sm font-semibold tabular-nums shrink-0 ${bad ? 'text-red-500 line-through' : on ? 'text-emerald-700' : 'text-slate-700'}`}>
                              ₹{fmtINR(p.amount)}
                            </span>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="shrink-0">
                                  <Switch checked={on && !bad} disabled={disabled} onCheckedChange={() => togglePlotPayment(p)} className="data-[state=checked]:bg-emerald-600" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="text-xs">
                                {bad ? 'Bounced/returned cheque — cannot appear on the NOC'
                                  : foreignLink ? 'Already assigned to a different registry'
                                  : !canUpdate ? 'You need update permission'
                                  : on ? 'Included on NOC' : 'Excluded from NOC'}
                              </TooltipContent>
                            </Tooltip>
                          </Motion.li>
                        );
                      })}
                    </Motion.ul>
                  )}
                </CardContent>
              </Card>
            </Motion.div>

            {/* Manual / NOC-only payments */}
            <Motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
              <Card className="shadow-none border-slate-200 overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                    <div className="flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-slate-500" />
                      <h2 className="text-sm font-semibold text-slate-800">Manual Payments</h2>
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-slate-500">{inline.length}</Badge>
                      <span className="text-[10px] text-slate-400 hidden sm:inline">NOC-only — never touches the plot account</span>
                    </div>
                    {canUpdate && (
                      <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)} className="h-7 text-xs gap-1">
                        <Plus className="w-3.5 h-3.5" /> Add manual payment
                      </Button>
                    )}
                  </div>

                  {inline.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-slate-400">
                      No manual payments. Use “Add manual payment” for amounts that should appear only on the NOC.
                    </div>
                  ) : (
                    <ul>
                      <AnimatePresence initial={false}>
                        {inline.map((r) => {
                          const on = r.include_in_noc;
                          return (
                            <Motion.li
                              key={r._key} layout
                              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                              className={`flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0 transition-colors duration-300 ${on ? 'bg-emerald-50/40' : 'bg-white'}`}
                            >
                              <span className={`w-2 h-2 rounded-full shrink-0 transition-colors ${on ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-semibold text-slate-700 tabular-nums">{fmtDateIN(r.payment_date)}</span>
                                  <Badge variant="outline" className={`text-[9px] h-4 px-1.5 uppercase ${modeBadgeCls(r.payment_mode)}`}>{r.payment_mode}</Badge>
                                  {!r.id && <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-blue-50 text-blue-600 border-blue-200">Unsaved</Badge>}
                                </div>
                                {r.notes && <p className="text-[11px] text-slate-500 truncate mt-0.5">{r.notes}</p>}
                              </div>
                              <span className={`text-sm font-semibold tabular-nums shrink-0 ${on ? 'text-emerald-700' : 'text-slate-600'}`}>₹{fmtINR(r.amount)}</span>
                              <Switch checked={on} disabled={!canUpdate} onCheckedChange={() => toggleInline(r._key)} className="data-[state=checked]:bg-emerald-600" />
                              {(r.id ? canDelete : canUpdate) && (
                                <Button variant="ghost" size="sm" onClick={() => removeInline(r)} className="h-7 w-7 p-0 text-slate-300 hover:text-red-600">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </Motion.li>
                          );
                        })}
                      </AnimatePresence>
                    </ul>
                  )}
                </CardContent>
              </Card>
            </Motion.div>
          </div>

          {/* ── RIGHT: certificate details + summary ── */}
          <div className="space-y-5 xl:sticky xl:top-4">
            <Motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
              <Card className="shadow-none border-slate-200">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <ScrollText className="w-4 h-4 text-slate-500" />
                    <h2 className="text-sm font-semibold text-slate-800">Certificate Details</h2>
                  </div>
                  <div className="space-y-2.5">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-500">NOC Number</Label>
                      <Input value={meta.noc_no} onChange={(e) => setMetaField('noc_no', e.target.value)} disabled={!canUpdate} className="h-8 text-xs font-medium" />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-slate-500 flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Date</Label>
                        <Input type="date" value={meta.noc_date} onChange={(e) => setMetaField('noc_date', e.target.value)} disabled={!canUpdate} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> Place</Label>
                        <Input value={meta.noc_place} onChange={(e) => setMetaField('noc_place', e.target.value)} disabled={!canUpdate} placeholder={currentSite?.city || 'City'} className="h-8 text-xs" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-500">Remarks on certificate (optional)</Label>
                      <Textarea value={meta.noc_notes} onChange={(e) => setMetaField('noc_notes', e.target.value)} disabled={!canUpdate} rows={2} className="text-xs resize-none" placeholder="e.g. Balance dues to be cleared before possession…" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Motion.div>

            <Motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
              <Card className="shadow-none border-emerald-200 bg-gradient-to-b from-emerald-50/70 to-white">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-emerald-600" />
                    <h2 className="text-sm font-semibold text-slate-800">NOC Summary</h2>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[11px] text-slate-500">Included payments</p>
                      <AnimatePresence mode="popLayout" initial={false}>
                        <Motion.p key={includedCount} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="text-lg font-semibold text-slate-900 tabular-nums">
                          {includedCount}
                        </Motion.p>
                      </AnimatePresence>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-slate-500 flex items-center justify-end gap-1"><IndianRupee className="w-3 h-3" /> Total on NOC</p>
                      <AnimatePresence mode="popLayout" initial={false}>
                        <Motion.p key={Math.round(includedTotal)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="text-xl font-bold text-emerald-700 tabular-nums">
                          ₹{fmtINR(includedTotal)}
                        </Motion.p>
                      </AnimatePresence>
                    </div>
                  </div>
                  <p className="text-[10px] leading-relaxed text-slate-500 italic border-l-2 border-emerald-200 pl-2">
                    {amountInWordsINR(includedTotal)}
                  </p>
                  {registryPayment > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>vs. registry payment ₹{fmtINR(registryPayment)}</span>
                        <span className="font-semibold tabular-nums">{coveragePct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <Motion.div
                          animate={{ width: `${coveragePct}%` }}
                          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                          className={`h-full rounded-full ${coveragePct >= 100 ? 'bg-emerald-500' : coveragePct >= 50 ? 'bg-amber-500' : 'bg-red-400'}`}
                        />
                      </div>
                    </div>
                  )}
                  {workflowUnlocked && coveragePct < 100 && (
                    <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] leading-relaxed text-blue-700">
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Workflow override is active. This NOC can be generated before the registry payment is fully covered.
                    </div>
                  )}
                  <Separator className="bg-emerald-100" />
                  <div className="space-y-1 text-[11px] text-slate-500">
                    <div className="flex items-center gap-1.5"><User className="w-3 h-3" /> Buyer: <span className="font-medium text-slate-700">{registry.customer_name || '—'}</span></div>
                    <div className="flex items-center gap-1.5"><Landmark className="w-3 h-3" /> Issued by: <span className="font-medium text-slate-700">{currentSite?.name || '—'}</span></div>
                    <div className="flex items-center gap-1.5"><User className="w-3 h-3" /> Signatory: <span className="font-medium text-slate-700">{user?.full_name || user?.name || '—'}</span></div>
                  </div>
                </CardContent>
              </Card>
            </Motion.div>
          </div>
        </div>

        {/* ── Manual payment sheet ── */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="right" className="w-full sm:max-w-md flex flex-col overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2"><Banknote className="w-4 h-4 text-emerald-600" /> Add Manual Payment</SheetTitle>
              <SheetDescription className="text-xs">
                This entry appears on the NOC only. It will <span className="font-semibold">not</span> be added to the plot account,
                daybook or payment tracker, and skips the approval flow.
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 py-5 flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">Date</Label>
                  <Input type="date" value={sheetForm.payment_date} onChange={(e) => setSheetForm((f) => ({ ...f, payment_date: e.target.value }))} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">Mode</Label>
                  <Select value={sheetForm.payment_mode} onValueChange={(v) => setSheetForm((f) => ({ ...f, payment_mode: v }))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MODE_OPTIONS.map((m) => <SelectItem key={m} value={m} className="text-sm">{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <BankAccountSelect
                value={sheetForm.bank_account_id}
                onChange={(bankAccountId) => setSheetForm((form) => ({ ...form, bank_account_id: bankAccountId }))}
                paymentMode={sheetForm.payment_mode}
              />
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">Amount (₹)</Label>
                <Input
                  type="number" min="0" inputMode="decimal" value={sheetForm.amount}
                  onChange={(e) => setSheetForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0" className="h-9 text-sm tabular-nums"
                />
                {parseFloat(sheetForm.amount) > 0 && (
                  <p className="text-[10px] text-slate-400 italic">{amountInWordsINR(sheetForm.amount)}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">Notes / particulars</Label>
                <Textarea rows={3} value={sheetForm.notes} onChange={(e) => setSheetForm((f) => ({ ...f, notes: e.target.value }))} placeholder="e.g. Old cash receipt no. 142" className="text-sm resize-none" />
              </div>
            </div>
            <SheetFooter>
              <Button onClick={handleAddManual} className="w-full bg-emerald-700 hover:bg-emerald-800 gap-1.5">
                <Plus className="w-4 h-4" /> Add to NOC
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
};

export default PlotRegistryNoc;
