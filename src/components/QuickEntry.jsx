import { useState } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, ChevronLeft, Loader2, Eye,
  Calendar, Banknote, Landmark, FileText, User, MapPin,
  NotebookPen, Tag, Users, MessageSquare, ArrowLeftRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from './ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import CreditDebitTabs from './CreditDebitTabs';
import {
  EntryRow, EntryField, FieldLabel, getParticularsForMode,
  EntryPersonPicker, useEntryPersonOptions, mapPersonToPayload,
} from './EntryModal';
import VoucherUpload from './VoucherUpload';
import { MAC_APP_ICONS } from './macAppIcons';
import { cn } from '@/lib/utils';

const MODE_META = {
  CASH: { icon: Banknote, label: 'Cash', solid: 'bg-emerald-600', tint: 'bg-emerald-100 text-emerald-600' },
  BANK: { icon: Landmark, label: 'Bank', solid: 'bg-blue-600', tint: 'bg-blue-100 text-blue-600' },
  CHEQUE: { icon: FileText, label: 'Cheque', solid: 'bg-indigo-600', tint: 'bg-indigo-100 text-indigo-600' },
};

const INPUT_ROUNDED = 'rounded-xl h-10';

/**
 * Dashboard quick entry — record a Credit or Debit into any money module
 * without leaving the dashboard. Pick a module, get its minimal fields,
 * submit to the module's own create endpoint (payloads mirror each module
 * page exactly; nothing new server-side).
 */

const todayISO = () => new Date().toISOString().split('T')[0];

const MODULES = [
  { key: 'farmer', label: 'Farmer Payment', appKey: 'farmers', perm: 'farmers' },
  { key: 'cashflow', label: 'Personal Ledger', appKey: 'cashflow', perm: 'cashflow' },
  { key: 'vendor', label: 'Vendor Payment', appKey: 'vendors', perm: 'vendors', directions: ['debit'] },
  { key: 'expense', label: 'Expense', appKey: 'expenses', perm: 'expenses' },
  { key: 'daybook', label: 'Day Book', appKey: 'daybook', perm: 'daybook' },
  { key: 'plot', label: 'Plot Payment', appKey: 'plot_payments', perm: 'plot_payments' },
  { key: 'plot_commission', label: 'Plot Commission', appKey: 'plot_commission', perm: 'commissions' },
];

const blankForm = () => ({
  date: todayISO(),
  mode: 'CASH',
  particular: 'CASH',
  amount: '',
  remarks: '',
  cheque_no: '',
  farmer_id: '',
  month_id: '',
  vendor_commitment_id: '',
  plot_id: '',
  description: '',
  from_entity: '',
  to_entity: '',
  category: '',
  commission_plot_id: '',
  commission_id: '',
  reference_no: '',
  voucher_url: '',
});

