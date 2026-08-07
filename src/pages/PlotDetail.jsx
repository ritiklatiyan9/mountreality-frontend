import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';

import {
  ArrowLeft, IndianRupee, Calendar, Ruler, Tag, FileText, Loader2,
  Edit2, Plus, Trash2, CreditCard, TrendingUp, CheckCircle2, AlertTriangle,
  Clock, CalendarClock, Banknote, Landmark, Wallet, Percent, Hash,
  ArrowDownRight, ArrowUpRight, ArrowDownLeft, CircleDollarSign, ChevronDown, X, Eye, Settings, Printer,
  Check, ChevronsUpDown, User, Search, UserPlus, PenLine, MessageSquare,
} from 'lucide-react';
import SignaturePad from '../components/SignaturePad';
import { printUnifiedReceipt } from '../lib/printReceipt';
import { customerSigImg, authoritySigHtml, nameSignOn } from '../lib/receiptSignature';
import { Textarea } from '../components/ui/textarea';
import VoucherUpload, { VoucherThumbnail } from '../components/VoucherUpload';
import ApprovalStatusBadge from '../components/ApprovalStatusBadge';
import ChequeStatusControl from '../components/ChequeStatusControl';
import { classifyPaymentMode } from '../utils/paymentMode';
import CreditDebitTabs from '../components/CreditDebitTabs';
import {
  EntryField, EntryAmount, EntryModeChips, FieldLabel,
} from '../components/EntryModal';

// ── Constants ──
const STATUS_COLORS = {
  'CREATED': 'bg-purple-50 text-purple-700 border-purple-200',
  'BOOKED': 'bg-blue-50 text-blue-700 border-blue-200',
  'AGREEMENT': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'PENDING PAYMENT': 'bg-orange-50 text-orange-700 border-orange-200',
  'PARTIAL PAYMENT': 'bg-amber-50 text-amber-700 border-amber-200',
  'IN PROGRESS': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'CONSTRUCTION': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'POSSESSION': 'bg-teal-50 text-teal-700 border-teal-200',
  'REGISTRY': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'PENDING NOC': 'bg-amber-50 text-amber-700 border-amber-200',
  'REGISTERED': 'bg-green-50 text-green-700 border-green-200',
  'COMPLETED': 'bg-green-50 text-green-800 border-green-300',
  'CANCELLED': 'bg-red-50 text-red-700 border-red-200',
  'HOLD': 'bg-slate-50 text-slate-600 border-slate-200',
  'DISPUTED': 'bg-rose-50 text-rose-700 border-rose-200',
  'RESALE': 'bg-violet-50 text-violet-700 border-violet-200',
  'TRANSFERRED': 'bg-sky-50 text-sky-700 border-sky-200',
};

