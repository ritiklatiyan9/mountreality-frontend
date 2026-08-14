import { useState } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Loader2, Check,
  Calendar, Banknote, Landmark, FileText, User, MapPin, BookOpen, CreditCard,
  NotebookPen, Tag, MessageSquare, ArrowLeftRight, Wallet, LayoutGrid,
  ShoppingBag, Tractor,
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
import { getParticularsForMode } from './EntryModal';
import VoucherUpload from './VoucherUpload';
import BankAccountSelect from './BankAccountSelect';
import { ACCENT } from './dashboard/accents';
import { cn, money } from '@/lib/utils';

const MODE_META = {
  CASH: { icon: Banknote, label: 'Cash' },
  BANK: { icon: Landmark, label: 'Bank' },
  CHEQUE: { icon: FileText, label: 'Cheque' },
};

const INPUT_ROUNDED = 'h-9 rounded-control border-mr-line text-[13px]';

/* Quick top-ups for the amount field — cash entries cluster on round
   numbers, and typing four zeros is where transposition errors happen. */
const AMOUNT_STEPS = [500, 1000, 5000, 25000];

/* ── Amount in words (Indian system) ─────────────────────────────────
   Shown under the amount so a mistyped zero is caught before posting.
   Purely a read-back of what the user typed — nothing is derived from it. */