export default function QuickEntry() {
  const { currentSite, hasPermission } = useAuth();
  const siteId = currentSite?.id;

  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState('credit');
  const [moduleKey, setModuleKey] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState(null); // {type:'success'|'error', text}
  const [options, setOptions] = useState({ farmers: null, months: null, vendorCommitments: null, categories: null, plots: null, plotCommissions: null });
  const [loadingOpts, setLoadingOpts] = useState(false);
  const [mappedPerson, setMappedPerson] = useState(null);
  const [commissionAgents, setCommissionAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [voucherUploading, setVoucherUploading] = useState(false);
  const { approvers: personApprovers, members: personMembers, addMember: addPersonMember } = useEntryPersonOptions(siteId);

  const visibleModules = MODULES.filter((m) =>
    hasPermission(m.perm, 'write') && (!m.directions || m.directions.includes(direction))
  );
  const setF = (patch) => setForm((f) => ({ ...f, ...patch }));

  const openWith = (dir) => {
    setDirection(dir);
    setModuleKey(null);
    setForm(blankForm());
    setBanner(null);
    setMappedPerson(null);
    setCommissionAgents([]);
    setVoucherUploading(false);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setModuleKey(null);
    setBanner(null);
    setSubmitting(false);
    setMappedPerson(null);
    setCommissionAgents([]);
    setVoucherUploading(false);
  };

  const pickModule = async (key) => {
    setModuleKey(key);
    setForm(blankForm());
    setBanner(null);
    setMappedPerson(null);
    setCommissionAgents([]);
    const need =
      key === 'farmer' ? 'farmers'
      : key === 'cashflow' ? 'months'
      : key === 'vendor' ? 'vendorCommitments'
      : key === 'expense' ? 'categories'
      : key === 'plot' ? 'plots'
      : key === 'plot_commission' ? 'plotCommissions'
      : null;
    if (!need || options[need] !== null) return;
    setLoadingOpts(true);
    try {
      if (need === 'farmers') {
        const res = await api.get(`/farmers?site_id=${siteId}`);
        const list = res.data?.farmers || (Array.isArray(res.data) ? res.data : []);
        setOptions((o) => ({ ...o, farmers: list }));
      } else if (need === 'months') {
        const res = await api.get(`/cashflow/months?site_id=${siteId}`);
        const list = (res.data?.months || (Array.isArray(res.data) ? res.data : []))
          .filter((m) => !m.is_locked && m.ledger_type === 'person');
        setOptions((o) => ({ ...o, months: list }));
      } else if (need === 'vendorCommitments') {
        const res = await api.get('/vendors/commitments', { params: { site_id: siteId, limit: 100 } });
        setOptions((o) => ({ ...o, vendorCommitments: res.data?.commitments || [] }));
      } else if (need === 'categories') {
        const res = await api.get('/expense-categories');
        setOptions((o) => ({ ...o, categories: (res.data?.categories || []).map((c) => c.name).filter(Boolean) }));
      } else if (need === 'plots') {
        const res = await api.get(`/plots?site_id=${siteId}`);
        setOptions((o) => ({ ...o, plots: res.data?.plots || [] }));
      } else if (need === 'plotCommissions') {
        const res = await api.get(`/plot-commission/list?site_id=${siteId}`);
        // Normalize plot_id → id so the generic entitySelect helper (which
        // always keys options by `.id`) works without special-casing.
        const list = (res.data?.commissions || []).map((c) => ({ ...c, id: c.plot_id }));
        setOptions((o) => ({ ...o, plotCommissions: list }));
      }
    } catch {
      setBanner({ type: 'error', text: 'Failed to load options — check connection and try again.' });
    } finally {
      setLoadingOpts(false);
    }
  };

  /** Plot Commission: a plot may have more than one agent over time (reassignment,
   * resale). Picking a plot loads its agents and defaults to the latest one —
   * also mirroring the payment into that agent's own Personal Ledger, since the
   * agent record IS a client/member (agent_id === members.id) already. */
  const handleCommissionPlotSelected = async (plotId) => {
    setF({ commission_id: '' });
    setMappedPerson(null);
    setCommissionAgents([]);
    if (!plotId) return;
    setLoadingAgents(true);
    try {
      const res = await api.get(`/plot-commission/plot/${plotId}?site_id=${siteId}`);
      const agents = res.data?.agents || [];
      setCommissionAgents(agents);
      const latest = agents[agents.length - 1]; // API returns oldest → newest
      if (latest) {
        setF({ commission_id: String(latest.commission_id) });
        setMappedPerson({ type: 'member', id: latest.agent_id });
      }
    } catch {
      setBanner({ type: 'error', text: 'Failed to load agents for this plot.' });
    } finally {
      setLoadingAgents(false);
    }
  };

  const handleCommissionAgentSelected = (commissionId) => {
    setF({ commission_id: commissionId });
    const agent = commissionAgents.find((a) => String(a.commission_id) === String(commissionId));
    setMappedPerson(agent ? { type: 'member', id: agent.agent_id } : null);
  };

  const changeMode = (m) => {
    setF({ mode: m, particular: getParticularsForMode(m)[0], ...(m !== 'CHEQUE' ? { cheque_no: '' } : {}) });
  };

  const changeDirection = (nextDirection) => {
    setDirection(nextDirection);
    // Vendor payments are always money paid out. Returning to module selection
    // prevents a credit entry from being silently recorded as a vendor payment.
    if (moduleKey === 'vendor' && nextDirection !== 'debit') {
      setModuleKey(null);
      setForm(blankForm());
      setMappedPerson(null);
    }
  };

  const amt = Math.abs(parseFloat(form.amount)) || 0;
  const isCheque = form.mode === 'CHEQUE';
  const debitCredit = { debit: direction === 'debit' ? amt : 0, credit: direction === 'credit' ? amt : 0 };

  const canSubmit = (() => {
    if (amt <= 0) return false;
    if (moduleKey === 'farmer') return !!form.farmer_id && !!form.particular && (!isCheque || !!form.cheque_no.trim());
    if (moduleKey === 'cashflow') return !!form.month_id && !!form.particular;
    if (moduleKey === 'vendor') return direction === 'debit' && !!form.vendor_commitment_id;
    if (moduleKey === 'expense') return true;
    if (moduleKey === 'daybook') return !!form.description.trim();
    if (moduleKey === 'plot') return !!form.plot_id;
    if (moduleKey === 'plot_commission') return !!form.commission_id;
    return false;
  })();

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    if (voucherUploading) {
      setBanner({ type: 'error', text: 'Please wait for the evidence photo to finish uploading.' });
      return;
    }
    setSubmitting(true);
    setBanner(null);
    try {
      if (moduleKey === 'farmer') {
        const signed = direction === 'debit' ? -amt : amt;
        await api.post(`/farmers/${form.farmer_id}/payments`, {
          date: form.date,
          particular: form.particular,
          payment_mode: form.mode,
          amount: signed,
          cheque_no: isCheque ? form.cheque_no.trim() : undefined,
          remarks: form.remarks.trim() || null,
          voucher_url: form.voucher_url || null,
          ...mapPersonToPayload(mappedPerson),
        });
      } else if (moduleKey === 'cashflow') {
        await api.post('/cashflow/entries', {
          cash_flow_month_id: parseInt(form.month_id, 10),
          particular: form.particular,
          ...debitCredit,
          date: form.date,
          cash_type: form.mode.toLowerCase(),
          cheque_no: isCheque ? form.cheque_no.trim() || null : null,
          remarks: form.remarks.trim() || null,
          voucher_url: form.voucher_url || null,
        });
      } else if (moduleKey === 'vendor') {
        await api.post(`/vendors/commitments/${form.vendor_commitment_id}/payments`, {
          site_id: siteId,
          payment_date: form.date,
          amount: amt,
          payment_mode: form.mode.toLowerCase(),
          reference_no: form.reference_no.trim() || (isCheque ? form.cheque_no.trim() : null),
          cheque_no: isCheque ? (form.reference_no.trim() || form.cheque_no.trim() || null) : null,
          note: form.description.trim() || form.remarks.trim() || null,
          voucher_url: form.voucher_url || null,
          ...mapPersonToPayload(mappedPerson),
        });
      } else if (moduleKey === 'expense') {
        await api.post('/expenses', {
          site_id: siteId,
          date: form.date,
          from_entity: form.from_entity.trim(),
          to_entity: form.to_entity.trim(),
          payment_mode: form.particular,
          cheque_no: isCheque ? form.cheque_no.trim() || null : null,
          ...debitCredit,
          remark: form.remarks.trim(),
          category: form.category.trim(),
          voucher_url: form.voucher_url || null,
          ...mapPersonToPayload(mappedPerson),
        });
      } else if (moduleKey === 'daybook') {
        await api.post('/daybook', {
          site_id: siteId,
          date: form.date,
          particular: form.description.trim(),
          entry_type: 'GENERAL',
          ...debitCredit,
          payment_mode: form.particular,
          remarks: form.remarks.trim(),
          from_entity: form.from_entity.trim() || null,
          to_entity: form.to_entity.trim() || null,
          category: form.category.trim() || null,
          voucher_url: form.voucher_url || null,
          ...mapPersonToPayload(mappedPerson),
        });
      } else if (moduleKey === 'plot') {
        const signed = direction === 'debit' ? -amt : amt;
        await api.post('/plots/payments', {
          plot_id: parseInt(form.plot_id, 10),
          date: form.date,
          payment_from: form.particular,
          payment_type: form.mode,
          amount: signed,
          cheque_no: isCheque ? form.cheque_no.trim() || null : null,
          narration: form.remarks.trim() || null,
          voucher_url: form.voucher_url || null,
          ...mapPersonToPayload(mappedPerson),
        });
      } else if (moduleKey === 'plot_commission') {
        // This endpoint has no direction field — sign of amount encodes it:
        // positive = "Pay" (money out to the agent, our Debit), negative =
        // "Get Money" / recovery (our Credit). Mirrors PlotCommissionDetail.jsx.
        await api.post('/plot-commission/payment', {
          master_id: parseInt(form.commission_id, 10),
          date: form.date,
          amount: direction === 'debit' ? amt : -amt,
          payment_mode: form.mode,
          cheque_no: isCheque ? form.cheque_no.trim() || null : null,
          remarks: form.remarks.trim() || null,
          voucher_url: form.voucher_url || null,
          ...mapPersonToPayload(mappedPerson),
        });
      }
      close();
    } catch (err) {
      setBanner({ type: 'error', text: err.response?.data?.message || 'Failed to record entry.' });
    } finally {
      setSubmitting(false);
    }
  };

  const mod = MODULES.find((m) => m.key === moduleKey);
  const ModIcon = mod ? MAC_APP_ICONS[mod.appKey] : null;

  const entitySelect = (label, listKey, idField, toOption, icon, color, onSelect, placeholderText) => {
    const opts = (options[listKey] || []).map((it) => ({ value: String(it.id), ...toOption(it) }));
    return (
      <EntryField label={<FieldLabel icon={icon} color={color}>{label}</FieldLabel>} required>
        {loadingOpts && options[listKey] === null ? (
          <div className={cn(INPUT_ROUNDED, 'border border-slate-200 bg-slate-50 flex items-center px-3 text-sm text-slate-400 gap-2')}>
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
          </div>
        ) : (
          <Select value={form[idField] || undefined} onValueChange={(v) => { setF({ [idField]: v }); onSelect?.(v); }}>
            <SelectTrigger className={INPUT_ROUNDED}>
              <SelectValue placeholder={placeholderText || `Select ${label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {opts.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                  {o.sublabel ? <span className="text-slate-400"> · {o.sublabel}</span> : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </EntryField>
    );
  };

  /** Plot Payment: a plot already has a buyer identity, so picking a plot tries to
   * auto-map the transaction to that buyer if they exist as a client/member. */
  const handlePlotSelected = (plotId) => {
    const plot = (options.plots || []).find((p) => String(p.id) === String(plotId));
    const buyerName = plot?.buyer_name?.trim().toUpperCase();
    const match = buyerName ? personMembers.find((m) => (m.full_name || '').trim().toUpperCase() === buyerName) : null;
    setMappedPerson(match ? { type: 'member', id: match.id } : null);
  };

  const isCredit = direction === 'credit';

  return (
    <>
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={() => openWith('credit')}
          disabled={!siteId}
          title={siteId ? 'Record money received' : 'Select a site first'}
          className="group flex items-center gap-2 pl-2.5 pr-4 h-10 rounded-full bg-linear-to-br from-emerald-500 to-emerald-600 text-white text-sm font-semibold shadow-sm shadow-emerald-500/25 ring-1 ring-inset ring-white/15 hover:shadow-md hover:shadow-emerald-500/30 hover:-translate-y-px active:translate-y-0 transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 transition-transform group-hover:scale-105">
            <ArrowDownLeft className="w-3.5 h-3.5" />
          </span>
          Credit
        </button>
        <button
          type="button"
          onClick={() => openWith('debit')}
          disabled={!siteId}
          title={siteId ? 'Record money paid out' : 'Select a site first'}
          className="group flex items-center gap-2 pl-2.5 pr-4 h-10 rounded-full bg-linear-to-br from-red-500 to-red-600 text-white text-sm font-semibold shadow-sm shadow-red-500/25 ring-1 ring-inset ring-white/15 hover:shadow-md hover:shadow-red-500/30 hover:-translate-y-px active:translate-y-0 transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 transition-transform group-hover:scale-105">
            <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
          Debit
        </button>
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
        <DialogContent className="sm:max-w-5xl max-h-[96vh] gap-0 p-0 flex flex-col overflow-hidden rounded-3xl border-slate-200/90 bg-white shadow-2xl shadow-slate-900/10">
          <div className="shrink-0 flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-5 py-3 sm:px-6">
            <div className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-sm',
              isCredit ? 'bg-emerald-600 shadow-emerald-600/25' : 'bg-red-600 shadow-red-600/25'
            )}>
              {isCredit ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold text-slate-900">
                {isCredit ? 'Record a Receipt' : 'Record a Payment'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5 truncate">
                {mod ? `${mod.label} · complete the details below` : 'Choose where to record this entry'}
              </DialogDescription>
            </div>
            {mod && (
              <button
                type="button"
                onClick={() => { setModuleKey(null); setBanner(null); }}
                className="shrink-0 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                {ModIcon ? <ModIcon className="w-4 h-4 rounded-[3px]" /> : null}
                Change module
              </button>
            )}
            <span className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white',
              isCredit ? 'bg-emerald-600' : 'bg-red-600'
            )}>
              {isCredit ? 'Credit · In' : 'Debit · Out'}
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3 sm:px-6 md:overflow-visible">
            {banner && (
              <div className={cn(
                'rounded-2xl border px-3.5 py-2.5 text-sm',
                banner.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              )}>
                {banner.text}
              </div>
            )}

            {!mod ? (
              visibleModules.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">You don&apos;t have write access to any money module.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {visibleModules.map((m) => {
                    const Icon = MAC_APP_ICONS[m.appKey];
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => pickModule(m.key)}
                        className={cn(
                          'group flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm shadow-slate-900/[0.03] transition-all hover:shadow-md',
                          isCredit ? 'hover:border-emerald-300 hover:bg-emerald-50/30' : 'hover:border-red-300 hover:bg-red-50/30'
                        )}
                      >
                        <Icon className="w-11 h-11 rounded-[10px] shadow-sm shadow-slate-900/10 transition-transform duration-150 group-hover:scale-105" />
                        <span className="text-xs font-medium text-slate-700 text-center leading-tight">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="space-y-3">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                  {/* ── Left column: direction, amount, date, mode ── */}
                  <div className="space-y-3">
                    <CreditDebitTabs value={direction} onChange={changeDirection} />

                    <div>
                      <label className={cn('mb-1.5 block text-[11px] font-semibold uppercase tracking-wide', isCredit ? 'text-emerald-600' : 'text-red-600')}>
                        Amount Paid
                      </label>
                      <div className="relative">
                        <span className={cn(
                          'pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm',
                          isCredit ? 'bg-emerald-600 shadow-emerald-600/25' : 'bg-red-600 shadow-red-600/25'
                        )}>₹</span>
                        <input
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={form.amount}
                          onChange={(e) => setF({ amount: e.target.value })}
                          required
                          className={cn(
                            'h-[78px] w-full rounded-2xl border-2 bg-white pl-14 pr-4 text-2xl font-bold text-slate-900 transition-shadow placeholder:text-base placeholder:font-normal placeholder:text-slate-400 outline-none',
                            isCredit
                              ? 'border-emerald-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100'
                              : 'border-red-200 focus:border-red-400 focus:ring-4 focus:ring-red-100'
                          )}
                        />
                      </div>
                    </div>

                    <EntryField label={<FieldLabel icon={Calendar} color="bg-sky-100 text-sky-600">Date</FieldLabel>} required>
                      <Input type="date" value={form.date} onChange={(e) => setF({ date: e.target.value })} required className={INPUT_ROUNDED} />
                      {isCheque && moduleKey !== 'vendor' && (
                        <Input placeholder="Cheque number" value={form.cheque_no} onChange={(e) => setF({ cheque_no: e.target.value })} className={INPUT_ROUNDED} />
                      )}
                    </EntryField>

                    <EntryField label={<FieldLabel icon={Landmark} color="bg-violet-100 text-violet-600">Payment Mode</FieldLabel>} required>
                      <div className="flex gap-1.5">
                        {['CASH', 'BANK', 'CHEQUE'].map((m) => {
                          const meta = MODE_META[m];
                          const Icon = meta.icon;
                          const active = form.mode === m;
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={() => changeMode(m)}
                              className={cn(
                                'flex flex-1 items-center justify-center gap-1.5 rounded-xl border h-10 px-1.5 text-xs font-semibold transition-colors',
                                active ? `${meta.solid} text-white border-transparent` : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                              )}
                            >
                              <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full', active ? 'bg-white/20' : meta.tint)}>
                                <Icon className={cn('w-3 h-3', active ? 'text-white' : '')} />
                              </span>
                              {meta.label}
                            </button>
                          );
                        })}
                      </div>
                    </EntryField>
                  </div>

                  {/* ── Right column: particular, paid from/to, category, map to person, remarks ── */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {moduleKey !== 'vendor' && moduleKey !== 'plot_commission' && (
                        <EntryField label={<FieldLabel icon={Tag} color="bg-indigo-100 text-indigo-600">Particular</FieldLabel>}>
                          {form.mode === 'CHEQUE' ? (
                            <div className={cn(INPUT_ROUNDED, 'flex items-center border border-teal-200 bg-teal-50 px-3 text-sm font-semibold text-teal-700')}>
                              CHEQUE
                            </div>
                          ) : (
                            <Select value={form.particular || undefined} onValueChange={(v) => setF({ particular: v })}>
                              <SelectTrigger className={INPUT_ROUNDED}>
                                <SelectValue placeholder="Select particular" />
                              </SelectTrigger>
                              <SelectContent>
                                {getParticularsForMode(form.mode).map((opt) => (
                                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </EntryField>
                      )}
                      {(moduleKey === 'expense' || moduleKey === 'daybook') && (
                        <EntryField label={<FieldLabel icon={ArrowLeftRight} color="bg-orange-100 text-orange-600">Paid from</FieldLabel>}>
                          <Input placeholder="e.g. OFFICE CASH" value={form.from_entity} onChange={(e) => setF({ from_entity: e.target.value })} className={INPUT_ROUNDED} />
                        </EntryField>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {moduleKey === 'farmer' && entitySelect('Paid to', 'farmers', 'farmer_id', (f) => ({ label: f.name, sublabel: f.phone || f.mobile || undefined }), User, 'bg-teal-100 text-teal-600', undefined, 'Select farmer')}
                      {moduleKey === 'cashflow' && entitySelect('Paid to', 'months', 'month_id', (m) => ({
                        label: m.ledger_name || [m.month, m.year].filter(Boolean).join('/') || `#${m.id}`,
                      }), NotebookPen, 'bg-teal-100 text-teal-600', undefined, 'Select ledger')}
                      {moduleKey === 'vendor' && entitySelect('Paid to', 'vendorCommitments', 'vendor_commitment_id', (c) => ({
                        label: c.vendor_name || c.vendor_member_name || `Commitment #${c.id}`,
                        sublabel: [c.work_title, c.remaining_amount != null ? `Due ₹${Number(c.remaining_amount).toLocaleString('en-IN')}` : null].filter(Boolean).join(' · ') || undefined,
                      }), User, 'bg-orange-100 text-orange-600', undefined, 'Select vendor commitment')}
                      {moduleKey === 'plot' && entitySelect('Paid to', 'plots', 'plot_id', (p) => ({
                        label: p.plot_no ? `Plot ${p.plot_no}` : `#${p.id}`,
                        sublabel: p.buyer_name || undefined,
                      }), MapPin, 'bg-teal-100 text-teal-600', handlePlotSelected, 'Select plot')}
                      {moduleKey === 'plot_commission' && entitySelect('Paid to', 'plotCommissions', 'commission_plot_id', (p) => ({
                        label: p.plot_no ? `Plot ${p.plot_no}` : `#${p.plot_id}`,
                        sublabel: p.buyer_name || undefined,
                      }), MapPin, 'bg-teal-100 text-teal-600', handleCommissionPlotSelected, 'Select plot')}
                      {(moduleKey === 'expense' || moduleKey === 'daybook') && (
                        <EntryField label={<FieldLabel icon={User} color="bg-cyan-100 text-cyan-600">Paid to</FieldLabel>}>
                          <Input placeholder="Person or business" value={form.to_entity} onChange={(e) => setF({ to_entity: e.target.value })} className={INPUT_ROUNDED} />
                        </EntryField>
                      )}

                      {moduleKey === 'plot_commission' && (
                        <EntryField label={<FieldLabel icon={User} color="bg-amber-100 text-amber-600">Agent</FieldLabel>} required>
                          {loadingAgents ? (
                            <div className={cn(INPUT_ROUNDED, 'border border-slate-200 bg-slate-50 flex items-center px-3 text-sm text-slate-400 gap-2')}>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
                            </div>
                          ) : (
                            <Select
                              value={form.commission_id || undefined}
                              onValueChange={handleCommissionAgentSelected}
                              disabled={!form.commission_plot_id || commissionAgents.length === 0}
                            >
                              <SelectTrigger className={INPUT_ROUNDED}>
                                <SelectValue placeholder={form.commission_plot_id ? 'Select agent' : 'Pick a plot first'} />
                              </SelectTrigger>
                              <SelectContent>
                                {commissionAgents.map((a) => (
                                  <SelectItem key={a.commission_id} value={String(a.commission_id)}>
                                    {a.agent_name}
                                    {a.agent_phone ? <span className="text-slate-400"> · {a.agent_phone}</span> : null}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </EntryField>
                      )}

                      {moduleKey === 'expense' && (
                        <EntryField label={<FieldLabel icon={Tag} color="bg-pink-100 text-pink-600">Category</FieldLabel>}>
                          {loadingOpts && options.categories === null ? (
                            <div className={cn(INPUT_ROUNDED, 'border border-slate-200 bg-slate-50 flex items-center px-3 text-sm text-slate-400 gap-2')}>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
                            </div>
                          ) : (
                            <Select value={form.category || undefined} onValueChange={(v) => setF({ category: v })}>
                              <SelectTrigger className={INPUT_ROUNDED}>
                                <SelectValue placeholder="Select…" />
                              </SelectTrigger>
                              <SelectContent>
                                {(options.categories || []).map((c) => (
                                  <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </EntryField>
                      )}
                      {moduleKey === 'daybook' && (
                        <EntryField label={<FieldLabel icon={Tag} color="bg-pink-100 text-pink-600">Category</FieldLabel>}>
                          <Input placeholder="Optional category" value={form.category} onChange={(e) => setF({ category: e.target.value })} className={INPUT_ROUNDED} />
                        </EntryField>
                      )}
                    </div>

                    {(moduleKey === 'vendor' || moduleKey === 'daybook') && (
                      <div className={cn('grid gap-3', moduleKey === 'vendor' ? 'sm:grid-cols-2' : '')}>
                        <EntryField label={<FieldLabel icon={FileText} color="bg-slate-100 text-slate-600">{moduleKey === 'vendor' ? 'Payment note' : 'Particular / Description'}</FieldLabel>} required={moduleKey === 'daybook'}>
                          <Input
                            placeholder={moduleKey === 'vendor' ? 'What is this payment for?' : direction === 'credit' ? 'e.g. PAYMENT RECEIVED' : 'e.g. PAYMENT MADE'}
                            value={form.description}
                            onChange={(e) => setF({ description: e.target.value })}
                            className={INPUT_ROUNDED}
                          />
                        </EntryField>
                        {moduleKey === 'vendor' && (
                          <EntryField label={<FieldLabel icon={FileText} color="bg-indigo-100 text-indigo-600">Reference / Cheque no.</FieldLabel>}>
                            <Input placeholder="Optional reference" value={form.reference_no} onChange={(e) => setF({ reference_no: e.target.value })} className={INPUT_ROUNDED} />
                          </EntryField>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      {moduleKey !== 'cashflow' && (
                        <EntryField
                          label={<FieldLabel icon={Users} color="bg-fuchsia-100 text-fuchsia-600">Map to person</FieldLabel>}
                          hint="Optional — mirrors this entry into their Personal Ledger"
                        >
                          <EntryPersonPicker
                            siteId={siteId}
                            value={mappedPerson}
                            onChange={setMappedPerson}
                            approvers={personApprovers}
                            members={personMembers}
                            onMemberCreated={addPersonMember}
                            openUp
                          />
                        </EntryField>
                      )}

                      <EntryField label={<FieldLabel icon={MessageSquare} color="bg-slate-100 text-slate-500">Remarks</FieldLabel>}>
                        <Textarea
                          rows={2}
                          placeholder="Optional note"
                          value={form.remarks}
                          onChange={(e) => setF({ remarks: e.target.value })}
                          className="rounded-xl"
                        />
                      </EntryField>
                    </div>
                  </div>
                </div>

                <VoucherUpload
                  label="Evidence Photo · Optional"
                  value={form.voucher_url}
                  onChange={(url) => setF({ voucher_url: url || '' })}
                  onUploadingChange={setVoucherUploading}
                  disabled={submitting}
                />
              </div>
            )}
          </div>

          {mod && (
            <div className="shrink-0 flex items-center justify-between gap-2.5 border-t border-slate-100 bg-slate-50/60 px-5 py-3 sm:px-6">
              <p className="hidden sm:block text-[11px] text-slate-400">
                Enter: next field · Shift+Tab: previous · Esc: close
              </p>
              <div className="flex items-center gap-2.5">
                <Button type="button" variant="outline" onClick={close} disabled={submitting} className="h-10 rounded-full px-5">
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || !canSubmit || voucherUploading}
                  className={cn(
                    'h-10 rounded-full px-5 text-white',
                    isCredit ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                  )}
                >
                  {submitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Eye className="h-4 w-4 mr-1.5" />}
                  Review payment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
