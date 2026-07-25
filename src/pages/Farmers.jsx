import { useState, useEffect, useMemo, useCallback } from 'react';
import { money, moneyCompact } from '@/lib/utils';

/* Farmer status → semantic pill tone, shared by the table and the mobile list. */
const STATUS_TONE = { active: 'positive', completed: 'info', inactive: 'neutral' };
import { CurrencyValue, EmptyState, SkeletonBlock, StatusPill } from '../components/dashboard/primitives';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Card, CardContent } from '../components/ui/card';
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
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '../components/ui/command';
import {
  Tractor, Plus, Edit2, Trash2, AlertCircle, Check,
  Search, Eye, IndianRupee, Phone, MapPin, Loader2,
  Camera, Clock, Send, Users, Banknote, Building2, ArrowUpDown,
  ChevronsUpDown, X, Calculator, Landmark, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRowSelection } from '../hooks/useRowSelection';
import BulkActionsBar from '../components/BulkActionsBar';

const LAND_UNITS = [
  { value: 'BIGHA', label: 'Bigha' },
  { value: 'YARD', label: 'Yard' },
  { value: 'SQMT', label: 'Mtr Sq' },
];
const landUnitLabel = (unit) => LAND_UNITS.find((u) => u.value === unit)?.label || 'Bigha';

