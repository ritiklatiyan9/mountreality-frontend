import { writePrintDocument } from '../lib/safePrint';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { money, moneyCompact } from '@/lib/utils';

/* Farmer status → semantic pill tone (mirrors the list page). */
const FARMER_STATUS_TONE = { active: 'positive', completed: 'info', inactive: 'neutral' };

/* Payment mode → brand tint. Cash reads aqua and bank reads blue, matching
   the cash/bank legs in the settlement panel above the table. */
const MODE_CHIP = {
  CASH: 'bg-mr-aqua-soft text-mr-aqua-ink',
  BANK: 'bg-mr-blue-soft text-mr-blue',
  SPLIT: 'bg-mr-lime-soft text-mr-lime-ink',
  CHEQUE: 'bg-mr-amber-soft text-mr-amber-ink',
  DEFAULT: 'bg-mr-surface-2 text-mr-muted',
};
import { CurrencyValue, EmptyState, SkeletonBlock, StatusPill } from '../components/dashboard/primitives';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  ArrowLeft, Plus, Edit2, Trash2, AlertCircle, Check,
  IndianRupee, X, Tractor,
  Download, Phone, MapPin, Camera,
  Banknote, Building2, FileSpreadsheet, Printer, Eye, FileText,
  PenLine,
} from 'lucide-react';
import SignaturePad from '../components/SignaturePad';
import { printCashReceipt } from '../lib/cashReceipt';
import { customerSigImg, authoritySigHtml, nameSignOn, CUSTOMER_SIGN_CSS } from '../lib/receiptSignature';
import VoucherUpload, { VoucherThumbnail } from '../components/VoucherUpload';
import ApprovalStatusBadge from '../components/ApprovalStatusBadge';
import ChequeStatusControl from '../components/ChequeStatusControl';
import CreditDebitTabs from '../components/CreditDebitTabs';
import { EntryDialog, EntryFooter, EntryRow, EntryField, EntryAmount, EntryModeChips, EntryParticular, getParticularsForMode } from '../components/EntryModal';
import QRCode from 'qrcode';
import { useRowSelection } from '../hooks/useRowSelection';
import BulkActionsBar from '../components/BulkActionsBar';
import BankAccountSelect from '../components/BankAccountSelect';
import { classifyPaymentMode } from '../utils/paymentMode';
import { GHOST_BTN, PRIMARY_BTN } from '../components/ui/page';
import { CountUp, ProgressBar } from '../components/ui/animate';

const todayISO = () => new Date().toISOString().split('T')[0];
const LAND_UNIT_LABELS = { BIGHA: 'Bigha', YARD: 'Yard', SQMT: 'Mtr Sq' };
const landUnitLabel = (unit) => LAND_UNIT_LABELS[unit] || 'Bigha';
const isPostedPayment = (payment) => (
  String(payment?.status ?? '').trim().toLowerCase() === 'approved'
  && !['BOUNCED', 'RETURNED'].includes(String(payment?.cheque_status ?? '').trim().toUpperCase())
);