const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const underHundred = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ''}`);
const underThousand = (n) => [
  Math.floor(n / 100) ? `${ONES[Math.floor(n / 100)]} hundred` : '',
  n % 100 ? underHundred(n % 100) : '',
].filter(Boolean).join(' ');

const amountInWords = (value) => {
  let n = Math.floor(Math.abs(Number(value) || 0));
  if (!n || n >= 1e9) return '';   // beyond 99 crore the read-back stops helping
  const parts = [];
  const push = (count, unit) => { if (count) parts.push(`${underThousand(count)} ${unit}`.trim()); };
  push(Math.floor(n / 1e7), 'crore'); n %= 1e7;
  push(Math.floor(n / 1e5), 'lakh'); n %= 1e5;
  push(Math.floor(n / 1e3), 'thousand'); n %= 1e3;
  push(n, '');
  return `${parts.join(' ')} rupees`.replace(/\s+/g, ' ').trim();
};

/**
 * Dashboard quick entry — record a Credit or Debit into any money module
 * without leaving the dashboard. Pick a module, get its minimal fields,
 * submit to the module's own create endpoint (payloads mirror each module
 * page exactly; nothing new server-side).
 */

const todayISO = () => new Date().toISOString().split('T')[0];

const MODULES = [
  { key: 'farmer', label: 'Farmer payment', hint: 'Pay or receive against a farmer', icon: Tractor, tone: 'lime', appKey: 'farmers', perm: 'farmers' },
  { key: 'cashflow', label: 'Personal ledger', hint: 'Given to or returned by a person', icon: Wallet, tone: 'amber', appKey: 'cashflow', perm: 'cashflow' },
  { key: 'vendor', label: 'Vendor payment', hint: 'Settle a vendor commitment', icon: ShoppingBag, tone: 'coral', appKey: 'vendors', perm: 'vendors', directions: ['debit'] },
  { key: 'expense', label: 'Expense', hint: 'Site or office expense voucher', icon: CreditCard, tone: 'coral', appKey: 'expenses', perm: 'expenses' },
  { key: 'daybook', label: 'Day book', hint: 'General entry with no other home', icon: BookOpen, tone: 'blue', appKey: 'daybook', perm: 'daybook' },
  { key: 'plot', label: 'Project payment', hint: 'Booking, installment or refund', icon: LayoutGrid, tone: 'aqua', appKey: 'plot_payments', perm: 'plot_payments' },
  { key: 'plot_commission', label: 'Plot commission', hint: 'Agent commission or recovery', icon: Landmark, tone: 'blue', appKey: 'plot_commission', perm: 'commissions' },
];

/* Compact field wrapper — the shared EntryField is roomier than a
   single-view modal can afford, and it is used by other dialogs. */
const QField = ({ label, required, hint, className, children }) => (
  <div className={cn('min-w-0 space-y-1', className)}>
    <span className="flex items-center gap-1.5 text-[12px] font-medium text-mr-muted">
      {label}
      {required ? <span className="text-mr-coral" aria-hidden="true">*</span> : null}
    </span>
    {children}
    {hint ? <p className="text-[11px] text-mr-faint">{hint}</p> : null}
  </div>
);

const QLabel = (props) => {
  const { icon: Icon, children } = props;
  return (
    <>
      <Icon className="h-3.5 w-3.5 shrink-0 text-mr-faint" strokeWidth={1.9} aria-hidden="true" />
      {children}
    </>
  );
};

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
  bank_account_id: '',
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
  const [commissionAgents, setCommissionAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [voucherUploading, setVoucherUploading] = useState(false);

  const visibleModules = MODULES.filter((m) =>
    hasPermission(m.perm, 'write') && (!m.directions || m.directions.includes(direction))
  );
  const setF = (patch) => setForm((f) => ({ ...f, ...patch }));

  const openWith = (dir) => {
    setDirection(dir);
    setModuleKey(null);
    setForm(blankForm());
    setBanner(null);
    setCommissionAgents([]);
    setVoucherUploading(false);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setModuleKey(null);
    setBanner(null);
    setSubmitting(false);
    setCommissionAgents([]);
    setVoucherUploading(false);
  };

  const pickModule = async (key) => {
    setModuleKey(key);
    setForm(blankForm());
    setBanner(null);
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
   * resale). Picking a plot loads its agents and defaults to the latest one. */
  const handleCommissionPlotSelected = async (plotId) => {
    setF({ commission_id: '' });
    setCommissionAgents([]);
    if (!plotId) return;
    setLoadingAgents(true);
    try {
      const res = await api.get(`/plot-commission/plot/${plotId}?site_id=${siteId}`);
      const agents = res.data?.agents || [];
      setCommissionAgents(agents);
      const latest = agents[agents.length - 1]; // API returns oldest → newest
      if (latest) setF({ commission_id: String(latest.commission_id) });
    } catch {
      setBanner({ type: 'error', text: 'Failed to load agents for this plot.' });
    } finally {
      setLoadingAgents(false);
    }
  };

  const handleCommissionAgentSelected = (commissionId) => {
    setF({ commission_id: commissionId });
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
    }
  };

  const amt = Math.abs(parseFloat(form.amount)) || 0;
  const isCheque = form.mode === 'CHEQUE';
  const debitCredit = { debit: direction === 'debit' ? amt : 0, credit: direction === 'credit' ? amt : 0 };

  // Same rules as before, expressed as a checklist so the summary rail can
  // show exactly what is still missing instead of a dead Save button.
  const checks = (() => {
    const amount = { label: 'Amount above zero', ok: amt > 0 };
    if (moduleKey === 'farmer') return [amount,
      { label: 'Farmer selected', ok: !!form.farmer_id },
      { label: 'Particular chosen', ok: !!form.particular },
      { label: 'Cheque number', ok: !isCheque || !!form.cheque_no.trim() }];
    if (moduleKey === 'cashflow') return [amount,
      { label: 'Ledger selected', ok: !!form.month_id },
      { label: 'Particular chosen', ok: !!form.particular }];
    if (moduleKey === 'vendor') return [amount,
      { label: 'Recorded as money out', ok: direction === 'debit' },
      { label: 'Vendor commitment selected', ok: !!form.vendor_commitment_id }];
    if (moduleKey === 'expense') return [amount];
    if (moduleKey === 'daybook') return [amount,
      { label: 'Description entered', ok: !!form.description.trim() }];
    if (moduleKey === 'plot') return [amount,
      { label: 'Plot selected', ok: !!form.plot_id }];
    if (moduleKey === 'plot_commission') return [amount,
      { label: 'Agent selected', ok: !!form.commission_id }];
    return [{ label: 'Module selected', ok: false }];
  })();

  const effectiveChecks = form.mode === 'CASH'
    ? checks
    : [...checks, { label: 'Bank account selected', ok: !!form.bank_account_id }];
  const canSubmit = effectiveChecks.every((c) => c.ok);
  const missing = effectiveChecks.filter((c) => !c.ok);

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
          bank_account_id: form.bank_account_id || null,
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
          bank_account_id: form.bank_account_id || null,
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
          bank_account_id: form.bank_account_id || null,
        });
      } else if (moduleKey === 'expense') {
        await api.post('/expenses', {
          site_id: siteId,
          date: form.date,
          payment_mode: form.particular,
          cheque_no: isCheque ? form.cheque_no.trim() || null : null,
          ...debitCredit,
          remark: form.remarks.trim(),
          category: form.category.trim(),
          voucher_url: form.voucher_url || null,
          bank_account_id: form.bank_account_id || null,
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
          bank_account_id: form.bank_account_id || null,
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
          bank_account_id: form.bank_account_id || null,
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
          bank_account_id: form.bank_account_id || null,
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
  const ModIcon = mod?.icon;

  const entitySelect = (label, listKey, idField, toOption, icon, onSelect, placeholderText) => {
    const opts = (options[listKey] || []).map((it) => ({ value: String(it.id), ...toOption(it) }));
    return (
      <QField label={<QLabel icon={icon}>{label}</QLabel>} required>
        {loadingOpts && options[listKey] === null ? (
          <div className={cn(INPUT_ROUNDED, 'flex items-center gap-2 border bg-mr-surface-2 px-3 text-mr-faint')}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Loading…
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
                  {o.sublabel ? <span className="text-mr-faint"> · {o.sublabel}</span> : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </QField>
    );
  };

  const isCredit = direction === 'credit';
  const flow = isCredit
    ? { chip: 'bg-emerald-100 text-emerald-700', text: 'text-emerald-700' }
    : { chip: 'bg-red-100 text-red-700', text: 'text-red-700' };
  const modTone = ACCENT[mod?.tone || 'blue'];
  const words = amountInWords(form.amount);

  /* Direction is a top-level decision, so it lives in the modal header
     rather than inside the form. Selection still routes through
     changeDirection(), which keeps the vendor debit-only guard. */
  const directionControl = (
    <div role="radiogroup" aria-label="Entry direction" className="mr-glass flex items-center gap-1 rounded-full p-1">
      {[
        { key: 'credit', label: 'Credit', icon: ArrowDownLeft, on: 'bg-emerald-600 text-white' },
        { key: 'debit', label: 'Debit', icon: ArrowUpRight, on: 'bg-red-600 text-white' },
      ].map((option) => {
        const { key, label, icon: Icon, on } = option;
        const active = direction === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => changeDirection(key)}
            className={cn(
              'mr-press inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-offset-1',
              active ? cn(on, 'mr-glass-ink') : 'text-mr-muted hover:text-mr-text',
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );

  /* Fields that only some modules use. Kept in one array so the middle
     column can lay them out in a dense two-up grid without the caller
     tracking which combination is active. */
  const detailFields = mod ? [
    moduleKey !== 'vendor' && moduleKey !== 'plot_commission' && (
      <QField key="particular" label={<QLabel icon={Tag}>Particular</QLabel>}>
        {form.mode === 'CHEQUE' ? (
          <div className={cn(INPUT_ROUNDED, 'flex items-center border bg-mr-aqua-soft px-3 font-medium text-mr-aqua-ink')}>
            CHEQUE
          </div>
        ) : (
          <Select value={form.particular || undefined} onValueChange={(v) => setF({ particular: v })}>
            <SelectTrigger className={INPUT_ROUNDED}><SelectValue placeholder="Select particular" /></SelectTrigger>
            <SelectContent>
              {getParticularsForMode(form.mode).map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </QField>
    ),
    moduleKey === 'daybook' && (
      <QField key="from" label={<QLabel icon={ArrowLeftRight}>Paid from</QLabel>}>
        <Input placeholder="e.g. OFFICE CASH" value={form.from_entity} onChange={(e) => setF({ from_entity: e.target.value })} className={INPUT_ROUNDED} />
      </QField>
    ),
    moduleKey === 'farmer' && entitySelect('Paid to', 'farmers', 'farmer_id', (f) => ({ label: f.name, sublabel: f.phone || f.mobile || undefined }), User, undefined, 'Select farmer'),
    moduleKey === 'cashflow' && entitySelect('Paid to', 'months', 'month_id', (m) => ({
      label: m.ledger_name || [m.month, m.year].filter(Boolean).join('/') || `#${m.id}`,
    }), NotebookPen, undefined, 'Select ledger'),
    moduleKey === 'vendor' && entitySelect('Paid to', 'vendorCommitments', 'vendor_commitment_id', (c) => ({
      label: c.vendor_name || c.vendor_member_name || `Commitment #${c.id}`,
      sublabel: [c.work_title, c.remaining_amount != null ? `Due ₹${Number(c.remaining_amount).toLocaleString('en-IN')}` : null].filter(Boolean).join(' · ') || undefined,
    }), User, undefined, 'Select commitment'),
    moduleKey === 'plot' && entitySelect('Paid to', 'plots', 'plot_id', (pl) => ({
      label: pl.plot_no ? `Plot ${pl.plot_no}` : `#${pl.id}`,
      sublabel: pl.buyer_name || undefined,
    }), MapPin, undefined, 'Select plot'),
    moduleKey === 'plot_commission' && entitySelect('Plot', 'plotCommissions', 'commission_plot_id', (pl) => ({
      label: pl.plot_no ? `Plot ${pl.plot_no}` : `#${pl.plot_id}`,
      sublabel: pl.buyer_name || undefined,
    }), MapPin, handleCommissionPlotSelected, 'Select plot'),
    moduleKey === 'daybook' && (
      <QField key="to" label={<QLabel icon={User}>Paid to</QLabel>}>
        <Input placeholder="Person or business" value={form.to_entity} onChange={(e) => setF({ to_entity: e.target.value })} className={INPUT_ROUNDED} />
      </QField>
    ),
    moduleKey === 'plot_commission' && (
      <QField key="agent" label={<QLabel icon={User}>Agent</QLabel>} required>
        {loadingAgents ? (
          <div className={cn(INPUT_ROUNDED, 'flex items-center gap-2 border bg-mr-surface-2 px-3 text-mr-faint')}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Loading…
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
                  {a.agent_phone ? <span className="text-mr-faint"> · {a.agent_phone}</span> : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </QField>
    ),
    moduleKey === 'expense' && (
      <QField key="cat" label={<QLabel icon={Tag}>Category</QLabel>}>
        {loadingOpts && options.categories === null ? (
          <div className={cn(INPUT_ROUNDED, 'flex items-center gap-2 border bg-mr-surface-2 px-3 text-mr-faint')}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Loading…
          </div>
        ) : (
          <Select value={form.category || undefined} onValueChange={(v) => setF({ category: v })}>
            <SelectTrigger className={INPUT_ROUNDED}><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {(options.categories || []).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </QField>
    ),
    moduleKey === 'daybook' && (
      <QField key="cat2" label={<QLabel icon={Tag}>Category</QLabel>}>
        <Input placeholder="Optional" value={form.category} onChange={(e) => setF({ category: e.target.value })} className={INPUT_ROUNDED} />
      </QField>
    ),
    (moduleKey === 'vendor' || moduleKey === 'daybook') && (
      <QField
        key="desc"
        label={<QLabel icon={FileText}>{moduleKey === 'vendor' ? 'Payment note' : 'Description'}</QLabel>}
        required={moduleKey === 'daybook'}
      >
        <Input
          placeholder={moduleKey === 'vendor' ? 'What is this for?' : isCredit ? 'e.g. PAYMENT RECEIVED' : 'e.g. PAYMENT MADE'}
          value={form.description}
          onChange={(e) => setF({ description: e.target.value })}
          className={INPUT_ROUNDED}
        />
      </QField>
    ),
    moduleKey === 'vendor' && (
      <QField key="ref" label={<QLabel icon={FileText}>Reference no.</QLabel>}>
        <Input placeholder="Optional" value={form.reference_no} onChange={(e) => setF({ reference_no: e.target.value })} className={INPUT_ROUNDED} />
      </QField>
    ),
  ].filter(Boolean) : [];

  return (
    <>
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={() => openWith('credit')}
          disabled={!siteId}
          title={siteId ? 'Record a credit' : 'Select a site first'}
          className="mr-press group inline-flex h-10 items-center gap-2 rounded-full bg-emerald-700 pl-2.5 pr-4 text-[13px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_2px_6px_rgba(4,120,87,0.28),0_10px_20px_-10px_rgba(4,120,87,0.6)] [background-image:linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0)_58%)] hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-110">
            <ArrowDownLeft className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
          </span>
          Credit
        </button>
        <button
          type="button"
          onClick={() => openWith('debit')}
          disabled={!siteId}
          title={siteId ? 'Record a debit' : 'Select a site first'}
          className="mr-press group inline-flex h-10 items-center gap-2 rounded-full bg-red-600 pl-2.5 pr-4 text-[13px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_2px_6px_rgba(185,28,28,0.28),0_10px_20px_-10px_rgba(185,28,28,0.6)] [background-image:linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0)_58%)] hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-700 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-110">
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
          </span>
          Debit
        </button>
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
        <DialogContent className="flex max-h-[94vh] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden rounded-panel border-mr-line bg-mr-surface p-0 sm:max-w-[1080px]">
          {/* ── Header ── */}
          <div className="relative shrink-0 overflow-hidden border-b border-mr-line px-5 py-3.5 sm:px-6">
            <div
              className="pointer-events-none absolute inset-0"
              aria-hidden="true"
              style={{
                background: isCredit
                  ? 'linear-gradient(100deg, rgba(220,252,231,.85) 0%, rgba(255,255,255,0) 78%)'
                  : 'linear-gradient(100deg, rgba(254,226,226,.85) 0%, rgba(255,255,255,0) 78%)',
              }}
            />
            <div className="relative flex flex-wrap items-center justify-between gap-3 pr-8">
              <div className="flex min-w-0 items-center gap-3">
                <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', mod ? modTone.chip : flow.chip)}>
                  {ModIcon
                    ? <ModIcon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                    : (isCredit
                      ? <ArrowDownLeft className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
                      : <ArrowUpRight className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />)}
                </span>
                <div className="min-w-0">
                  <DialogTitle className="text-[18px] font-semibold tracking-[-0.02em] text-mr-text">
                    {isCredit ? 'Record credit' : 'Record debit'}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 flex flex-wrap items-center gap-x-2 truncate text-[12px] text-mr-muted">
                    {currentSite?.name ? <span className="font-medium text-mr-text">{currentSite.name}</span> : null}
                    <span>{mod ? mod.label : 'Step 1 of 2 — choose where this entry belongs'}</span>
                    {mod && (
                      <button
                        type="button"
                        onClick={() => { setModuleKey(null); setBanner(null); }}
                        className="inline-flex items-center gap-1 rounded-full px-1.5 font-semibold text-mr-blue transition-colors hover:bg-mr-blue-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
                      >
                        <ChevronLeft className="h-3 w-3" strokeWidth={2.2} aria-hidden="true" /> change
                      </button>
                    )}
                  </DialogDescription>
                </div>
              </div>
              {directionControl}
            </div>
          </div>

          {/* min-h-0 + overflow-auto is a safety valve for very short windows;
              at 800px and up the whole form fits without scrolling. */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {banner && (
              <div
                role="alert"
                className={cn(
                  'mx-5 mt-3 rounded-control border px-3.5 py-2 text-[13px] sm:mx-6',
                  banner.type === 'success'
                    ? 'border-mr-lime-ink/15 bg-mr-lime-soft text-mr-lime-ink'
                    : 'border-mr-coral-ink/15 bg-mr-coral-soft text-mr-coral-ink',
                )}
              >
                {banner.text}
              </div>
            )}

            {!mod ? (
              /* ── Step 1 ── */
              <div className="px-5 py-5 sm:px-6">
                {visibleModules.length === 0 ? (
                  <p className="py-10 text-center text-[13px] text-mr-muted">
                    You don&apos;t have write access to any money module.
                  </p>
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {visibleModules.map((m) => {
                      const Icon = m.icon;
                      const t = ACCENT[m.tone];
                      return (
                        <li key={m.key}>
                          <button
                            type="button"
                            onClick={() => pickModule(m.key)}
                            className="group flex h-full w-full items-center gap-3 rounded-control border border-mr-line px-3.5 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-transparent hover:shadow-md hover:shadow-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
                          >
                            <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-105', t.chip)}>
                              <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14px] font-medium text-mr-text">{m.label}</span>
                              <span className="mt-0.5 block truncate text-[12px] text-mr-faint">{m.hint}</span>
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-mr-faint" strokeWidth={1.9} aria-hidden="true" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : (
              /* ── Step 2: everything in one view ── */
              <div className="grid lg:grid-cols-[288px_minmax(0,1fr)_262px]">
                {/* Column 1 — the money */}
                <div
                  className="space-y-3 border-b border-mr-line px-5 py-4 sm:px-6 lg:border-b-0 lg:border-r"
                  style={{
                    background: isCredit
                      ? 'linear-gradient(180deg, rgba(220,252,231,.60) 0%, rgba(255,255,255,0) 60%)'
                      : 'linear-gradient(180deg, rgba(254,226,226,.60) 0%, rgba(255,255,255,0) 60%)',
                  }}
                >
                  <div>
                    <label htmlFor="qe-amount" className="mb-1.5 block text-[12px] font-medium text-mr-muted">Amount</label>
                    <div className="relative">
                      <span className={cn('pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[22px] font-semibold', flow.text)} aria-hidden="true">₹</span>
                      <input
                        id="qe-amount"
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        placeholder="0.00"
                        autoFocus
                        value={form.amount}
                        onChange={(e) => setF({ amount: e.target.value })}
                        required
                        aria-describedby="qe-amount-words"
                        className={cn(
                          'h-16 w-full rounded-panel-sm border-2 bg-mr-surface pl-10 pr-3 text-[26px] font-semibold tracking-[-0.03em] text-mr-text outline-none transition-colors placeholder:text-[18px] placeholder:font-normal placeholder:text-mr-faint',
                          isCredit
                            ? 'border-mr-lime-ink/20 focus:border-mr-lime-ink/60 focus:ring-4 focus:ring-mr-lime-soft'
                            : 'border-mr-coral-ink/20 focus:border-mr-coral-ink/60 focus:ring-4 focus:ring-mr-coral-soft',
                        )}
                      />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      {AMOUNT_STEPS.map((step) => (
                        <button
                          key={step}
                          type="button"
                          onClick={() => setF({ amount: String((Math.abs(parseFloat(form.amount)) || 0) + step) })}
                          className="inline-flex h-7 items-center rounded-full bg-mr-surface px-2.5 text-[11px] font-semibold text-mr-muted ring-1 ring-mr-line transition-colors hover:bg-mr-ink hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
                        >
                          +{step.toLocaleString('en-IN')}
                        </button>
                      ))}
                      {amt > 0 && (
                        <button
                          type="button"
                          onClick={() => setF({ amount: '' })}
                          className="inline-flex h-7 items-center rounded-full px-2 text-[11px] font-medium text-mr-faint transition-colors hover:text-mr-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <p id="qe-amount-words" className={cn('mt-1.5 min-h-4 text-[11px] capitalize', flow.text)}>{words}</p>
                  </div>

                  <QField label={<QLabel icon={Calendar}>Date</QLabel>} required>
                    <Input type="date" value={form.date} onChange={(e) => setF({ date: e.target.value })} required className={INPUT_ROUNDED} />
                  </QField>

                  <QField label={<QLabel icon={Landmark}>Payment mode</QLabel>} required>
                    <div className="flex gap-1.5">
                      {['CASH', 'BANK', 'CHEQUE'].map((m) => {
                        const meta = MODE_META[m];
                        const Icon = meta.icon;
                        const active = form.mode === m;
                        return (
                          <button
                            key={m}
                            type="button"
                            aria-pressed={active}
                            onClick={() => changeMode(m)}
                            className={cn(
                              'mr-press flex h-9 flex-1 items-center justify-center gap-1.5 rounded-control border px-1 text-[12px] font-medium',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue',
                              active
                                ? 'mr-glass-ink border-transparent bg-mr-blue text-white'
                                : 'border-mr-line bg-mr-surface text-mr-muted hover:bg-mr-blue-soft hover:text-mr-blue',
                            )}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                            {meta.label}
                          </button>
                        );
                      })}
                    </div>
                  </QField>

                  <BankAccountSelect
                    value={form.bank_account_id}
                    onChange={(bankAccountId) => setF({ bank_account_id: bankAccountId })}
                    paymentMode={form.mode}
                    disabled={submitting}
                  />

                  {isCheque && moduleKey !== 'vendor' && (
                    <QField label={<QLabel icon={FileText}>Cheque number</QLabel>} required>
                      <Input placeholder="Cheque number" value={form.cheque_no} onChange={(e) => setF({ cheque_no: e.target.value })} className={INPUT_ROUNDED} />
                    </QField>
                  )}
                </div>

                {/* Column 2 — module details */}
                <div className="space-y-3 border-b border-mr-line px-5 py-4 sm:px-6 lg:border-b-0 lg:border-r">
                  <div className="grid gap-x-3 gap-y-3 sm:grid-cols-2">
                    {detailFields}
                  </div>
                  <QField label={<QLabel icon={MessageSquare}>Remarks</QLabel>}>
                    <Textarea
                      rows={2}
                      placeholder="Optional note"
                      value={form.remarks}
                      onChange={(e) => setF({ remarks: e.target.value })}
                      className="resize-none rounded-control border-mr-line text-[13px]"
                    />
                  </QField>
                  <div className="[&_label]:text-[12px] [&_label]:font-medium [&_label]:text-mr-muted">
                    <VoucherUpload
                      label="Evidence photo · optional"
                      value={form.voucher_url}
                      onChange={(url) => setF({ voucher_url: url || '' })}
                      onUploadingChange={setVoucherUploading}
                      disabled={submitting}
                    />
                  </div>
                </div>

                {/* Column 3 — read-back of exactly what will be posted */}
                <aside aria-label="Entry summary" className="bg-mr-surface-2/70 px-5 py-4 sm:px-6">
                  <p className="text-[12px] font-medium text-mr-muted">
                    {isCredit ? 'Money coming in' : 'Money going out'}
                  </p>
                  <p
                    className={cn(
                      'mt-1 break-words text-[24px] font-semibold leading-tight tracking-[-0.035em] tabular-nums',
                      amt > 0 ? flow.text : 'text-mr-faint',
                    )}
                    title={money(amt)}
                  >
                    {isCredit ? '+' : '−'}{money(amt)}
                  </p>

                  <dl className="mt-4 space-y-2 border-t border-mr-line pt-3 text-[12px]">
                    {[
                      ['Module', mod.label],
                      ['Date', form.date ? new Date(form.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'],
                      ['Mode', MODE_META[form.mode]?.label || form.mode],
                      isCheque && form.cheque_no.trim() ? ['Cheque', form.cheque_no.trim()] : null,
                      ['Evidence', form.voucher_url ? 'Attached' : 'None'],
                    ].filter(Boolean).map((entry) => (
                      <div key={entry[0]} className="flex items-baseline justify-between gap-3">
                        <dt className="text-mr-muted">{entry[0]}</dt>
                        <dd className="min-w-0 truncate text-right font-medium text-mr-text">{entry[1]}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-4 border-t border-mr-line pt-3">
                    <p className="text-[12px] font-medium text-mr-muted">
                      {canSubmit ? 'Ready to record' : 'Still needed'}
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {(canSubmit ? checks : missing).map((c) => (
                        <li key={c.label} className="flex items-start gap-2 text-[12px]">
                          {c.ok
                            ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mr-lime-ink" strokeWidth={2.4} aria-hidden="true" />
                            : <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-mr-amber" aria-hidden="true" />}
                          <span className={c.ok ? 'text-mr-muted' : 'text-mr-amber-ink'}>{c.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </aside>
              </div>
            )}
          </div>

          {mod && (
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-t border-mr-line bg-mr-surface px-5 py-3 sm:px-6">
              <p className="hidden text-[12px] text-mr-faint sm:block">
                Tab moves between fields · Esc closes without saving
              </p>
              <div className="flex items-center gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={close}
                  disabled={submitting}
                  className="h-10 rounded-full border-mr-line px-5 text-[13px]"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || !canSubmit || voucherUploading}
                  className={cn(
                    'h-10 rounded-full px-5 text-[13px] font-semibold transition-colors disabled:opacity-40',
                    isCredit ? 'bg-emerald-700 text-white hover:bg-emerald-800' : 'bg-red-600 text-white hover:bg-red-700',
                  )}
                >
                  {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
                  {submitting ? 'Recording…' : `Record ${isCredit ? 'receipt' : 'payment'}`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