const INST_STATUS = {
  paid:           { label: 'Paid',    color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2, bg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  partially_paid: { label: 'Partial', color: 'bg-amber-50 text-amber-700 border-amber-200',      icon: Clock,        bg: 'bg-amber-50',   iconColor: 'text-amber-600' },
  overdue:        { label: 'Overdue', color: 'bg-red-50 text-red-700 border-red-200',            icon: AlertTriangle,bg: 'bg-red-50',     iconColor: 'text-red-600' },
  pending:        { label: 'Pending', color: 'bg-slate-50 text-slate-600 border-slate-200',      icon: CalendarClock,bg: 'bg-slate-50',   iconColor: 'text-slate-500' },
};

const INTEREST_TYPES = [
  { value: 'per_day', label: 'Per Day' },
  { value: 'per_month', label: 'Per Month' },
  { value: 'per_quarter', label: 'Per Quarter' },
  { value: 'per_year', label: 'Per Year' },
];

const PAYMENT_FROM_OPTIONS = [
  'BOOKING', 'CASH', 'BANK', 'TRANSFER', 'CHEQUE', 'UPI',
  'NEFT', 'RTGS', 'IMPS', 'ADJUST', 'RETURN', 'REFUND',
];
const derivePaymentType = (from) => {
  const bucket = classifyPaymentMode(from);
  return bucket === 'cash' ? 'CASH' : bucket === 'cheque' ? 'CHEQUE' : 'BANK';
};

const FROM_COLORS = {
  'BOOKING': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'CASH': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'BANK': 'bg-blue-50 text-blue-700 border-blue-200',
  'TRANSFER': 'bg-purple-50 text-purple-700 border-purple-200',
  'CHEQUE': 'bg-teal-50 text-teal-700 border-teal-200',
  'UPI': 'bg-green-50 text-green-700 border-green-200',
  'NEFT': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'RTGS': 'bg-sky-50 text-sky-700 border-sky-200',
  'ADJUST': 'bg-orange-50 text-orange-700 border-orange-200',
  'IMPS': 'bg-amber-50 text-amber-700 border-amber-200',
  'RETURN': 'bg-pink-50 text-pink-700 border-pink-200',
  'REFUND': 'bg-red-50 text-red-700 border-red-200',
};

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const progressPct = (paid, total) => total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

// ══════════════════════════════════════════════════
export default function PlotDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canManage, hasPermission, currentSite, user } = useAuth();
  const canWrite  = canManage && hasPermission('plot_payments', 'write');
  const canUpdate = canManage && hasPermission('plot_payments', 'update');
  const canDelete = canManage && hasPermission('plot_payments', 'delete');

  // ─── Data ───
  const [plot, setPlot] = useState(null);
  const [payments, setPayments] = useState([]);
  const [signEntry, setSignEntry] = useState(null);
  const [fromBreakdown, setFromBreakdown] = useState([]);
  const [receivedByBreakdown, setReceivedByBreakdown] = useState([]);
  const [installments, setInstallments] = useState([]);
  const [installmentPayments, setInstallmentPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approvers, setApprovers] = useState([]);
  const [autocomplete, setAutocomplete] = useState({ members: [] });
  const [message, setMessage] = useState({ type: '', text: '' });

  // ─── Create Installments Dialog ───
  const [instOpen, setInstOpen] = useState(false);
  const [instRows, setInstRows] = useState([{ installment_name: '', percentage: '', amount: '', due_date: '' }]);
  const [instSubmitting, setInstSubmitting] = useState(false);

  // ─── Edit Installment Dialog ───
  const [editInstOpen, setEditInstOpen] = useState(false);
  const [editInstForm, setEditInstForm] = useState({ id: null, installment_name: '', amount: '', due_date: '' });
  const [editInstSubmitting, setEditInstSubmitting] = useState(false);

  // ─── Settings Dialog ───
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ installments_enabled: false, interest_enabled: false, interest_rate: '', interest_type: 'per_month', penalty_enabled: false, penalty_rate: '', penalty_type: 'per_day', free_to_sale_days: '0' });
  const [settingsSubmitting, setSettingsSubmitting] = useState(false);

  // ─── Confirm ───
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  // ─── Tab ───
  const [activeTab, setActiveTab] = useState('payments');

  // ─── Print Receipt ───
  const printReceipt = async (pay) => {
    const amt = parseFloat(pay.amount) || 0;
    const isNegative = amt < 0;
    const absAmt = Math.abs(amt);
    const fromMode = String(pay.payment_from || '').toUpperCase();
    const isRefundEntry = fromMode === 'REFUND';
    const amountColor = isRefundEntry ? '#2563eb' : (isNegative ? '#dc2626' : '#059669');
    const siteName = (currentSite?.name || 'ALLOTMENT DIVISION').toUpperCase();
    const siteAddr = [currentSite?.address, currentSite?.city, currentSite?.state].filter(Boolean).join(', ').toUpperCase();
    const payDate = pay.date ? new Date(pay.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    const printedAt = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
    const plotMeasure = plot?.plot_size ? String(plot.plot_size).toUpperCase() : '—';
    const instrumentRef = (pay.payment_from || pay.payment_type || '—').toUpperCase();
    const bankName = pay.payment_type === 'BANK'
      ? ((pay.bank_name || pay.bank_details || '—').toUpperCase())
      : '—';
    const branchName = pay.payment_type === 'BANK'
      ? ((pay.branch || '—').toUpperCase())
      : '—';

    const isCash = classifyPaymentMode(pay.payment_type) === 'cash';
    const signerName = user?.full_name || user?.name || '';

    await printUnifiedReceipt({
      docTitle: 'Payment Receipt',
      site: { name: siteName, address: siteAddr },
      receiptNo: `ACK-${pay.id}`,
      date: payDate,
      leadIn: 'As a full and final settlement in the following manner:',
      rows: [
        { label: 'Received From', value: plot?.buyer_name || 'UNDEFINED ENTITY' },
        { label: 'Plot No.', value: plot?.plot_no },
        { label: 'Measuring', value: plotMeasure },
        { label: 'Payment Mode / Ch. No.', value: instrumentRef },
        ...(pay.payment_type === 'BANK'
          ? [{ label: 'Name of the Bank', value: bankName }, { label: 'Branch', value: branchName }]
          : []),
        { label: 'In Favour Of', value: siteName },
        { label: 'Payment Date', value: payDate },
      ],
      amount: absAmt,
      amountDirection: isRefundEntry || isNegative ? 'out' : 'in',
      amountLabel: isRefundEntry ? 'Amount Refunded' : undefined,
      amountColor,
      verifyUrl: pay.verifyUrl,
      signatures: {
        customerImg: customerSigImg(pay),
        authorityHtml: authoritySigHtml(pay, signerName),
        customerLabel: 'Signature of the Remitter',
        authorityLabel: 'Authorized Signatory & Seal',
      },
      extraNote: isCash
        ? 'STATUTORY PROVISO: Cash received exclusively as a temporary custodian on behalf of our designated banking institution for immediate reconciliation and ledger entry.'
        : undefined,
      printedAt,
    });
  };

  const printStatement = () => {
    if (!plot) return;
    const siteName = (currentSite?.name || '').toUpperCase();
    const siteAddr = [currentSite?.address, currentSite?.city, currentSite?.state].filter(Boolean).join(', ').toUpperCase();
    const fmtINR = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
    const fmtSigned = (v) => { const n = parseFloat(v) || 0; return `${n < 0 ? '-' : ''}₹${fmtINR(Math.abs(n))}`; };
    const dt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
    const up = (s) => (s == null || String(s).trim() === '' ? '—' : String(s).toUpperCase());
    const selected = statementPayments;

    const grandTotal = totalReceived;
    const balanceAmt = balance;
    const grandTotalSign = grandTotal < 0 ? '-' : '';
    const balanceSign = balanceAmt < 0 ? '-' : '';
    const balanceColor = balanceAmt <= 0 ? '#059669' : '#dc2626';

    // ── Section builders ──
    const pcell = (label, value, color) => `<div class="pcell"><div class="plabel">${label}</div><div class="pval"${color ? ` style="color:${color}"` : ''}>${value}</div></div>`;

    const hasDiscount = parseFloat(plot.original_plot_rate) > 0 && parseFloat(plot.original_plot_rate) !== (parseFloat(plot.plot_rate) || 0);

    const particularsCells = [
      pcell('Plot Number', `${up(plot.plot_no)}${plot.block ? ' · BLOCK ' + up(plot.block) : ''}`),
      pcell('Status', up(plot.status)),
      pcell('Booking Date', dt(plot.booking_date)),
      pcell('Allottee / Buyer', up(plot.buyer_name)),
      pcell('Booked By', up(plot.booking_by)),
      pcell('Team', up(plot.team)),
    ].join('');

    const pricingCells = [
      pcell('Plot Size', plot.plot_size ? `${up(plot.plot_size)}${plot.plot_size_mtr ? ' (' + up(plot.plot_size_mtr) + ' MTR)' : ''}` : '—'),
      pcell('Plot Rate', `₹${fmtINR(plot.plot_rate)}`),
      pcell('Sale Consideration', `₹${fmtINR(salePrice)}`),
      pcell('Registry Area', plot.registry_area ? up(plot.registry_area) : '—'),
      pcell('Circle Rate', `₹${fmtINR(plot.circle_rate)}`),
      pcell('Circle Receivable', toReceiveCircle > 0 ? `₹${fmtINR(toReceiveCircle)}` : '—'),
      ...(hasDiscount ? [
        pcell('Original Rate', `₹${fmtINR(plot.original_plot_rate)}`),
        pcell('Discount Given', `-₹${fmtINR(plot.discount_rate)}`, '#dc2626'),
        pcell('Effective Rate', `₹${fmtINR(plot.plot_rate)}`, '#059669'),
      ] : []),
    ].join('');

    // Bank / Cash reconciliation — compact inline line (no separate table)
    const bankCashLine =
      `<span><b>Bank</b> · Target ₹${fmtINR(toReceiveBank)} · Recd <span style="color:#059669">₹${fmtINR(receivedBank)}</span> · Bal <span style="color:${balanceBank <= 0 ? '#059669' : '#dc2626'}">${fmtSigned(balanceBank)}</span></span>`
      + `<span><b>Cash</b> · Target ₹${fmtINR(toReceiveCash)} · Recd <span style="color:#059669">₹${fmtINR(receivedCash)}</span> · Bal <span style="color:${balanceCash <= 0 ? '#059669' : '#dc2626'}">${fmtSigned(balanceCash)}</span></span>`;

    // Commission — folded into the Particulars grid (no separate section)
    const commissionOn = !!plot.commission_enabled && (parseFloat(plot.plot_commission) || parseFloat(plot.commission_value) || parseFloat(plot.commission_rate));
    const commissionType = (plot.commission_type || 'PERCENTAGE').toUpperCase();
    const commissionBasis = commissionType === 'PERCENTAGE'
      ? `${plot.commission_rate || plot.commission_value || 0}%`
      : `₹${fmtINR(plot.commission_value || plot.commission_rate || 0)}`;
    const commissionCells = commissionOn
      ? pcell('Commission', `${commissionType} · ${commissionBasis}`) + pcell('Total Commission', `₹${fmtINR(plot.plot_commission)}`, '#7c3aed')
      : '';

    // Installment schedule (only when enabled and present)
    const hasInst = !!plot.installments_enabled && installments.length > 0;
    const interestInfo = plot.interest_enabled
      ? `${plot.interest_rate || 0}% ${(INTEREST_TYPES.find(t => t.value === plot.interest_type)?.label || '')}`.trim()
      : 'Disabled';
    const instSection = hasInst ? `
    <div class="sec">
      <div class="sec-title">Installment Schedule <span class="sec-note">Interest: ${interestInfo}${plot.grace_period_days != null ? ` · Grace ${plot.grace_period_days} days` : ''}</span></div>
      <table>
        <thead><tr>
          <th style="width:24px; text-align:center">#</th>
          <th>Installment</th>
          <th style="width:70px">Due Date</th>
          <th style="text-align:right; width:80px">Amount</th>
          <th style="text-align:right; width:80px">Paid</th>
          <th style="text-align:right; width:80px">Balance</th>
          <th style="text-align:center; width:64px">Status</th>
        </tr></thead>
        <tbody>
          ${installments.map((inst, idx) => {
            const amt = parseFloat(inst.amount) || 0;
            const paid = parseFloat(inst.paid_amount) || 0;
            const rem = Math.max(amt - paid, 0);
            return `<tr>
              <td style="text-align:center">${idx + 1}</td>
              <td>${up(inst.installment_name || ('Installment ' + (idx + 1)))}</td>
              <td style="white-space:nowrap">${dt(inst.due_date)}</td>
              <td style="text-align:right">₹${fmtINR(amt)}</td>
              <td style="text-align:right; color:#059669">₹${fmtINR(paid)}</td>
              <td style="text-align:right; color:${rem > 0 ? '#dc2626' : '#059669'}">₹${fmtINR(rem)}</td>
              <td style="text-align:center; font-size:9px; font-weight:700">${up(INST_STATUS[inst.status]?.label || inst.status)}</td>
            </tr>`;
          }).join('')}
          <tr class="total-row">
            <td colspan="3" style="text-align:right">SCHEDULED TOTAL</td>
            <td style="text-align:right">₹${fmtINR(instTotal)}</td>
            <td style="text-align:right; color:#059669">₹${fmtINR(instPaid)}</td>
            <td style="text-align:right; color:${instRemaining > 0 ? '#dc2626' : '#059669'}">₹${fmtINR(instRemaining)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>` : '';

    // Statement rows are already restricted to posted sources and carry a
    // chronological cumulative amount across direct + installment receipts.
    const payRows = selected.map((pay, idx) => {
      const amt = parseFloat(pay.amount) || 0;
      const isVoid = ['BOUNCED', 'RETURNED'].includes(pay.cheque_status);
      const isPosted = isActivePayment(pay);
      const running = parseFloat(pay.cumulative_amount) || 0;
      const fromMode = String(pay.payment_from || '').toUpperCase();
      const isRefundEntry = fromMode === 'REFUND';
      const amountColor = !isPosted ? '#94a3b8' : (isRefundEntry ? '#ca8a04' : (amt < 0 ? '#dc2626' : '#059669'));
      const cumulativeColor = running < 0 ? '#dc2626' : '#059669';
      const particularBits = [
        up(pay.bank_details || (pay.payment_type === 'CASH' ? 'CASH' : 'DIRECT')),
        pay.cheque_no ? `<div class="sub">CHQ #${pay.cheque_no}</div>` : '',
        pay.narration ? `<div class="sub">${pay.narration}</div>` : '',
      ].join('');
      const assignedLabel = pay.assigned_admin_id ? (getAssignedAdminLabel(pay) || '') : '';
      const statusCell = [
        pay.status ? up(pay.status) : '—',
        pay.cheque_status ? `<div class="sub" style="color:${isVoid ? '#ef4444' : '#64748b'}">${up(pay.cheque_status)}</div>` : '',
        assignedLabel ? `<div class="sub">Asgd: ${up(assignedLabel)}</div>` : '',
      ].join('');
      return `<tr>
        <td style="text-align:center">${idx + 1}</td>
        <td style="white-space:nowrap">${dt(pay.date)}</td>
        <td>${up(pay.payment_from || pay.payment_type)}${pay.payment_type ? `<div class="sub">${up(pay.payment_type)}</div>` : ''}</td>
        <td class="mono">${particularBits}</td>
        <td>${up(pay.received_by)}</td>
        <td>${up(pay.created_by_name)}</td>
        <td style="text-align:center; font-size:8px; font-weight:700">${statusCell}</td>
        <td class="amt" style="text-align:right; font-weight:700; color:${amountColor}${isVoid ? '; text-decoration:line-through' : ''}">${amt < 0 ? '-' : ''}₹${fmtINR(Math.abs(amt))}</td>
        <td style="text-align:right; font-weight:700; color:${!isPosted ? '#cbd5e1' : cumulativeColor}">${!isPosted ? '—' : `${running < 0 ? '-' : ''}₹${fmtINR(Math.abs(running))}`}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>STATEMENT OF ACCOUNT - ${plot.plot_no}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');
    @page { size: A4 portrait; margin: 8mm; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Inter', sans-serif; color: #1e293b; background: #f8fafc; padding: 8mm 0; display: flex; justify-content: center; }
    .document { background: white; width: 210mm; min-height: 297mm; padding: 10mm; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; position: relative; }
    .header { text-align: center; margin-bottom: 4mm; border-bottom: 3px double #0f172a; padding-bottom: 4mm; }
    .header h1 { font-family: 'Cinzel', serif; font-size: 23px; color: #0f172a; text-transform: uppercase; letter-spacing: 2px; }
    .header p { font-size: 9.5px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-top: 3px; }
    .stmt-title { text-align: center; margin-bottom: 4mm; font-family: 'Cinzel', serif; font-size: 13px; color: #64748b; text-decoration: underline; text-underline-offset: 4px; letter-spacing: 4px; text-transform: uppercase; }
    /* ── Sections ── */
    .sec { margin-bottom: 4mm; break-inside: avoid; }
    .sec-title { font-family: 'Cinzel', serif; font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 1.5px; padding-bottom: 2mm; margin-bottom: 3mm; border-bottom: 2px solid #0f172a; display: flex; justify-content: space-between; align-items: baseline; }
    .sec-note { font-family: 'Inter', sans-serif; font-size: 8.5px; letter-spacing: 0.5px; color: #94a3b8; font-weight: 600; }
    /* ── Particulars grid ── */
    .pgrid { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; }
    .pcell { padding: 2.4mm 3mm; border-right: 1px solid #eef2f6; border-bottom: 1px solid #eef2f6; }
    .plabel { font-size: 8px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.4px; margin-bottom: 1px; }
    .pval { font-size: 11px; font-weight: 600; color: #0f172a; }
    /* ── Financial band ── */
    .fin-band { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2.5mm; margin-bottom: 2.5mm; }
    .fin-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 2.5mm; text-align: center; }
    .fin-lbl { font-size: 8px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.4px; }
    .fin-val { font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 1mm; }
    .recon-line { display: flex; justify-content: space-between; gap: 5mm; flex-wrap: wrap; font-size: 9.3px; color: #475569; }
    .recon-line + .recon-line { margin-top: 1mm; }
    .notes-line { font-size: 9px; color: #475569; margin-top: 2mm; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 4mm; font-size: 10.5px; }
    thead { display: table-header-group; }
    th { background: #f1f5f9; padding: 2.4mm 2mm; text-align: left; text-transform: uppercase; font-size: 8.5px; font-weight: 800; color: #475569; border: 1px solid #cbd5e1; }
    td { padding: 2.2mm 2mm; border: 1px solid #e2e8f0; color: #334155; vertical-align: top; }
    tr:nth-child(even) { background: #fbfcfd; }
    .sub { font-size: 8px; color: #94a3b8; font-weight: 500; margin-top: 0.5mm; }
    .mono { font-family: 'Courier New', monospace; font-size: 9px; }
    /* Payment ledger — slightly compact type so the extra columns fit cleanly */
    .ledger { font-size: 9px; table-layout: fixed; }
    .ledger th { font-size: 7.6px; padding: 1.8mm 1.4mm; }
    .ledger td { padding: 1.6mm 1.4mm; word-break: break-word; }
    .ledger .mono { font-size: 8.2px; }
    .ledger .sub { font-size: 7.2px; margin-top: 0.3mm; }
    .ledger td.amt { font-size: 10.5px; white-space: nowrap; }
    .total-row td { background: #f8fafc; font-weight: 800; border-top: 2px solid #0f172a; font-size: 11px; color: #0f172a; }
    .bal-row td { background: #fff; font-weight: 800; font-size: 12px; }
    /* ── Footer / signatures ── */
    .sign-row { display: flex; justify-content: space-between; margin-top: 9mm; break-inside: avoid; }
    .sign-box { width: 42%; text-align: center; border-top: 1px solid #94a3b8; padding-top: 2mm; font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
    .footer { margin-top: 5mm; padding-top: 3mm; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; }
    @media print { body { background: white; padding: 0; } .document { box-shadow: none; border: none; width: 100%; padding: 0; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="document">
    <div class="header">
      <h1>${siteName}</h1>
      <p>${siteAddr || 'STATUTORY REAL PROPERTY DIVISION'}</p>
    </div>
    <div class="stmt-title">Statement of Account</div>

    <div class="sec">
      <div class="sec-title">Plot Particulars</div>
      <div class="pgrid">${particularsCells}${pricingCells}${commissionCells}</div>
      ${plot.notes ? `<div class="notes-line"><b>Notes:</b> ${up(plot.notes)}</div>` : ''}
    </div>

    <div class="sec">
      <div class="sec-title">Financial Summary</div>
      <div class="fin-band">
        <div class="fin-item"><div class="fin-lbl">Sale Consideration</div><div class="fin-val">₹${fmtINR(salePrice)}</div></div>
        <div class="fin-item"><div class="fin-lbl">Total Received</div><div class="fin-val" style="color:#059669">₹${fmtINR(totalReceived)}</div></div>
        <div class="fin-item"><div class="fin-lbl">Outstanding</div><div class="fin-val" style="color:${balanceColor}">${fmtSigned(balanceAmt)}</div></div>
        <div class="fin-item"><div class="fin-lbl">% Received</div><div class="fin-val" style="color:#7c3aed">${pctReceived.toFixed(1)}%</div></div>
      </div>
      <div class="recon-line">${bankCashLine}</div>
      ${firstInstallment > 0 ? `<div class="recon-line">1st Installment: <b>₹${fmtINR(firstInstallment)}</b> · Balance of 1st Installment: <b style="color:${balanceFirstInstallment <= 0 ? '#059669' : '#dc2626'}">${fmtSigned(balanceFirstInstallment)}</b></div>` : ''}
    </div>

    ${instSection}

    <div class="sec">
      <div class="sec-title">Payment Ledger <span class="sec-note">${selected.length} transaction${selected.length === 1 ? '' : 's'}</span></div>
      <table class="ledger">
        <thead>
          <tr>
            <th style="width:18px; text-align:center">#</th>
            <th style="width:50px">Date</th>
            <th style="width:52px">Mode</th>
            <th>Particulars</th>
            <th>Received By</th>
            <th>Created By</th>
            <th style="width:50px; text-align:center">Status</th>
            <th style="text-align:right; width:110px">Amount (₹)</th>
            <th style="text-align:right; width:76px">Cumulative (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${selected.length ? payRows : `<tr><td colspan="9" style="text-align:center; color:#94a3b8; padding:6mm">No payments recorded yet.</td></tr>`}
          <tr class="total-row">
            <td colspan="7" style="text-align:right">TOTAL RECEIVED</td>
            <td style="text-align:right; color:${grandTotal < 0 ? '#dc2626' : '#059669'}">${grandTotalSign}₹${fmtINR(Math.abs(grandTotal))}</td>
            <td></td>
          </tr>
          <tr class="bal-row">
            <td colspan="7" style="text-align:right">OUTSTANDING BALANCE</td>
            <td style="text-align:right; color:${balanceColor}">${balanceSign}₹${fmtINR(Math.abs(balanceAmt))}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="sign-row">
      <div class="sign-box">Authorised Signatory</div>
      <div class="sign-box">Allottee Signature</div>
    </div>
    <div class="footer">
      <span>Generated on ${new Date().toLocaleString('en-IN')}${(user?.full_name || user?.name) ? ' · By ' + (user.full_name || user.name) : ''}</span>
      <span>${siteName} · Authorized Statement</span>
    </div>
  </div>
  <div class="no-print" style="position:fixed; bottom: 30px; left:0; right:0; text-align:center;">
    <button onclick="(async () => { try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch(e){} window.print(); })()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#0f172a; color:#fff; border:none; border-radius:10px; cursor:pointer; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);">
      EXECUTE PRINT (A4)
    </button>
    <button onclick="window.close()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#fff; color:#475569; border:1px solid #e2e8f0; border-radius:10px; cursor:pointer; margin-left:15px;">
      TERMINATE
    </button>
  </div>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=1100,height=700');
    w.document.write(html);
    w.document.close();
  };

  // ─── Print Transactions Statement ───
  // A bare transactions ledger only — no company branding, no plot particulars,
  // no signatures. Just the list of payment transactions in an HTML table.
  const printTransactions = () => {
    const fmtINR = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
    const dt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
    const up = (s) => (s == null || String(s).trim() === '' ? '—' : String(s).toUpperCase());
    const selected = statementPayments;
    const grandTotal = totalReceived;
    const grandTotalSign = grandTotal < 0 ? '-' : '';

    // Cumulative is computed once after all posted source rows are merged and
    // sorted, so both printable statements use the same accounting sequence.
    const rows = selected.map((pay, idx) => {
      const amt = parseFloat(pay.amount) || 0;
      const isVoid = ['BOUNCED', 'RETURNED'].includes(pay.cheque_status);
      const isPosted = isActivePayment(pay);
      const running = parseFloat(pay.cumulative_amount) || 0;
      const fromMode = String(pay.payment_from || '').toUpperCase();
      const isRefundEntry = fromMode === 'REFUND';
      const amountColor = !isPosted ? '#94a3b8' : (isRefundEntry ? '#ca8a04' : (amt < 0 ? '#dc2626' : '#059669'));
      const cumulativeColor = running < 0 ? '#dc2626' : '#059669';
      const particularBits = [
        up(pay.bank_details || (pay.payment_type === 'CASH' ? 'CASH' : 'DIRECT')),
        pay.cheque_no ? `<div class="sub">CHQ #${pay.cheque_no}</div>` : '',
        pay.narration ? `<div class="sub">${pay.narration}</div>` : '',
      ].join('');
      const statusCell = [
        pay.status ? up(pay.status) : '—',
        pay.cheque_status ? `<div class="sub" style="color:${isVoid ? '#ef4444' : '#64748b'}">${up(pay.cheque_status)}</div>` : '',
      ].join('');
      return `<tr>
        <td style="text-align:center">${idx + 1}</td>
        <td style="white-space:nowrap">${dt(pay.date)}</td>
        <td>${up(pay.payment_from || pay.payment_type)}${pay.payment_type ? `<div class="sub">${up(pay.payment_type)}</div>` : ''}</td>
        <td class="mono">${particularBits}</td>
        <td style="text-align:center; font-size:8px; font-weight:700">${statusCell}</td>
        <td class="amt" style="text-align:right; font-weight:700; color:${amountColor}${isVoid ? '; text-decoration:line-through' : ''}">${amt < 0 ? '-' : ''}₹${fmtINR(Math.abs(amt))}</td>
        <td style="text-align:right; font-weight:700; color:${!isPosted ? '#cbd5e1' : cumulativeColor}">${!isPosted ? '—' : `${running < 0 ? '-' : ''}₹${fmtINR(Math.abs(running))}`}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>TRANSACTIONS STATEMENT</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    @page { size: A4 portrait; margin: 10mm; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Inter', sans-serif; color: #1e293b; background: #f8fafc; padding: 8mm 0; display: flex; justify-content: center; }
    .document { background: white; width: 210mm; min-height: 297mm; padding: 12mm; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
    .stmt-title { text-align: center; margin-bottom: 6mm; font-size: 16px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 3px; padding-bottom: 3mm; border-bottom: 2px solid #0f172a; }
    table { width: 100%; border-collapse: collapse; font-size: 9px; table-layout: fixed; }
    thead { display: table-header-group; }
    th { background: #0f172a; padding: 2mm 1.5mm; text-align: left; text-transform: uppercase; font-size: 7.6px; font-weight: 700; letter-spacing: 0.3px; color: #fff; border: 1px solid #0f172a; vertical-align: middle; }
    td { padding: 1.8mm 1.5mm; border: 1px solid #e2e8f0; color: #334155; vertical-align: top; overflow-wrap: anywhere; word-break: break-word; line-height: 1.35; }
    tbody tr { break-inside: avoid; page-break-inside: avoid; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    .sub { font-size: 7.2px; color: #94a3b8; font-weight: 500; margin-top: 0.5mm; }
    .mono { font-family: 'Courier New', monospace; font-size: 8.2px; }
    td.amt, tbody td:last-child { font-size: 10px; white-space: nowrap; text-align: right; }
    .total-row td { background: #ecfdf5; font-weight: 800; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; font-size: 11px; color: #0f172a; padding: 2.4mm 1.5mm; }
    .footer { margin-top: 5mm; padding-top: 3mm; border-top: 1px solid #e2e8f0; text-align: right; font-size: 9px; color: #94a3b8; }
    @media print { body { background: white; padding: 0; } .document { box-shadow: none; border: none; width: 100%; min-height: 0; padding: 0; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="document">
    <div class="stmt-title">Transactions Statement</div>
    <table>
      <colgroup>
        <col style="width:5%" />
        <col style="width:13%" />
        <col style="width:13%" />
        <col style="width:29%" />
        <col style="width:13%" />
        <col style="width:14%" />
        <col style="width:13%" />
      </colgroup>
      <thead>
        <tr>
          <th style="text-align:center">#</th>
          <th>Date</th>
          <th>Mode</th>
          <th>Particulars</th>
          <th style="text-align:center">Status</th>
          <th style="text-align:right">Amount (₹)</th>
          <th style="text-align:right">Cumulative (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${selected.length ? rows : `<tr><td colspan="7" style="text-align:center; color:#94a3b8; padding:6mm">No transactions recorded yet.</td></tr>`}
        <tr class="total-row">
          <td colspan="5" style="text-align:right">TOTAL RECEIVED</td>
          <td style="text-align:right; color:${grandTotal < 0 ? '#dc2626' : '#059669'}">${grandTotalSign}₹${fmtINR(Math.abs(grandTotal))}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
    <div class="footer">Generated on ${new Date().toLocaleString('en-IN')} · ${selected.length} transaction${selected.length === 1 ? '' : 's'}</div>
  </div>
  <div class="no-print" style="position:fixed; bottom: 30px; left:0; right:0; text-align:center;">
    <button onclick="(async () => { try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch(e){} window.print(); })()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#0f172a; color:#fff; border:none; border-radius:10px; cursor:pointer; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);">
      EXECUTE PRINT (A4)
    </button>
    <button onclick="window.close()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#fff; color:#475569; border:1px solid #e2e8f0; border-radius:10px; cursor:pointer; margin-left:15px;">
      TERMINATE
    </button>
  </div>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=1100,height=700');
    w.document.write(html);
    w.document.close();
  };

  // ─── Take Payment Dialog ───
  const [payOpen, setPayOpen] = useState(false);
  const [payMode, setPayMode] = useState('receive');
  const [payForm, setPayForm] = useState({
    date: todayStr(),
    payment_from: '',
    payment_type: 'CASH',
    bank_name: '',
    branch: '',
    bank_details: '',
    narration: '',
    buyer_name: '',
    booked_by: '',
    amount: '',
    voucher_url: '',
    assigned_admin_id: null,
    cheque_no: '',
    received_by: '',
  });
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [voucherUploading, setVoucherUploading] = useState(false);
  const [payBuyerOpen, setPayBuyerOpen] = useState(false);
  const [payBookedByOpen, setPayBookedByOpen] = useState(false);
  const [payBuyerSearch, setPayBuyerSearch] = useState('');
  const [payBookedBySearch, setPayBookedBySearch] = useState('');
  const bookedByRef = useRef(null);
  const bookedByInputRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!payBookedByOpen) return;
    const handler = (e) => {
      if (bookedByRef.current && !bookedByRef.current.contains(e.target)) {
        setPayBookedByOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [payBookedByOpen]);

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (payBookedByOpen && bookedByInputRef.current) {
      setTimeout(() => bookedByInputRef.current?.focus(), 0);
    }
  }, [payBookedByOpen]);

  const filteredBookedByMembers = useMemo(() => {
    const q = (payBookedBySearch || '').trim().toLowerCase();
    const members = autocomplete?.members || [];
    if (!q) return members;
    const words = q.split(/\s+/).filter(Boolean);
    const scored = [];
    for (const m of members) {
      const name = (m.name || '').toLowerCase();
      const phone = (m.phone || '').toLowerCase();
      const nameLC = name;
      // Every query word must match name or phone
      const allMatch = words.every(w => nameLC.includes(w) || phone.includes(w));
      if (!allMatch) continue;
      // Score: exact start > word-start > contains
      let score = 0;
      if (nameLC === q) score = 100;
      else if (nameLC.startsWith(q)) score = 80;
      else if (nameLC.split(/\s+/).some(w => w.startsWith(words[0]))) score = 60;
      else score = 40;
      scored.push({ m, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.m);
  }, [payBookedBySearch, autocomplete?.members]);

  const resetPayForm = () => {
    setPayForm({ date: todayStr(), payment_from: '', payment_type: 'CASH', bank_name: '', branch: '', bank_details: '', narration: '', buyer_name: plot?.buyer_name || '', booked_by: '', amount: '', voucher_url: '', assigned_admin_id: null, cheque_no: '', received_by: '' });
    setEditingPaymentId(null);
    setPayMode('receive');
    setPayBuyerSearch('');
    setPayBookedBySearch('');
    setVoucherUploading(false);
  };

  const handleOpenPay = () => { resetPayForm(); setPayOpen(true); };

  const handleEditPayment = (p) => {
    setEditingPaymentId(p.id);
    setPayMode(parseFloat(p.amount) < 0 ? 'refund' : 'receive');
    setPayForm({
      date: p.date ? p.date.split('T')[0] : todayStr(),
      payment_from: p.payment_from || '',
      payment_type: p.payment_type || 'BANK',
      bank_name: p.bank_name || '',
      branch: p.branch || '',
      bank_details: p.bank_details || '',
      narration: p.narration || '',
      buyer_name: p.buyer_name || '',
      booked_by: p.booked_by || '',
      amount: String(Math.abs(parseFloat(p.amount) || 0)),
      voucher_url: p.voucher_url || '',
      assigned_admin_id: p.assigned_admin_id || null,
      cheque_no: p.cheque_no || '',
      received_by: p.received_by || '',
    });
    setPayOpen(true);
  };

  const handleDeletePayment = async (payId) => {
    if (!window.confirm('Delete this payment? This cannot be undone.')) return;
    try {
      await api.delete(`/plots/payments/${payId}`);
      showMsg('success', 'Payment deleted');
      fetchAll();
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Failed to delete payment');
    }
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (voucherUploading) {
      showMsg('error', 'Please wait for the voucher photo to finish uploading.');
      return;
    }
    setPaySubmitting(true);
    try {
      const rawAmt = Math.abs(parseFloat(payForm.amount) || 0);
      const payload = {
        date: payForm.date,
        payment_from: payForm.payment_from,
        payment_type: payForm.payment_type,
        bank_name: payForm.payment_type === 'BANK' ? (payForm.bank_name || null) : null,
        branch: payForm.payment_type === 'BANK' ? (payForm.branch || null) : null,
        bank_details: payForm.bank_details,
        narration: payForm.narration,
        buyer_name: payForm.buyer_name,
        booked_by: payForm.booked_by,
        amount: payMode === 'refund' ? -rawAmt : rawAmt,
        voucher_url: payForm.voucher_url || null,
        assigned_admin_id: payForm.assigned_admin_id,
        cheque_no: payForm.payment_type === 'CHEQUE' ? (payForm.cheque_no || null) : null,
        received_by: payForm.received_by || null,
      };
      if (editingPaymentId) {
        await api.put(`/plots/payments/${editingPaymentId}`, payload);
        showMsg('success', 'Payment updated');
      } else {
        await api.post('/plots/payments', { ...payload, plot_id: id });
        showMsg('success', payMode === 'refund' ? 'Refund recorded' : 'Payment recorded');
      }
      setPayOpen(false);
      fetchAll();
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Failed to save payment');
    } finally {
      setPaySubmitting(false);
    }
  };

  // ══════════════════════════════════════════════════
  //  FETCH
  // ══════════════════════════════════════════════════

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [plotRes, payRes, instRes, instPayRes, appRes, acRes] = await Promise.all([
        api.get(`/plots/${id}`),
        api.get(`/plots/payments/list?plot_id=${id}`),
        api.get(`/plots/${id}/installments`),
        api.get(`/plots/${id}/installment-payments`),
        api.get(currentSite?.id ? `/admin/approvers?site_id=${currentSite.id}` : '/admin/approvers').catch(() => ({ data: { approvers: [] } })),
        currentSite?.id ? api.get(`/plots/autocomplete?site_id=${currentSite.id}`).catch(() => ({ data: { members: [] } })) : Promise.resolve({ data: { members: [] } }),
      ]);
      setPlot(plotRes.data.plot || plotRes.data);
      setPayments(payRes.data.payments || []);
      setFromBreakdown(payRes.data.fromBreakdown || []);
      setReceivedByBreakdown(payRes.data.receivedByBreakdown || []);
      setInstallments(instRes.data.installments || []);
      setInstallmentPayments(instPayRes.data.payments || []);
      setApprovers(appRes.data.approvers || []);
      setAutocomplete(acRes.data || { members: [] });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to load plot data' });
    } finally {
      setLoading(false);
    }
  }, [id, currentSite?.id]);

  const getAssignedAdminLabel = (payment) => {
    if (!payment.assigned_admin_id || approvers.length === 0) return null;
    const admin = approvers.find((a) => String(a.id) === String(payment.assigned_admin_id));
    if (!admin) return `Admin #${payment.assigned_admin_id}`;
    return admin.full_name || admin.name || admin.email || `Admin #${admin.id}`;
  };

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Computed ──
  const isActivePayment = (p) => (
    String(p.status || 'approved').toLowerCase() === 'approved'
    && !['BOUNCED', 'RETURNED'].includes(String(p.cheque_status || '').toUpperCase())
  );
  const statementPayments = useMemo(() => {
    const postedDirect = payments
      .filter((payment) => (
        String(payment.status || 'approved').toLowerCase() === 'approved'
        && !['BOUNCED', 'RETURNED'].includes(String(payment.cheque_status || '').toUpperCase())
      ))
      .map((payment) => ({
        ...payment,
        statement_key: `plot-payment-${payment.id}`,
        statement_source: 'plot_payment',
      }));

    // Installment payments are posted at creation time. Read their individual
    // source rows instead of the schedule's paid_amount aggregate, which keeps
    // each receipt in the statement exactly once.
    const postedInstallments = installmentPayments
      .filter((payment) => !['BOUNCED', 'RETURNED'].includes(String(payment.cheque_status || '').toUpperCase()))
      .map((payment) => {
        const rawMode = String(payment.payment_mode || '').trim() || 'BANK';
        return {
          id: `installment-${payment.id}`,
          statement_key: `installment-payment-${payment.id}`,
          statement_source: 'plot_installment_payment',
          source_id: payment.id,
          date: payment.payment_date,
          created_at: payment.created_at,
          amount: payment.amount,
          payment_from: rawMode,
          payment_type: derivePaymentType(rawMode),
          bank_details: payment.reference || '',
          narration: [payment.installment_name, payment.notes].filter(Boolean).join(' · '),
          cheque_no: payment.cheque_no || null,
          cheque_status: payment.cheque_status || null,
          received_by: payment.installment_name || 'Installment',
          created_by_name: payment.created_by_name || '',
          status: 'approved',
        };
      });

    let cumulative = 0;
    return [...postedDirect, ...postedInstallments]
      .sort((a, b) => (
        String(a.date || '').localeCompare(String(b.date || ''))
        || String(a.created_at || '').localeCompare(String(b.created_at || ''))
        || String(a.statement_key).localeCompare(String(b.statement_key))
      ))
      .map((payment) => {
        cumulative += parseFloat(payment.amount) || 0;
        return { ...payment, cumulative_amount: cumulative };
      });
  }, [payments, installmentPayments]);
  const salePrice = parseFloat(plot?.sale_price) || 0;
  const totalReceived = parseFloat(plot?.total_received) || 0;
  const balance = salePrice - totalReceived;
  const pctReceived = salePrice > 0 ? (totalReceived / salePrice) * 100 : 0;
  const toReceiveBank = parseFloat(plot?.to_receive_bank) || 0;
  const toReceiveCash = salePrice - toReceiveBank;
  const receivedBank = parseFloat(plot?.received_bank) || 0;
  const receivedCash = parseFloat(plot?.received_cash) || 0;
  const balanceBank = toReceiveBank - receivedBank;
  const balanceCash = toReceiveCash - receivedCash;
  const firstInstallment = parseFloat(plot?.first_installment) || 0;
  const balanceFirstInstallment = firstInstallment - totalReceived;
  const registryArea = parseFloat(plot?.registry_area) || 0;
  const circleRate = parseFloat(plot?.circle_rate) || 0;
  const toReceiveCircle = registryArea * circleRate;

  const instTotal = useMemo(() => installments.reduce((s, i) => s + parseFloat(i.amount || 0), 0), [installments]);
  const instPaid = useMemo(() => installments.reduce((s, i) => s + parseFloat(i.paid_amount || 0), 0), [installments]);
  const instRemaining = instTotal - instPaid;
  const instInterest = useMemo(() => installments.reduce((s, i) => s + (i.interest_due || 0), 0), [installments]);
  const instOverdue = useMemo(() => installments.filter(i => i.status === 'overdue').length, [installments]);
  const instOverdueAmt = useMemo(() => installments.filter(i => i.status === 'overdue' || i.status === 'partially_paid').reduce((s, i) => s + Math.max(parseFloat(i.amount || 0) - parseFloat(i.paid_amount || 0), 0), 0), [installments]);
  const instPaidPct = instTotal > 0 ? (instPaid / instTotal) * 100 : 0;
  const nextDueInst = useMemo(() => installments.find(i => i.status === 'pending' || i.status === 'partially_paid' || i.status === 'overdue'), [installments]);

  // ══════════════════════════════════════════════════
  //  HELPERS
  // ══════════════════════════════════════════════════

  const getStatusBadge = (status) => (
    <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{status}</Badge>
  );

  const instStatusBadge = (status) => {
    const cfg = INST_STATUS[status] || INST_STATUS.pending;
    const Icon = cfg.icon;
    return <Badge variant="outline" className={`text-[10px] font-semibold ${cfg.color} gap-1`}><Icon className="w-3 h-3" /> {cfg.label}</Badge>;
  };

  const showMsg = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  // ══════════════════════════════════════════════════
  //  INSTALLMENT ACTIONS
  // ══════════════════════════════════════════════════

  // Create installments
  const addInstRow = () => setInstRows(prev => [...prev, { installment_name: '', percentage: '', amount: '', due_date: '' }]);
  const removeInstRow = (i) => setInstRows(prev => prev.filter((_, idx) => idx !== i));
  const updateInstRow = (i, field, val) => setInstRows(prev => prev.map((r, idx) => {
    if (idx !== i) return r;
    const updated = { ...r, [field]: val };
    if (field === 'percentage' && val !== '' && salePrice > 0) {
      updated.amount = ((parseFloat(val) / 100) * salePrice).toFixed(2);
    } else if (field === 'amount' && val !== '' && salePrice > 0) {
      updated.percentage = ((parseFloat(val) / salePrice) * 100).toFixed(2);
    }
    return updated;
  }));

  const handleCreateInstallments = async (e) => {
    e.preventDefault();
    const valid = instRows.filter(r => r.amount && r.due_date);
    if (valid.length === 0) return showMsg('error', 'Add at least one valid installment');
    setInstSubmitting(true);
    try {
      await api.post(`/plots/${id}/installments`, { installments: valid });
      showMsg('success', `${valid.length} installment(s) created`);
      setInstOpen(false);
      setInstRows([{ installment_name: '', percentage: '', amount: '', due_date: '' }]);
      fetchAll();
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Failed to create installments');
    } finally {
      setInstSubmitting(false);
    }
  };

  // Edit installment
  const openEditInst = (inst) => {
    setEditInstForm({
      id: inst.id,
      installment_name: inst.installment_name || '',
      amount: inst.amount || '',
      due_date: inst.due_date ? new Date(inst.due_date).toISOString().split('T')[0] : '',
    });
    setEditInstOpen(true);
  };

  const handleUpdateInstallment = async (e) => {
    e.preventDefault();
    setEditInstSubmitting(true);
    try {
      await api.put(`/plots/installments/${editInstForm.id}`, {
        installment_name: editInstForm.installment_name,
        amount: parseFloat(editInstForm.amount) || 0,
        due_date: editInstForm.due_date,
      });
      showMsg('success', 'Installment updated');
      setEditInstOpen(false);
      fetchAll();
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Update failed');
    } finally {
      setEditInstSubmitting(false);
    }
  };

  // Delete installment
  const handleDeleteInstallment = async (instId) => {
    try {
      await api.delete(`/plots/installments/${instId}`);
      showMsg('success', 'Installment deleted');
      fetchAll();
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Delete failed');
    }
  };

  // Settings
  const openSettings = () => {
    setSettingsForm({
      installments_enabled: !!plot?.installments_enabled,
      interest_enabled: !!plot?.interest_enabled,
      interest_rate: plot?.interest_rate || '',
      interest_type: plot?.interest_type || 'per_month',
      penalty_enabled: !!plot?.penalty_enabled,
      penalty_rate: plot?.penalty_rate != null ? String(plot.penalty_rate) : '',
      penalty_type: plot?.penalty_type || 'per_day',
      free_to_sale_days: plot?.free_to_sale_days != null ? String(plot.free_to_sale_days) : '0',
    });
    setSettingsOpen(true);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsSubmitting(true);
    try {
      await api.put(`/plots/${id}/installment-settings`, settingsForm);
      showMsg('success', 'Settings updated');
      setSettingsOpen(false);
      fetchAll();
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSettingsSubmitting(false);
    }
  };

  // Confirm
  const confirmAndDo = (action) => { setConfirmAction(() => action); setConfirmOpen(true); };
  const executeConfirm = () => { if (confirmAction) confirmAction(); setConfirmOpen(false); setConfirmAction(null); };

  // ══════════════════════════════════════════════════
  //  LOADING / ERROR
  // ══════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!plot) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-slate-400 gap-3">
        <AlertTriangle className="w-10 h-10" />
        <p className="text-sm">Plot not found</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/plot-payments')}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
      </div>
    );
  }

  // ══════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/plot-payments')} className="h-8 w-8 p-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">
                Plot {plot.plot_no}{plot.block ? ` — Block ${plot.block}` : ''}
              </h1>
              {getStatusBadge(plot.status)}
              {plot.installments_enabled && (
                <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">Installments</Badge>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {plot.buyer_name && <span className="font-medium text-slate-600">{plot.buyer_name}</span>}
              {plot.booking_by && <span className="text-slate-400"> · Booked by {plot.booking_by}</span>}
              {plot.booking_date && <span className="text-slate-400"> · {fmtDate(plot.booking_date)}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={printStatement} className="text-xs h-8 border-blue-200 text-blue-700 hover:bg-blue-50">
            <Printer className="w-3.5 h-3.5 mr-1.5" /> Print Statement
          </Button>
          <Button variant="outline" size="sm" onClick={printTransactions} className="text-xs h-8 border-slate-200 text-slate-700 hover:bg-slate-50">
            <FileText className="w-3.5 h-3.5 mr-1.5" /> Print Transactions
          </Button>

          <Button size="sm" className="text-xs h-8" onClick={handleOpenPay}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Take Payment
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={openSettings}>
            <Settings className="w-3.5 h-3.5 mr-1" /> Settings
          </Button>
        </div>
      </div>

      {/* ── Message ── */}
      {message.text && (
        <div className={`rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {message.text}
          <X className="w-4 h-4 ml-auto cursor-pointer" onClick={() => setMessage({ type: '', text: '' })} />
        </div>
      )}

      {/* ── Plot Info Strip ── */}
      <Card className="shadow-none border-slate-200 bg-slate-50/60">
        <CardContent className="p-3">
          <div className="flex items-center gap-6 flex-wrap text-xs">
            <div className="flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500">Size:</span>
              <span className="font-semibold text-slate-700">{plot.plot_size || '—'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500">Rate:</span>
              <span className="font-semibold text-slate-700">₹{fmt(plot.plot_rate)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-slate-500">Reg. Area:</span>
              <span className="font-semibold text-slate-700">{plot.registry_area || '—'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CircleDollarSign className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-slate-500">Circle Rate:</span>
              <span className="font-semibold text-slate-700">₹{fmt(plot.circle_rate)}</span>
            </div>
            {plot.team && (
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-slate-500">Team:</span>
                <span className="font-semibold text-indigo-700">{plot.team}</span>
              </div>
            )}
            {plot.notes && (
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500 truncate max-w-xs">{plot.notes}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Rate Change Tracker (shows when discount was applied during booking) ── */}
      {parseFloat(plot.original_plot_rate) > 0 && parseFloat(plot.original_plot_rate) !== (parseFloat(plot.plot_rate) || 0) && (
        <Card className="shadow-none border-amber-200 bg-amber-50/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
              <p className="text-xs font-semibold text-amber-800">Rate Change on Booking</p>
            </div>
            <div className="flex items-center gap-6 flex-wrap text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Original Rate:</span>
                <span className="font-semibold text-slate-600 line-through">₹{fmt(plot.original_plot_rate)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Discount:</span>
                <span className="font-semibold text-red-600">-₹{fmt(plot.discount_rate)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Booking Rate:</span>
                <span className="font-bold text-emerald-700">₹{fmt(plot.plot_rate)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Original Price:</span>
                <span className="font-semibold text-slate-600 line-through">₹{fmt((parseFloat(plot.plot_size) || 0) * (parseFloat(plot.original_plot_rate) || 0))}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Current Price:</span>
                <span className="font-bold text-blue-700">₹{fmt(plot.sale_price)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Sale Price</p>
              <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center"><IndianRupee className="w-3 h-3 text-blue-600" /></div>
            </div>
            <p className="text-lg font-bold text-slate-900 mt-1">₹{fmt(salePrice)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Received</p>
              <div className="w-6 h-6 rounded-md bg-emerald-50 flex items-center justify-center"><ArrowDownRight className="w-3 h-3 text-emerald-600" /></div>
            </div>
            <p className="text-lg font-bold text-emerald-700 mt-1">₹{fmt(totalReceived)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Balance</p>
              <div className={`w-6 h-6 rounded-md flex items-center justify-center ${balance <= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <Banknote className={`w-3 h-3 ${balance <= 0 ? 'text-emerald-600' : 'text-red-500'}`} /></div>
            </div>
            <p className={`text-lg font-bold mt-1 ${balance <= 0 ? 'text-emerald-700' : 'text-red-600'}`}>₹{fmt(balance)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">% Received</p>
              <div className="w-6 h-6 rounded-md bg-purple-50 flex items-center justify-center"><Percent className="w-3 h-3 text-purple-600" /></div>
            </div>
            <p className="text-lg font-bold text-purple-700 mt-1">{pctReceived.toFixed(1)}%</p>
            <div className="w-full h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${pctReceived >= 100 ? 'bg-emerald-500' : pctReceived >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(pctReceived, 100)}%` }} />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Payments</p>
              <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center"><Hash className="w-3 h-3 text-slate-600" /></div>
            </div>
            <p className="text-lg font-bold text-slate-900 mt-1">{payments.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Bank / Cash Split ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-none border-blue-200 bg-blue-50/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center"><Landmark className="w-3 h-3 text-blue-700" /></div>
              <p className="text-xs font-bold text-blue-900 uppercase tracking-wide">Bank Split</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><p className="text-[9px] uppercase tracking-wider text-blue-400 font-medium text-nowrap">Goal</p><p className="text-sm font-bold text-blue-800">₹{fmt(toReceiveBank)}</p></div>
              <div><p className="text-[9px] uppercase tracking-wider text-blue-400 font-medium text-nowrap">Recvd</p><p className="text-sm font-bold text-emerald-700">₹{fmt(receivedBank)}</p></div>
              <div><p className="text-[9px] uppercase tracking-wider text-blue-400 font-medium text-nowrap">Bal</p><p className={`text-sm font-bold ${balanceBank <= 0 ? 'text-emerald-700' : 'text-red-600'}`}>₹{fmt(balanceBank)}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none border-emerald-200 bg-emerald-50/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center"><Wallet className="w-3 h-3 text-emerald-700" /></div>
              <p className="text-xs font-bold text-emerald-900 uppercase tracking-wide">Cash Split</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><p className="text-[9px] uppercase tracking-wider text-emerald-400 font-medium text-nowrap">Goal</p><p className="text-sm font-bold text-emerald-800">₹{fmt(toReceiveCash)}</p></div>
              <div><p className="text-[9px] uppercase tracking-wider text-emerald-400 font-medium text-nowrap">Recvd</p><p className="text-sm font-bold text-emerald-700">₹{fmt(receivedCash)}</p></div>
              <div><p className="text-[9px] uppercase tracking-wider text-emerald-400 font-medium text-nowrap">Bal</p><p className={`text-sm font-bold ${balanceCash <= 0 ? 'text-emerald-700' : 'text-red-600'}`}>₹{fmt(balanceCash)}</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 1st Installment & Circle Rate Strip ── */}
      {(firstInstallment > 0 || toReceiveCircle > 0) && (
        <Card className="shadow-none border-slate-200 bg-slate-50/40">
          <CardContent className="p-3">
            <div className="flex items-center gap-6 flex-wrap text-xs">
              {toReceiveCircle > 0 && (
                <div className="flex items-center gap-1.5">
                  <CircleDollarSign className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-slate-500">To Receive (Area × Circle):</span>
                  <span className="font-bold text-amber-700">₹{fmt(toReceiveCircle)}</span>
                </div>
              )}
              {firstInstallment > 0 && (
                <>
                  <div className="flex items-center gap-1.5">
                    <Banknote className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="text-slate-500">1st Installment:</span>
                    <span className="font-bold text-indigo-700">₹{fmt(firstInstallment)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Banknote className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-500">Bal. of 1st Inst.:</span>
                    <span className={`font-bold ${balanceFirstInstallment <= 0 ? 'text-emerald-700' : 'text-red-600'}`}>₹{fmt(balanceFirstInstallment)}</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════ TABS: Installments / Payment History ═══════════ */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 h-9">
          {!!plot?.installments_enabled && (
          <TabsTrigger value="installments" className="text-xs">
            <CalendarClock className="w-3.5 h-3.5 mr-1.5" />
            Installments {installments.length > 0 && `(${installments.length})`}
          </TabsTrigger>
          )}
          <TabsTrigger value="payments" className="text-xs">
            <CreditCard className="w-3.5 h-3.5 mr-1.5" />
            Payment History ({payments.length})
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB: Installments ─── */}
        <TabsContent value="installments" className="mt-4 space-y-4">
          {/* Installment Analytics Cards */}
          {installments.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Total Scheduled */}
                <Card className="shadow-none border-slate-200">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Scheduled</p>
                      <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center"><CalendarClock className="w-3 h-3 text-blue-600" /></div>
                    </div>
                    <p className="text-lg font-bold text-slate-900">₹{fmt(instTotal)}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{installments.length} installment{installments.length > 1 ? 's' : ''}</p>
                  </CardContent>
                </Card>

                {/* Paid */}
                <Card className="shadow-none border-emerald-200 bg-emerald-50/20">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-500 font-medium">Paid</p>
                      <div className="w-6 h-6 rounded-md bg-emerald-50 flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-emerald-600" /></div>
                    </div>
                    <p className="text-lg font-bold text-emerald-700">₹{fmt(instPaid)}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="w-full h-1 bg-emerald-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(instPaidPct, 100)}%` }} />
                      </div>
                      <span className="text-[10px] text-emerald-600 font-medium w-8 text-right">{instPaidPct.toFixed(0)}%</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Remaining */}
                <Card className="shadow-none border-slate-200">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Remaining</p>
                      <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center"><Banknote className="w-3 h-3 text-slate-500" /></div>
                    </div>
                    <p className={`text-lg font-bold ${instRemaining > 0 ? 'text-slate-700' : 'text-emerald-700'}`}>₹{fmt(instRemaining)}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{installments.filter(i => i.status !== 'paid').length} unpaid</p>
                  </CardContent>
                </Card>

                {/* Overdue Amount */}
                <Card className={`shadow-none ${instOverdue > 0 ? 'border-red-200 bg-red-50/20' : 'border-slate-200'}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className={`text-[10px] uppercase tracking-wider font-medium ${instOverdue > 0 ? 'text-red-500' : 'text-slate-400'}`}>Late Due</p>
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center ${instOverdue > 0 ? 'bg-red-50' : 'bg-slate-100'}`}><AlertTriangle className={`w-3 h-3 ${instOverdue > 0 ? 'text-red-500' : 'text-slate-400'}`} /></div>
                    </div>
                    <p className={`text-lg font-bold ${instOverdue > 0 ? 'text-red-600' : 'text-slate-400'}`}>₹{fmt(instOverdueAmt)}</p>
                    <p className={`text-[10px] mt-1 ${instOverdue > 0 ? 'text-red-400' : 'text-slate-400'}`}>{instOverdue} overdue installment{instOverdue !== 1 ? 's' : ''}</p>
                  </CardContent>
                </Card>

                {/* Interest Due */}
                <Card className={`shadow-none ${instInterest > 0 ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200'}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className={`text-[10px] uppercase tracking-wider font-medium ${instInterest > 0 ? 'text-amber-600' : 'text-slate-400'}`}>Interest Due</p>
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center ${instInterest > 0 ? 'bg-amber-50' : 'bg-slate-100'}`}><TrendingUp className={`w-3 h-3 ${instInterest > 0 ? 'text-amber-600' : 'text-slate-400'}`} /></div>
                    </div>
                    <p className={`text-lg font-bold ${instInterest > 0 ? 'text-amber-700' : 'text-slate-400'}`}>₹{fmt(instInterest)}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {plot.interest_enabled ? `${plot.interest_rate}% ${INTEREST_TYPES.find(t => t.value === plot.interest_type)?.label || ''}` : 'Interest off'}
                    </p>
                  </CardContent>
                </Card>

                {/* Next Due */}
                <Card className="shadow-none border-indigo-200 bg-indigo-50/20">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] uppercase tracking-wider text-indigo-500 font-medium">Next Due</p>
                      <div className="w-6 h-6 rounded-md bg-indigo-50 flex items-center justify-center"><Calendar className="w-3 h-3 text-indigo-600" /></div>
                    </div>
                    {nextDueInst ? (
                      <>
                        <p className="text-lg font-bold text-indigo-700">₹{fmt(Math.max(parseFloat(nextDueInst.amount) - parseFloat(nextDueInst.paid_amount), 0))}</p>
                        <p className="text-[10px] text-indigo-400 mt-1">{fmtDate(nextDueInst.due_date)} · {nextDueInst.installment_name || 'Next'}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-bold text-emerald-600">All Paid</p>
                        <p className="text-[10px] text-emerald-400 mt-1">No pending dues</p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {canWrite && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => { setInstRows([{ installment_name: '', percentage: '', amount: '', due_date: '' }]); setInstOpen(true); }}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Installments
              </Button>
            </div>
          )}

          {/* Installment Timeline */}
          {installments.length === 0 ? (
            <Card className="shadow-none border-slate-200">
              <CardContent className="py-12 text-center">
                <CalendarClock className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No installments defined yet</p>
                <p className="text-xs text-slate-400 mt-1">Click "Add Installments" to create an installment schedule</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {installments.map((inst, idx) => {
                const cfg = INST_STATUS[inst.status] || INST_STATUS.pending;
                const pct = progressPct(inst.paid_amount, inst.amount);
                const remaining = Math.max(parseFloat(inst.amount) - parseFloat(inst.paid_amount), 0);
                const isOverdue = new Date(inst.due_date) < new Date() && inst.status !== 'paid';
                return (
                  <Card key={inst.id} className={`shadow-none border-slate-200 ${isOverdue ? 'border-l-4 border-l-red-400' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`w-9 h-9 rounded-full ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                            <span className="text-xs font-bold text-slate-600">{idx + 1}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-slate-900">{inst.installment_name || `Installment ${idx + 1}`}</p>
                              {instStatusBadge(inst.status)}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Due: {fmtDate(inst.due_date)}</span>
                              <span>Amount: <strong className="text-slate-700">₹{fmt(inst.amount)}</strong></span>
                              <span>Paid: <strong className="text-emerald-600">₹{fmt(inst.paid_amount)}</strong></span>
                              <span>Remaining: <strong className={remaining > 0 ? 'text-red-600' : 'text-emerald-600'}>₹{fmt(remaining)}</strong></span>
                            </div>
                            {inst.interest_due > 0 && (
                              <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" /> Interest due: ₹{fmt(inst.interest_due)}
                              </p>
                            )}
                            <div className="mt-2 flex items-center gap-2">
                              <Progress value={pct} className="h-1.5 flex-1" />
                              <span className="text-[10px] text-slate-500 w-8 text-right">{pct}%</span>
                            </div>
                          </div>
                        </div>
                        {/* Actions */}
                        {(canUpdate || canDelete) && (
                          <div className="flex items-center gap-1 shrink-0">
                            {canUpdate && <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => openEditInst(inst)}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>}
                            {canDelete && <Button variant="ghost" size="icon" className="h-7 w-7" title="Delete" onClick={() => confirmAndDo(() => handleDeleteInstallment(inst.id))}>
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </Button>}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ─── TAB: Payment History ─── */}
        <TabsContent value="payments" className="mt-4">
          <Card className="shadow-none border-slate-200">
            <CardContent className="p-0">
              {payments.length === 0 ? (
                <div className="text-center py-12">
                  <CreditCard className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No payments recorded yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent bg-slate-50/80">
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-10">#</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-24">Date</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-28">From</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-20">Type</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-32">Amount (₹)</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Assigned To</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Created By</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Bank Details</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Narration</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Received By</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Buyer</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Booked By</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Cheque No</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Cheque</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Voucher</TableHead>
                        <TableHead className="w-28 text-right text-[11px] font-semibold uppercase text-slate-500">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((p, i) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs text-slate-400 tabular-nums">{i + 1}</TableCell>
                          <TableCell className="text-xs tabular-nums">{fmtDate(p.date)}</TableCell>
                          <TableCell>
                            {p.payment_from && (
                              <Badge variant="outline" className={`text-[10px] font-medium ${FROM_COLORS[p.payment_from] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{p.payment_from}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] font-medium ${p.payment_type === 'BANK' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                              {p.payment_type}
                            </Badge>
                          </TableCell>
                           <TableCell className={`text-sm text-right font-semibold tabular-nums ${String(p.payment_from || '').toUpperCase() === 'REFUND' ? 'text-amber-600' : p.amount < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{p.amount < 0 ? '-' : ''}₹{fmt(Math.abs(p.amount))}</TableCell>
                          <TableCell>
                            {p.assigned_admin_id ? (
                              <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-100 italic">
                                {getAssignedAdminLabel(p) || '—'}
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-slate-300 italic">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-slate-600">{p.created_by_name || '—'}</span>
                          </TableCell>
                          <TableCell className="text-xs text-slate-500 max-w-[120px] truncate font-mono">{p.bank_details || '—'}</TableCell>
                          <TableCell className="text-xs text-slate-500 max-w-[150px] truncate">{p.narration || '—'}</TableCell>
                          <TableCell className="text-xs font-medium">{p.received_by || '—'}</TableCell>
                          <TableCell className="text-xs font-medium">{p.buyer_name || '—'}</TableCell>
                          <TableCell className="text-xs font-medium">{p.booked_by || '—'}</TableCell>
                          <TableCell>
                            <ApprovalStatusBadge status={p.status} />
                          </TableCell>
                          <TableCell>
                            {p.cheque_no ? <span className="text-xs font-mono font-medium text-slate-700">{p.cheque_no}</span> : <span className="text-xs text-slate-300">—</span>}
                          </TableCell>
                          <TableCell>
                            {p.cheque_status ? (
                              <ChequeStatusControl
                                chequeStatus={p.cheque_status}
                                source="plot_payment"
                                entryId={p.id}
                                isAdmin={canManage}
                                onStatusChange={fetchAll}
                              />
                            ) : <span className="text-xs text-slate-300">—</span>}
                          </TableCell>
                          <TableCell>
                            {p.voucher_url ? <VoucherThumbnail url={p.voucher_url} /> : <span className="text-xs text-slate-300">—</span>}
                          </TableCell>
                          <TableCell className="text-right px-2">
                            <div className="flex items-center justify-end gap-1">
                              {canUpdate && (
                                <Button variant="ghost" size="sm" onClick={() => handleEditPayment(p)} className="h-7 w-7 p-0 text-slate-400 hover:text-amber-600 hover:bg-amber-50" title="Edit Payment">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => printReceipt(p)} className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50" title="Print Receipt">
                                <Printer className="w-3.5 h-3.5" />
                              </Button>
                              {canUpdate && (
                                <Button variant="ghost" size="sm" onClick={() => setSignEntry(p)}
                                  className={`h-7 w-7 p-0 ${p.customer_signature_url ? 'text-emerald-500 hover:text-emerald-700' : 'text-slate-400 hover:text-violet-600 hover:bg-violet-50'}`}
                                  title={p.customer_signature_url ? 'Signed — capture again' : 'Capture Signature'}>
                                  <PenLine className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              {canDelete && (
                                <Button variant="ghost" size="sm" onClick={() => handleDeletePayment(p.id)} className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50" title="Delete Payment">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals row */}
                      <TableRow className="bg-slate-50 hover:bg-slate-50 border-t-2 border-slate-200">
                        <TableCell colSpan={4} className="text-xs font-semibold text-slate-600 px-4 py-3">Total Cumulative Received (${payments.length} entries)</TableCell>
                        <TableCell className={`text-sm text-right font-bold px-4 py-3 ${totalReceived < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{totalReceived < 0 ? '-' : ''}₹{fmt(Math.abs(totalReceived))}</TableCell>
                        <TableCell colSpan={11} />
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══════════ DIALOGS ═══════════ */}

      {/* ── Create Installments ── */}
      <SignaturePad
        open={!!signEntry}
        onOpenChange={(o) => { if (!o) setSignEntry(null); }}
        onSave={async ({ customer, authority }) => {
          const entry = signEntry;
          const sigPatch = { customer_signature_url: customer };
          if (authority) sigPatch.authority_signature_url = authority;
          await api.put(`/signatures/plot_payment/${entry.id}`, sigPatch);
          setSignEntry(null);
          fetchAll();
          printReceipt({ ...entry, ...sigPatch });
        }}
        askAuthority={!nameSignOn()}
        signeeLabel={signEntry ? `${signEntry.buyer_name || 'Plot Payment'} · ₹${parseFloat(signEntry.amount || 0).toLocaleString('en-IN')}` : ''}
      />

      <Dialog open={instOpen} onOpenChange={setInstOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Installments</DialogTitle>
            <DialogDescription>Plot {plot.plot_no} · Sale Price: ₹{fmt(salePrice)}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateInstallments} className="space-y-4">
            <div className="space-y-2">
              {instRows.map((row, i) => (
                <div key={i} className="flex items-end gap-2 bg-slate-50 rounded-lg p-3">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs font-medium">Name</Label>
                    <Input value={row.installment_name} onChange={(e) => updateInstRow(i, 'installment_name', e.target.value)} placeholder={`Installment ${i + 1}`} className="h-8 text-sm" />
                  </div>
                  <div className="w-24 space-y-1.5">
                    <Label className="text-xs font-medium">% of Sale</Label>
                    <Input type="number" step="0.01" min="0" max="100" value={row.percentage} onChange={(e) => updateInstRow(i, 'percentage', e.target.value)} placeholder="0%" className="h-8 text-sm" />
                  </div>
                  <div className="w-32 space-y-1.5">
                    <Label className="text-xs font-medium">Amount *</Label>
                    <Input type="number" step="0.01" min="0.01" value={row.amount} onChange={(e) => updateInstRow(i, 'amount', e.target.value)} placeholder="₹0.00" className="h-8 text-sm" required />
                  </div>
                  <div className="w-36 space-y-1.5">
                    <Label className="text-xs font-medium">Due Date *</Label>
                    <Input type="date" value={row.due_date} onChange={(e) => updateInstRow(i, 'due_date', e.target.value)} className="h-8 text-sm" required />
                  </div>
                  {instRows.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeInstRow(i)}>
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={addInstRow}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Row
            </Button>
            <DialogFooter>
              <Button type="submit" disabled={instSubmitting}>
                {instSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create {instRows.length} Installment{instRows.length > 1 ? 's' : ''}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Installment ── */}
      <Dialog open={editInstOpen} onOpenChange={setEditInstOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Installment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateInstallment} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Name</Label>
              <Input value={editInstForm.installment_name} onChange={(e) => setEditInstForm(p => ({ ...p, installment_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Amount *</Label>
                <Input type="number" step="0.01" min="0.01" value={editInstForm.amount} onChange={(e) => setEditInstForm(p => ({ ...p, amount: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Due Date *</Label>
                <Input type="date" value={editInstForm.due_date} onChange={(e) => setEditInstForm(p => ({ ...p, due_date: e.target.value }))} required />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={editInstSubmitting}>
                {editInstSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Update
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Installment & Interest Settings ── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Installment Settings</DialogTitle>
            <DialogDescription>Configure installments & interest for this plot</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
              <input type="checkbox" id="inst_enabled" checked={settingsForm.installments_enabled} onChange={(e) => setSettingsForm(p => ({ ...p, installments_enabled: e.target.checked }))} className="rounded" />
              <Label htmlFor="inst_enabled" className="text-sm cursor-pointer">Enable installment tracking</Label>
            </div>
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
              <input type="checkbox" id="int_enabled" checked={settingsForm.interest_enabled} onChange={(e) => setSettingsForm(p => ({ ...p, interest_enabled: e.target.checked }))} className="rounded" />
              <Label htmlFor="int_enabled" className="text-sm cursor-pointer">Enable overdue interest calculation</Label>
            </div>
            {settingsForm.interest_enabled && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Interest Rate (%)</Label>
                  <Input type="number" step="0.01" min="0" value={settingsForm.interest_rate} onChange={(e) => setSettingsForm(p => ({ ...p, interest_rate: e.target.value }))} placeholder="e.g. 1.5" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Period</Label>
                  <Select value={settingsForm.interest_type} onValueChange={(v) => setSettingsForm(p => ({ ...p, interest_type: v }))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{INTEREST_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
              <input type="checkbox" id="pen_enabled" checked={settingsForm.penalty_enabled} onChange={(e) => setSettingsForm(p => ({ ...p, penalty_enabled: e.target.checked }))} className="rounded" />
              <Label htmlFor="pen_enabled" className="text-sm cursor-pointer">Enable penalty on overdue installments</Label>
            </div>
            {settingsForm.penalty_enabled && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Penalty Rate (₹)</Label>
                  <Input type="number" step="0.01" min="0" value={settingsForm.penalty_rate} onChange={(e) => setSettingsForm(p => ({ ...p, penalty_rate: e.target.value }))} placeholder="e.g. 500" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Penalty Type</Label>
                  <Select value={settingsForm.penalty_type} onValueChange={(v) => setSettingsForm(p => ({ ...p, penalty_type: v }))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per_day">Per Day</SelectItem>
                      <SelectItem value="per_week">Per Week</SelectItem>
                      <SelectItem value="per_month">Per Month</SelectItem>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Free to Sale (Days after bench period overdue)</Label>
              <Input type="number" min="0" value={settingsForm.free_to_sale_days} onChange={(e) => setSettingsForm(p => ({ ...p, free_to_sale_days: e.target.value }))} placeholder="0 = disabled" />
              <p className="text-[10px] text-slate-400">Plot auto-eligible for free-to-sale after this many days past bench period overdue. 0 = disabled.</p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={settingsSubmitting}>
                {settingsSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save Settings
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Take Payment Dialog ── */}
      <Dialog open={payOpen} onOpenChange={(open) => { setPayOpen(open); if (!open) resetPayForm(); }}>
        <DialogContent className="sm:max-w-5xl max-h-[96vh] gap-0 p-0 flex flex-col overflow-hidden rounded-3xl border-slate-200/90 bg-white shadow-2xl shadow-slate-900/10">
          <div className="shrink-0 flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-5 py-3 sm:px-6">
            <div className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-sm',
              payMode === 'refund' ? 'bg-red-600 shadow-red-600/25' : 'bg-emerald-600 shadow-emerald-600/25'
            )}>
              {payMode === 'refund' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold text-slate-900">
                {editingPaymentId ? 'Edit Payment' : 'Take Payment'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5 truncate">
                Plot <span className="font-semibold text-slate-700">{plot.plot_no}</span>{plot.buyer_name && <> · <span className="text-slate-600">{plot.buyer_name}</span></>} · complete the details below
              </DialogDescription>
            </div>
            <span className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white',
              payMode === 'refund' ? 'bg-red-600' : 'bg-emerald-600'
            )}>
              {payMode === 'refund' ? 'Refund · Out' : 'Receive · In'}
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3 sm:px-6 md:overflow-visible">
            <form id="pay-form" onSubmit={handleSubmitPayment} className="space-y-3">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                {/* ── Left column: direction, date, mode, amount ── */}
                <div className="space-y-3">
                  <CreditDebitTabs
                    value={payMode === 'refund' ? 'debit' : 'credit'}
                    onChange={(v) => setPayMode(v === 'debit' ? 'refund' : 'receive')}
                    disabled={!!editingPaymentId}
                    creditHint="Receive payment"
                    debitHint="Refund / return"
                  />
                  <EntryField label={<FieldLabel icon={Calendar} color="bg-sky-100 text-sky-600">Date</FieldLabel>} required>
                    <Input type="date" value={payForm.date}
                      onChange={(e) => setPayForm({ ...payForm, date: e.target.value })}
                      required />
                  </EntryField>
                  <EntryField label={<FieldLabel icon={Landmark} color="bg-violet-100 text-violet-600">Payment Mode</FieldLabel>}>
                    <EntryModeChips
                      value={payForm.payment_type}
                      modes={['CASH', 'BANK', 'CHEQUE']}
                      onChange={(m) => setPayForm(m === 'CASH'
                        ? { ...payForm, payment_type: 'CASH', payment_from: 'CASH' }
                        : m === 'CHEQUE'
                          ? { ...payForm, payment_type: 'CHEQUE', payment_from: 'CHEQUE' }
                          : { ...payForm, payment_type: 'BANK' })}
                    />
                  </EntryField>
                  <EntryAmount
                    direction={payMode === 'refund' ? 'debit' : 'credit'}
                    label={payMode === 'refund' ? 'Refund (₹)' : 'Amount (₹)'}
                    required
                    hint={payForm.amount ? `${payMode === 'refund' ? '−' : '+'} ₹${fmt(Math.abs(parseFloat(payForm.amount) || 0))}` : undefined}
                    inputProps={{
                      step: '0.01',
                      placeholder: '0',
                      value: payForm.amount,
                      onChange: (e) => setPayForm({ ...payForm, amount: e.target.value }),
                      required: true,
                    }}
                  />
                </div>

                {/* ── Right column: payment from, cheque/bank, booked by, narration, approval ── */}
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <EntryField label={<FieldLabel icon={Tag} color="bg-orange-100 text-orange-600">Payment From</FieldLabel>}>
                      <div className="flex flex-wrap gap-1.5">
                        {PAYMENT_FROM_OPTIONS.map((f) => (
                          <button key={f} type="button"
                            onClick={() => {
                              const newFrom = payForm.payment_from === f ? '' : f;
                              const newType = newFrom ? derivePaymentType(newFrom) : payForm.payment_type;
                              if (newFrom === 'REFUND' || newFrom === 'RETURN') setPayMode('refund');
                              else if (newFrom) setPayMode('receive');
                              setPayForm({ ...payForm, payment_from: newFrom, payment_type: newType });
                            }}
                            className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${payForm.payment_from === f ? 'border-slate-800 bg-slate-800 text-white' : FROM_COLORS[f] || 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                            {f}
                          </button>
                        ))}
                      </div>
                    </EntryField>
                  </div>

                  {(payForm.payment_type !== 'CASH' || payForm.cheque_no) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(payForm.payment_type === 'CHEQUE' || payForm.cheque_no) && (
                        <EntryField label={<FieldLabel icon={Hash} color="bg-indigo-100 text-indigo-600">Cheque No</FieldLabel>}>
                          <Input placeholder="Cheque number" value={payForm.cheque_no}
                            onChange={(e) => setPayForm({ ...payForm, cheque_no: e.target.value })} />
                        </EntryField>
                      )}
                      {payForm.payment_type !== 'CASH' && (
                        <EntryField label={<FieldLabel icon={CreditCard} color="bg-blue-100 text-blue-600">Bank Details</FieldLabel>}>
                          <Input placeholder="SBI-613266 / UNB-037191" value={payForm.bank_details}
                            onChange={(e) => setPayForm({ ...payForm, bank_details: e.target.value.toUpperCase() })}
                            list="pay-bank-suggestions-d" />
                          <datalist id="pay-bank-suggestions-d">
                            {autocomplete.bankDetails?.map((b) => <option key={b} value={b} />)}
                          </datalist>
                        </EntryField>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* ── Booked By — inline dropdown (no Popover portal) ── */}
                    <EntryField label={<FieldLabel icon={User} color="bg-teal-100 text-teal-600">Payment Booked By</FieldLabel>}>
                      <div className="relative" ref={bookedByRef}>
                        <button type="button"
                          onClick={() => { setPayBookedByOpen(prev => !prev); setPayBookedBySearch(''); }}
                          className="h-9 w-full flex items-center justify-between px-3 border rounded-md text-sm bg-white hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1">
                          {payForm.booked_by ? (
                            <span className="flex items-center gap-1.5 truncate text-slate-800">
                              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              {(() => { const m = autocomplete?.members?.find(x => x.name === payForm.booked_by); return m?.phone ? `${m.name} (${m.phone})` : payForm.booked_by; })()}
                            </span>
                          ) : (
                            <span className="text-slate-400">Select person...</span>
                          )}
                          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                        </button>

                        {payBookedByOpen && (
                          <div className="absolute z-[200] left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl animate-in fade-in-0 zoom-in-95 duration-100">
                            {/* Search input */}
                            <div className="flex items-center gap-2 border-b border-slate-100 px-3">
                              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <input
                                ref={bookedByInputRef}
                                type="text"
                                placeholder="Search name or phone..."
                                value={payBookedBySearch}
                                onChange={(e) => setPayBookedBySearch(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') { setPayBookedByOpen(false); }
                                  if (e.key === 'Enter' && filteredBookedByMembers.length > 0) {
                                    e.preventDefault();
                                    const first = filteredBookedByMembers[0];
                                    setPayForm(prev => ({ ...prev, booked_by: first.name }));
                                    setPayBookedByOpen(false);
                                    setPayBookedBySearch('');
                                  }
                                }}
                                className="flex-1 h-9 text-sm outline-none bg-transparent placeholder:text-slate-400"
                              />
                              {payBookedBySearch && (
                                <button type="button" onClick={() => setPayBookedBySearch('')} className="p-0.5 rounded hover:bg-slate-100">
                                  <X className="w-3 h-3 text-slate-400" />
                                </button>
                              )}
                            </div>
                            {/* Scrollable list */}
                            <div className="max-h-[180px] overflow-y-auto overscroll-contain p-1">
                              {filteredBookedByMembers.length === 0 ? (
                                <p className="py-4 text-center text-xs text-slate-400">No members found</p>
                              ) : (
                                filteredBookedByMembers.map((m) => (
                                  <button
                                    key={`booked-${m.name}-${m.phone || ''}`}
                                    type="button"
                                    onClick={() => {
                                      setPayForm(prev => ({ ...prev, booked_by: prev.booked_by === m.name ? '' : m.name }));
                                      setPayBookedByOpen(false);
                                      setPayBookedBySearch('');
                                    }}
                                    className={`w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                                      payForm.booked_by === m.name ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-slate-50 text-slate-700'
                                    }`}
                                  >
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-semibold ${
                                      payForm.booked_by === m.name ? 'bg-emerald-200 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                      {(m.name || '?')[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0 text-left">
                                      <p className="font-medium truncate">{m.name}</p>
                                      {(m.phone || m.team) && (
                                        <p className="text-[10px] text-slate-400 truncate">
                                          {[m.phone, m.team].filter(Boolean).join(' · ')}
                                        </p>
                                      )}
                                    </div>
                                    {payForm.booked_by === m.name && (
                                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    )}
                                  </button>
                                ))
                              )}
                            </div>
                            {payForm.booked_by && (
                              <div className="border-t border-slate-100 p-1">
                                <button type="button"
                                  onClick={() => { setPayForm(prev => ({ ...prev, booked_by: '' })); setPayBookedByOpen(false); }}
                                  className="w-full text-xs text-red-500 hover:bg-red-50 rounded-md py-1.5 px-2 text-left transition-colors">
                                  Clear selection
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </EntryField>

                    {/* ── Admin Approval ── */}
                    {approvers.length > 0 && (
                      <EntryField label={<FieldLabel icon={CheckCircle2 } color="bg-amber-100 text-amber-600">Assign For Approval</FieldLabel>}>
                        <Select value={payForm.assigned_admin_id?.toString() || '_none'}
                          onValueChange={(val) => setPayForm({ ...payForm, assigned_admin_id: val === '_none' ? null : parseInt(val) })}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select admin" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">— Auto-assign or none —</SelectItem>
                            {approvers.map((admin) => (
                              <SelectItem key={admin.id} value={String(admin.id)}>
                                {admin.full_name || admin.name || admin.email || `Admin #${admin.id}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </EntryField>
                    )}
                  </div>

                  {/* ── Narration ── */}
                  <EntryField label={<FieldLabel icon={MessageSquare} color="bg-slate-100 text-slate-500">Narration</FieldLabel>}>
                    <Textarea placeholder={payMode === 'refund' ? 'REFUND, RETURN A19 DG, TRF TO A38...' : 'REGISTRY, BOOKING, INSTALLMENT...'}
                      value={payForm.narration}
                      onChange={(e) => setPayForm({ ...payForm, narration: e.target.value.toUpperCase() })}
                      rows={2} className="text-sm resize-none" />
                  </EntryField>
                </div>
              </div>

              {/* ── Voucher — full width ── */}
              <VoucherUpload
                value={payForm.voucher_url}
                onChange={(url) => setPayForm({ ...payForm, voucher_url: url })}
                onUploadingChange={setVoucherUploading}
                disabled={paySubmitting}
              />

              {/* hidden submit keeps Enter-to-submit working; visible button lives in the footer below */}
              <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
            </form>
          </div>

          <div className="shrink-0 flex items-center justify-between gap-2.5 border-t border-slate-100 bg-slate-50/60 px-5 py-3 sm:px-6">
            <p className="hidden sm:block text-[11px] text-slate-400">
              Enter: next field · Shift+Tab: previous · Esc: close
            </p>
            <div className="flex items-center gap-2.5">
              <Button type="button" variant="outline" onClick={() => setPayOpen(false)} disabled={paySubmitting} className="h-10 rounded-full px-5">
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => document.getElementById('pay-form')?.requestSubmit()}
                disabled={paySubmitting || voucherUploading}
                className={cn(
                  'h-10 rounded-full px-5 text-white',
                  payMode === 'refund' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                )}
              >
                {paySubmitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                {paySubmitting ? 'Recording...' : payMode === 'refund' ? 'Record Refund' : 'Record Payment'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Confirm ── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Action</DialogTitle>
            <DialogDescription>Are you sure? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={executeConfirm}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
