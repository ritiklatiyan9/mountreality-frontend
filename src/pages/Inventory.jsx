import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import VendorInventory from './VendorInventory';
import VendorModuleTabs from '../components/inventory/VendorModuleTabs';
import api from '../api/api';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { TableCell, TableRow } from '../components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import MaterialCell from '../components/inventory/MaterialCell';
import StockLevelIndicator from '../components/inventory/StockLevelIndicator';
import { PageHeader, EmptyBlock, PRIMARY_BTN } from '../components/ui/page';
import { SkeletonBlock, EmptyState } from '../components/dashboard/primitives';
import {
  Boxes, Plus, Search, Loader2, IndianRupee, PackageOpen, AlertTriangle,
  ArrowDownToLine, History, Trash2, MoreHorizontal,
} from 'lucide-react';

const MOVEMENT_TYPES = [
  { value: 'RECEIPT', label: 'Receipt (+)', hint: 'Stock received into store' },
  { value: 'ADJUSTMENT', label: 'Adjustment (±)', hint: 'Correction — qty may be negative' },
  { value: 'RESERVE', label: 'Reserve', hint: 'Soft-hold available stock' },
  { value: 'UNRESERVE', label: 'Un-reserve', hint: 'Release a reservation' },
  { value: 'RETURN', label: 'Return (+)', hint: 'Material returned to store' },
  { value: 'TRANSFER_OUT', label: 'Transfer Out (−)', hint: 'Sent to another site/store' },
  { value: 'TRANSFER_IN', label: 'Transfer In (+)', hint: 'Received from another site/store' },
];
const MOVE_TONE = {
  RECEIPT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  RETURN: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  TRANSFER_IN: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ISSUE: 'bg-red-50 text-red-700 border-red-200',
  CONSUMPTION: 'bg-red-50 text-red-700 border-red-200',
  TRANSFER_OUT: 'bg-red-50 text-red-700 border-red-200',
  ADJUSTMENT: 'bg-amber-50 text-amber-700 border-amber-200',
  RESERVE: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  UNRESERVE: 'bg-slate-50 text-slate-600 border-slate-200',
};

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtQty = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function Inventory() {
  const { currentSite, hasPermission } = useAuth();
  const siteId = currentSite?.id;
  const canSeeProcurement = hasPermission('vendors', 'read');

  const [materials, setMaterials] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'procurement' ? 'procurement' : 'stock';
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef(null);
  const requestSeq = useRef(0);
  const [lowOnly, setLowOnly] = useState(() => searchParams.get('low') === '1');

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', unit: 'NOS', category: '', min_stock: '', rate: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const [moveOpen, setMoveOpen] = useState(false);
  const [move, setMove] = useState({ material_id: '', movement_type: 'RECEIPT', qty: '', rate: '', note: '' });
  const [moving, setMoving] = useState(false);

  const [histOpen, setHistOpen] = useState(false);
  const [histMat, setHistMat] = useState(null);
  const [movements, setMovements] = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!siteId) return;
    const requestId = ++requestSeq.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ site_id: siteId });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (lowOnly) params.set('low_stock', 'true');
      const [mRes, sRes] = await Promise.all([
        api.get(`/inventory/materials?${params}`),
        api.get(`/inventory/summary?site_id=${siteId}`),
      ]);
      if (requestId !== requestSeq.current) return;
      setMaterials(mRes.data.materials || []);
      setSummary(sRes.data.summary || {});
    } catch (err) {
      if (requestId === requestSeq.current) toast.error(err.response?.data?.message || 'Failed to load inventory');
    } finally {
      if (requestId === requestSeq.current) setLoading(false);
    }
  }, [siteId, debouncedSearch, lowOnly]);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search.trim()), 280);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Material name is required');
    setSaving(true);
    try {
      await api.post('/inventory/materials', { site_id: siteId, ...form });
      toast.success('Material added');
      setCreateOpen(false);
      setForm({ name: '', code: '', unit: 'NOS', category: '', min_stock: '', rate: '', notes: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add material');
    } finally {
      setSaving(false);
    }
  };

  const openMove = (material) => {
    setMove({ material_id: material ? String(material.id) : '', movement_type: 'RECEIPT', qty: '', rate: material ? String(material.rate) : '', note: '' });
    setMoveOpen(true);
  };
  const handleMove = async (e) => {
    e.preventDefault();
    if (!move.material_id) return toast.error('Pick a material');
    if (!Number(move.qty)) return toast.error('Enter a qty');
    setMoving(true);
    try {
      await api.post('/inventory/movements', {
        site_id: siteId, material_id: Number(move.material_id), movement_type: move.movement_type,
        qty: Number(move.qty), rate: move.rate === '' ? undefined : Number(move.rate), note: move.note || undefined,
      });
      toast.success('Movement recorded');
      setMoveOpen(false);
      fetchData();
      if (histOpen && histMat && String(histMat.id) === move.material_id) openHistory(histMat);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Movement failed');
    } finally {
      setMoving(false);
    }
  };

  const openHistory = async (material) => {
    setHistMat(material);
    setHistOpen(true);
    setHistLoading(true);
    try {
      const res = await api.get(`/inventory/movements?site_id=${siteId}&material_id=${material.id}`);
      setMovements(res.data.movements || []);
    } catch { setMovements([]); }
    finally { setHistLoading(false); }
  };

  const archiveMaterial = async (material) => {
    if (!window.confirm(`Archive "${material.name}"? It will be hidden from active stock lists.`)) return;
    try { await api.put(`/inventory/materials/${material.id}`, { site_id: siteId, is_active: false }); toast.success('Material archived'); fetchData(); }
    catch (err) { toast.error(err.response?.data?.message || 'Archive failed'); }
  };

  if (!currentSite) {
    return <EmptyBlock icon={Boxes} title="Select a site to manage inventory" tall />;
  }

  const kpis = [
    { label: 'Materials', value: summary.material_count ?? 0, icon: Boxes, accent: 'bg-mr-blue-soft text-mr-blue' },
    { label: 'Inventory Value', value: `₹${fmt(summary.total_value)}`, icon: IndianRupee, accent: 'bg-mr-lime-soft text-mr-lime-ink' },
    { label: 'Low Stock', value: summary.low_stock_count ?? 0, icon: AlertTriangle, accent: 'bg-mr-coral-soft text-mr-coral-ink' },
  ];

  return (
    <div className="mx-auto w-full max-w-[1400px] pb-16">
      <PageHeader
        title="Inventory"
        description={`Stock, movements & vendor procurement${currentSite?.name ? ` · ${currentSite.name}` : ''}`}
        actions={tab === 'stock' && (
          <>
            <Button variant="outline" className="h-10 gap-2 rounded-control border-mr-line px-4 font-semibold" onClick={() => openMove(null)}><ArrowDownToLine className="w-4 h-4" /> Record Movement</Button>
            <button type="button" className={PRIMARY_BTN} onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" strokeWidth={2} /> New Material</button>
          </>
        )}
      />

      {canSeeProcurement && <VendorModuleTabs active={tab === 'procurement' ? 'procurement' : 'stocks'} className="mt-6" />}

      {tab === 'procurement' ? (
        <VendorInventory />
      ) : (<div className="mt-5 space-y-5">

      <dl className="grid grid-cols-3 divide-x divide-mr-line overflow-hidden rounded-panel border border-mr-line bg-mr-surface">
        {kpis.map((kpi) => {
          const KpiIcon = kpi.icon;
          return (
            <div key={kpi.label} className="flex items-center gap-3 px-4 py-4">
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', kpi.accent)}><KpiIcon className="h-4 w-4" strokeWidth={2} /></span>
              <div className="min-w-0">
                <dd className="text-xl font-semibold tabular-nums text-mr-text">{loading ? '—' : kpi.value}</dd>
                <dt className="text-[11px] font-medium text-mr-muted">{kpi.label}</dt>
              </div>
            </div>
          );
        })}
      </dl>

      <div className="flex items-center gap-0 border-b border-mr-line">
        {[{ label: 'All stock', active: !lowOnly, action: () => setLowOnly(false) }, { label: 'Low stock', active: lowOnly, action: () => setLowOnly(true) }].map((view) => (
          <button key={view.label} type="button" onClick={view.action} className={cn('-mb-px border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors', view.active ? 'border-mr-ink text-mr-text' : 'border-transparent text-mr-muted hover:text-mr-text')}>
            {view.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap border-b border-mr-line pb-1">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-mr-faint" />
          <Input placeholder="Search material, code, category…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-10 rounded-full border-mr-line bg-mr-surface-2 text-xs shadow-none focus-visible:bg-mr-surface" />
        </div>
        <button onClick={() => setLowOnly((v) => !v)}
          className={cn('px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
            lowOnly ? 'border-mr-coral-ink bg-mr-coral-ink text-white' : 'border-mr-line bg-mr-surface text-mr-muted hover:border-mr-faint')}>
          <AlertTriangle className="w-3 h-3 inline mr-1" /> Low stock only
        </button>
      </div>

      <div className="overflow-hidden rounded-panel border border-mr-line bg-mr-surface">
        {loading ? (
          <div className="space-y-3 p-5 sm:p-6">
            {[0, 1, 2, 3, 4].map((i) => <SkeletonBlock key={i} className="h-14 w-full" />)}
          </div>
        ) : materials.length === 0 ? (
          <EmptyState
            icon={PackageOpen}
            title="No materials yet"
            description="Add a material to start tracking stock."
            action={<Button variant="outline" size="sm" className="mt-1 border-mr-line" onClick={() => setCreateOpen(true)}><Plus className="w-3.5 h-3.5 mr-1" /> New Material</Button>}
          />
        ) : (
          <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 340px)' }}>
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-20 bg-zinc-900 text-zinc-300" style={{ boxShadow: '0 1px 0 0 var(--color-mr-line)' }}>
                <tr>
                  {['Material', 'Stock', 'Reserved', 'Available', 'Rate', 'Value', 'Min', ''].map((h, i) => (
                    <th key={i} className={cn('px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-300', i >= 2 && i <= 7 ? 'text-right' : 'text-left')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <TableRow key={m.id} className="group cursor-pointer border-mr-line hover:bg-mr-surface-2/70" onClick={() => openHistory(m)}>
                    <TableCell className="py-2.5"><MaterialCell name={m.name} code={m.code} category={m.category} /></TableCell>
                    <TableCell className="py-2.5"><StockLevelIndicator current={m.on_hand} minimum={m.min_stock} unit={m.unit} /></TableCell>
                    <TableCell className="text-right text-mr-blue tabular-nums">{Number(m.reserved) > 0 ? fmtQty(m.reserved) : <span className="text-mr-faint">—</span>}</TableCell>
                    <TableCell className="text-right font-semibold text-mr-text tabular-nums">{fmtQty(m.available)}</TableCell>
                    <TableCell className="text-right text-mr-muted tabular-nums">₹{fmt(m.rate)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-mr-text">₹{fmt(m.stock_value)}</TableCell>
                    <TableCell className="text-right text-xs text-mr-faint tabular-nums">{Number(m.min_stock) > 0 ? fmtQty(m.min_stock) : '—'}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-mr-faint opacity-70 group-hover:opacity-100" aria-label={`Actions for ${m.name}`}><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuLabel className="text-[11px] text-mr-faint">Material actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openHistory(m)}><History /> View stock history</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openMove(m)}><ArrowDownToLine /> Record movement</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-mr-coral-ink focus:text-mr-coral-ink" onClick={() => archiveMaterial(m)}><Trash2 /> Archive material</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      </div>)}

      {/* Create material */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>New Material</DialogTitle><DialogDescription>Add an item to the material master.</DialogDescription></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5"><Label className="text-xs">Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Cement OPC 43" required /></div>
              <div className="space-y-1.5"><Label className="text-xs">Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Optional" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Unit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="BAG / KG / CFT / NOS" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Optional" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Rate (₹)</Label><Input type="number" step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="0" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Min Stock (alert below)</Label><Input type="number" step="0.001" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} placeholder="0" /></div>
              <div className="col-span-2 space-y-1.5"><Label className="text-xs">Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}Add Material</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record movement */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Record Stock Movement</DialogTitle><DialogDescription>Receipt, adjustment, reservation or transfer.</DialogDescription></DialogHeader>
          <form onSubmit={handleMove} className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs">Material *</Label>
              <Select value={move.material_id || undefined} onValueChange={(v) => { const m = materials.find((x) => String(x.id) === v); setMove({ ...move, material_id: v, rate: m ? String(m.rate) : move.rate }); }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Pick material" /></SelectTrigger>
                <SelectContent>{materials.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name} <span className="text-slate-400">({fmtQty(m.on_hand)} {m.unit})</span></SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Type *</Label>
              <Select value={move.movement_type} onValueChange={(v) => setMove({ ...move, movement_type: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{MOVEMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-[11px] text-slate-400">{MOVEMENT_TYPES.find((t) => t.value === move.movement_type)?.hint}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Qty *{move.movement_type === 'ADJUSTMENT' && ' (±)'}</Label><Input type="number" step="0.001" value={move.qty} onChange={(e) => setMove({ ...move, qty: e.target.value })} placeholder="0" required /></div>
              <div className="space-y-1.5"><Label className="text-xs">Rate (₹)</Label><Input type="number" step="0.01" value={move.rate} onChange={(e) => setMove({ ...move, rate: e.target.value })} placeholder="0" /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Note</Label><Input value={move.note} onChange={(e) => setMove({ ...move, note: e.target.value })} placeholder="Optional — e.g. GRN #, PO ref" /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMoveOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={moving}>{moving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}Record</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* History drawer */}
      <Sheet open={histOpen} onOpenChange={setHistOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col gap-0">
          <SheetHeader className="shrink-0 border-b border-slate-100 px-6 py-4 text-left">
            <SheetTitle className="text-base">{histMat?.name}</SheetTitle>
            <SheetDescription>
              On hand <b className="text-slate-700">{fmtQty(histMat?.on_hand)}</b> · Available <b className="text-slate-700">{fmtQty(histMat?.available)}</b> · Value ₹{fmt(histMat?.stock_value)}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><History className="w-4 h-4 text-slate-400" /> Stock History</h3>
              {histMat && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openMove(histMat)}><ArrowDownToLine className="w-3.5 h-3.5 mr-1" /> Movement</Button>}
            </div>
            {histLoading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
            ) : movements.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No movements yet.</p>
            ) : (
              <div className="space-y-2">
                {movements.map((mv) => (
                  <div key={mv.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2.5">
                    <Badge variant="outline" className={cn('text-[10px] font-semibold shrink-0', MOVE_TONE[mv.movement_type] || 'bg-slate-50 text-slate-600 border-slate-200')}>{mv.movement_type}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 tabular-nums">{fmtQty(mv.qty)} {histMat?.unit} {Number(mv.rate) > 0 && <span className="text-slate-400 font-normal">@ ₹{fmt(mv.rate)}</span>}</p>
                      <p className="text-[11px] text-slate-400 truncate">{fmtDate(mv.created_at)}{mv.project_name ? ` · ${mv.project_name}` : ''}{mv.note ? ` · ${mv.note}` : ''}{mv.created_by_name ? ` · ${mv.created_by_name}` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
