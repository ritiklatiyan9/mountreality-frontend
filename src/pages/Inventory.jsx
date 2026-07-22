import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import VendorInventory from './VendorInventory';
import api from '../api/api';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { Card, CardContent } from '../components/ui/card';
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
  Boxes, Plus, Search, Loader2, IndianRupee, PackageOpen, AlertTriangle,
  ArrowDownToLine, History, Trash2,
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
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'procurement' ? 'procurement' : 'stock';
  const [search, setSearch] = useState('');
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
    setLoading(true);
    try {
      const params = new URLSearchParams({ site_id: siteId });
      if (search) params.set('search', search);
      if (lowOnly) params.set('low_stock', 'true');
      const [mRes, sRes] = await Promise.all([
        api.get(`/inventory/materials?${params}`),
        api.get(`/inventory/summary?site_id=${siteId}`),
      ]);
      setMaterials(mRes.data.materials || []);
      setSummary(sRes.data.summary || {});
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [siteId, search, lowOnly]);

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

  const delMaterial = async (material) => {
    if (!window.confirm(`Delete "${material.name}"?`)) return;
    try { await api.delete(`/inventory/materials/${material.id}`); toast.success('Deleted'); fetchData(); }
    catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-slate-400 gap-3">
        <Boxes className="w-10 h-10" />
        <p className="text-sm">Select a site to manage inventory</p>
      </div>
    );
  }

  const kpis = [
    { label: 'Materials', value: summary.material_count ?? 0, icon: Boxes, color: 'bg-sky-100 text-sky-600' },
    { label: 'Inventory Value', value: `₹${fmt(summary.total_value)}`, icon: IndianRupee, color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Low Stock', value: summary.low_stock_count ?? 0, icon: AlertTriangle, color: 'bg-red-100 text-red-600' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Inventory</h1>
          <p className="text-xs text-slate-500">Stock, movements & vendor procurement{currentSite?.name ? ` · ${currentSite.name}` : ''}</p>
        </div>
        <div className={cn('flex items-center gap-2', tab !== 'stock' && 'hidden')}>
          <Button variant="outline" className="h-10 gap-2 rounded-xl px-4 font-semibold" onClick={() => openMove(null)}><ArrowDownToLine className="w-4 h-4" /> Record Movement</Button>
          <Button className="h-10 gap-2 rounded-xl bg-blue-600 px-4 font-semibold shadow-sm shadow-blue-600/25 hover:bg-blue-700" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> New Material</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="rounded-2xl border-slate-200/80 shadow-sm shadow-slate-900/[0.04]">
            <CardContent className="p-4 flex items-center gap-3">
              <span className={cn('flex h-10 w-10 items-center justify-center rounded-full', color)}><Icon className="w-4 h-4" /></span>
              <div><p className="text-xl font-bold text-slate-900">{loading ? '—' : value}</p><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {canSeeProcurement && (
        <div className="flex items-center gap-1 border-b border-slate-200">
          {[{ id: 'stock', label: 'Stock' }, { id: 'procurement', label: 'Vendor Procurement' }].map((t) => (
            <button
              key={t.id}
              onClick={() => setSearchParams(t.id === 'stock' ? {} : { tab: t.id }, { replace: true })}
              className={cn('px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors',
                tab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800')}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'procurement' ? <VendorInventory embedded /> : (<>

      <Card className="rounded-2xl border-slate-200/80 shadow-sm shadow-slate-900/[0.04]">
        <CardContent className="p-3 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input placeholder="Search material, code, category…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
          </div>
          <button onClick={() => setLowOnly((v) => !v)}
            className={cn('px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
              lowOnly ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400')}>
            <AlertTriangle className="w-3 h-3 inline mr-1" /> Low stock only
          </button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-slate-200/80 shadow-sm shadow-slate-900/[0.04]">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : materials.length === 0 ? (
            <div className="text-center py-16">
              <PackageOpen className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No materials yet</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setCreateOpen(true)}><Plus className="w-3.5 h-3.5 mr-1" /> New Material</Button>
            </div>
          ) : (
            <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 340px)' }}>
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-20 bg-slate-50" style={{ boxShadow: '0 1px 0 0 #e2e8f0' }}>
                  <tr>
                    {['Material', 'Unit', 'On Hand', 'Reserved', 'Available', 'Rate', 'Value', 'Min', ''].map((h, i) => (
                      <th key={i} className={cn('text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2', i >= 2 && i <= 7 ? 'text-right' : 'text-left')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => (
                    <TableRow key={m.id} className="group cursor-pointer" onClick={() => openHistory(m)}>
                      <TableCell className="py-2.5">
                        <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-1">
                          {m.name}
                          {m.is_low_stock && <Badge variant="outline" className="text-[9px] bg-red-50 text-red-600 border-red-200">Low</Badge>}
                        </div>
                        {m.category && <div className="text-[11px] text-slate-400">{m.category}</div>}
                      </TableCell>
                      <TableCell className="text-slate-500 text-xs">{m.unit}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{fmtQty(m.on_hand)}</TableCell>
                      <TableCell className="text-right text-indigo-600 tabular-nums">{Number(m.reserved) > 0 ? fmtQty(m.reserved) : <span className="text-slate-300">—</span>}</TableCell>
                      <TableCell className="text-right font-semibold text-slate-800 tabular-nums">{fmtQty(m.available)}</TableCell>
                      <TableCell className="text-right text-slate-500 tabular-nums">₹{fmt(m.rate)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">₹{fmt(m.stock_value)}</TableCell>
                      <TableCell className="text-right text-xs text-slate-400 tabular-nums">{Number(m.min_stock) > 0 ? fmtQty(m.min_stock) : '—'}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5 opacity-70 group-hover:opacity-100">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Record movement" onClick={() => openMove(m)}><ArrowDownToLine className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="History" onClick={() => openHistory(m)}><History className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Delete" onClick={() => delMaterial(m)}><Trash2 className="w-3.5 h-3.5 text-red-400" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      </>)}

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