const Farmers = () => {
  const { currentSite, isAdmin, canManage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryFromUrl = useMemo(() => new URLSearchParams(location.search).get('q') || '', [location.search]);
  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('desc');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);
  const [proofPhoto, setProofPhoto] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [editRequestPending, setEditRequestPending] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const selection = useRowSelection();

  // Member selection for Register Farmer
  const [farmerMembers, setFarmerMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    total_amount: '',
    notes: '',
    status: 'active',
    member_id: null,
    payment_mode: 'CASH',
    cash_amount: '',
    bank_amount: '',
    bank_name: '',
    bank_account_no: '',
    bank_reference: '',
    bank_ifsc: '',
    land_size_bigha: '',
    land_size_unit: 'BIGHA',
    land_rate: '',
    commission_percentage: '',
    commission_amount: '',
    commission_paid_to_broker: '',
    land_payment: '',
    _autoPaymentApplied: '',
  });

  const siteId = currentSite?.id;

  const fetchFarmers = useCallback(async () => {
    if (!siteId) return;
    try {
      setLoading(true);
      // Watchdog so the spinner can never hang on a stalled request.
      const watchdog = setTimeout(() => setLoading(false), 15000);
      const res = await api.get(`/farmers?site_id=${siteId}`);
      clearTimeout(watchdog);
      setFarmers(res.data.farmers || []);
    } catch (err) {
      console.error('Failed to fetch farmers:', err);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  // Background refresh — does NOT toggle the page-wide loader.
  const refreshFarmers = useCallback(async () => {
    if (!siteId) return;
    try {
      const res = await api.get(`/farmers?site_id=${siteId}`);
      setFarmers(res.data.farmers || []);
    } catch { /* keep current */ }
  }, [siteId]);

  const fetchFarmerMembers = useCallback(async () => {
    if (!siteId) return;
    try {
      const res = await api.get(`/farmers/members?site_id=${siteId}`);
      setFarmerMembers(res.data.members || []);
    } catch (err) {
      console.error('Failed to fetch farmer members:', err);
    }
  }, [siteId]);

  // Clear old data immediately and refetch when site changes
  useEffect(() => {
    setFarmers([]);
    setSearchQuery(queryFromUrl);
    setStatusFilter('all');
    fetchFarmers();
    fetchFarmerMembers();
  }, [fetchFarmers, fetchFarmerMembers, queryFromUrl]);

  const resetForm = () => {
    setFormData({ name: '', phone: '', address: '', total_amount: '', notes: '', status: 'active', member_id: null, payment_mode: 'CASH', cash_amount: '', bank_amount: '', bank_name: '', bank_account_no: '', bank_reference: '', bank_ifsc: '', land_size_bigha: '', land_size_unit: 'BIGHA', land_rate: '', commission_percentage: '', commission_amount: '', commission_paid_to_broker: '', land_payment: '', _autoPaymentApplied: '' });
    setEditingId(null);
    setMessage({ type: '', text: '' });
    setProofPhoto(null);
    setProofPreview(null);
    setEditRequestPending(false);
    setSelectedMemberId(null);
    setMemberSearch('');
  };

  const handleProofPhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProofPhoto(file);
      setProofPreview(URL.createObjectURL(file));
    }
  };

  const handleOpenCreate = () => { resetForm(); setDialogOpen(true); };

  const handleOpenEdit = (farmer) => {
    setFormData({
      name: farmer.name || '',
      phone: farmer.phone || '',
      address: farmer.address || '',
      total_amount: farmer.total_amount || '',
      notes: farmer.notes || '',
      status: farmer.status || 'active',
      member_id: farmer.member_id || null,
      payment_mode: farmer.payment_mode || 'BANK',
      cash_amount: farmer.cash_amount || '',
      bank_amount: farmer.bank_amount || '',
      bank_name: farmer.bank_name || '',
      bank_account_no: farmer.bank_account_no || '',
      bank_reference: farmer.bank_reference || '',
      bank_ifsc: farmer.bank_ifsc || '',
      land_size_bigha: farmer.land_size_bigha || '',
      land_size_unit: farmer.land_size_unit || 'BIGHA',
      land_rate: farmer.land_rate || '',
      commission_percentage: farmer.commission_percentage || '',
      commission_amount: farmer.commission_amount || '',
      commission_paid_to_broker: farmer.commission_paid_to_broker || '',
    });
    setSelectedMemberId(farmer.member_id || null);
    setEditingId(farmer.id);
    setDialogOpen(true);
  };

  const handleFormChange = (field, value) => {
    const newForm = { ...formData, [field]: value };

    // Auto-calculate total_amount = cash_amount + bank_amount
    if (field === 'cash_amount' || field === 'bank_amount') {
      const cash = parseFloat(field === 'cash_amount' ? value : newForm.cash_amount) || 0;
      const bank = parseFloat(field === 'bank_amount' ? value : newForm.bank_amount) || 0;
      newForm.total_amount = (cash + bank) || '';
      // Auto-determine payment_mode
      if (cash > 0 && bank > 0) newForm.payment_mode = 'SPLIT';
      else if (bank > 0) newForm.payment_mode = 'BANK';
      else newForm.payment_mode = 'CASH';
    }

    // Auto-calculate land_payment = land_size_bigha × land_rate (display only).
    // Never touches cash_amount / bank_amount — the user fills Payment
    // Breakdown independently.
    if (field === 'land_size_bigha' || field === 'land_rate') {
      const size = parseFloat(field === 'land_size_bigha' ? value : newForm.land_size_bigha) || 0;
      const rate = parseFloat(field === 'land_rate' ? value : newForm.land_rate) || 0;
      newForm.land_payment = (size > 0 && rate > 0) ? (size * rate).toFixed(2) : '';
    }

    setFormData(newForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    if (!editingId && !formData.member_id) {
      setMessage({ type: 'error', text: 'Please select a registered member first' });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        total_amount: parseFloat(formData.total_amount) || 0,
        cash_amount: parseFloat(formData.cash_amount) || 0,
        bank_amount: parseFloat(formData.bank_amount) || 0,
        site_id: siteId,
        member_id: formData.member_id || null,
        land_size_bigha: formData.land_size_bigha !== '' ? parseFloat(formData.land_size_bigha) : null,
        land_size_unit: formData.land_size_unit || 'BIGHA',
        land_rate: formData.land_rate !== '' ? parseFloat(formData.land_rate) : null,
        commission_percentage: formData.commission_percentage !== '' ? parseFloat(formData.commission_percentage) : null,
        commission_amount: formData.commission_amount !== '' ? parseFloat(formData.commission_amount) : null,
        commission_paid_to_broker: formData.commission_paid_to_broker !== '' ? parseFloat(formData.commission_paid_to_broker) : null,
      };

      // Sub-admin editing: submit edit request instead of direct update
      if (editingId && !isAdmin) {
        if (!proofPhoto) {
          setMessage({ type: 'error', text: 'Please upload a proof photo for the edit request' });
          setSubmitting(false);
          return;
        }
        const fd = new FormData();
        fd.append('module', 'farmer');
        fd.append('record_id', editingId);
        fd.append('proposed_data', JSON.stringify(payload));
        fd.append('site_id', siteId);
        fd.append('proof_photo', proofPhoto);
        await api.post('/edit-requests', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setMessage({ type: 'success', text: 'Edit request submitted for admin approval' });
        setEditRequestPending(true);
        setDialogOpen(false);
      } else if (editingId) {
        const { data } = await api.put(`/farmers/${editingId}`, payload);
        // Optimistic in-place update so the dialog can close instantly.
        const updated = data?.farmer;
        if (updated) {
          setFarmers((prev) => prev.map((f) => (f.id === updated.id ? { ...f, ...updated } : f)));
        }
        setMessage({ type: 'success', text: 'Farmer updated' });
        setDialogOpen(false);
        refreshFarmers(); // background reconcile (server-computed totals)
      } else {
        await api.post('/farmers', payload);
        setMessage({ type: 'success', text: 'Farmer registered' });
        setDialogOpen(false);
        refreshFarmers(); // need the server-computed totals — refresh in bg
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Operation failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this farmer and all payments? This cannot be undone.')) return;
    // Optimistic removal — instant UI feedback.
    const snapshot = farmers;
    setFarmers((prev) => prev.filter((f) => f.id !== id));
    try {
      await api.delete(`/farmers/${id}`);
      refreshFarmers();
    } catch (err) {
      setFarmers(snapshot); // rollback
      console.error('Failed to delete farmer:', err);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selection.selected);
    setBulkDeleting(true);
    try {
      const { data } = await api.post('/farmers/bulk-delete', { ids });
      setFarmers((prev) => prev.filter((f) => !ids.includes(f.id)));
      selection.clear();
      refreshFarmers();
      toast.success(data?.message || 'Farmers deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete farmers');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBulkPrint = () => {
    const rows = filteredFarmers.filter((f) => selection.isSelected(f.id));
    const win = window.open('', '_blank');
    if (!win) return;
    const rowsHtml = rows.map((f) => {
      const paid = parseFloat(f.total_paid) || 0;
      const total = parseFloat(f.total_amount) || 0;
      const remaining = total - paid;
      return `<tr>
        <td>${f.name || ''}</td>
        <td style="text-align: right;">₹${formatCurrency(total)}</td>
        <td style="text-align: right;">₹${formatCurrency(paid)}</td>
        <td style="text-align: right;">₹${formatCurrency(remaining)}</td>
        <td style="text-align: center;">${f.payment_count || 0}</td>
        <td>${f.status || ''}</td>
      </tr>`;
    }).join('');
    win.document.write(`
      <html>
        <head>
          <title>Farmers</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            html, body {
              height: 100%;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
              padding: 10mm;
              line-height: 1.4;
            }
            @page {
              margin: 10mm;
              size: A4 landscape;
            }
            h3 {
              font-size: 18px;
              margin-bottom: 10px;
              font-weight: 600;
            }
            .print-date {
              font-size: 11px;
              color: #666;
              margin-bottom: 15px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 0;
              padding: 0;
            }
            th {
              background: #f3f4f6;
              color: #1f2937;
              padding: 10px 8px;
              text-align: left;
              font-size: 12px;
              font-weight: 600;
              border: 1px solid #d1d5db;
            }
            td {
              border: 1px solid #d1d5db;
              padding: 8px 8px;
              text-align: left;
              font-size: 12px;
            }
            tbody tr {
              page-break-inside: avoid;
            }
            tbody tr:nth-child(even) {
              background: #f9fafb;
            }
            @media print {
              body {
                padding: 10mm;
              }
              table {
                width: 100%;
              }
              th, td {
                padding: 8px 6px;
                font-size: 11px;
              }
              tbody tr {
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <h3>Farmer Payments Report</h3>
          <div class="print-date">Generated on ${new Date().toLocaleDateString('en-IN')}</div>
          <table>
            <thead>
              <tr>
                <th>Farmer Name</th>
                <th style="text-align: right;">Total Amount</th>
                <th style="text-align: right;">Paid</th>
                <th style="text-align: right;">Remaining</th>
                <th style="text-align: center;">Count</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 250);
  };

  const filteredFarmers = useMemo(() => {
    let list = farmers.filter((f) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        f.name?.toLowerCase().includes(q) ||
        f.phone?.toLowerCase().includes(q) ||
        f.address?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || f.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
    if (sortOrder === 'asc') list.reverse();
    return list;
  }, [farmers, searchQuery, statusFilter, sortOrder]);

  const visibleFarmerIds = useMemo(() => filteredFarmers.map((f) => f.id), [filteredFarmers]);

  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  // Summary cards
  const totalFarmers = farmers.length;
  const totalAmount = farmers.reduce((s, f) => s + (parseFloat(f.total_amount) || 0), 0);
  const totalPaid = farmers.reduce((s, f) => s + (parseFloat(f.total_paid) || 0), 0);
  const totalRemaining = totalAmount - totalPaid;
  // Cash vs bank flow. cash_paid + bank_paid = total_paid (reconciles).
  const totalCashPaid = farmers.reduce((s, f) => s + (parseFloat(f.cash_paid) || 0), 0);
  const totalBankPaid = farmers.reduce((s, f) => s + (parseFloat(f.bank_paid) || 0), 0);
  const settledPct = totalAmount > 0 ? Math.min(100, Math.round((totalPaid / totalAmount) * 100)) : 0;

  if (!currentSite) {
    return (
      <div className="rounded-panel border border-mr-line bg-mr-surface">
        <EmptyState
          icon={Tractor}
          title="Select a site to manage farmers"
          description="Farmer payments are recorded per site. Pick one from the site switcher to continue."
        />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 print:space-y-0 print:max-w-full print:m-0">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center print:hidden">
        <div className="min-w-0">
          <h1 className="text-[clamp(1.5rem,2.6vw,2rem)] font-semibold leading-tight tracking-[-0.03em] text-mr-text">
            Farmer payments
          </h1>
          <p className="mt-1 text-[13px] text-mr-muted">
            Land payments and installments{currentSite?.name ? ` · ${currentSite.name}` : ''}
          </p>
        </div>
        {(canManage || selection.count > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            <BulkActionsBar
              count={selection.count}
              onClear={selection.clear}
              onEdit={() => {
                const row = filteredFarmers.find((f) => selection.isSelected(f.id));
                if (row) handleOpenEdit(row);
              }}
              onDelete={canManage ? handleBulkDelete : undefined}
              onPrint={handleBulkPrint}
              entityLabel="farmer"
              deleting={bulkDeleting}
            />
            {canManage && (
              <Button
                onClick={handleOpenCreate}
                className="h-10 rounded-full bg-mr-ink px-4 text-[13px] font-semibold text-white hover:bg-mr-ink-2"
              >
                <Plus className="mr-1.5 h-4 w-4" strokeWidth={2} /> Register farmer
              </Button>
            )}
          </div>
        )}
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 print:hidden">
              <DialogHeader className="space-y-1">
                <DialogTitle className="text-base sm:text-lg font-semibold text-slate-900">
                  {editingId ? (isAdmin ? 'Edit Farmer' : 'Request Farmer Edit') : 'Register Farmer'}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  {editingId ? (isAdmin ? 'Update farmer details.' : 'Submit an edit request with proof for admin approval.') : 'Select a registered member, add land & commission, then confirm payment.'}
                </DialogDescription>
              </DialogHeader>

              {message.text && (
                <div className={`flex gap-2 p-2.5 rounded-lg text-xs ${
                  message.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                    : 'bg-red-50 border border-red-100 text-red-700'
                }`}>
                  {message.type === 'success' ? <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                  {message.text}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                {/* ── Section 1: Member Selection ── */}
                {!editingId && (
                  <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 sm:p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                        <Users className="w-3.5 h-3.5 text-emerald-600" /> Map Farmer
                      </p>
                      <span className="text-[10px] text-slate-400">Required</span>
                    </div>

                    {!selectedMemberId ? (
                      farmerMembers.length > 0 ? (
                        <Popover open={memberPickerOpen} onOpenChange={setMemberPickerOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              role="combobox"
                              aria-expanded={memberPickerOpen}
                              className="w-full justify-between h-10 px-3 font-normal text-sm text-slate-500 border-dashed hover:border-solid hover:border-emerald-400 hover:bg-emerald-50/40"
                            >
                              <span className="flex items-center gap-2">
                                <Search className="w-4 h-4 text-slate-400" />
                                Search and select a member…
                              </span>
                              <ChevronsUpDown className="w-4 h-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="p-0 w-[min(92vw,32rem)]" align="start">
                            <Command>
                              <CommandInput placeholder="Type name or mobile…" className="h-10" />
                              <CommandList className="max-h-64">
                                <CommandEmpty className="py-6 text-center text-xs text-slate-500">
                                  No matching members.
                                </CommandEmpty>
                                <CommandGroup>
                                  {farmerMembers.map((m) => (
                                    <CommandItem
                                      key={m.id}
                                      value={`${m.full_name || ''} ${m.phone || ''}`}
                                      onSelect={() => {
                                        setSelectedMemberId(m.id);
                                        setFormData((prev) => ({
                                          ...prev,
                                          name: m.full_name || prev.name,
                                          phone: m.phone || prev.phone,
                                          address: m.address || prev.address,
                                          member_id: m.id,
                                          bank_name: m.bank_name || prev.bank_name,
                                          bank_account_no: m.bank_account_no || prev.bank_account_no,
                                          bank_ifsc: m.bank_ifsc || prev.bank_ifsc,
                                        }));
                                        setMemberSearch('');
                                        setMemberPickerOpen(false);
                                      }}
                                      className="flex items-start gap-3 py-2.5 cursor-pointer"
                                    >
                                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center text-emerald-700 text-sm font-bold shrink-0">
                                        {(m.full_name || '?').charAt(0).toUpperCase()}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-slate-800 truncate">{m.full_name || '—'}</p>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                          {m.member_type && (
                                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                              {m.member_type}
                                            </span>
                                          )}
                                          {m.phone && (
                                            <span className="text-[11px] text-slate-500 flex items-center gap-0.5">
                                              <Phone className="w-2.5 h-2.5" /> {m.phone}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-700 flex items-start gap-2">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          No registered members found. Register members in User Management first.
                        </div>
                      )
                    ) : (
                      // ── Selected state: show only the selected member with Change action ──
                      <div className="relative rounded-lg border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white px-3 py-3 flex items-center gap-3 shadow-sm">
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-sm sm:text-base font-bold shrink-0 ring-2 ring-emerald-200">
                          {(formData.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-slate-900 truncate">{formData.name || '—'}</p>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white uppercase tracking-wider">Selected</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {formData.phone && (
                              <span className="text-[11px] text-slate-600 flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" /> {formData.phone}
                              </span>
                            )}
                            {formData.address && (
                              <span className="text-[11px] text-slate-600 flex items-center gap-1 truncate max-w-[20ch] sm:max-w-[40ch]">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" /> {formData.address}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedMemberId(null);
                            setFormData((prev) => ({
                              ...prev,
                              name: '', phone: '', address: '',
                              member_id: null,
                              bank_name: '', bank_account_no: '', bank_ifsc: '',
                            }));
                          }}
                          className="shrink-0 h-8 text-[11px] text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <X className="w-3.5 h-3.5 mr-1" /> Change
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Editable name/phone/address for edit mode */}
                {editingId && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 sm:p-4 space-y-2">
                    <p className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Farmer Details</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Name *</Label>
                        <Input className="h-9 text-sm" placeholder="Ajay Chaudhary" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Phone</Label>
                        <Input className="h-9 text-sm" placeholder="9876543210" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Address</Label>
                      <Input className="h-9 text-sm" placeholder="Village / Area" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                    </div>
                  </div>
                )}

                {/* ── Section 2: Land & Commission (above Payment) ── */}
                <div className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50/60 via-white to-white p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                      <span className="inline-flex w-5 h-5 items-center justify-center rounded-md bg-amber-500/10 text-amber-600">
                        <Tractor className="w-3 h-3" />
                      </span>
                      Land &amp; Commission
                    </p>
                    <span className="text-[10px] text-slate-400 italic">Optional</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-600">Size</Label>
                      <div className="flex gap-1">
                        <Input
                          className="h-9 text-sm"
                          type="number" step="0.01" placeholder="0.00"
                          value={formData.land_size_bigha}
                          onChange={(e) => handleFormChange('land_size_bigha', e.target.value)}
                        />
                        <Select
                          value={formData.land_size_unit}
                          onValueChange={(v) => handleFormChange('land_size_unit', v)}
                        >
                          <SelectTrigger className="h-9 w-24 shrink-0 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {LAND_UNITS.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-600">Rate / {landUnitLabel(formData.land_size_unit)} (₹)</Label>
                      <Input
                        className="h-9 text-sm"
                        type="number" step="0.01" placeholder="0"
                        value={formData.land_rate}
                        onChange={(e) => handleFormChange('land_rate', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-600">Commission Paid to Broker (₹)</Label>
                      <Input
                        className="h-9 text-sm"
                        type="number" step="0.01" placeholder="0"
                        value={formData.commission_paid_to_broker}
                        onChange={(e) => handleFormChange('commission_paid_to_broker', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-600">Total Amount (₹)</Label>
                      <Input
                        className="h-9 text-sm bg-slate-50 font-semibold text-emerald-700"
                        readOnly
                        value={formData.land_payment ? formatCurrency(formData.land_payment) : ''}
                        placeholder="Size × Rate"
                      />
                    </div>
                  </div>
                </div>

                {/* ── Section 3: Payment Breakdown ── */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2.5">
                  <p className="text-[11px] font-semibold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <span className="inline-flex w-5 h-5 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
                      <IndianRupee className="w-3 h-3" />
                    </span>
                    Payment Breakdown
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="border border-green-200 rounded-lg p-2.5 bg-green-50/40 space-y-1">
                      <Label className="text-[11px] flex items-center gap-1 text-green-700 font-medium">
                        <Banknote className="w-3.5 h-3.5" /> Cash (₹)
                      </Label>
                      <Input
                        className="h-9 text-sm border-green-200 bg-white focus-visible:ring-green-300"
                        type="number" step="0.01" placeholder="0"
                        value={formData.cash_amount}
                        onChange={(e) => handleFormChange('cash_amount', e.target.value)}
                      />
                    </div>
                    <div className="border border-blue-200 rounded-lg p-2.5 bg-blue-50/40 space-y-1">
                      <Label className="text-[11px] flex items-center gap-1 text-blue-700 font-medium">
                        <Building2 className="w-3.5 h-3.5" /> Bank (₹)
                      </Label>
                      <Input
                        className="h-9 text-sm border-blue-200 bg-white focus-visible:ring-blue-300"
                        type="number" step="0.01" placeholder="0"
                        value={formData.bank_amount}
                        onChange={(e) => handleFormChange('bank_amount', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between rounded-lg bg-slate-900 text-white px-3 py-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">Total Amount</span>
                    <span className="text-base font-bold tabular-nums">
                      ₹{formatCurrency((parseFloat(formData.cash_amount) || 0) + (parseFloat(formData.bank_amount) || 0))}
                    </span>
                  </div>

                  {/* Bank Details — only when bank amount > 0 */}
                  {(parseFloat(formData.bank_amount) || 0) > 0 && (
                    <div className="rounded-lg border border-blue-100 bg-blue-50/30 p-2.5 space-y-2">
                      <p className="text-[10px] font-semibold text-blue-700 flex items-center gap-1 uppercase tracking-wider">
                        <Building2 className="w-3 h-3" /> Bank Details
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px]">Bank Name</Label>
                          <Input className="h-9 text-sm" placeholder="State Bank of India" value={formData.bank_name} onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Account No.</Label>
                          <Input className="h-9 text-sm" placeholder="1234567890" value={formData.bank_account_no} onChange={(e) => setFormData({ ...formData, bank_account_no: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Reference / UTR</Label>
                          <Input className="h-9 text-sm" placeholder="UTR / Cheque No." value={formData.bank_reference} onChange={(e) => setFormData({ ...formData, bank_reference: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">IFSC Code</Label>
                          <Input className="h-9 text-sm" placeholder="SBIN0001234" value={formData.bank_ifsc} onChange={(e) => setFormData({ ...formData, bank_ifsc: e.target.value })} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Section 4: Notes & Status ── */}
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-600">Notes</Label>
                    <Textarea className="text-sm min-h-[72px] resize-none" placeholder="Any additional notes..." value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-600">Status</Label>
                    <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Proof Photo Upload (sub-admin editing only) */}
                {editingId && !isAdmin && (
                  <div className="border rounded-lg p-3 space-y-2">
                    <Label className="text-[11px] flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5" /> Proof Photo *
                    </Label>
                    <Input type="file" accept="image/*" onChange={handleProofPhotoChange} required className="text-xs" />
                    {proofPreview && (
                      <img src={proofPreview} alt="Proof preview" className="h-20 rounded-lg border object-contain" />
                    )}
                    <p className="text-[10px] text-amber-600">Upload a photo as proof for admin to verify</p>
                  </div>
                )}

                <DialogFooter className="pt-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
                  <Button type="submit" size="sm" disabled={submitting || editRequestPending}>
                    {submitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        {editingId && !isAdmin ? 'Submitting Request...' : editingId ? 'Updating...' : 'Registering...'}
                      </>
                    ) : editRequestPending ? (
                      <><Clock className="w-3.5 h-3.5 mr-1.5" /> Request Sent</>
                    ) : editingId && !isAdmin ? (
                      <><Send className="w-3.5 h-3.5 mr-1.5" /> Submit Edit Request</>
                    ) : (
                      editingId ? 'Update' : 'Register'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
      </div>

      {/* ── Payment position — one connected surface, not six cards ── */}
      <section
        aria-labelledby="mr-farmers-summary"
        className="grid overflow-hidden rounded-panel border border-mr-line bg-mr-surface print:hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]"
      >
        {/* Dominant: what is still owed */}
        <div
          className="relative flex flex-col justify-between gap-5 border-b border-mr-line p-6 sm:p-7 lg:border-b-0 lg:border-r"
          style={{
            background: totalRemaining > 0
              ? 'radial-gradient(115% 85% at 0% 100%, rgba(255,176,46,.28) 0%, rgba(255,255,255,0) 68%)'
              : 'radial-gradient(115% 85% at 0% 100%, rgba(185,255,69,.40) 0%, rgba(255,255,255,0) 68%)',
          }}
        >
          <div className="relative">
            <h2 id="mr-farmers-summary" className="text-[12px] font-medium text-mr-muted">Outstanding to farmers</h2>
            <CurrencyValue
              value={totalRemaining}
              size="xl"
              tone={totalRemaining > 0 ? 'default' : 'positive'}
              className="mt-2"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusPill tone={totalRemaining > 0 ? 'attention' : 'positive'}>
                {totalRemaining > 0 ? 'Payments pending' : 'Fully settled'}
              </StatusPill>
              <StatusPill>{totalFarmers} farmer{totalFarmers === 1 ? '' : 's'}</StatusPill>
            </div>
          </div>

          {/* Settlement progress — real paid ÷ committed, no invented trend */}
          <div className="relative">
            <div className="flex items-baseline justify-between gap-3 text-[12px]">
              <span className="text-mr-muted">Settled so far</span>
              <span className="font-semibold text-mr-text" title={`${money(totalPaid)} of ${money(totalAmount)}`}>
                {moneyCompact(totalPaid)} of {moneyCompact(totalAmount)}
              </span>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-mr-surface-2"
              role="img"
              aria-label={`${settledPct}% of committed farmer payments settled`}
            >
              <div
                className="h-full rounded-full bg-mr-lime-ink transition-[width] duration-500"
                style={{ width: `${settledPct}%` }}
              />
            </div>
            <p className="mt-1.5 text-[12px] text-mr-faint">{settledPct}% of committed amount paid</p>
          </div>
        </div>

        {/* Supporting figures — hairline separated, no floating boxes */}
        <div className="-mb-px -mr-px grid sm:grid-cols-2 [&>*]:border-b [&>*]:border-r [&>*]:border-mr-line">
          {[
            { label: 'Total committed', value: totalAmount, hint: 'Agreed land payment value', accent: 'bg-mr-blue-soft text-mr-blue', icon: Landmark },
            { label: 'Total paid', value: totalPaid, hint: `${totalFarmers} farmer${totalFarmers === 1 ? '' : 's'}`, accent: 'bg-mr-lime-soft text-mr-lime-ink', icon: CheckCircle2, tone: 'positive' },
            { label: 'Paid in cash', value: totalCashPaid, hint: totalPaid > 0 ? `${Math.round((totalCashPaid / totalPaid) * 100)}% of paid · cash + split leg` : 'No payments yet', accent: 'bg-mr-aqua-soft text-mr-aqua-ink', icon: Banknote },
            { label: 'Paid via bank', value: totalBankPaid, hint: totalPaid > 0 ? `${Math.round((totalBankPaid / totalPaid) * 100)}% of paid · NEFT, UPI, cheque` : 'No payments yet', accent: 'bg-mr-blue-soft text-mr-blue', icon: Building2 },
          ].map((metric) => (
            <div key={metric.label} className="flex flex-col gap-1.5 px-5 py-5">
              <span className="flex items-center gap-2.5 text-[12px] font-medium text-mr-muted">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${metric.accent}`}>
                  <metric.icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </span>
                {metric.label}
              </span>
              <CurrencyValue value={metric.value} size="lg" tone={metric.tone} />
              <span className="text-[12px] text-mr-faint">{metric.hint}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <label htmlFor="mr-farmer-search" className="sr-only">Search farmers</label>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mr-faint" strokeWidth={1.9} aria-hidden="true" />
          <Input
            id="mr-farmer-search"
            placeholder="Search name, phone or address…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 rounded-full border-mr-line bg-mr-surface-2 pl-10 text-[13px] focus-visible:border-mr-blue focus-visible:bg-mr-surface focus-visible:ring-2 focus-visible:ring-mr-blue/25"
          />
        </div>

        {/* Status becomes a segmented pill — same control as the dashboard period filter */}
        <div role="radiogroup" aria-label="Filter by status" className="mr-rail flex items-center gap-0.5 overflow-x-auto rounded-full border border-mr-line bg-mr-surface-2 p-1">
          {[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'completed', label: 'Completed' },
            { key: 'inactive', label: 'Inactive' },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={statusFilter === option.key}
              onClick={() => setStatusFilter(option.key)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-offset-1 ${
                statusFilter === option.key ? 'bg-mr-ink text-white' : 'text-mr-muted hover:text-mr-text'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
          className="inline-flex h-10 items-center gap-1.5 rounded-full border border-mr-line px-3.5 text-[12px] font-medium text-mr-muted transition-colors hover:bg-mr-surface-2 hover:text-mr-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
        >
          <ArrowUpDown className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />
          {sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
        </button>

        <span className="ml-auto text-[12px] text-mr-muted">
          {filteredFarmers.length} farmer{filteredFarmers.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* ── Farmer list ── */}
      <section className="overflow-hidden rounded-panel border border-mr-line bg-mr-surface print:rounded-none print:border-0">
        {loading ? (
          <div className="space-y-3 p-5 sm:p-6">
            {[0, 1, 2, 3, 4].map((i) => <SkeletonBlock key={i} className="h-14 w-full" />)}
          </div>
        ) : filteredFarmers.length === 0 ? (
          <EmptyState
            icon={Tractor}
            title={searchQuery || statusFilter !== 'all' ? 'No farmers match this filter' : 'No farmers yet'}
            description={searchQuery || statusFilter !== 'all'
              ? 'Try a different search term or clear the status filter.'
              : 'Register your first farmer to start tracking land payments.'}
            action={canManage && !searchQuery && statusFilter === 'all' ? (
              <Button
                onClick={handleOpenCreate}
                className="mt-1 h-10 rounded-full bg-mr-ink px-4 text-[13px] font-semibold text-white hover:bg-mr-ink-2"
              >
                <Plus className="mr-1.5 h-4 w-4" strokeWidth={2} /> Register farmer
              </Button>
            ) : null}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block print:block">
              <Table className="print:w-full print:border-collapse">
                <TableHeader>
                  <TableRow className="border-mr-line hover:bg-transparent print:border-b-2 print:border-slate-800">
                    <TableHead className="w-8 bg-mr-surface-2/70 print:hidden">
                      <Checkbox
                        checked={
                          selection.isAllSelected(visibleFarmerIds)
                            ? true
                            : (selection.count > 0 && visibleFarmerIds.some((id) => selection.isSelected(id)))
                              ? 'indeterminate'
                              : false
                        }
                        onCheckedChange={() => selection.toggleAll(visibleFarmerIds)}
                        aria-label="Select all farmers"
                      />
                    </TableHead>
                    <TableHead className="bg-mr-surface-2/70 text-[12px] font-medium text-mr-muted print:bg-transparent print:font-bold">Farmer</TableHead>
                    <TableHead className="bg-mr-surface-2/70 text-right text-[12px] font-medium text-mr-muted print:bg-transparent print:font-bold">Committed</TableHead>
                    <TableHead className="bg-mr-surface-2/70 text-right text-[12px] font-medium text-mr-muted print:bg-transparent print:font-bold">Paid</TableHead>
                    <TableHead className="bg-mr-surface-2/70 text-right text-[12px] font-medium text-mr-muted print:bg-transparent print:font-bold">Remaining</TableHead>
                    <TableHead className="bg-mr-surface-2/70 text-[12px] font-medium text-mr-muted print:hidden">Progress</TableHead>
                    <TableHead className="bg-mr-surface-2/70 text-[12px] font-medium text-mr-muted print:bg-transparent print:font-bold">Status</TableHead>
                    <TableHead className="bg-mr-surface-2/70 text-right text-[12px] font-medium text-mr-muted print:hidden">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFarmers.map((farmer) => {
                    const paid = parseFloat(farmer.total_paid) || 0;
                    const total = parseFloat(farmer.total_amount) || 0;
                    const remaining = total - paid;
                    const progressPct = total > 0 ? Math.min((paid / total) * 100, 100) : 0;

                    return (
                      <TableRow
                        key={farmer.id}
                        className="cursor-pointer border-mr-line transition-colors duration-150 hover:bg-mr-surface-2/70 print:hover:bg-transparent"
                        onClick={() => navigate(`/farmers/${farmer.id}`)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()} className="print:hidden">
                          <Checkbox
                            checked={selection.isSelected(farmer.id)}
                            onCheckedChange={() => selection.toggle(farmer.id)}
                            aria-label={`Select ${farmer.name}`}
                          />
                        </TableCell>
                        <TableCell className="print:py-1.5">
                          <span className="flex items-center gap-2.5">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mr-lime-soft text-[13px] font-semibold text-mr-lime-ink print:hidden">
                              {farmer.name?.charAt(0)?.toUpperCase() || 'F'}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-medium text-mr-text">{farmer.name}</span>
                              {farmer.phone && (
                                <span className="mt-0.5 flex items-center gap-1 text-[12px] text-mr-faint print:hidden">
                                  <Phone className="h-3 w-3" strokeWidth={1.9} aria-hidden="true" /> {farmer.phone}
                                </span>
                              )}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-[13px] font-medium tabular-nums text-mr-text print:py-1.5">
                          {money(total)}
                        </TableCell>
                        <TableCell className="text-right text-[13px] font-semibold tabular-nums text-mr-lime-ink print:py-1.5">
                          {money(paid)}
                        </TableCell>
                        <TableCell className={`text-right text-[13px] font-semibold tabular-nums print:py-1.5 ${remaining > 0 ? 'text-mr-amber-ink' : 'text-mr-lime-ink'}`}>
                          {money(remaining)}
                        </TableCell>
                        <TableCell className="print:hidden">
                          <span className="flex items-center gap-2">
                            <span
                              className="h-1.5 w-20 overflow-hidden rounded-full bg-mr-surface-2"
                              role="img"
                              aria-label={`${Math.round(progressPct)}% paid`}
                            >
                              <span className="block h-full rounded-full bg-mr-lime-ink" style={{ width: `${progressPct}%` }} />
                            </span>
                            <span className="text-[12px] tabular-nums text-mr-faint">{Math.round(progressPct)}%</span>
                          </span>
                        </TableCell>
                        <TableCell className="print:py-1.5">
                          <StatusPill tone={STATUS_TONE[farmer.status] || 'neutral'} className="capitalize">
                            {farmer.status}
                          </StatusPill>
                        </TableCell>
                        <TableCell className="text-right print:hidden">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/farmers/${farmer.id}`)}
                              className="h-8 w-8 rounded-full p-0 text-mr-faint hover:bg-mr-blue-soft hover:text-mr-blue"
                              title="View payments"
                              aria-label={`View payments for ${farmer.name}`}
                            >
                              <Eye className="h-4 w-4" strokeWidth={1.9} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(farmer)}
                              className={`h-8 w-8 rounded-full p-0 ${canManage ? 'text-mr-faint hover:bg-mr-surface-2 hover:text-mr-text' : 'text-mr-amber-ink hover:bg-mr-amber-soft'}`}
                              title={canManage ? 'Edit' : 'Request edit'}
                              aria-label={canManage ? `Edit ${farmer.name}` : `Request edit for ${farmer.name}`}
                            >
                              <Edit2 className="h-4 w-4" strokeWidth={1.9} />
                            </Button>
                            {canManage && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(farmer.id)}
                                className="h-8 w-8 rounded-full p-0 text-mr-faint hover:bg-mr-coral-soft hover:text-mr-coral-ink"
                                title="Delete"
                                aria-label={`Delete ${farmer.name}`}
                              >
                                <Trash2 className="h-4 w-4" strokeWidth={1.9} />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile list — the same rows, never a squeezed table */}
            <ul className="divide-y divide-mr-line md:hidden print:hidden">
              {filteredFarmers.map((farmer) => {
                const paid = parseFloat(farmer.total_paid) || 0;
                const total = parseFloat(farmer.total_amount) || 0;
                const remaining = total - paid;
                const progressPct = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
                return (
                  <li key={`m-${farmer.id}`}>
                    <button
                      type="button"
                      onClick={() => navigate(`/farmers/${farmer.id}`)}
                      className="w-full px-5 py-4 text-left transition-colors hover:bg-mr-surface-2/70"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mr-lime-soft text-[13px] font-semibold text-mr-lime-ink">
                            {farmer.name?.charAt(0)?.toUpperCase() || 'F'}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[14px] font-medium text-mr-text">{farmer.name}</span>
                            {farmer.phone && <span className="block truncate text-[12px] text-mr-faint">{farmer.phone}</span>}
                          </span>
                        </span>
                        <StatusPill tone={STATUS_TONE[farmer.status] || 'neutral'} className="shrink-0 capitalize">
                          {farmer.status}
                        </StatusPill>
                      </span>
                      <span className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                        <span>
                          <span className="block text-mr-faint">Committed</span>
                          <span className="mt-0.5 block font-semibold tabular-nums text-mr-text">{moneyCompact(total)}</span>
                        </span>
                        <span>
                          <span className="block text-mr-faint">Paid</span>
                          <span className="mt-0.5 block font-semibold tabular-nums text-mr-lime-ink">{moneyCompact(paid)}</span>
                        </span>
                        <span className="text-right">
                          <span className="block text-mr-faint">Remaining</span>
                          <span className={`mt-0.5 block font-semibold tabular-nums ${remaining > 0 ? 'text-mr-amber-ink' : 'text-mr-lime-ink'}`}>
                            {moneyCompact(remaining)}
                          </span>
                        </span>
                      </span>
                      <span
                        className="mt-3 block h-1.5 overflow-hidden rounded-full bg-mr-surface-2"
                        role="img"
                        aria-label={`${Math.round(progressPct)}% paid`}
                      >
                        <span className="block h-full rounded-full bg-mr-lime-ink" style={{ width: `${progressPct}%` }} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </div>
  );
};

export default Farmers;