const FarmerPayments = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, canManage, user, currentSite, hasPermission } = useAuth();
  const canWrite  = canManage && hasPermission('farmers', 'write');
  const canUpdate = canManage && hasPermission('farmers', 'update');
  const canDelete = canManage && hasPermission('farmers', 'delete');

  const [farmer, setFarmer] = useState(null);
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({ total_amount: 0, total_paid: 0, remaining: 0, cash_to_pay: 0, bank_to_pay: 0, cash_paid: 0, bank_paid: 0, cash_remaining: 0, bank_remaining: 0 });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);
  const [approvers, setApprovers] = useState([]);
  const [proofPhoto, setProofPhoto] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [editRequestPending, setEditRequestPending] = useState(false);
  const [voucherUploading, setVoucherUploading] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [sigPadOpen, setSigPadOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const receiptRef = useRef(null);
  const statementRef = useRef(null);
  const paymentFormRef = useRef(null);
  const selection = useRowSelection();
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [formData, setFormData] = useState({
    date: todayISO(),
    transaction_type: 'debit',
    particular: 'CASH',
    mode: 'CASH',
    bank_account_id: '',
    amount: '',
    by_note: '',
    remarks: '',
    payment_mode: 'CASH',
    cash_amount: '',
    bank_amount: '',
    bank_name: '',
    bank_account_no: '',
    bank_reference: '',
    bank_ifsc: '',
    voucher_url: '',
    customer_signature_url: '',
    authority_signature_url: '',
    assigned_admin_id: null,
    cheque_no: '',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // Watchdog so the spinner can never hang on a stalled request.
      const watchdog = setTimeout(() => setLoading(false), 15000);
      const res = await api.get(`/farmers/${id}/payments`);
      clearTimeout(watchdog);
      setFarmer(res.data.farmer);
      setPayments(res.data.payments || []);
      setSummary(res.data.summary || {});
    } catch (err) {
      console.error('Failed to fetch farmer payments:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Background refresh — does NOT toggle the page-wide loader, used after
  // create / update / delete so the dialog can close instantly.
  const refreshData = useCallback(async () => {
    try {
      const res = await api.get(`/farmers/${id}/payments`);
      setFarmer(res.data.farmer);
      setPayments(res.data.payments || []);
      setSummary(res.data.summary || {});
    } catch { /* keep current */ }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const url = currentSite?.id ? `/admin/approvers?site_id=${currentSite.id}` : '/admin/approvers';
    api.get(url)
      .then((res) => setApprovers(res.data.approvers || []))
      .catch(() => setApprovers([]));
  }, [currentSite?.id]);

  const getAssignedAdminLabel = (entry) => {
    if (entry?.assigned_admin_name) return entry.assigned_admin_name;
    const assignedId = entry?.assigned_admin_id;
    if (!assignedId) return null;
    const approver = approvers.find((a) => String(a.id) === String(assignedId));
    return approver?.full_name || approver?.name || approver?.email || `Admin #${assignedId}`;
  };

  const resetForm = () => {
    setFormData({
      date: todayISO(),
      transaction_type: 'debit',
      particular: 'CASH',
      mode: 'CASH',
      bank_account_id: '',
      amount: '',
      by_note: '',
      remarks: '',
      payment_mode: 'CASH',
      cash_amount: '',
      bank_amount: '',
      bank_name: '',
      bank_account_no: '',
      bank_reference: '',
      bank_ifsc: '',
      voucher_url: '',
      customer_signature_url: '',
      authority_signature_url: '',
      assigned_admin_id: null,
      cheque_no: '',
    });
    setEditingPayment(null);
    setMessage({ type: '', text: '' });
    setProofPhoto(null);
    setProofPreview(null);
    setEditRequestPending(false);
    setSubmitting(false);
    setVoucherUploading(false);
  };

  const handleProofPhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProofPhoto(file);
      setProofPreview(URL.createObjectURL(file));
    }
  };

  const handleOpenCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleOpenEdit = (payment) => {
    const paymentBucket = classifyPaymentMode(payment.payment_mode);
    const mode = paymentBucket === 'cash' ? 'CASH' : paymentBucket === 'cheque' ? 'CHEQUE' : 'BANK';
    const absAmount = Math.abs(parseFloat(payment.amount) || 0);
    // Debit = money paid to the farmer (stored positive); credit = refund back (negative).
    const transactionType = (parseFloat(payment.amount) || 0) < 0 ? 'credit' : 'debit';
    setFormData({
      date: payment.date ? payment.date.split('T')[0] : '',
      particular: payment.particular || 'CASH',
      transaction_type: transactionType,
      mode,
      bank_account_id: payment.bank_account_id ? String(payment.bank_account_id) : '',
      amount: absAmount || '',
      by_note: payment.by_note || '',
      remarks: payment.remarks || '',
      payment_mode: payment.payment_mode || 'BANK',
      cash_amount: payment.cash_amount ? Math.abs(payment.cash_amount) : '',
      bank_amount: payment.bank_amount ? Math.abs(payment.bank_amount) : '',
      bank_name: payment.bank_name || '',
      bank_account_no: payment.bank_account_no || '',
      bank_reference: payment.bank_reference || '',
      bank_ifsc: payment.bank_ifsc || '',
      voucher_url: payment.voucher_url || '',
      customer_signature_url: payment.customer_signature_url || '',
      authority_signature_url: payment.authority_signature_url || '',
      assigned_admin_id: payment.assigned_admin_id || null,
      cheque_no: payment.cheque_no || '',
    });
    setEditingPayment(payment.id);
    setDialogOpen(true);
  };

  // Handle form changes with mode-based logic
  const handleFormChange = (field, value) => {
    const newForm = { ...formData, [field]: value };

    // When mode changes, reset particular to first option of that mode & clear irrelevant fields
    if (field === 'mode') {
      const particulars = getParticularsForMode(value);
      newForm.particular = particulars[0];
      newForm.payment_mode = value;
      newForm.cheque_no = value === 'CHEQUE' ? (newForm.cheque_no || '') : '';
      if (value === 'CASH') {
        newForm.bank_name = '';
        newForm.bank_account_no = '';
        newForm.bank_reference = '';
        newForm.bank_ifsc = '';
      }
    }

    setFormData(newForm);
  };

  // ─────────────────────────────────────────────────────────────
  // Local helper: re-derive the summary card numbers (paid / remaining /
  // cash / bank) from a given payments array. Used by every optimistic
  // update so the cards stay in sync with the table without waiting for
  // a refetch.
  // ─────────────────────────────────────────────────────────────
  const recomputeSummary = useCallback((nextPayments, baseFarmer) => {
    const f = baseFarmer || farmer || {};
    const totalAmount = parseFloat(f.total_amount) || 0;
    const cashToPay = parseFloat(f.cash_amount) || 0;
    const bankToPay = parseFloat(f.bank_amount) || 0;
    let totalPaid = 0, cashPaid = 0, bankPaid = 0, totalInterest = 0;
    for (const p of nextPayments) {
      if (!isPostedPayment(p)) continue;
      const amount = parseFloat(p.amount) || 0;
      totalPaid += amount;
      if (String(p.payment_mode || '').trim().toUpperCase() === 'SPLIT') {
        cashPaid += parseFloat(p.cash_amount) || 0;
        bankPaid += parseFloat(p.bank_amount) || 0;
      } else if (classifyPaymentMode(p.payment_mode) === 'cash') {
        cashPaid += amount;
      } else {
        bankPaid += amount;
      }
      totalInterest += parseFloat(p.interest_amount) || 0;
    }
    return {
      total_amount: totalAmount,
      total_paid: totalPaid,
      total_interest: totalInterest,
      remaining: totalAmount - totalPaid,
      cash_to_pay: cashToPay,
      bank_to_pay: bankToPay,
      cash_paid: cashPaid,
      bank_paid: bankPaid,
      cash_remaining: cashToPay - cashPaid,
      bank_remaining: bankToPay - bankPaid,
    };
  }, [farmer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (voucherUploading) {
      setMessage({ type: 'error', text: 'Please wait for the voucher photo to finish uploading.' });
      return;
    }
    if (classifyPaymentMode(formData.mode) !== 'cash' && !formData.bank_account_id) {
      setMessage({ type: 'error', text: 'Select the bank account used for this payment.' });
      return;
    }
    setMessage({ type: '', text: '' });
    setSubmitting(true);

    const baseAmt = parseFloat(formData.amount) || 0;
    // Debit ("Dr the receiver") = payment to the farmer, stored positive;
    // credit = refund from the farmer, stored negative.
    const totalAmt = formData.transaction_type === 'credit' ? -Math.abs(baseAmt) : Math.abs(baseAmt);
    const paymentBucket = classifyPaymentMode(formData.mode);
    const payload = {
      ...formData,
      date: formData.date || todayISO(),
      amount: totalAmt,
      cash_amount: paymentBucket === 'cash' ? totalAmt : 0,
      bank_amount: paymentBucket === 'cash' ? 0 : totalAmt,
      assigned_admin_id: formData.assigned_admin_id,
      payment_mode: formData.mode,
      cheque_no: formData.mode === 'CHEQUE' ? (formData.cheque_no || null) : null,
    };
    // Read off the form before the dialog resets — the awaits below outlive it.
    const sig = {
      customer_signature_url: formData.customer_signature_url,
      authority_signature_url: formData.authority_signature_url,
    };

    try {
      // ── Sub-admin edit-request branch (no optimistic update — admin must approve) ──
      if (editingPayment && !canUpdate) {
        const fd = new FormData();
        fd.append('module', 'farmer_payment');
        fd.append('record_id', editingPayment);
        fd.append('proposed_data', JSON.stringify(payload));
        if (farmer?.site_id) fd.append('site_id', farmer.site_id);
        if (proofPhoto) fd.append('proof_photo', proofPhoto);
        await api.post('/edit-requests', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setMessage({ type: 'success', text: 'Edit request submitted for admin approval' });
        setEditRequestPending(true);
        setDialogOpen(false);
        return;
      }

      // ── Create / direct-update branches ──
      // CLOSE THE DIALOG IMMEDIATELY and apply optimistic UI before the
      // network call. The user-visible latency drops to ~0ms regardless of
      // the API round-trip; we roll back on failure.
      const snapshotPayments = payments;
      const snapshotSummary = summary;

      if (editingPayment) {
        // Optimistic edit: splice the new values into the existing row.
        const optimisticPayments = payments.map((p) =>
          p.id === editingPayment ? { ...p, ...payload, id: editingPayment } : p
        );
        setPayments(optimisticPayments);
        setSummary(recomputeSummary(optimisticPayments));
      } else {
        // Optimistic create: append a temp row (server returns payments in
        // date-ASC order, so the newest one belongs at the end). We use a
        // negative id so refreshData() can identify and replace it.
        const tempId = -Date.now();
        const tempPayment = {
          id: tempId,
          farmer_id: parseInt(id),
          ...payload,
          status: 'pending',
          cheque_status: payload.payment_mode === 'CHEQUE' ? 'PENDING' : null,
          created_by: user?.id || null,
          created_by_name: user?.full_name || user?.name || null,
          created_at: new Date().toISOString(),
        };
        const optimisticPayments = [...payments, tempPayment];
        setPayments(optimisticPayments);
        setSummary(recomputeSummary(optimisticPayments));
      }

      // Close dialog now — feels instant to the user.
      setDialogOpen(false);

      try {
        if (editingPayment) {
          await api.put(`/farmers/${id}/payments/${editingPayment}`, payload);
          await persistSignature(editingPayment, sig);
          setMessage({ type: 'success', text: 'Payment updated' });
        } else {
          const res = await api.post(`/farmers/${id}/payments`, payload);
          await persistSignature(res.data?.payment?.id, sig);
          setMessage({ type: 'success', text: 'Payment added' });
        }
        // Reconcile in the background — server computes verifyUrl, totals,
        // running balance, and replaces the temp negative-id row with the
        // canonical record.
        refreshData();
      } catch (err) {
        // Roll back to the snapshot taken before the optimistic update.
        setPayments(snapshotPayments);
        setSummary(snapshotSummary);
        setMessage({ type: 'error', text: err.response?.data?.message || 'Operation failed' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (paymentId) => {
    if (!window.confirm('Delete this payment entry?')) return;
    // Optimistic removal — instant UI feedback. Recompute summary too.
    const snapshotPayments = payments;
    const snapshotSummary = summary;
    const nextPayments = payments.filter((p) => p.id !== paymentId);
    setPayments(nextPayments);
    setSummary(recomputeSummary(nextPayments));
    try {
      await api.delete(`/farmers/${id}/payments/${paymentId}`);
      refreshData();
    } catch (err) {
      setPayments(snapshotPayments);
      setSummary(snapshotSummary);
      console.error('Failed to delete payment:', err);
    }
  };

  const handleBulkDelete = async () => {
    const ids = [...selection.selected];
    setBulkDeleting(true);
    try {
      const res = await api.post(`/farmers/${id}/payments/bulk-delete`, { ids });
      const deletedIds = res.data.deleted || [];
      const nextPayments = payments.filter((p) => !deletedIds.includes(p.id));
      setPayments(nextPayments);
      setSummary(recomputeSummary(nextPayments));
      selection.clear();
      toast.success(res.data.message || 'Payments deleted');
      refreshData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk delete failed');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBulkEdit = () => {
    const selectedId = [...selection.selected][0];
    const payment = payments.find((p) => p.id === selectedId);
    if (payment) handleOpenEdit(payment);
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Running total
  const paymentsWithRunning = useMemo(() => {
    let runningTotal = 0;
    return payments.map((p) => {
      if (isPostedPayment(p)) runningTotal += parseFloat(p.amount) || 0;
      return { ...p, running_total: runningTotal };
    });
  }, [payments]);

  const visibleIds = paymentsWithRunning.map((p) => p.id);

  // Debit / credit split of the posted rows, so the table foot states the same
  // two numbers the columns above it show. Debit = paid to the farmer
  // (positive rows), credit = refunded back (negative rows).
  const ledgerTotals = useMemo(() => {
    let credit = 0, debit = 0;
    for (const p of payments) {
      if (!isPostedPayment(p)) continue;
      const amt = parseFloat(p.amount) || 0;
      if (amt < 0) credit += -amt; else debit += amt;
    }
    return { credit, debit, net: debit - credit };
  }, [payments]);

  // Completion percentage
  const progressPct = summary.total_amount > 0 ? Math.min((summary.total_paid / summary.total_amount) * 100, 100) : 0;

  // ── Receipt & Export Functions ──
  const openReceipt = (payment) => {
    setReceiptPayment(payment);
    setReceiptDialogOpen(true);
  };

  const handlePrintReceipt = async (paymentArg) => {
    const pay = paymentArg || receiptPayment;
    if (!pay) return;
    const amt = parseFloat(pay.amount) || 0;
    const absAmt = Math.abs(amt);
    const siteName = (currentSite?.name || 'ALLOTMENT DIVISION').toUpperCase();
    const siteAddr = [currentSite?.address, currentSite?.city, currentSite?.state].filter(Boolean).join(', ').toUpperCase();
    const fmtINR = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
    const payDate = pay.date ? new Date(pay.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    const printedAt = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
    const isCash = classifyPaymentMode(pay.payment_mode) === 'cash';
    const signerName = user?.full_name || user?.name || '';
    const bankInfo = pay.bank_name ? `${pay.bank_name}${pay.bank_account_no ? ' - ' + pay.bank_account_no : ''}` : '—';

    // CASH mode → clean minimal A5 receipt (no QR / watermark); issuer kept.
    if (isCash) {
      printCashReceipt({
        siteName, siteAddr,
        docTitle: 'Cash Payment Receipt',
        voucherNo: `FPR-${pay.id}`, dateStr: payDate, printedAt,
        partyLabel: 'Paid To (Farmer)', partyName: (farmer?.name || '').toUpperCase(),
        amount: absAmt,
        rows: [
          { label: 'Particular', value: pay.particular ? String(pay.particular).toUpperCase() : '' },
          { label: 'Remarks', value: pay.remarks || '' },
        ],
        signerName,
        customerSigLabel: 'Farmer Signature',
        row: pay,
      });
      return;
    }

    let qrDataUrl = null;
    if (pay.verifyUrl) {
      try {
        qrDataUrl = await QRCode.toDataURL(pay.verifyUrl, {
          width: 640,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#ffffff' },
        });
      } catch (e) {
        qrDataUrl = null;
      }
    }

    const qrSection = qrDataUrl ? `
      <div class="qr-section">
        <img src="${qrDataUrl}" alt="Verify QR" />
        <div class="qr-label">Scan to verify</div>
      </div>
    ` : '';

    const receiptBlock = (copyLabel) => `
      <div class="receipt-copy">
        <div class="copy-label">${copyLabel}</div>
        <div class="border-frame"></div>
        <div class="watermark">${siteName}</div>
        <div class="content">
          <div class="header">
            <h1>${siteName}</h1>
            <p>${siteAddr || 'FARMER PAYMENT DIVISION'}</p>
          </div>
          <div class="doc-type"><h2>Farmer Payment Receipt</h2></div>
          <div class="meta-info">
            <div class="meta-item"><b>Ref:</b> FPR-${pay.id}</div>
            <div class="meta-item"><b>Date:</b> ${payDate}</div>
          </div>
          <div class="kv-qr-wrap">
            <div class="kv-section">
              <div class="kv-row"><div class="k">Paid To (Farmer)</div><div class="c">:</div><div class="v">${(farmer?.name || '—').toUpperCase()}</div></div>
              <div class="kv-row"><div class="k">Amount</div><div class="c">:</div><div class="v" style="color:#059669">RS ${fmtINR(absAmt)}/-</div></div>
              <div class="kv-row"><div class="k">Payment Mode</div><div class="c">:</div><div class="v">${(pay.payment_mode || '—').toUpperCase()}</div></div>
            </div>
            ${qrSection}
          </div>
          <div class="settlement-title">Payment Details:</div>
          <table class="data-table">
            <tr><th>S.No.</th><td>#${pay.id}</td></tr>
            <tr><th>Date</th><td>${payDate || '—'}</td></tr>
            <tr><th>Particular</th><td>${(pay.particular || '—').toUpperCase()}</td></tr>
            <tr><th>Payment Mode</th><td>${(pay.payment_mode || '—').toUpperCase()}</td></tr>
            <tr><th>Bank Details</th><td>${bankInfo.toUpperCase()}</td></tr>
            <tr><th>Remarks</th><td>${pay.remarks || '—'}</td></tr>
            <tr><th>Amount</th><td style="color:#059669">RS ${fmtINR(absAmt)}/-</td></tr>
          </table>
          ${isCash ? '<div class="bank-proviso">STATUTORY PROVISO: Cash received exclusively as a temporary custodian on behalf of our designated banking institution for immediate reconciliation and ledger entry.</div>' : ''}
          <div class="footer">
            <div class="sig-box">${customerSigImg(pay)}<div class="sig-line">Farmer Signature</div></div>
            <div class="sig-box">${authoritySigHtml(pay, signerName)}<div class="sig-line">Authorized Signatory & Seal</div></div>
          </div>
          <div class="print-meta">Printed on: <b>${printedAt}</b></div>
        </div>
      </div>
    `;

    const html = `<!DOCTYPE html>
<html><head>
  <title>FARMER PAYMENT RECEIPT - ${pay.id}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;500;600;700&family=Dancing+Script:wght@400;500;600;700&display=swap');
    @page { size: A4 portrait; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; color: #1a1a1a; background: #f1f5f9; display: flex; justify-content: center; padding: 10mm 0; }
    .document { background: #fff; width: 210mm; min-height: 297mm; padding: 8mm 15mm; position: relative; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; display: flex; flex-direction: column; overflow: hidden; }
    .receipt-copy { position: relative; flex: 1; display: flex; flex-direction: column; padding: 3mm 5mm; overflow: hidden; }
    .copy-label { position: absolute; top: 2mm; right: 3mm; font-size: 8px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
    .scissor-line { position: relative; border: none; border-top: 1.5px dashed #94a3b8; margin: 2mm 0; overflow: visible; }
    .scissor-line::before { content: '✂'; position: absolute; top: -10px; left: -2px; font-size: 16px; color: #94a3b8; line-height: 1; }
    .border-frame { position: absolute; top: 2mm; left: 2mm; right: 2mm; bottom: 2mm; border: 1px solid #cbd5e1; pointer-events: none; }
    .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-family: 'Cinzel', serif; font-size: 60px; color: rgba(226,232,240,0.25); font-weight: 700; z-index: 1; pointer-events: none; white-space: nowrap; text-transform: uppercase; }
    .content { position: relative; z-index: 10; flex: 1; display: flex; flex-direction: column; }
    .header { text-align: center; margin-bottom: 2mm; border-bottom: 2px double #0f172a; padding: 2mm 3mm 1.5mm; background: #f0fdf4; border-radius: 4px; }
    .header h1 { font-family: 'Cinzel', serif; font-size: 17px; color: #166534; letter-spacing: 2px; margin-bottom: 1px; text-transform: uppercase; }
    .header p { font-size: 9px; color: #475569; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; max-width: 80%; margin: 0 auto; }
    .doc-type { text-align: center; margin-bottom: 2mm; }
    .doc-type h2 { font-family: 'Cinzel', serif; font-size: 11px; color: #64748b; letter-spacing: 4px; text-transform: uppercase; display: inline-block; padding: 1px 15px; border-bottom: 1px solid #cbd5e1; }
    .meta-info { display: flex; justify-content: space-between; margin-bottom: 2mm; font-size: 10px; padding: 0 3mm; }
    .meta-item b { color: #64748b; font-size: 8px; text-transform: uppercase; margin-right: 3px; }
    .kv-qr-wrap { display: flex; align-items: flex-start; gap: 4mm; padding: 0 3mm; margin-bottom: 2mm; }
    .kv-section { flex: 1; min-width: 0; }
    .kv-row { display: grid; grid-template-columns: 44% 4% 52%; gap: 1px; align-items: baseline; margin: 1mm 0; font-size: 10px; }
    .kv-row .k { color: #0f172a; font-weight: 600; } .kv-row .c { text-align: center; color: #475569; font-weight: 700; } .kv-row .v { color: #0f172a; font-weight: 600; text-transform: uppercase; }
    .settlement-title { margin: 1mm 3mm 0.8mm; font-size: 10px; color: #0f172a; font-weight: 700; }
    .data-table { width: 100%; border-collapse: collapse; margin-bottom: 2mm; }
    .data-table th, .data-table td { border: 1px solid #e2e8f0; padding: 0.8mm 3mm; text-align: left; line-height: 1.25; }
    .data-table th { background: #f8fafc; font-size: 8px; text-transform: uppercase; color: #64748b; width: 35%; }
    .data-table td { font-size: 10px; font-weight: 600; color: #0f172a; }
    .bank-proviso { margin-top: 1mm; padding: 1.8mm 2.5mm; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 8px; font-style: italic; color: #64748b; text-align: center; line-height: 1.4; }
    .qr-section { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; background: #fff; padding: 1.5mm; border: 1px solid #0f172a; border-radius: 3px; }
    .qr-section img { display: block; width: 30mm; height: 30mm; image-rendering: pixelated; image-rendering: crisp-edges; }
    .qr-label { font-size: 7px; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; margin-top: 1mm; }
    .print-meta { flex-shrink: 0; text-align: center; font-size: 7.5px; color: #64748b; margin-top: 1.5mm; padding: 0.8mm 0 0; border-top: 1px dashed #e2e8f0; letter-spacing: 0.3px; }
    .print-meta b { color: #0f172a; font-weight: 600; }
    .footer { flex-shrink: 0; margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; padding: 3mm 5mm 1mm; }
    .sig-box { text-align: center; width: 55mm; min-height: 14mm; display: flex; flex-direction: column; justify-content: flex-end; }
    .sig-line { border-top: 1.5px solid #0f172a; padding-top: 3px; font-size: 8px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
    .digital-signature { font-family: 'Dancing Script', 'Brush Script MT', cursive; font-size: 22px; font-weight: 700; color: #1a237e; margin-bottom: 1px; line-height: 1; height: 8mm; display: flex; align-items: flex-end; justify-content: center; }
    ${CUSTOMER_SIGN_CSS}
    @media print { body { background: white; padding: 0; } .document { box-shadow: none !important; border: none !important; width: 210mm; height: 297mm; margin: 0 !important; padding: 8mm 15mm !important; } .receipt-copy { padding: 3mm 5mm !important; } .header { padding: 2mm 3mm !important; margin-bottom: 1.5mm !important; } .header h1 { font-size: 16px !important; } .doc-type { margin-bottom: 1.5mm !important; } .meta-info { margin-bottom: 1.5mm !important; } .kv-qr-wrap { margin-bottom: 1mm !important; } .qr-section img { width: 24mm !important; height: 24mm !important; } .settlement-title { margin: 1mm 3mm 0.5mm !important; } .data-table { margin-bottom: 1.5mm !important; } .data-table th, .data-table td { padding: 0.8mm 3mm !important; } .bank-proviso { margin-top: 1mm !important; padding: 1.5mm 2mm !important; font-size: 7px !important; line-height: 1.35 !important; } .footer { padding: 1.5mm 5mm 0 !important; } .sig-box { min-height: 11mm !important; } .digital-signature { font-size: 18px !important; height: 6mm !important; } .print-meta { margin-top: 0.5mm !important; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="document">
    ${receiptBlock('Office Copy')}
    <hr class="scissor-line" />
    ${receiptBlock('Farmer Copy')}
  </div>
  <div class="no-print" style="position:fixed; bottom: 30px; left:0; right:0; text-align:center; z-index:1000;">
    <button onclick="(async () => { try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch(e){} window.print(); })()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#0f172a; color:#fff; border:none; border-radius:10px; cursor:pointer; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);">EXECUTE PRINT (A4)</button>
    <button onclick="window.close()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#fff; color:#475569; border:1px solid #e2e8f0; border-radius:10px; cursor:pointer; margin-left:15px;">TERMINATE</button>
  </div>
</body></html>`;

    const win = window.open('', '_blank', 'width=1000,height=750');
    writePrintDocument(win, html);
    win.document.close();
  };

  // Bulk print — ONE window, one page per selected payment (never loop
  // window.open per row, popup blockers kill everything after the first).
  // ponytail: reuses the single generic A4 receipt layout from
  // handlePrintReceipt for every row (incl. cash-mode ones) instead of also
  // branching into printCashReceipt's separate A5 template — keeps this to
  // one combined document. Upgrade if cash rows need the compact A5 look.
  const handleBulkPrint = async () => {
    const selectedPayments = paymentsWithRunning.filter((p) => selection.isSelected(p.id));
    if (selectedPayments.length === 0) return;
    const siteName = (currentSite?.name || 'ALLOTMENT DIVISION').toUpperCase();
    const siteAddr = [currentSite?.address, currentSite?.city, currentSite?.state].filter(Boolean).join(', ').toUpperCase();
    const fmtINR = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
    const signerName = user?.full_name || user?.name || '';

    const blocks = await Promise.all(selectedPayments.map(async (pay) => {
      const absAmt = Math.abs(parseFloat(pay.amount) || 0);
      const payDate = pay.date ? new Date(pay.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
      const bankInfo = pay.bank_name ? `${pay.bank_name}${pay.bank_account_no ? ' - ' + pay.bank_account_no : ''}` : '—';
      let qrDataUrl = null;
      if (pay.verifyUrl) {
        try {
          qrDataUrl = await QRCode.toDataURL(pay.verifyUrl, {
            width: 640, margin: 2, errorCorrectionLevel: 'M',
            color: { dark: '#000000', light: '#ffffff' },
          });
        } catch { qrDataUrl = null; }
      }
      const qrSection = qrDataUrl ? `
        <div class="qr-section">
          <img src="${qrDataUrl}" alt="Verify QR" />
          <div class="qr-label">Scan to verify</div>
        </div>
      ` : '';
      return `
        <div class="document">
          <div class="receipt-copy">
            <div class="border-frame"></div>
            <div class="watermark">${siteName}</div>
            <div class="content">
              <div class="header">
                <h1>${siteName}</h1>
                <p>${siteAddr || 'FARMER PAYMENT DIVISION'}</p>
              </div>
              <div class="doc-type"><h2>Farmer Payment Receipt</h2></div>
              <div class="meta-info">
                <div class="meta-item"><b>Ref:</b> FPR-${pay.id}</div>
                <div class="meta-item"><b>Date:</b> ${payDate}</div>
              </div>
              <div class="kv-qr-wrap">
                <div class="kv-section">
                  <div class="kv-row"><div class="k">Paid To (Farmer)</div><div class="c">:</div><div class="v">${(farmer?.name || '—').toUpperCase()}</div></div>
                  <div class="kv-row"><div class="k">Amount</div><div class="c">:</div><div class="v" style="color:#059669">RS ${fmtINR(absAmt)}/-</div></div>
                  <div class="kv-row"><div class="k">Payment Mode</div><div class="c">:</div><div class="v">${(pay.payment_mode || '—').toUpperCase()}</div></div>
                </div>
                ${qrSection}
              </div>
              <div class="settlement-title">Payment Details:</div>
              <table class="data-table">
                <tr><th>S.No.</th><td>#${pay.id}</td></tr>
                <tr><th>Date</th><td>${payDate || '—'}</td></tr>
                <tr><th>Particular</th><td>${(pay.particular || '—').toUpperCase()}</td></tr>
                <tr><th>Payment Mode</th><td>${(pay.payment_mode || '—').toUpperCase()}</td></tr>
                <tr><th>Bank Details</th><td>${bankInfo.toUpperCase()}</td></tr>
                <tr><th>Remarks</th><td>${pay.remarks || '—'}</td></tr>
                <tr><th>Amount</th><td style="color:#059669">RS ${fmtINR(absAmt)}/-</td></tr>
              </table>
              <div class="footer">
                <div class="sig-box">${customerSigImg(pay)}<div class="sig-line">Farmer Signature</div></div>
                <div class="sig-box">${authoritySigHtml(pay, signerName)}<div class="sig-line">Authorized Signatory &amp; Seal</div></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }));

    const html = `<!DOCTYPE html>
<html><head>
  <title>FARMER PAYMENT RECEIPTS - ${farmer?.name || ''}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;500;600;700&family=Dancing+Script:wght@400;500;600;700&display=swap');
    @page { size: A4 portrait; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; color: #1a1a1a; background: #f1f5f9; display: flex; flex-direction: column; align-items: center; padding: 10mm 0; }
    .document { background: #fff; width: 210mm; min-height: 297mm; padding: 8mm 15mm; position: relative; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; margin-bottom: 10mm; }
    .receipt-copy { position: relative; height: 100%; display: flex; flex-direction: column; padding: 3mm 5mm; overflow: hidden; }
    .border-frame { position: absolute; top: 2mm; left: 2mm; right: 2mm; bottom: 2mm; border: 1px solid #cbd5e1; pointer-events: none; }
    .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-family: 'Cinzel', serif; font-size: 60px; color: rgba(226,232,240,0.25); font-weight: 700; z-index: 1; pointer-events: none; white-space: nowrap; text-transform: uppercase; }
    .content { position: relative; z-index: 10; flex: 1; display: flex; flex-direction: column; }
    .header { text-align: center; margin-bottom: 2mm; border-bottom: 2px double #0f172a; padding: 2mm 3mm 1.5mm; background: #f0fdf4; border-radius: 4px; }
    .header h1 { font-family: 'Cinzel', serif; font-size: 17px; color: #166534; letter-spacing: 2px; margin-bottom: 1px; text-transform: uppercase; }
    .header p { font-size: 9px; color: #475569; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; max-width: 80%; margin: 0 auto; }
    .doc-type { text-align: center; margin-bottom: 2mm; }
    .doc-type h2 { font-family: 'Cinzel', serif; font-size: 11px; color: #64748b; letter-spacing: 4px; text-transform: uppercase; display: inline-block; padding: 1px 15px; border-bottom: 1px solid #cbd5e1; }
    .meta-info { display: flex; justify-content: space-between; margin-bottom: 2mm; font-size: 10px; padding: 0 3mm; }
    .meta-item b { color: #64748b; font-size: 8px; text-transform: uppercase; margin-right: 3px; }
    .kv-qr-wrap { display: flex; align-items: flex-start; gap: 4mm; padding: 0 3mm; margin-bottom: 2mm; }
    .kv-section { flex: 1; min-width: 0; }
    .kv-row { display: grid; grid-template-columns: 44% 4% 52%; gap: 1px; align-items: baseline; margin: 1mm 0; font-size: 10px; }
    .kv-row .k { color: #0f172a; font-weight: 600; } .kv-row .c { text-align: center; color: #475569; font-weight: 700; } .kv-row .v { color: #0f172a; font-weight: 600; text-transform: uppercase; }
    .settlement-title { margin: 1mm 3mm 0.8mm; font-size: 10px; color: #0f172a; font-weight: 700; }
    .data-table { width: 100%; border-collapse: collapse; margin-bottom: 2mm; }
    .data-table th, .data-table td { border: 1px solid #e2e8f0; padding: 0.8mm 3mm; text-align: left; line-height: 1.25; }
    .data-table th { background: #f8fafc; font-size: 8px; text-transform: uppercase; color: #64748b; width: 35%; }
    .data-table td { font-size: 10px; font-weight: 600; color: #0f172a; }
    .qr-section { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; background: #fff; padding: 1.5mm; border: 1px solid #0f172a; border-radius: 3px; }
    .qr-section img { display: block; width: 30mm; height: 30mm; image-rendering: pixelated; image-rendering: crisp-edges; }
    .qr-label { font-size: 7px; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; margin-top: 1mm; }
    .footer { flex-shrink: 0; margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; padding: 3mm 5mm 1mm; }
    .sig-box { text-align: center; width: 55mm; min-height: 14mm; display: flex; flex-direction: column; justify-content: flex-end; }
    .sig-line { border-top: 1.5px solid #0f172a; padding-top: 3px; font-size: 8px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
    .digital-signature { font-family: 'Dancing Script', 'Brush Script MT', cursive; font-size: 22px; font-weight: 700; color: #1a237e; margin-bottom: 1px; line-height: 1; height: 8mm; display: flex; align-items: flex-end; justify-content: center; }
    ${CUSTOMER_SIGN_CSS}
    @media print { body { background: white; padding: 0; } .document { box-shadow: none !important; border: none !important; width: 210mm; height: 297mm; margin: 0 !important; padding: 8mm 15mm !important; page-break-after: always; } .document:last-child { page-break-after: auto; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  ${blocks.join('')}
  <div class="no-print" style="position:fixed; bottom: 30px; left:0; right:0; text-align:center; z-index:1000;">
    <button onclick="(async () => { try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch(e){} window.print(); })()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#0f172a; color:#fff; border:none; border-radius:10px; cursor:pointer; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);">EXECUTE PRINT (A4)</button>
    <button onclick="window.close()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#fff; color:#475569; border:1px solid #e2e8f0; border-radius:10px; cursor:pointer; margin-left:15px;">TERMINATE</button>
  </div>
</body></html>`;

    const win = window.open('', '_blank', 'width=1000,height=750');
    if (!win) {
      toast.error('Popup blocked — allow popups for this site to print');
      return;
    }
    writePrintDocument(win, html);
    win.document.close();
  };

  // ── Signature capture (pad / pen tablet) ──
  // Captured inside the payment modal, so the farmer signs at the moment the
  // installment is recorded. The pad only uploads the images here; they are
  // attached to the row by persistSignature() once it has an id.
  const handleSaveSignature = async ({ customer, authority }) => {
    setFormData((f) => ({
      ...f,
      customer_signature_url: customer || '',
      authority_signature_url: authority || '',
    }));
    setSigPadOpen(false);
  };

  /** The signature columns are not part of the payment payload — one PUT once the row exists. */
  const persistSignature = async (paymentId, sig) => {
    if (!paymentId || !sig.customer_signature_url) return;
    const patch = { customer_signature_url: sig.customer_signature_url };
    if (sig.authority_signature_url) patch.authority_signature_url = sig.authority_signature_url;
    // A failed signature must not roll back a saved payment — the row keeps its
    // data and the signature can be captured again from the payment modal.
    try {
      await api.put(`/signatures/farmer_payment/${paymentId}`, patch);
    } catch {
      toast.error('Payment saved, but the signature could not be attached');
    }
  };

  const handleDownloadReceiptPDF = () => {
    const el = receiptRef.current;
    if (!el) return;
    html2pdf().set({
      margin: 0.3,
      filename: `Receipt_${farmer.name}_${receiptPayment?.id || 'payment'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
    }).from(el).save();
  };

  const handleDownloadStatementPDF = () => {
    const el = statementRef.current;
    if (!el) return;
    el.style.display = 'block';
    html2pdf().set({
      margin: 0.3,
      filename: `Statement_${farmer.name}_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' },
    }).from(el).save().then(() => { el.style.display = 'none'; });
  };

  const handleExportExcel = () => {
    const data = paymentsWithRunning.map((p, i) => {
      const amt = parseFloat(p.amount) || 0;
      return {
      '#': i + 1,
      Date: formatDate(p.date),
      Particular: p.particular || '',
      Mode: p.payment_mode || 'BANK',
      'Debit (paid to farmer)': amt > 0 ? amt : '',
      'Credit (refund back)': amt < 0 ? -amt : '',
      'Cash (₹)': Math.abs(parseFloat(p.cash_amount) || 0),
      'Bank (₹)': Math.abs(parseFloat(p.bank_amount) || 0),
      By: p.by_note || '',
      'Balance (net paid)': parseFloat(p.running_total) || 0,
      'Bank Name': p.bank_name || '',
      'Account No': p.bank_account_no || '',
      'IFSC': p.bank_ifsc || '',
      'Bank Ref': p.bank_reference || '',
      Remarks: p.remarks || '',
      };
    });
    // Add summary row
    data.push({});
    data.push({
      '#': '',
      Date: 'SUMMARY',
      Particular: `Committed: ₹${formatCurrency(summary.total_amount)}`,
      Mode: '',
      'Debit (paid to farmer)': ledgerTotals.debit,
      'Credit (refund back)': ledgerTotals.credit,
      'Cash (₹)': parseFloat(summary.cash_paid) || 0,
      'Bank (₹)': parseFloat(summary.bank_paid) || 0,
      By: '',
      'Balance (net paid)': ledgerTotals.net,
      Remarks: `Remaining: ₹${formatCurrency(summary.remaining)}`,
    });
    const ws = XLSX.utils.json_to_sheet(data);
    // Set column widths
    ws['!cols'] = [
      { wch: 5 }, { wch: 14 }, { wch: 22 }, { wch: 8 }, { wch: 20 }, { wch: 18 },
      { wch: 12 }, { wch: 12 }, { wch: 14 },
      { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 20 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Farmer Payments');
    XLSX.writeFile(wb, `Farmer_${farmer.name}_Payments.xlsx`);
  };

  if (loading) {
    return (
      <div className="w-full space-y-6">
        <SkeletonBlock className="h-24 w-full" />
        <SkeletonBlock className="h-56 w-full" />
        <SkeletonBlock className="h-80 w-full" />
      </div>
    );
  }

  if (!farmer) {
    return (
      <div className="rounded-panel border border-mr-line bg-mr-surface">
        <EmptyState
          icon={Tractor}
          title="Farmer not found"
          description="This farmer may have been removed, or belongs to a different site."
          action={(
            <Button
              variant="outline"
              onClick={() => navigate('/farmers')}
              className="mt-1 h-10 rounded-full border-mr-line text-[13px]"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" strokeWidth={1.9} /> Back to farmers
            </Button>
          )}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl pb-16">
      {/* ── Header ── */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/farmers')}
            aria-label="Back to farmers"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-mr-line text-mr-muted transition-colors hover:bg-mr-surface-2 hover:text-mr-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-[clamp(1.375rem,2.4vw,1.875rem)] font-semibold leading-tight tracking-[-0.03em] text-mr-text">
                {farmer.name}
              </h1>
              <StatusPill tone={FARMER_STATUS_TONE[farmer.status] || 'neutral'} className="capitalize">
                {farmer.status}
              </StatusPill>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-mr-muted">
              {farmer.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" /> {farmer.phone}
                </span>
              )}
              {farmer.address && (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} aria-hidden="true" />
                  <span className="truncate">{farmer.address}</span>
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BulkActionsBar
            count={selection.count}
            onClear={selection.clear}
            onEdit={handleBulkEdit}
            onDelete={canDelete ? handleBulkDelete : undefined}
            onPrint={handleBulkPrint}
            entityLabel="payment"
            deleting={bulkDeleting}
          />
          <button type="button" className={GHOST_BTN} onClick={handleExportExcel} title="Download Excel">
            <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" /> Excel
          </button>
          <button type="button" className={GHOST_BTN} onClick={handleDownloadStatementPDF} title="Download full statement PDF">
            <FileText className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" /> Statement
          </button>
          {canWrite && (
            <button type="button" className={PRIMARY_BTN} onClick={handleOpenCreate}>
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> Add payment
            </button>
          )}
        </div>
      </div>

      {/* ── Settlement position ──
         Remaining leads because it is the number that decides whether
         anything still has to happen. Figures count up and the bars fill
         once on arrival; both land on the real value. */}
      <section aria-labelledby="mr-farmer-position" className="mt-7 border-t border-mr-line pt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 id="mr-farmer-position" className="text-[13px] text-mr-muted">Remaining to pay</h2>
            <p className={`mt-1.5 text-[clamp(2rem,4vw,2.75rem)] font-semibold leading-none tracking-[-0.04em] ${summary.remaining > 0 ? 'text-mr-text' : 'text-mr-lime-ink'}`}>
              <CountUp value={summary.remaining} format={money} title={money(summary.remaining)} />
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={summary.remaining > 0 ? 'attention' : 'positive'}>
              {summary.remaining > 0 ? 'Settlement pending' : 'Fully settled'}
            </StatusPill>
            <StatusPill>{payments.length} payment{payments.length === 1 ? '' : 's'}</StatusPill>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="text-mr-muted">Paid of committed</span>
            <span className="font-medium tabular-nums text-mr-text" title={`${money(summary.total_paid)} of ${money(summary.total_amount)}`}>
              <CountUp value={summary.total_paid} format={moneyCompact} /> of {moneyCompact(summary.total_amount)}
            </span>
          </div>
          <ProgressBar
            className="mt-2"
            value={progressPct}
            tone="bg-mr-lime-ink"
            label={`${progressPct.toFixed(1)}% of the committed amount paid`}
          />
          <p className="mt-1.5 text-[12px] text-mr-faint">{progressPct.toFixed(1)}% settled</p>
        </div>

        {/* Cash and bank legs */}
        <div className="mt-7 grid gap-8 sm:grid-cols-2">
          {[
            {
              key: 'cash', label: 'Cash leg', bar: 'bg-mr-aqua-ink',
              toPay: summary.cash_to_pay, paid: summary.cash_paid, remaining: summary.cash_remaining,
            },
            {
              key: 'bank', label: 'Bank leg', bar: 'bg-mr-blue',
              toPay: summary.bank_to_pay, paid: summary.bank_paid, remaining: summary.bank_remaining,
            },
          ].map((leg) => {
            const legPct = leg.toPay > 0 ? Math.min((leg.paid / leg.toPay) * 100, 100) : 0;
            return (
              <div key={leg.key} className="min-w-0">
                <div className="flex items-baseline justify-between gap-3 border-b border-mr-line pb-2.5">
                  <h3 className="text-[14px] font-semibold text-mr-text">{leg.label}</h3>
                  <span className="text-[12px] tabular-nums text-mr-faint">{legPct.toFixed(0)}% paid</span>
                </div>

                <div className="mt-3.5">
                  <span className="block text-[13px] text-mr-muted">Remaining</span>
                  <p className={`mt-0.5 text-[20px] font-semibold leading-none tracking-[-0.025em] ${leg.remaining > 0 ? 'text-mr-text' : 'text-mr-lime-ink'}`}>
                    <CountUp value={leg.remaining} format={money} title={money(leg.remaining)} />
                  </p>
                </div>

                {leg.toPay > 0 && (
                  <ProgressBar
                    className="mt-3"
                    height="h-1.5"
                    value={legPct}
                    tone={leg.bar}
                    label={`${leg.label}: ${legPct.toFixed(1)}% paid`}
                  />
                )}

                <dl className="mt-3 text-[13px]">
                  <div className="flex items-baseline justify-between gap-3 border-b border-mr-line py-2">
                    <dt className="text-mr-muted">Committed</dt>
                    <dd className="font-medium tabular-nums text-mr-text" title={money(leg.toPay)}>{moneyCompact(leg.toPay)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 border-b border-mr-line py-2">
                    <dt className="text-mr-muted">Paid</dt>
                    <dd className="font-semibold tabular-nums text-mr-lime-ink" title={money(leg.paid)}>
                      <CountUp value={leg.paid} format={moneyCompact} />
                    </dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Land, commission and notes — supporting detail, one quiet surface ── */}
      <section className="mt-10">
        <h2 className="border-b border-mr-line pb-2.5 text-[15px] font-semibold tracking-[-0.01em] text-mr-text">Land &amp; commission</h2>
        <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-3">
          {[
            {
              label: 'Size of land',
              value: farmer.land_size_bigha
                ? `${parseFloat(farmer.land_size_bigha).toLocaleString('en-IN')} ${landUnitLabel(farmer.land_size_unit)}`
                : '—',
            },
            {
              label: 'Rate of land',
              value: farmer.land_rate ? money(farmer.land_rate) : '—',
            },
            {
              label: 'Paid to broker',
              value: farmer.commission_paid_to_broker ? money(farmer.commission_paid_to_broker) : '—',
            },
          ].map((row) => (
            <div key={row.label} className="min-w-0">
              <dt className="text-[12px] text-mr-muted">{row.label}</dt>
              <dd className="mt-1 truncate text-[18px] font-semibold tracking-[-0.02em] tabular-nums text-mr-text">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
        {farmer.notes && (
          <p className="mt-5 border-t border-mr-line pt-4 text-[13px] leading-relaxed text-mr-muted">
            <span className="font-medium text-mr-text">Notes · </span>{farmer.notes}
          </p>
        )}
      </section>

      {/* ── Payment history ── */}
      <section className="overflow-hidden rounded-panel border border-mr-line bg-mr-surface">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-mr-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-mr-text">Payment history</h2>
            <p className="mt-0.5 text-[12px] text-mr-muted">Every installment recorded against this farmer</p>
            {/* The two money columns are named once, in words, so nobody has to
                infer direction from a minus sign or a colour. */}
            <ul className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-mr-muted">
              <li className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-mr-lime-ink" aria-hidden="true" />
                <span><span className="font-medium text-mr-text">Debit</span> — paid to farmer</span>
              </li>
              <li className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-mr-coral-ink" aria-hidden="true" />
                <span><span className="font-medium text-mr-text">Credit</span> — refunded back by farmer</span>
              </li>
              <li className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-mr-faint" aria-hidden="true" />
                <span><span className="font-medium text-mr-text">Balance</span> — net paid up to that row</span>
              </li>
            </ul>
          </div>
          <span className="shrink-0 text-[12px] text-mr-muted">
            {paymentsWithRunning.length} entr{paymentsWithRunning.length === 1 ? 'y' : 'ies'}
          </span>
        </div>
        <div className="p-0">
          {paymentsWithRunning.length === 0 ? (
            <EmptyState
              icon={IndianRupee}
              title="No payments yet"
              description="Record the first installment to start building this farmer's statement."
              action={canWrite ? (
                <Button
                  onClick={handleOpenCreate}
                  className="mt-1 h-10 rounded-full bg-mr-ink px-4 text-[13px] font-semibold text-white hover:bg-mr-ink-2"
                >
                  <Plus className="mr-1.5 h-4 w-4" strokeWidth={2} /> Add payment
                </Button>
              ) : null}
            />
          ) : (
            <>
              {/* Desktop: 8 grouped columns instead of 17 pinned ones.
                  No sticky side columns and no content-visibility — both were
                  what made the old table shear and jump while scrolling. */}
              <div className="hidden max-h-[65vh] overflow-y-auto overflow-x-auto md:block">
                <table className="w-full min-w-[1040px] border-collapse text-left">
                  <caption className="sr-only">
                    Payment history for {farmer.name}. Debit is money paid to the farmer, credit is money refunded back.
                  </caption>
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th scope="col" className="w-10 border-b border-mr-line bg-mr-surface-2 px-4 py-2.5">
                        <Checkbox
                          checked={selection.isAllSelected(visibleIds) ? true : (selection.count > 0 && visibleIds.some((vid) => selection.isSelected(vid))) ? 'indeterminate' : false}
                          onCheckedChange={() => selection.toggleAll(visibleIds)}
                          aria-label="Select all payments"
                        />
                      </th>
                      {[
                        { label: 'Date', sub: null, align: '', tone: '' },
                        { label: 'Particular', sub: null, align: '', tone: '' },
                        { label: 'Mode', sub: null, align: '', tone: '' },
                        { label: 'Debit', sub: 'paid to farmer', align: 'text-right', tone: 'text-mr-lime-ink' },
                        { label: 'Credit', sub: 'refund back', align: 'text-right', tone: 'text-mr-coral-ink' },
                        { label: 'Balance', sub: 'net paid', align: 'text-right', tone: '' },
                        { label: 'Status', sub: null, align: '', tone: '' },
                        { label: 'Actions', sub: null, align: 'text-right', tone: '' },
                      ].map((col) => (
                        <th
                          key={col.label}
                          scope="col"
                          className={`border-b border-mr-line bg-mr-surface-2 px-4 py-2.5 align-bottom text-[12px] font-medium text-mr-muted ${col.align}`}
                        >
                          <span className={`block ${col.tone || 'text-mr-muted'}`}>{col.label}</span>
                          {col.sub && (
                            <span className="mt-0.5 block text-[11px] font-normal normal-case text-mr-faint">{col.sub}</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paymentsWithRunning.map((payment, idx) => {
                      const isPayAdvance = payment.particular?.toUpperCase().includes('PAY ADVANCE');
                      const amt = parseFloat(payment.amount) || 0;
                      const isRefund = amt < 0;
                      const cash = Math.abs(parseFloat(payment.cash_amount) || 0);
                      const bank = Math.abs(parseFloat(payment.bank_amount) || 0);
                      const meta = [
                        payment.by_note && `By ${payment.by_note}`,
                        payment.assigned_admin_id && getAssignedAdminLabel(payment),
                        payment.created_by_name && `Entry by ${payment.created_by_name}`,
                        payment.remarks,
                      ].filter(Boolean).join(' · ');

                      return (
                        <tr
                          key={payment.id}
                          className={`border-b border-mr-line align-top transition-colors duration-150 hover:bg-mr-surface-2/60 ${isPayAdvance ? 'bg-mr-amber-soft/50' : ''}`}
                        >
                          <td className="px-4 py-3.5">
                            <Checkbox
                              checked={selection.isSelected(payment.id)}
                              onCheckedChange={() => selection.toggle(payment.id)}
                              aria-label={`Select payment ${idx + 1}`}
                            />
                          </td>

                          <td className="whitespace-nowrap px-4 py-3.5">
                            <span className="block text-[13px] font-medium tabular-nums text-mr-text">{formatDate(payment.date)}</span>
                            <span className="mt-0.5 block text-[12px] tabular-nums text-mr-faint">#{idx + 1}</span>
                          </td>

                          <td className="max-w-[22rem] px-4 py-3.5">
                            <span className={`block truncate text-[13px] font-medium ${isPayAdvance ? 'text-mr-amber-ink' : 'text-mr-text'}`} title={payment.particular}>
                              {payment.particular || '—'}
                            </span>
                            {meta && (
                              <span className="mt-0.5 block truncate text-[12px] text-mr-faint" title={meta}>{meta}</span>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3.5">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium ${MODE_CHIP[payment.payment_mode] || MODE_CHIP.DEFAULT}`}>
                              {payment.payment_mode || 'BANK'}
                            </span>
                            {payment.cheque_no && (
                              <span className="mt-0.5 block text-[12px] tabular-nums text-mr-faint">Cheque {payment.cheque_no}</span>
                            )}
                            <ChequeStatusControl
                              chequeStatus={payment.cheque_status}
                              source="farmer_payment"
                              entryId={payment.id}
                              isAdmin={isAdmin}
                              onStatusChange={fetchData}
                            />
                          </td>

                          {/* Debit — money paid to the farmer. Empty on a refund row. */}
                          <td className="whitespace-nowrap bg-mr-lime-soft/25 px-4 py-3.5 text-right">
                            {isRefund ? (
                              <span className="text-[13px] text-mr-faint" aria-label="No debit">—</span>
                            ) : (
                              <>
                                <span className="block text-[14px] font-semibold tabular-nums text-mr-lime-ink">
                                  ₹{formatCurrency(amt)}
                                </span>
                                {(cash > 0 || bank > 0) && (
                                  <span className="mt-0.5 block text-[12px] tabular-nums text-mr-faint">
                                    {cash > 0 && <span className="text-mr-aqua-ink">Cash ₹{formatCurrency(cash)}</span>}
                                    {cash > 0 && bank > 0 && ' · '}
                                    {bank > 0 && <span className="text-mr-blue">Bank ₹{formatCurrency(bank)}</span>}
                                  </span>
                                )}
                              </>
                            )}
                          </td>

                          {/* Credit — money the farmer returned. Empty on a payment row. */}
                          <td className="whitespace-nowrap bg-mr-coral-soft/25 px-4 py-3.5 text-right">
                            {isRefund ? (
                              <>
                                <span className="block text-[14px] font-semibold tabular-nums text-mr-coral-ink">
                                  ₹{formatCurrency(-amt)}
                                </span>
                                {(cash > 0 || bank > 0) && (
                                  <span className="mt-0.5 block text-[12px] tabular-nums text-mr-faint">
                                    {cash > 0 && <span className="text-mr-aqua-ink">Cash ₹{formatCurrency(cash)}</span>}
                                    {cash > 0 && bank > 0 && ' · '}
                                    {bank > 0 && <span className="text-mr-blue">Bank ₹{formatCurrency(bank)}</span>}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-[13px] text-mr-faint" aria-label="No credit">—</span>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3.5 text-right">
                            <span className="block text-[13px] font-semibold tabular-nums text-mr-text">
                              ₹{formatCurrency(payment.running_total)}
                            </span>
                            {!isPostedPayment(payment) && (
                              <span className="mt-0.5 block text-[11px] text-mr-faint">not counted yet</span>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3.5">
                            <ApprovalStatusBadge status={payment.status || 'pending'} />
                            <span className="mt-1 block"><VoucherThumbnail url={payment.voucher_url} /></span>
                          </td>

                          <td className="whitespace-nowrap px-4 py-3.5">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                onClick={() => handlePrintReceipt(payment)}
                                className="h-8 w-8 rounded-full p-0 text-mr-faint hover:bg-mr-lime-soft hover:text-mr-lime-ink"
                                title="Print receipt"
                                aria-label="Print receipt"
                              >
                                <Printer className="h-4 w-4" strokeWidth={1.9} />
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() => handleOpenEdit(payment)}
                                className={`h-8 w-8 rounded-full p-0 ${canUpdate ? 'text-mr-faint hover:bg-mr-surface-2 hover:text-mr-text' : 'text-mr-amber-ink hover:bg-mr-amber-soft'}`}
                                title={canUpdate ? 'Edit' : 'Request edit'}
                                aria-label={canUpdate ? 'Edit payment' : 'Request payment edit'}
                              >
                                <Edit2 className="h-4 w-4" strokeWidth={1.9} />
                              </Button>
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  onClick={() => handleDelete(payment.id)}
                                  className="h-8 w-8 rounded-full p-0 text-mr-faint hover:bg-mr-coral-soft hover:text-mr-coral-ink"
                                  title="Delete"
                                  aria-label="Delete payment"
                                >
                                  <Trash2 className="h-4 w-4" strokeWidth={1.9} />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile: one card per payment */}
              <ul className="divide-y divide-mr-line md:hidden">
                {paymentsWithRunning.map((payment, idx) => {
                  const amt = parseFloat(payment.amount) || 0;
                  const isRefund = amt < 0;
                  const cash = Math.abs(parseFloat(payment.cash_amount) || 0);
                  const bank = Math.abs(parseFloat(payment.bank_amount) || 0);
                  return (
                    <li key={`m-${payment.id}`} className="px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-medium text-mr-text">{payment.particular || '—'}</p>
                          <p className="mt-0.5 text-[12px] text-mr-faint">
                            #{idx + 1} · {formatDate(payment.date)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={`block text-[15px] font-semibold tabular-nums ${isRefund ? 'text-mr-coral-ink' : 'text-mr-lime-ink'}`}>
                            {isRefund ? '−' : '+'} ₹{formatCurrency(Math.abs(amt))}
                          </span>
                          <span className={`mt-0.5 block text-[11px] font-medium ${isRefund ? 'text-mr-coral-ink' : 'text-mr-lime-ink'}`}>
                            {isRefund ? 'Credit · refund back' : 'Debit · paid to farmer'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium ${MODE_CHIP[payment.payment_mode] || MODE_CHIP.DEFAULT}`}>
                          {payment.payment_mode || 'BANK'}
                        </span>
                        <ApprovalStatusBadge status={payment.status || 'pending'} />
                        {payment.cheque_no && <span className="text-[12px] text-mr-faint">Cheque {payment.cheque_no}</span>}
                      </div>

                      <p className="mt-2 text-[12px] tabular-nums text-mr-faint">
                        {cash > 0 && <span className="text-mr-aqua-ink">Cash ₹{formatCurrency(cash)}</span>}
                        {cash > 0 && bank > 0 && ' · '}
                        {bank > 0 && <span className="text-mr-blue">Bank ₹{formatCurrency(bank)}</span>}
                        {(cash > 0 || bank > 0) && ' · '}
                        Balance <span className="font-semibold text-mr-text">₹{formatCurrency(payment.running_total)}</span>
                      </p>

                      <div className="mt-2 flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          onClick={() => handlePrintReceipt(payment)}
                          className="h-9 w-9 rounded-full p-0 text-mr-faint"
                          aria-label="Print receipt"
                        >
                          <Printer className="h-4 w-4" strokeWidth={1.9} />
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => handleOpenEdit(payment)}
                          className={`h-9 w-9 rounded-full p-0 ${canUpdate ? 'text-mr-faint' : 'text-mr-amber-ink'}`}
                          aria-label={canUpdate ? 'Edit payment' : 'Request payment edit'}
                        >
                          <Edit2 className="h-4 w-4" strokeWidth={1.9} />
                        </Button>
                        {canDelete && (
                          <Button
                            variant="ghost"
                            onClick={() => handleDelete(payment.id)}
                            className="h-9 w-9 rounded-full p-0 text-mr-faint"
                            aria-label="Delete payment"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.9} />
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Totals live below the scroll area, not in a sticky tfoot that
                  fought the sticky columns for z-order. The credit/debit pair
                  restates the two money columns, then the arithmetic that
                  produces the net — no mental subtraction required. */}
              <div className="border-t border-mr-line bg-mr-surface-2/60 px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
                  <span className="text-[12px] font-medium text-mr-muted">
                    Total · {payments.length} payment{payments.length === 1 ? '' : 's'}
                  </span>
                  <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 tabular-nums">
                    <span className="text-[12px] text-mr-muted">
                      Debit <span className="ml-1 text-[15px] font-semibold text-mr-lime-ink">₹{formatCurrency(ledgerTotals.debit)}</span>
                    </span>
                    <span className="text-[12px] text-mr-faint">−</span>
                    <span className="text-[12px] text-mr-muted">
                      Credit <span className="ml-1 text-[15px] font-semibold text-mr-coral-ink">₹{formatCurrency(ledgerTotals.credit)}</span>
                    </span>
                    <span className="text-[12px] text-mr-faint">=</span>
                    <span className="text-[12px] text-mr-muted">
                      Net paid <span className="ml-1 text-[17px] font-semibold text-mr-text">₹{formatCurrency(ledgerTotals.net)}</span>
                    </span>
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-mr-line pt-2.5 text-[12px] text-mr-muted">
                  <span>
                    Cash leg <span className="ml-1 font-semibold tabular-nums text-mr-aqua-ink">₹{formatCurrency(summary.cash_paid)}</span>
                  </span>
                  <span>
                    Bank leg <span className="ml-1 font-semibold tabular-nums text-mr-blue">₹{formatCurrency(summary.bank_paid)}</span>
                  </span>
                  <span>
                    Remaining <span className={`ml-1 font-semibold tabular-nums ${summary.remaining > 0 ? 'text-mr-amber-ink' : 'text-mr-lime-ink'}`}>₹{formatCurrency(summary.remaining)}</span>
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Add / Edit Payment Dialog */}
      <EntryDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}
        title={editingPayment ? (canUpdate ? 'Edit Payment' : 'Request Payment Edit') : 'Add Payment'}
        description={editingPayment ? (canUpdate ? 'Update installment details.' : 'Submit edit request with proof for admin approval.') : `Add a new installment for ${farmer.name}. Choose how to split between Cash and Bank.`}
        footer={
          <EntryFooter
            onCancel={() => setDialogOpen(false)}
            onSubmit={() => paymentFormRef.current?.requestSubmit()}
            submitting={submitting}
            disabled={editRequestPending || voucherUploading}
            submitLabel={
              submitting
                ? (editingPayment && !canUpdate ? 'Submitting Request...' : editingPayment ? 'Updating...' : 'Adding...')
                : voucherUploading
                  ? 'Uploading voucher...'
                  : editRequestPending
                    ? 'Request Sent'
                    : editingPayment && !canUpdate
                      ? 'Submit Edit Request'
                      : editingPayment ? 'Update' : 'Add Payment'
            }
          />
        }
      >
        {message.text && (
          <div className={`flex gap-2 p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
              : 'bg-red-50 border border-red-100 text-red-700'
          }`}>
            {message.type === 'success' ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            {message.text}
          </div>
        )}

        <form ref={paymentFormRef} onSubmit={handleSubmit} className="space-y-4">
          {/* ── Transaction Type: Debit (pay farmer) / Credit (refund) ── */}
          <CreditDebitTabs
            value={formData.transaction_type}
            onChange={(v) => handleFormChange('transaction_type', v)}
            debitLabel="Payment to Farmer"
            creditLabel="Refund from Farmer"
            debitHint="Installment paid to the farmer (adds to Paid)"
            creditHint="Farmer returns money (subtracts from Paid)"
            debitVisual="out"
            creditVisual="in"
          />

          <EntryRow>
            <EntryField label="Date" required hint={!isAdmin ? 'Only Admin/Super Admin can set a custom date' : undefined}>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => handleFormChange('date', e.target.value)}
                required
                disabled={!isAdmin}
              />
            </EntryField>
            <EntryField
              label="Mode"
              required
              hint={formData.mode === 'CASH' ? 'Payment will be recorded as cash' : formData.mode === 'BANK' ? 'Payment will be recorded as bank transfer' : 'Cheque payment — will require approval'}
            >
              <EntryModeChips
                value={formData.mode}
                onChange={(m) => handleFormChange('mode', m)}
                modes={['CASH', 'BANK', 'CHEQUE']}
              />
            </EntryField>
          </EntryRow>

          <EntryAmount
            direction={formData.transaction_type}
            visual={formData.transaction_type === 'credit' ? 'in' : 'out'}
            label={formData.transaction_type === 'credit'
              ? (formData.mode === 'CASH' ? 'Refund in Cash (₹)' : formData.mode === 'BANK' ? 'Refund in Bank (₹)' : 'Refund Cheque (₹)')
              : (formData.mode === 'CASH' ? 'Paid in Cash (₹)' : formData.mode === 'BANK' ? 'Paid in Bank (₹)' : 'Cheque Amount (₹)')}
            inputProps={{
              step: '0.01',
              placeholder: '0',
              value: formData.amount,
              onChange: (e) => handleFormChange('amount', e.target.value),
              required: true,
            }}
          />

          <BankAccountSelect
            value={formData.bank_account_id}
            onChange={(value) => handleFormChange('bank_account_id', value)}
            paymentMode={formData.mode}
            disabled={submitting}
            required
          />

          <EntryRow>
            <EntryParticular
              mode={formData.mode}
              value={formData.particular}
              onChange={(val) => handleFormChange('particular', val)}
            />
            {formData.mode === 'CHEQUE' && (
              <EntryField label="Cheque No" required>
                <Input
                  placeholder="Enter cheque number"
                  value={formData.cheque_no || ''}
                  onChange={(e) => handleFormChange('cheque_no', e.target.value)}
                  required
                />
              </EntryField>
            )}
            <EntryField label="By (who / reference)">
              <Input
                placeholder="OM / PRAVINDER / KULDEEP JI"
                value={formData.by_note}
                onChange={(e) => handleFormChange('by_note', e.target.value)}
              />
            </EntryField>
          </EntryRow>

          {/* ── Bank Details — BANK mode only ── */}
          {formData.mode === 'BANK' && (
            <div className="rounded-lg border border-slate-200 p-3 space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Bank Details</p>
              <EntryRow>
                <EntryField label="Bank Name">
                  <Input
                    placeholder="State Bank of India"
                    value={formData.bank_name}
                    onChange={(e) => handleFormChange('bank_name', e.target.value)}
                  />
                </EntryField>
                <EntryField label="Account No.">
                  <Input
                    placeholder="1234567890"
                    value={formData.bank_account_no}
                    onChange={(e) => handleFormChange('bank_account_no', e.target.value)}
                  />
                </EntryField>
              </EntryRow>
              <EntryRow>
                <EntryField label="Reference / UTR No.">
                  <Input
                    placeholder="UTR / Txn Ref"
                    value={formData.bank_reference}
                    onChange={(e) => handleFormChange('bank_reference', e.target.value)}
                  />
                </EntryField>
                <EntryField label="IFSC Code">
                  <Input
                    placeholder="SBIN0001234"
                    value={formData.bank_ifsc}
                    onChange={(e) => handleFormChange('bank_ifsc', e.target.value)}
                  />
                </EntryField>
              </EntryRow>
            </div>
          )}

          <EntryField label="Remarks">
            <Textarea
              placeholder="biyaz 9 month, chq RTGS OM 19-1-26, etc."
              value={formData.remarks}
              onChange={(e) => handleFormChange('remarks', e.target.value)}
              rows={2}
            />
          </EntryField>

          {approvers.length > 0 && (
            <EntryField label="Send To Admin For Approval">
              <Select
                value={formData.assigned_admin_id?.toString() || '_none'}
                onValueChange={(val) => handleFormChange('assigned_admin_id', val === '_none' ? null : parseInt(val))}
              >
                <SelectTrigger><SelectValue placeholder="Select approver" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">- Auto-assign or no preference -</SelectItem>
                  {approvers.map((app) => (
                    <SelectItem key={app.id} value={String(app.id)}>{app.full_name || app.name || app.email || `Admin #${app.id}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </EntryField>
          )}

          {/* Voucher / Receipt Upload */}
          <VoucherUpload
            value={formData.voucher_url}
            onChange={(url) => handleFormChange('voucher_url', url || '')}
            onUploadingChange={setVoucherUploading}
            disabled={submitting}
          />

          {/* Farmer signs here, while the payment is being recorded. */}
          <EntryField
            label="Customer signature"
            hint="Signature pad, pen tablet, mouse or finger — attached to this payment's receipt"
          >
            {formData.customer_signature_url ? (
              <div className="flex flex-wrap items-center gap-2">
                <img
                  src={formData.customer_signature_url}
                  alt="Captured customer signature"
                  className="h-14 rounded-lg border border-slate-200 bg-white object-contain px-2"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => setSigPadOpen(true)} disabled={submitting}>
                  <PenLine className="mr-1.5 h-3.5 w-3.5" /> Sign again
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-slate-500"
                  disabled={submitting}
                  onClick={() => setFormData((f) => ({ ...f, customer_signature_url: '', authority_signature_url: '' }))}
                >
                  <X className="mr-1.5 h-3.5 w-3.5" /> Clear
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => setSigPadOpen(true)}
                disabled={submitting}
                className="w-full justify-center border-dashed"
              >
                <PenLine className="mr-1.5 h-4 w-4" /> Capture signature
              </Button>
            )}
          </EntryField>

          {/* Proof Photo Upload (sub-admin editing only) - OPTIONAL */}
          {editingPayment && !canUpdate && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-slate-600">
                <Camera className="w-3.5 h-3.5" /> Proof Photo <span className="text-[10px] text-slate-400">(optional)</span>
              </Label>
              <Input type="file" accept="image/*" onChange={handleProofPhotoChange} />
              {proofPreview && (
                <img src={proofPreview} alt="Proof preview" className="h-24 rounded-lg border object-contain mt-1" />
              )}
              <p className="text-[11px] text-slate-500">Attach a photo as supporting evidence (optional)</p>
            </div>
          )}
        </form>
      </EntryDialog>

      {/* ── Receipt Viewer Dialog ── */}
      <SignaturePad
        open={sigPadOpen}
        onOpenChange={setSigPadOpen}
        onSave={handleSaveSignature}
        askAuthority={!nameSignOn()}
        signeeLabel={`${farmer.name} · ₹${formatCurrency(formData.amount || 0)}`}
      />

      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Payment Receipt</DialogTitle>
            <DialogDescription className="text-sm">Receipt for payment #{receiptPayment?.id}</DialogDescription>
          </DialogHeader>

          {receiptPayment && (
            <>
              <div ref={receiptRef}>
                <div style={{ fontFamily: 'Arial, sans-serif', color: '#1a1a1a', maxWidth: '680px', margin: '0 auto', padding: '24px', border: '2px solid #1e293b', borderRadius: '4px' }}>
                  {/* Header */}
                  <div style={{ borderBottom: '3px solid #1e293b', paddingBottom: '16px', marginBottom: '16px', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '22px', fontWeight: '800', margin: '0', letterSpacing: '1px', textTransform: 'uppercase', color: '#0f172a' }}>Payment Receipt</h1>
                    <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0', letterSpacing: '0.5px' }}>Farmer Payment Acknowledgement</p>
                  </div>

                  {/* Receipt No & Date Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '12px' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Receipt No: </span>
                      <strong style={{ color: '#0f172a' }}>FP-{String(receiptPayment.id).padStart(5, '0')}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Date: </span>
                      <strong style={{ color: '#0f172a' }}>{formatDate(receiptPayment.date)}</strong>
                    </div>
                  </div>

                  {/* Farmer Info Box */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '12px 16px', marginBottom: '20px' }}>
                    <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                      <tbody>
                        <tr>
                          <td style={{ padding: '3px 0', color: '#64748b', width: '120px' }}>Farmer Name</td>
                          <td style={{ padding: '3px 0', fontWeight: '600' }}>{farmer.name}</td>
                          <td style={{ padding: '3px 0', color: '#64748b', width: '100px' }}>Phone</td>
                          <td style={{ padding: '3px 0', fontWeight: '600' }}>{farmer.phone || '—'}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '3px 0', color: '#64748b' }}>Address</td>
                          <td style={{ padding: '3px 0' }} colSpan={3}>{farmer.address || '—'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Payment Details Table */}
                  <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', marginBottom: '20px' }}>
                    <thead>
                      <tr style={{ background: '#0f172a', color: '#fff' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '600' }}>Description</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600' }}>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px 12px' }}>Particular</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500' }}>{receiptPayment.particular}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f0fdf4' }}>
                        <td style={{ padding: '8px 12px', color: '#15803d' }}>● Cash Payment</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600', color: '#15803d' }}>₹{formatCurrency(receiptPayment.cash_amount || 0)}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#eff6ff' }}>
                        <td style={{ padding: '8px 12px', color: '#1d4ed8' }}>● Bank Payment</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600', color: '#1d4ed8' }}>₹{formatCurrency(receiptPayment.bank_amount || 0)}</td>
                      </tr>
                      <tr style={{ background: '#0f172a', color: '#fff' }}>
                        <td style={{ padding: '10px 12px', fontWeight: '700', fontSize: '13px' }}>TOTAL AMOUNT</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', fontSize: '14px' }}>₹{formatCurrency(receiptPayment.amount)}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Bank Details (if applicable) */}
                  {(parseFloat(receiptPayment.bank_amount) > 0) && (
                    <div style={{ border: '1px solid #bfdbfe', borderRadius: '4px', padding: '12px 16px', marginBottom: '20px', background: '#eff6ff' }}>
                      <p style={{ fontSize: '11px', fontWeight: '700', color: '#1d4ed8', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bank Transfer Details</p>
                      <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr>
                            <td style={{ padding: '2px 0', color: '#64748b', width: '130px' }}>Bank Name</td>
                            <td style={{ padding: '2px 0', fontWeight: '500' }}>{receiptPayment.bank_name || '—'}</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '2px 0', color: '#64748b' }}>Account No.</td>
                            <td style={{ padding: '2px 0', fontWeight: '500' }}>{receiptPayment.bank_account_no || '—'}</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '2px 0', color: '#64748b' }}>IFSC Code</td>
                            <td style={{ padding: '2px 0', fontWeight: '500' }}>{receiptPayment.bank_ifsc || '—'}</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '2px 0', color: '#64748b' }}>Reference / UTR</td>
                            <td style={{ padding: '2px 0', fontWeight: '500' }}>{receiptPayment.bank_reference || '—'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* By & Remarks */}
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', fontSize: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ color: '#64748b' }}>Paid By: </span>
                      <strong>{receiptPayment.by_note || '—'}</strong>
                    </div>
                    {receiptPayment.remarks && (
                      <div style={{ flex: 1 }}>
                        <span style={{ color: '#64748b' }}>Remarks: </span>
                        <span>{receiptPayment.remarks}</span>
                      </div>
                    )}
                  </div>

                  {/* Summary Bar */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '10px 16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <div><span style={{ color: '#64748b' }}>Total Agreed: </span><strong>₹{formatCurrency(summary.total_amount)}</strong></div>
                    <div><span style={{ color: '#64748b' }}>Total Paid: </span><strong style={{ color: '#15803d' }}>₹{formatCurrency(summary.total_paid)}</strong></div>
                    <div><span style={{ color: '#64748b' }}>Remaining: </span><strong style={{ color: summary.remaining > 0 ? '#d97706' : '#15803d' }}>₹{formatCurrency(summary.remaining)}</strong></div>
                  </div>

                  {/* Signature Area */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px', paddingTop: '16px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ borderTop: '1px solid #94a3b8', width: '160px', paddingTop: '6px' }}>
                        <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>Receiver’s Signature</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ borderTop: '1px solid #94a3b8', width: '160px', paddingTop: '6px' }}>
                        <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>Authorized Signature</p>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '20px', paddingTop: '8px', textAlign: 'center' }}>
                    <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0 }}>This is a computer-generated receipt. Generated on {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handlePrintReceipt}>
                  <Printer className="w-4 h-4 mr-1.5" /> Print
                </Button>
                <Button size="sm" onClick={handleDownloadReceiptPDF}>
                  <Download className="w-4 h-4 mr-1.5" /> Download PDF
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Hidden Statement for PDF Export ── */}
      <div ref={statementRef} style={{ display: 'none' }}>
        <div style={{ fontFamily: 'Arial, sans-serif', color: '#1a1a1a', padding: '20px' }}>
          {/* Statement Header */}
          <div style={{ borderBottom: '3px solid #1e293b', paddingBottom: '12px', marginBottom: '16px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: '800', margin: '0', textAlign: 'center', textTransform: 'uppercase', color: '#0f172a', letterSpacing: '1px' }}>Farmer Payment Statement</h1>
            <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0', textAlign: 'center' }}>Generated on {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
          </div>

          {/* Farmer Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '10px 14px' }}>
            <div>
              <span style={{ color: '#64748b' }}>Farmer: </span>
              <strong>{farmer?.name}</strong>
              {farmer?.phone && <span style={{ marginLeft: '12px', color: '#64748b' }}>Ph: {farmer.phone}</span>}
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Status: </span>
              <strong style={{ textTransform: 'capitalize' }}>{farmer?.status}</strong>
            </div>
          </div>

          {/* Summary Cards */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', fontSize: '11px' }}>
            <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '4px', padding: '8px 12px', textAlign: 'center' }}>
              <div style={{ color: '#64748b' }}>Total Amount</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>₹{formatCurrency(summary.total_amount)}</div>
            </div>
            <div style={{ flex: 1, border: '1px solid #bbf7d0', borderRadius: '4px', padding: '8px 12px', textAlign: 'center', background: '#f0fdf4' }}>
              <div style={{ color: '#15803d' }}>Cash (To Pay / Paid)</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#15803d' }}>₹{formatCurrency(summary.cash_to_pay)} / ₹{formatCurrency(summary.cash_paid)}</div>
            </div>
            <div style={{ flex: 1, border: '1px solid #bfdbfe', borderRadius: '4px', padding: '8px 12px', textAlign: 'center', background: '#eff6ff' }}>
              <div style={{ color: '#1d4ed8' }}>Bank (To Pay / Paid)</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#1d4ed8' }}>₹{formatCurrency(summary.bank_to_pay)} / ₹{formatCurrency(summary.bank_paid)}</div>
            </div>
            <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '4px', padding: '8px 12px', textAlign: 'center' }}>
              <div style={{ color: '#d97706' }}>Remaining</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#d97706' }}>₹{formatCurrency(summary.remaining)}</div>
            </div>
          </div>

          {/* Payments Table */}
          <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', marginBottom: '16px' }}>
            <thead>
              <tr style={{ background: '#0f172a', color: '#fff' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '600' }}>#</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '600' }}>Date</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '600' }}>Particular</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '600' }}>Mode</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '600' }}>Debit (paid)</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '600' }}>Credit (refund)</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '600' }}>Cash</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '600' }}>Bank</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '600' }}>By</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '600' }}>Balance</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '600' }}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {paymentsWithRunning.map((p, i) => {
                const amt = parseFloat(p.amount) || 0;
                return (
                <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={{ padding: '5px 8px' }}>{i + 1}</td>
                  <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{formatDate(p.date)}</td>
                  <td style={{ padding: '5px 8px' }}>{p.particular}</td>
                  <td style={{ padding: '5px 8px' }}>{p.payment_mode || 'BANK'}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: '500', color: '#15803d' }}>{amt > 0 ? `₹${formatCurrency(amt)}` : '—'}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: '500', color: '#b91c1c' }}>{amt < 0 ? `₹${formatCurrency(-amt)}` : '—'}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>₹{formatCurrency(Math.abs(p.cash_amount || 0))}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>₹{formatCurrency(Math.abs(p.bank_amount || 0))}</td>
                  <td style={{ padding: '5px 8px' }}>{p.by_note || '—'}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: '500' }}>₹{formatCurrency(p.running_total)}</td>
                  <td style={{ padding: '5px 8px', fontSize: '10px' }}>{p.remarks || '—'}</td>
                </tr>
                );
              })}
              {/* Totals */}
              <tr style={{ background: '#0f172a', color: '#fff', fontWeight: '700' }}>
                <td colSpan={4} style={{ padding: '7px 8px', fontSize: '11px' }}>TOTAL ({payments.length} payments)</td>
                <td style={{ padding: '7px 8px', textAlign: 'right', color: '#86efac' }}>₹{formatCurrency(ledgerTotals.debit)}</td>
                <td style={{ padding: '7px 8px', textAlign: 'right', color: '#fca5a5' }}>₹{formatCurrency(ledgerTotals.credit)}</td>
                <td style={{ padding: '7px 8px', textAlign: 'right', color: '#86efac' }}>₹{formatCurrency(summary.cash_paid)}</td>
                <td style={{ padding: '7px 8px', textAlign: 'right', color: '#93c5fd' }}>₹{formatCurrency(summary.bank_paid)}</td>
                <td style={{ padding: '7px 8px' }}></td>
                <td style={{ padding: '7px 8px', textAlign: 'right' }}>₹{formatCurrency(ledgerTotals.net)}</td>
                <td style={{ padding: '7px 8px' }}></td>
              </tr>
            </tbody>
          </table>

          {/* Signatures */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', paddingTop: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #94a3b8', width: '160px', paddingTop: '6px' }}>
                <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>Farmer’s Signature</p>
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #94a3b8', width: '160px', paddingTop: '6px' }}>
                <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>Authorized Signature</p>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '16px', paddingTop: '6px', textAlign: 'center' }}>
            <p style={{ fontSize: '9px', color: '#94a3b8', margin: 0 }}>Computer-generated statement. Generated on {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FarmerPayments;
