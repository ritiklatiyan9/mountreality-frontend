import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import MaterialCell from '../components/inventory/MaterialCell';
import VendorCell from '../components/inventory/VendorCell';
import DeliveryProgress from '../components/inventory/DeliveryProgress';
import ProcurementTimeline from '../components/inventory/ProcurementTimeline';
import { EmptyBlock } from '../components/ui/page';
import { FinancialMetric, SkeletonBlock, EmptyState, StatusPill } from '../components/dashboard/primitives';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  IndianRupee,
  Loader2,
  Package,
  ArrowDownToLine,
  Plus,
  Receipt,
  Search,
  X, MoreHorizontal, ClipboardList,
} from 'lucide-react';

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const money = (n) => {
  const num = parseFloat(n) || 0;
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
};

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
};

const STATUS_META = {
  open:      { label: 'Unpaid',    tone: 'info' },
  partial:   { label: 'Partial',   tone: 'attention' },
  completed: { label: 'Paid',      tone: 'positive' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

const PAGE_LIMIT = 20;

const emptyForm = {
  vendor_member_id: '',
  vendor_name: '',
  item_name: '',
  item_category: '',
  unit: 'pcs',
  qty_ordered: '',
  rate: '',
  discount_pct: '',
  discount_amount: '',
  order_date: todayLocal(),
  expected_date: '',
  note: '',
};

const CATEGORY_PALETTE = [
  { chip: 'bg-mr-blue-soft text-mr-blue',       bar: 'bg-mr-blue' },
  { chip: 'bg-mr-amber-soft text-mr-amber-ink', bar: 'bg-mr-amber' },
  { chip: 'bg-mr-lime-soft text-mr-lime-ink',   bar: 'bg-mr-lime' },
  { chip: 'bg-mr-aqua-soft text-mr-aqua-ink',   bar: 'bg-mr-aqua' },
  { chip: 'bg-mr-coral-soft text-mr-coral-ink', bar: 'bg-mr-coral' },
];
const catColor = (i) => CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];

const VendorInventory = () => {
  const navigate   = useNavigate();
  const { currentSite, canManage, hasPermission } = useAuth();
  const canWrite  = canManage && hasPermission('vendors', 'write');
  const canDelete = canManage && hasPermission('vendors', 'delete');
  const canReceive = canManage && hasPermission('inventory', 'write');
  const siteId    = currentSite?.id;

  const [loading,    setLoading]    = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message,    setMessage]    = useState({ type: '', text: '' });

  const [orders,     setOrders]     = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 1 });
  const [vendors,    setVendors]    = useState([]);
  const [categories, setCategories] = useState([]);
  const [heads,      setHeads]      = useState([]);
  const [stockSummary, setStockSummary] = useState({ categories: [], recentTransactions: [], totals: {} });

  const [search,      setSearch]      = useState('');
  const [statusFilter,setStatusFilter]= useState('all');
  const [catFilter,   setCatFilter]   = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  // Receive-into-stock (procurement → inventory ledger)
  const [materials, setMaterials] = useState([]);
  const [receiveOrder, setReceiveOrder] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [receiveForm, setReceiveForm] = useState({ material_id: 'auto', qty: '', rate: '', note: '' });

  const gross = (() => {
    const q = parseFloat(form.qty_ordered) || 0;
    const r = parseFloat(form.rate) || 0;
    return q * r;
  })();
  const effectiveDiscount = (() => {
    const pct = parseFloat(form.discount_pct) || 0;
    const flat = parseFloat(form.discount_amount) || 0;
    if (pct > 0) return Math.round(gross * pct / 100 * 100) / 100;
    return flat;
  })();
  const net = Math.max(0, gross - effectiveDiscount);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setCurrentPage(1);
    }, 380);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  useEffect(() => { setCurrentPage(1); }, [statusFilter, catFilter]);

  const loadStatic = useCallback(async () => {
    if (!siteId) return;
    try {
      const [vendorsRes, catsRes, stockRes, headsRes] = await Promise.all([
        api.get('/vendors/users', { params: { site_id: siteId } }),
        api.get('/vendors/inventory/categories', { params: { site_id: siteId } }),
        api.get('/vendors/inventory/stock-summary', { params: { site_id: siteId } }),
        api.get('/vendors/heads', { params: { site_id: siteId } }),
      ]);
      setVendors(vendorsRes.data.vendors || []);
      setCategories(catsRes.data.categories || []);
      setHeads(headsRes.data.heads || []);
      setStockSummary(stockRes.data || { categories: [], recentTransactions: [], totals: {} });
    } catch { /* silent */ }
    // Separate call: a user with vendor but not inventory permission gets 403
    // here and must still see the rest of the page.
    try {
      const matRes = await api.get('/inventory/materials', { params: { site_id: siteId } });
      setMaterials(matRes.data.materials || []);
    } catch { setMaterials([]); }
  }, [siteId]);

  const loadOrders = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    // Watchdog so the spinner can't hang on a stalled request.
    const watchdog = setTimeout(() => setLoading(false), 15000);
    try {
      const params = { site_id: siteId, page: currentPage, limit: PAGE_LIMIT };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (catFilter !== 'all') params.category = catFilter;

      const res = await api.get('/vendors/inventory', { params });
      setOrders(res.data.orders || []);
      setPagination(res.data.pagination || { page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 1 });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to load inventory' });
    } finally {
      clearTimeout(watchdog);
      setLoading(false);
    }
  }, [siteId, currentPage, debouncedSearch, statusFilter, catFilter]);

  // Background refresh — does NOT toggle the loader.
  const refreshOrders = useCallback(async () => {
    if (!siteId) return;
    try {
      const params = { site_id: siteId, page: currentPage, limit: PAGE_LIMIT };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (catFilter !== 'all') params.category = catFilter;
      const res = await api.get('/vendors/inventory', { params });
      setOrders(res.data.orders || []);
      setPagination(res.data.pagination || { page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 1 });
    } catch { /* keep current */ }
  }, [siteId, currentPage, debouncedSearch, statusFilter, catFilter]);

  useEffect(() => { loadStatic(); }, [loadStatic]);
  useEffect(() => { loadOrders(); }, [loadOrders]);

  useEffect(() => {
    if (!message.text) return;
    const t = setTimeout(() => setMessage({ type: '', text: '' }), 3500);
    return () => clearTimeout(t);
  }, [message]);

  const setF = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const onVendorChange = (id) => {
    const v = vendors.find((x) => String(x.id) === id);
    setForm((p) => ({ ...p, vendor_member_id: id, vendor_name: v?.full_name || p.vendor_name }));
  };

  const onDiscountPct  = (val) => setForm((p) => ({ ...p, discount_pct: val, discount_amount: val ? '' : p.discount_amount }));
  const onDiscountFlat = (val) => setForm((p) => ({ ...p, discount_amount: val, discount_pct: val ? '' : p.discount_pct }));

  const openCreate = () => {
    setForm({ ...emptyForm, order_date: todayLocal() });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!siteId) return;
    if (!form.item_name.trim()) return setMessage({ type: 'error', text: 'Item name is required' });
    if (!form.unit.trim())      return setMessage({ type: 'error', text: 'Unit is required' });
    if (!(parseFloat(form.qty_ordered) > 0)) return setMessage({ type: 'error', text: 'Qty must be > 0' });
    if (!form.vendor_name.trim() && !form.vendor_member_id) return setMessage({ type: 'error', text: 'Vendor name is required' });
    setSubmitting(true);
    try {
      await api.post('/vendors/inventory', { site_id: siteId, ...form });
      setMessage({ type: 'success', text: 'Item added' });
      setDialogOpen(false);
      // Reconcile in background — both refreshes run concurrently and don't
      // block the dialog close.
      refreshOrders();
      loadStatic();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to create item' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item and all its payment transactions?')) return;
    // Optimistic removal — instant UI feedback.
    const snapshot = orders;
    setOrders((prev) => prev.filter((o) => o.id !== id));
    try {
      await api.delete(`/vendors/inventory/${id}`, { params: { site_id: siteId } });
      setMessage({ type: 'success', text: 'Item deleted' });
      refreshOrders();
      loadStatic();
    } catch (err) {
      setOrders(snapshot); // rollback
      setMessage({ type: 'error', text: err.response?.data?.message || 'Delete failed' });
    }
  };

  const openReceive = (o) => {
    setReceiveOrder(o);
    setReceiveForm({ material_id: 'auto', qty: String(parseFloat(o.pending_qty) || 0), rate: String(o.rate ?? ''), note: '' });
  };

  const handleReceive = async () => {
    const qty = parseFloat(receiveForm.qty);
    if (!(qty > 0)) return setMessage({ type: 'error', text: 'Qty must be > 0' });
    setSubmitting(true);
    try {
      await api.post(`/inventory/vendor-orders/${receiveOrder.id}/receive`, {
        site_id: siteId,
        qty,
        material_id: receiveForm.material_id === 'auto' ? undefined : Number(receiveForm.material_id),
        rate: receiveForm.rate === '' ? undefined : parseFloat(receiveForm.rate),
        note: receiveForm.note || undefined,
      });
      setMessage({ type: 'success', text: 'Received into stock' });
      setReceiveOrder(null);
      refreshOrders();
      loadStatic();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Receive failed' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentSite) {
    return <EmptyBlock icon={Package} title="Select a site to view inventory" tall />;
  }

  const { page, totalPages, total } = pagination;
  const startItem = total === 0 ? 0 : (page - 1) * PAGE_LIMIT + 1;
  const endItem   = Math.min(page * PAGE_LIMIT, total);
  const totals    = stockSummary.totals || {};

  const totalValue = parseFloat(totals.total_value || 0);
  const totalPaid  = parseFloat(totals.total_paid  || 0);
  const totalOutstanding = parseFloat(totals.total_outstanding || 0);
  const paidPct    = totalValue > 0 ? Math.min(100, (totalPaid / totalValue) * 100) : 0;

  return (
    <div className="w-full space-y-6 pb-16 text-mr-text">
      <div className="flex flex-col items-start justify-between gap-4 border-b border-mr-line pb-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-[clamp(1.35rem,2.3vw,1.75rem)] font-semibold tracking-[-0.035em] text-mr-text">Purchase register</h2>
          <p className="mt-1 text-[13px] text-mr-muted">Ordered materials, payment position and stock receipt</p>
        </div>
        {canWrite && (
          <button type="button" className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-mr-ink px-4 text-[13px] font-semibold text-white transition-colors hover:bg-mr-ink-2" onClick={openCreate}>
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> New purchase item
          </button>
        )}
      </div>

      {/* Alert */}
      {message.text && (
        <div className={`flex items-center gap-2 rounded-control border p-3 text-[13px] ${message.type === 'success' ? 'border-mr-lime-ink/15 bg-mr-lime-soft text-mr-lime-ink' : 'border-mr-coral-ink/15 bg-mr-coral-soft text-mr-coral-ink'}`}>
          {message.type === 'success' ? <Check className="h-4 w-4 shrink-0" strokeWidth={1.9} /> : <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.9} />}
          <span>{message.text}</span>
          <button className="ml-auto" onClick={() => setMessage({ type: '', text: '' })}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Summary strip */}
      <dl className="grid grid-cols-2 divide-x divide-mr-line overflow-hidden rounded-panel border border-mr-line bg-mr-surface sm:grid-cols-4">
        <FinancialMetric label="Total items" value={totals.total_items || 0} icon={Package} accent="blue" />
        <FinancialMetric label="Total value" value={totalValue} icon={IndianRupee} accent="blue" />
        <FinancialMetric label="Paid" value={totalPaid} icon={IndianRupee} accent="lime" tone="positive" hint={`${Math.round(paidPct)}% of total`} />
        <FinancialMetric label="Outstanding" value={totalOutstanding} icon={Receipt} accent="coral" />
      </dl>

      {/* Category Breakdown */}
      {stockSummary.categories?.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-mr-text">
            <Package className="h-4 w-4 text-mr-faint" strokeWidth={1.9} /> By category
          </h2>
          <div className="divide-y divide-mr-line overflow-hidden rounded-panel border border-mr-line bg-mr-surface sm:grid sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3">
            {stockSummary.categories.map((cat, idx) => {
              const c = catColor(idx);
              const val  = parseFloat(cat.total_value) || 0;
              const paid = parseFloat(cat.total_paid) || 0;
              const out  = parseFloat(cat.outstanding) || 0;
              const pct  = val > 0 ? Math.min(100, (paid / val) * 100) : 0;
              const isActive = catFilter === cat.category;
              return (
                <button
                  key={cat.category}
                  onClick={() => setCatFilter(isActive ? 'all' : cat.category)}
                  className={`text-left p-3.5 transition-colors ${isActive ? 'bg-mr-surface-2' : 'hover:bg-mr-surface-2/70'}`}
                >
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${c.chip}`}>{cat.category}</span>
                    <span className="text-[11px] font-medium text-mr-faint">{cat.item_count} items</span>
                  </div>
                  <div className="mb-2.5">
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="text-mr-muted">Paid</span>
                      <span className="font-semibold tabular-nums text-mr-text">₹{money(paid)} / ₹{money(val)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-mr-surface-2">
                      <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-mr-line pt-2 text-xs">
                    <span className={out > 0 ? 'font-semibold text-mr-coral-ink' : 'font-semibold text-emerald-800'}>
                      {out > 0 ? `Due: ₹${money(out)}` : '✓ Paid'}
                    </span>
                    <span className="text-[10px] font-semibold tabular-nums text-mr-faint">{Math.round(pct)}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      {stockSummary.recentTransactions?.length > 0 && (
        <div className="border-t border-mr-line">
          <div className="flex items-center gap-2 border-b border-mr-line py-2.5">
            <Receipt className="h-3.5 w-3.5 text-mr-faint" strokeWidth={1.9} />
            <span className="text-xs font-semibold text-mr-text">Recent payment transactions</span>
          </div>
          <div className="divide-y divide-mr-line">
            {stockSummary.recentTransactions.slice(0, 6).map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                    <IndianRupee className="h-3.5 w-3.5" strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-mr-text">{t.item_name}</p>
                    <p className="text-[10px] text-mr-faint">
                      {fmtDate(t.date)}
                      {t.item_category && <> &middot; {t.item_category}</>}
                      {t.payment_mode && <> &middot; {t.payment_mode.toUpperCase()}</>}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-bold tabular-nums text-emerald-800">₹{money(t.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="border-t border-mr-line pt-5">
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mr-faint" strokeWidth={1.9} />
            <Input
              className="h-10 rounded-full border-mr-line bg-mr-surface-2 pl-8 text-sm shadow-none focus-visible:border-mr-blue focus-visible:bg-mr-surface focus-visible:ring-2 focus-visible:ring-mr-blue/20"
              placeholder="Search item, vendor, category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mr-faint hover:text-mr-text">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 w-full rounded-full border-mr-line bg-mr-surface-2 text-sm shadow-none sm:w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Unpaid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="completed">Paid</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="h-10 w-full rounded-full border-mr-line bg-mr-surface-2 text-sm shadow-none sm:w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {heads.map((h) => (
                <SelectItem key={h.id} value={h.name}>{h.name}</SelectItem>
              ))}
              {categories.filter(c => !heads.some(h => h.name === c)).map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {catFilter !== 'all' && (
            <Button variant="ghost" size="sm" className="h-9 text-xs text-mr-muted" onClick={() => setCatFilter('all')}>
              <X className="w-3 h-3 mr-1" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Items Table */}
      <div className="overflow-hidden rounded-panel border border-mr-line bg-mr-surface">
        {catFilter !== 'all' && (
          <div className="flex items-center justify-between border-b border-mr-line bg-mr-blue-soft px-1 py-2">
            <span className="text-xs font-semibold text-mr-blue">Showing: {catFilter}</span>
            <button onClick={() => setCatFilter('all')} className="flex items-center gap-1 text-xs text-mr-blue hover:brightness-90">
              <X className="w-3 h-3" /> Show all
            </button>
          </div>
        )}
        {loading ? (
          <div className="space-y-3 p-5 sm:p-6">
            {[0, 1, 2, 3, 4].map((i) => <SkeletonBlock key={i} className="h-14 w-full" />)}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No inventory items found"
            description={search || statusFilter !== 'all' || catFilter !== 'all' ? 'Try clearing your filters' : 'Add items via "New purchase item" or from a vendor commitment'}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-mr-line bg-mr-surface-2/60 hover:bg-mr-surface-2/60">
                    <TableHead className="bg-zinc-900 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 pl-4 py-3">Material / Vendor</TableHead>
                    <TableHead className="bg-zinc-900 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 py-3">Category</TableHead>
                    <TableHead className="bg-zinc-900 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 text-right py-3">Qty × Rate</TableHead>
                    <TableHead className="bg-zinc-900 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 text-right py-3">Net Value</TableHead>
                    <TableHead className="bg-zinc-900 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 text-right py-3">Paid</TableHead>
                    <TableHead className="bg-zinc-900 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 text-right py-3">Due</TableHead>
                    <TableHead className="bg-zinc-900 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 text-right py-3">Stock In</TableHead>
                    <TableHead className="bg-zinc-900 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 py-3">Status</TableHead>
                    <TableHead className="bg-zinc-900 py-3 pr-4 w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => {
                    const outstanding = parseFloat(o.outstanding) || 0;
                    const orderValue  = parseFloat(o.order_value) || 0;
                    const paid = parseFloat(o.total_paid) || 0;
                    const pct  = orderValue > 0 ? Math.min(100, (paid / orderValue) * 100) : 0;
                    return (
                      <TableRow
                        key={o.id}
                        className="cursor-pointer border-b border-mr-line transition-colors duration-150 hover:bg-mr-surface-2/70"
                        onClick={() => setSelectedOrder(o)}
                      >
                        <TableCell className="pl-4 py-2.5">
                          <MaterialCell name={o.item_name} category={o.item_category} />
                          <div className="mt-1" onClick={(e) => e.stopPropagation()}><VendorCell name={o.vendor_name} photo={o.vendor_member_photo} secondary={o.head_name || 'Supplier'} /></div>
                        </TableCell>
                        <TableCell className="py-2.5">
                          {o.item_category ? (
                            <span className="rounded-full bg-mr-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase text-mr-muted">{o.item_category}</span>
                          ) : <span className="text-xs text-mr-faint">—</span>}
                        </TableCell>
                        <TableCell className="text-right py-2.5">
                          <p className="text-sm font-medium text-mr-text tabular-nums">
                            {money(o.qty_ordered)} <span className="text-[10px] text-mr-faint">{o.unit}</span>
                          </p>
                          <p className="text-[10px] text-mr-faint tabular-nums">@ ₹{money(o.rate)}</p>
                        </TableCell>
                        <TableCell className="text-right py-2.5 tabular-nums text-sm font-semibold text-mr-text">₹{money(orderValue)}</TableCell>
                        <TableCell className="text-right py-2.5">
                          <p className="text-sm font-medium text-emerald-800 tabular-nums">₹{money(paid)}</p>
                          <div className="mt-1 ml-auto h-1 w-16 overflow-hidden rounded-full bg-mr-surface-2">
                            <div className="h-full rounded-full bg-emerald-800" style={{ width: `${pct}%` }} />
                          </div>
                        </TableCell>
                        <TableCell className="text-right py-2.5 tabular-nums text-sm font-semibold">
                          <span className={outstanding > 0 ? 'text-mr-coral-ink' : 'text-mr-faint'}>{outstanding > 0 ? `₹${money(outstanding)}` : '—'}</span>
                        </TableCell>
                        <TableCell className="text-right py-2.5">
                          <DeliveryProgress received={o.received_qty} ordered={o.qty_ordered} unit={o.unit} expectedDate={fmtDate(o.expected_date)} />
                        </TableCell>
                        <TableCell className="py-2.5">
                          <StatusPill tone={STATUS_META[o.payment_status || o.status]?.tone || 'neutral'}>{STATUS_META[o.payment_status || o.status]?.label || o.payment_status || o.status}</StatusPill>
                        </TableCell>
                        <TableCell className="pr-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-0.5 justify-end">
                            {canReceive && parseFloat(o.pending_qty) > 0 && o.status !== 'cancelled' && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-mr-faint hover:text-emerald-800" title="Receive into stock" onClick={() => openReceive(o)}>
                                <ArrowDownToLine className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-mr-faint" aria-label={`Actions for ${o.item_name}`}><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuLabel className="text-[11px] text-mr-faint">Purchase actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => setSelectedOrder(o)}><Eye /> Open quick view</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/vendors/inventory/${o.id}`)}><ClipboardList /> Open full detail</DropdownMenuItem>
                                {canDelete && <><DropdownMenuSeparator /><DropdownMenuItem className="text-mr-coral-ink focus:text-mr-coral-ink" onClick={() => handleDelete(o.id)}><X /> Delete order</DropdownMenuItem></>}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between border-t border-mr-line bg-mr-surface-2/50 px-4 py-3">
              <p className="text-xs text-mr-muted">{total === 0 ? 'No results' : `${startItem}–${endItem} of ${total}`}</p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7 border-mr-line" disabled={page <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <span className="text-xs text-mr-muted px-2">{page} / {totalPages}</span>
                <Button variant="outline" size="icon" className="h-7 w-7 border-mr-line" disabled={page >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <Sheet open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden border-mr-line bg-mr-surface p-0 sm:max-w-xl">
          <SheetHeader className="shrink-0 border-b border-zinc-800 bg-zinc-950 px-5 py-5 text-left text-white sm:px-6">
            <div className="flex items-start gap-3 pr-7">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-200"><Package className="h-4 w-4" /></div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">Purchase order #{selectedOrder?.id}</p>
                <SheetTitle className="mt-1 truncate text-[17px] tracking-[-0.02em] text-white">{selectedOrder?.item_name}</SheetTitle>
                <SheetDescription className="mt-1 truncate text-[12px] text-zinc-400">{selectedOrder?.vendor_name || 'Supplier not assigned'}</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          {selectedOrder && (
            <div className="flex-1 space-y-7 overflow-y-auto bg-mr-surface-2/35 px-5 py-5 sm:px-6">
              <div className="flex items-end justify-between gap-3 border-b border-mr-line pb-5">
                <div><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mr-faint">Order value</p><p className="mt-1 text-[26px] font-semibold tracking-[-0.04em] tabular-nums text-mr-text">₹{money(selectedOrder.order_value)}</p></div>
                <StatusPill tone={STATUS_META[selectedOrder.status]?.tone || 'neutral'}>{STATUS_META[selectedOrder.status]?.label || selectedOrder.status}</StatusPill>
              </div>
              <section>
                <div className="mb-4 flex items-center justify-between"><h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-mr-faint">Purchase flow</h3><span className="text-[11px] text-mr-faint">{fmtDate(selectedOrder.order_date)}</span></div>
                <ProcurementTimeline vertical stages={[
                  { label: 'Purchase order', status: 'complete', detail: fmtDate(selectedOrder.order_date) },
                  { label: 'Delivery', status: Number(selectedOrder.received_qty) > 0 && Number(selectedOrder.pending_qty) > 0 ? 'current' : (Number(selectedOrder.received_qty) >= Number(selectedOrder.qty_ordered) ? 'complete' : 'pending'), detail: `${money(selectedOrder.received_qty)} / ${money(selectedOrder.qty_ordered)} ${selectedOrder.unit}` },
                  { label: 'Inventory receipt', status: Number(selectedOrder.received_qty) > 0 ? 'complete' : 'pending', detail: Number(selectedOrder.received_qty) > 0 ? 'Posted to stock ledger' : 'Awaiting receipt' },
                  { label: 'Payment', status: Number(selectedOrder.outstanding) <= 0 ? 'complete' : (Number(selectedOrder.total_paid) > 0 ? 'current' : 'pending'), detail: Number(selectedOrder.outstanding) > 0 ? `₹${money(selectedOrder.outstanding)} outstanding` : 'Paid in full' },
                ]} />
              </section>
              <section className="border-t border-mr-line pt-5">
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-mr-faint">Material & vendor</h3>
                <div className="space-y-4">
                  <MaterialCell name={selectedOrder.item_name} category={selectedOrder.item_category} />
                  <div className="grid grid-cols-3 divide-x divide-mr-line border-y border-mr-line py-3">
                    <div className="pr-3"><p className="text-[10px] uppercase tracking-wide text-mr-faint">Quantity</p><p className="mt-1 text-[13px] font-semibold tabular-nums text-mr-text">{money(selectedOrder.qty_ordered)} {selectedOrder.unit}</p></div>
                    <div className="px-3"><p className="text-[10px] uppercase tracking-wide text-mr-faint">Rate</p><p className="mt-1 text-[13px] font-semibold tabular-nums text-mr-text">₹{money(selectedOrder.rate)}</p></div>
                    <div className="pl-3"><p className="text-[10px] uppercase tracking-wide text-mr-faint">Category</p><p className="mt-1 truncate text-[13px] font-semibold text-mr-text">{selectedOrder.item_category || 'Uncategorised'}</p></div>
                  </div>
                  <VendorCell name={selectedOrder.vendor_name} photo={selectedOrder.vendor_member_photo} secondary={selectedOrder.head_name || 'Supplier'} />
                </div>
              </section>
              <section className="border-t border-mr-line pt-5">
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-mr-faint">Delivery progress</h3>
                <DeliveryProgress received={selectedOrder.received_qty} ordered={selectedOrder.qty_ordered} unit={selectedOrder.unit} expectedDate={fmtDate(selectedOrder.expected_date)} className="max-w-sm" />
                <div className="mt-5 grid grid-cols-3 divide-x divide-mr-line border-y border-mr-line py-3 text-sm"><div className="pr-3"><p className="text-[11px] text-mr-faint">Rate</p><p className="mt-1 font-semibold tabular-nums text-mr-text">₹{money(selectedOrder.rate)}</p></div><div className="px-3"><p className="text-[11px] text-mr-faint">Paid</p><p className="mt-1 font-semibold tabular-nums text-emerald-800">₹{money(selectedOrder.total_paid)}</p></div><div className="pl-3"><p className="text-[11px] text-mr-faint">Due</p><p className="mt-1 font-semibold tabular-nums text-mr-coral-ink">₹{money(selectedOrder.outstanding)}</p></div></div>
              </section>
              {selectedOrder.note && <p className="border-t border-mr-line pt-5 text-[13px] leading-6 text-mr-muted">{selectedOrder.note}</p>}
            </div>
          )}
          <SheetFooter className="shrink-0 flex-row justify-between gap-3 border-t border-zinc-800 bg-zinc-950 px-5 py-4 sm:px-6">
            <Button variant="ghost" size="sm" className="rounded-full text-zinc-300 hover:bg-zinc-800 hover:text-white" onClick={() => selectedOrder && navigate(`/vendors/inventory/${selectedOrder.id}`)}>Open full detail</Button>
            {selectedOrder && canReceive && Number(selectedOrder.pending_qty) > 0 && selectedOrder.status !== 'cancelled' && <Button size="sm" className="rounded-full bg-emerald-800 px-4 text-white hover:bg-emerald-700" onClick={() => { openReceive(selectedOrder); setSelectedOrder(null); }}><ArrowDownToLine className="mr-1.5 h-4 w-4" /> Receive into stock</Button>}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Receive into stock — appends a RECEIPT to the inventory ledger */}
      <Dialog open={!!receiveOrder} onOpenChange={(v) => !v && setReceiveOrder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <ArrowDownToLine className="w-4 h-4" /> Receive into Stock
            </DialogTitle>
            <DialogDescription className="text-sm">
              {receiveOrder?.item_name} from {receiveOrder?.vendor_name} — {money(receiveOrder?.pending_qty)} {receiveOrder?.unit} pending.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Material</Label>
              <Select value={receiveForm.material_id} onValueChange={(v) => setReceiveForm((p) => ({ ...p, material_id: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Match / create by item name</SelectItem>
                  {materials.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.name} ({money(m.on_hand)} {m.unit})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Qty *</Label>
                <Input type="number" step="0.001" value={receiveForm.qty} onChange={(e) => setReceiveForm((p) => ({ ...p, qty: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Rate (₹)</Label>
                <Input type="number" step="0.01" value={receiveForm.rate} onChange={(e) => setReceiveForm((p) => ({ ...p, rate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Note</Label>
              <Input value={receiveForm.note} onChange={(e) => setReceiveForm((p) => ({ ...p, note: e.target.value }))} placeholder="Optional — GRN / challan no." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveOrder(null)}>Cancel</Button>
            <Button onClick={handleReceive} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}Receive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Item Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4" /> New Inventory Item
            </DialogTitle>
            <DialogDescription className="text-sm">
              Record an ordered item. Track payment transactions against it — no stock in/out flow.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Vendor (from users)</Label>
              <Select value={form.vendor_member_id} onValueChange={onVendorChange}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>{v.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Or Manual Vendor Name</Label>
              <Input
                value={form.vendor_name}
                onChange={(e) => setF('vendor_name', e.target.value.toUpperCase())}
                placeholder="SHARMA BRICKS"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs font-medium">Item Name <span className="text-red-500">*</span></Label>
              <Input
                value={form.item_name}
                onChange={(e) => setF('item_name', e.target.value)}
                placeholder="Red Clay Bricks / Cement 53 Grade / TMT Steel…"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Category</Label>
              <Select value={form.item_category} onValueChange={(val) => setF('item_category', val)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {heads.map((h) => (
                    <SelectItem key={h.id} value={h.name}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Unit <span className="text-red-500">*</span></Label>
              <Input
                value={form.unit}
                onChange={(e) => setF('unit', e.target.value)}
                placeholder="pcs / kg / bag / sqft / ton"
                className="h-9"
                list="unit-list"
              />
              <datalist id="unit-list">
                {['pcs', 'kg', 'bag', 'sqft', 'ton', 'rft', 'cft', 'litre', 'bundle', 'set'].map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Qty <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={form.qty_ordered}
                onChange={(e) => setF('qty_ordered', e.target.value)}
                placeholder="10000"
                className="h-9 tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Rate per {form.unit || 'unit'} (₹)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">₹</span>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={form.rate}
                  onChange={(e) => setF('rate', e.target.value)}
                  placeholder="8.50"
                  className="pl-7 h-9 tabular-nums"
                />
              </div>
            </div>

            {gross > 0 && (
              <div className="col-span-2 bg-slate-50 rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 text-xs">Gross Amount</span>
                  <span className="font-semibold text-slate-800 tabular-nums">₹{money(gross)}</span>
                </div>
                {effectiveDiscount > 0 && (
                  <div className="flex items-center justify-between text-sm mt-1.5">
                    <span className="text-slate-500 text-xs">Discount</span>
                    <span className="font-medium text-amber-600 tabular-nums">- ₹{money(effectiveDiscount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-slate-200">
                  <span className="text-xs font-semibold text-slate-700">Net Amount</span>
                  <span className="font-bold text-emerald-700 tabular-nums">₹{money(net)}</span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Discount % <span className="text-slate-400 font-normal">(auto-calc)</span></Label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  value={form.discount_pct}
                  onChange={(e) => onDiscountPct(e.target.value)}
                  placeholder="0"
                  className="pr-7 h-9 tabular-nums"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Discount ₹ <span className="text-slate-400 font-normal">(manual flat)</span></Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">₹</span>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={form.discount_amount}
                  onChange={(e) => onDiscountFlat(e.target.value)}
                  placeholder="0"
                  className="pl-7 h-9 tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Order Date</Label>
              <Input type="date" value={form.order_date} onChange={(e) => setF('order_date', e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Expected Date</Label>
              <Input type="date" value={form.expected_date} onChange={(e) => setF('expected_date', e.target.value)} className="h-9" />
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs font-medium">Note</Label>
              <Textarea
                rows={2}
                value={form.note}
                onChange={(e) => setF('note', e.target.value)}
                placeholder="Any special terms, quality spec, delivery address…"
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
              Create Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorInventory;
