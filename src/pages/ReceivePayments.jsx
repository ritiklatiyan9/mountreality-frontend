import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { buildUpiUri, fmtINR } from '../lib/upi';
import UpiBrandStrip, { QrUpiBadge } from '../components/UpiBrandStrip';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Skeleton } from '../components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationPrevious, PaginationNext,
} from '../components/ui/pagination';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '../components/ui/tooltip';
import {
  QrCode, Loader2, CheckCircle2,
  XCircle, Clock, Edit2, Trash2, Building2, RefreshCw, MonitorPlay,
  Download, Eye,
} from 'lucide-react';

const QR_STATUS = {
  pending:   { label: 'Pending',   icon: Clock,        cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  received:  { label: 'Received',  icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Cancelled', icon: XCircle,      cls: 'bg-red-50 text-red-700 border-red-200' },
};

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'received', label: 'Received' },
  { key: 'cancelled', label: 'Cancelled' },
];

const PAGE_SIZE = 10;

// Small labeled icon button used across table rows
const RowAction = ({ label, onClick, className, children }) => (
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="sm" onClick={onClick} className={`h-7 w-7 p-0 ${className}`}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const ReceivePayments = () => {
  const { currentSite, canManage, hasPermission } = useAuth();
  const siteId = currentSite?.id;
  const canWrite  = canManage && hasPermission('upi_collect', 'write');
  const canUpdate = canManage && hasPermission('upi_collect', 'update');
  const canDelete = canManage && hasPermission('upi_collect', 'delete');

  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  // QR history (server-paginated)
  const [qrs, setQrs] = useState([]);
  const [qrsLoading, setQrsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalItems: 0, totalPages: 1, currentPage: 1 });

  // QR payment dialog (step 1: amount → step 2: QR)
  const [receiveDialog, setReceiveDialog] = useState(false);
  const [receiveForm, setReceiveForm] = useState({ upi_account_id: '', amount: '', note: '' });
  const [activeQr, setActiveQr] = useState(null);
  const [qrImage, setQrImage] = useState(null);
  const [generating, setGenerating] = useState(false);

  // QR edit dialog
  const [editQr, setEditQr] = useState(null);
  const [editForm, setEditForm] = useState({ amount: '', note: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchAccounts = useCallback(async () => {
    if (!siteId) return;
    try {
      setAccountsLoading(true);
      // Bank Configs is the canonical Site account register. The old UPI
      // account endpoint intentionally hid accounts without VPA/payee data,
      // so accounts created in Bank Configs could disappear from this page.
      let res = await api.get('/bank-accounts/options', { params: { site_id: siteId } });
      let nextAccounts = res.data.accounts || [];

      // Keep QR Payments compatible with an older backend process and make
      // sure it uses the same source that visibly powers Bank Configs.
      const optionsHaveQrFields = nextAccounts.every((account) => (
        Object.prototype.hasOwnProperty.call(account, 'vpa')
        && Object.prototype.hasOwnProperty.call(account, 'payee_name')
      ));
      if (!nextAccounts.length || !optionsHaveQrFields) {
        res = await api.get('/bank-accounts', { params: { site_id: siteId } });
        nextAccounts = res.data.accounts || [];
      }
      setAccounts(nextAccounts);
    } catch (err) {
      try {
        const fallback = await api.get('/bank-accounts', { params: { site_id: siteId } });
        setAccounts(fallback.data.accounts || []);
      } catch (fallbackError) {
        toast.error(fallbackError.response?.data?.message || err.response?.data?.message || 'Failed to load Bank Config accounts');
      }
    } finally {
      setAccountsLoading(false);
    }
  }, [siteId]);

  const fetchQrs = useCallback(async () => {
    if (!siteId) return;
    try {
      setQrsLoading(true);
      const res = await api.get('/upi/qrs', {
        params: { site_id: siteId, status: statusFilter, page, limit: PAGE_SIZE },
      });
      setQrs(res.data.qrs || []);
      setPagination(res.data.pagination || { totalItems: 0, totalPages: 1, currentPage: 1 });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load QR history');
    } finally {
      setQrsLoading(false);
    }
  }, [siteId, statusFilter, page]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);
  useEffect(() => {
    const refresh = () => void fetchAccounts();
    window.addEventListener('bank-accounts:changed', refresh);
    return () => window.removeEventListener('bank-accounts:changed', refresh);
  }, [fetchAccounts]);
  useEffect(() => { fetchQrs(); }, [fetchQrs]);

  // /bank-accounts/options is already restricted to active accounts. Treat
  // a missing flag as active for compatibility with an older backend process.
  const activeBankAccounts = accounts.filter((a) => a.is_active !== false);
  const activeAccounts = activeBankAccounts.filter((a) => String(a.vpa || '').trim());

  // ── QR payment / dynamic QR ──
  // 'H' error correction — the UPI badge overlaid on the centre stays scannable
  const renderQrImage = async (qr) =>
    QRCode.toDataURL(buildUpiUri(qr), { width: 640, margin: 2, errorCorrectionLevel: 'H' });

  const openReceive = () => {
    if (!activeBankAccounts.length) {
      toast.error('No active account — set one up in Bank Configs first');
      return;
    }
    setReceiveForm({ upi_account_id: activeAccounts[0] ? String(activeAccounts[0].id) : '', amount: '', note: '' });
    setActiveQr(null);
    setQrImage(null);
    setReceiveDialog(true);
  };

  const generateQr = async () => {
    if (!receiveForm.upi_account_id) {
      toast.error('Select a QR-ready account with a UPI ID / VPA');
      return;
    }
    const amt = parseFloat(receiveForm.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setGenerating(true);
    try {
      const res = await api.post('/upi/qrs', {
        site_id: siteId,
        upi_account_id: parseInt(receiveForm.upi_account_id),
        amount: amt,
        note: receiveForm.note,
      });
      const qr = res.data.qr;
      setActiveQr(qr);
      setQrImage(await renderQrImage(qr));
      fetchQrs();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate QR');
    } finally {
      setGenerating(false);
    }
  };

  // Reopen the QR modal for an existing pending QR
  const viewQr = async (qr) => {
    setActiveQr(qr);
    setQrImage(await renderQrImage(qr));
    setReceiveDialog(true);
  };

  const setQrStatus = async (qr, status) => {
    try {
      await api.put(`/upi/qrs/${qr.id}/status`, { status });
      fetchQrs();
      if (activeQr?.id === qr.id) {
        toast.success(status === 'received' ? 'Payment marked as received' : 'QR cancelled');
        setReceiveDialog(false);
        setActiveQr(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update QR');
    }
  };

  const removeQr = async (qr) => {
    if (!window.confirm(`Delete QR of ₹${fmtINR(qr.amount)} (${qr.txn_ref})?`)) return;
    try {
      await api.delete(`/upi/qrs/${qr.id}`);
      toast.success('QR deleted');
      fetchQrs();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete QR');
    }
  };

  // ── QR edit (pending only) ──
  const openEditQr = (qr) => {
    setEditForm({ amount: String(qr.amount), note: qr.note || '' });
    setEditQr(qr);
  };

  const saveEditQr = async () => {
    const amt = parseFloat(editForm.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setSavingEdit(true);
    try {
      const res = await api.put(`/upi/qrs/${editQr.id}`, { amount: amt, note: editForm.note });
      toast.success('QR updated — display screen refreshes automatically');
      setEditQr(null);
      fetchQrs();
      if (activeQr?.id === editQr.id) {
        setActiveQr(res.data.qr);
        setQrImage(await renderQrImage(res.data.qr));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update QR');
    } finally {
      setSavingEdit(false);
    }
  };

  const downloadQr = () => {
    if (!qrImage || !activeQr) return;
    const a = document.createElement('a');
    a.href = qrImage;
    a.download = `PAY-QR-${activeQr.txn_ref}-Rs${activeQr.amount}.png`;
    a.click();
  };

  const statusBadge = (status) => {
    const cfg = QR_STATUS[status] || QR_STATUS.pending;
    const Icon = cfg.icon;
    return (
      <Badge variant="outline" className={`gap-1 text-[10px] ${cfg.cls}`}>
        <Icon className="w-3 h-3" /> {cfg.label}
      </Badge>
    );
  };

  // Windowed page numbers (max 5)
  const pageNumbers = (() => {
    const total = pagination.totalPages;
    const start = Math.max(1, Math.min(page - 2, total - 4));
    return Array.from({ length: Math.min(5, total) }, (_, i) => start + i);
  })();

  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Building2 className="w-10 h-10 text-slate-200 mb-3" />
        <p className="text-sm text-slate-500">Select a site to manage QR payments</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      {/* ── Hero header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-500/10 rounded-full blur-[60px] -translate-x-1/4 translate-y-1/4" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl ring-2 ring-white/10 shrink-0">
            <QrCode className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-emerald-400/80 uppercase tracking-wider mb-1">QR Payments</p>
            <h1 className="text-2xl font-bold text-white tracking-tight">QR Payments</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Generate a payment QR — customer scans, amount comes pre-filled and locked
            </p>
          </div>
          <div className="flex items-center gap-2 sm:self-center">
            <Button variant="outline" size="sm" onClick={() => window.open('/qr-display', '_blank')}
              className="bg-white/5 border-white/15 text-white hover:bg-white/15 hover:text-white">
              <MonitorPlay className="w-4 h-4 mr-1.5" /> Display Screen
            </Button>
            {canWrite && (
              <Button size="sm" onClick={openReceive}
                className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25">
                <QrCode className="w-4 h-4 mr-1.5" /> Create QR
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── QR history ── */}
      <Card className="border-border/50 shadow-lg shadow-black/5 rounded-2xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/50 bg-gradient-to-r from-slate-50/80 to-transparent">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-md">
                <QrCode className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">QR History</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{pagination.totalItems} QRs generated</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <TabsList className="h-8">
                  {STATUS_TABS.map((t) => (
                    <TabsTrigger key={t.key} value={t.key} className="text-xs px-3 h-6">{t.label}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400" onClick={fetchQrs} title="Refresh">
                <RefreshCw className={`w-3.5 h-3.5 ${qrsLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {qrsLoading ? (
            <div className="p-5 space-y-3">
              <Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" />
            </div>
          ) : qrs.length === 0 ? (
            <div className="py-10 text-center">
              <QrCode className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No QRs {statusFilter !== 'all' ? `with status "${statusFilter}"` : 'generated yet'}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="text-xs pl-5">Created</TableHead>
                      <TableHead className="text-xs">Account</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs">Note</TableHead>
                      <TableHead className="text-xs">Ref</TableHead>
                      <TableHead className="text-xs">By</TableHead>
                      <TableHead className="text-xs text-center">Status</TableHead>
                      <TableHead className="text-xs text-right pr-5">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {qrs.map((q) => (
                      <TableRow key={q.id} className="group">
                        <TableCell className="text-xs text-slate-500 whitespace-nowrap pl-5">
                          {new Date(q.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                        <TableCell className="text-sm">{q.account_label}</TableCell>
                        <TableCell className="text-sm font-semibold text-right tabular-nums text-emerald-700">₹{fmtINR(q.amount)}</TableCell>
                        <TableCell className="text-xs text-slate-500 max-w-40 truncate">{q.note || '—'}</TableCell>
                        <TableCell className="text-[10px] font-mono text-slate-400">{q.txn_ref}</TableCell>
                        <TableCell className="text-xs text-slate-500">{q.created_by_name || '—'}</TableCell>
                        <TableCell className="text-center">{statusBadge(q.status)}</TableCell>
                        <TableCell className="text-right pr-5">
                          <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {q.status === 'pending' && (
                              <>
                                <RowAction label="Show QR" onClick={() => viewQr(q)}
                                  className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50">
                                  <Eye className="w-3.5 h-3.5" />
                                </RowAction>
                                {canUpdate && (
                                  <>
                                    <RowAction label="Mark received" onClick={() => setQrStatus(q, 'received')}
                                      className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                    </RowAction>
                                    <RowAction label="Edit amount / note" onClick={() => openEditQr(q)}
                                      className="text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </RowAction>
                                    <RowAction label="Cancel QR" onClick={() => setQrStatus(q, 'cancelled')}
                                      className="text-slate-400 hover:text-amber-600 hover:bg-amber-50">
                                      <XCircle className="w-3.5 h-3.5" />
                                    </RowAction>
                                  </>
                                )}
                              </>
                            )}
                            {canDelete && (
                              <RowAction label="Delete" onClick={() => removeQr(q)}
                                className="text-slate-400 hover:text-red-600 hover:bg-red-50">
                                <Trash2 className="w-3.5 h-3.5" />
                              </RowAction>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="px-5 py-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">
                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, pagination.totalItems)} of {pagination.totalItems}
                  </p>
                  <Pagination className="mx-0 w-auto">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          className={page <= 1 ? 'pointer-events-none opacity-40' : 'cursor-pointer'}
                          onClick={() => setPage((p) => Math.max(1, p - 1))} />
                      </PaginationItem>
                      {pageNumbers.map((n) => (
                        <PaginationItem key={n}>
                          <PaginationLink isActive={n === page} className="cursor-pointer" onClick={() => setPage(n)}>
                            {n}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          className={page >= pagination.totalPages ? 'pointer-events-none opacity-40' : 'cursor-pointer'}
                          onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── QR payment dialog ── */}
      <Dialog open={receiveDialog} onOpenChange={(o) => { if (!generating) { setReceiveDialog(o); if (!o) setActiveQr(null); } }}>
        <DialogContent className="sm:max-w-md">
          {!activeQr ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-base flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-emerald-600" /> Create QR Payment
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Enter the amount — a QR locked to that amount is generated for the customer to scan.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">QR payment account</Label>
                  <Select value={receiveForm.upi_account_id}
                    onValueChange={(v) => setReceiveForm((f) => ({ ...f, upi_account_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {activeBankAccounts.map((a) => {
                        const qrReady = Boolean(String(a.vpa || '').trim());
                        return (
                        <SelectItem key={a.id} value={String(a.id)} disabled={!qrReady}>
                          {a.bank_name ? `${a.bank_name} · ${a.label}` : a.label}{!qrReady ? ' · Add UPI ID' : ''}
                        </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {activeBankAccounts.length > 0 && activeAccounts.length === 0 ? (
                    <p className="text-[11px] text-amber-600">This account is connected from Bank Configs. Add its UPI ID / VPA there to enable QR creation.</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Amount (₹) *</Label>
                  <Input type="number" min="1" step="0.01" autoFocus value={receiveForm.amount}
                    placeholder="0.00" className="text-lg font-semibold h-11"
                    onChange={(e) => setReceiveForm((f) => ({ ...f, amount: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') generateQr(); }} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Note <span className="text-slate-400">(shown in customer's UPI app)</span></Label>
                  <Input value={receiveForm.note} placeholder="e.g. Plot booking advance" maxLength={80}
                    onChange={(e) => setReceiveForm((f) => ({ ...f, note: e.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" size="sm" onClick={() => setReceiveDialog(false)}>Cancel</Button>
                <Button size="sm" onClick={generateQr} disabled={generating || !receiveForm.upi_account_id}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {generating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <QrCode className="w-3.5 h-3.5 mr-1.5" />}
                  Generate QR
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-base text-center">Scan to Pay</DialogTitle>
                <DialogDescription className="text-center text-xs sr-only">
                  UPI payment QR code
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-1">
                <p className="text-3xl font-bold text-emerald-700 tabular-nums">₹{fmtINR(activeQr.amount)}</p>
                <div className="relative w-64 mt-2">
                  <img src={qrImage} alt="UPI QR" className="w-full h-auto border rounded-xl" />
                  <QrUpiBadge />
                </div>
                {activeQr.note && <p className="text-xs text-slate-500 mt-1">{activeQr.note}</p>}
                <UpiBrandStrip className="mt-2" />
                <p className="text-[10px] font-mono text-slate-400 mt-1">Ref: {activeQr.txn_ref}</p>
                <div className="flex items-center gap-1.5 text-[11px] text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-md px-3 py-1.5 mt-2">
                  <MonitorPlay className="w-3.5 h-3.5 shrink-0" />
                  Live on the display screen — it appears there automatically
                </div>
              </div>
              <DialogFooter className="gap-2 flex-wrap">
                <Button variant="ghost" size="sm" onClick={downloadQr} className="text-slate-500">
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Download
                </Button>
                <Button variant="ghost" size="sm" className="text-red-500"
                  onClick={() => setQrStatus(activeQr, 'cancelled')}>
                  <XCircle className="w-3.5 h-3.5 mr-1.5" /> Cancel QR
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setActiveQr(null); setQrImage(null); }}>
                  New QR
                </Button>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => setQrStatus(activeQr, 'received')}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Mark Received
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Edit QR dialog ── */}
      <Dialog open={!!editQr} onOpenChange={(o) => { if (!o) setEditQr(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-slate-600" /> Edit QR
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pending QR <span className="font-mono">{editQr?.txn_ref}</span> — the QR code changes with the amount.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Amount (₹) *</Label>
              <Input type="number" min="1" step="0.01" value={editForm.amount} className="text-lg font-semibold h-11"
                onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Note</Label>
              <Input value={editForm.note} maxLength={80}
                onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditQr(null)}>Cancel</Button>
            <Button size="sm" onClick={saveEditQr} disabled={savingEdit}>
              {savingEdit ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReceivePayments;
