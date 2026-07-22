import { createElement } from 'react';
import { useQuery } from '@apollo/client/react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowUpRight, Boxes, HardHat, IndianRupee, PackageOpen,
  Scale, TrendingUp, Truck,
} from 'lucide-react';
import { GET_CONSTRUCTION_DASHBOARD, GET_INVENTORY_DASHBOARD } from '../../graphql/queries';
import { useAuth } from '../../context/AuthContext';

const compactINR = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
const money = (value) => `₹${compactINR.format(Number(value) || 0)}`;

const Signal = ({ icon, tone, label, value, onClick }) => (
  <button type="button" onClick={onClick} className="group flex w-full items-center gap-3 py-3 text-left">
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}>{createElement(icon, { className: 'h-4 w-4' })}</span>
    <span className="min-w-0 flex-1"><span className="block text-[10px] text-slate-400">{label}</span><span className="mt-0.5 block text-sm font-semibold text-slate-800">{value}</span></span>
    <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 transition-colors group-hover:text-slate-600" />
  </button>
);

const LoadingLine = () => <div className="h-10 animate-pulse rounded-xl bg-slate-100" />;

export default function ConstructionInventoryCards({ siteId }) {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const canConstruction = hasPermission('construction', 'read');
  const canInventory = hasPermission('inventory', 'read');
  const constructionQuery = useQuery(GET_CONSTRUCTION_DASHBOARD, { variables: { siteId: String(siteId) }, skip: !siteId || !canConstruction });
  const inventoryQuery = useQuery(GET_INVENTORY_DASHBOARD, { variables: { siteId: String(siteId) }, skip: !siteId || !canInventory });

  if (!canConstruction && !canInventory) return null;

  const construction = constructionQuery.data?.constructionDashboard;
  const inventory = inventoryQuery.data?.inventoryDashboard;
  const progress = Math.min(100, Math.max(0, Number(construction?.avgProgress) || 0));
  const budget = Number(construction?.totalBudget) || 0;
  const actual = Number(construction?.totalActualCost) || 0;
  const spent = budget > 0 ? Math.round((actual / budget) * 100) : 0;

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.03]">
      <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600"><HardHat className="h-4.5 w-4.5" /></span><div><h2 className="text-sm font-semibold text-slate-950">Delivery operations</h2><p className="text-[10px] text-slate-400">Project execution and material readiness in one board</p></div></div>
        <span className="hidden rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 sm:inline">Live signals</span>
      </header>

      <div className={`grid ${canConstruction && canInventory ? 'lg:grid-cols-2' : 'grid-cols-1'} divide-y divide-slate-100 lg:divide-x lg:divide-y-0`}>
        {canConstruction && (
          <article className="p-5">
            <div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-slate-700">Construction delivery</p><p className="mt-0.5 text-[10px] text-slate-400">Average progress across active work</p></div><button type="button" onClick={() => navigate('/construction')} className="text-[10px] font-semibold text-blue-600 hover:text-blue-700">Open projects</button></div>
            {constructionQuery.loading ? <div className="mt-5 space-y-3"><LoadingLine /><LoadingLine /><LoadingLine /></div> : constructionQuery.error ? <p className="py-12 text-center text-xs text-red-500">Construction signals could not be loaded.</p> : (
              <div className="mt-5 grid gap-5 sm:grid-cols-[150px_minmax(0,1fr)]">
                <button type="button" onClick={() => navigate('/construction')} className="relative mx-auto h-36 w-36">
                  <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90" aria-hidden="true"><circle cx="21" cy="21" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3" /><circle cx="21" cy="21" r="15.9" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" pathLength="100" strokeDasharray={`${progress} ${100 - progress}`} /></svg>
                  <span className="absolute inset-0 flex flex-col items-center justify-center"><TrendingUp className="h-4 w-4 text-emerald-500" /><span className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{progress}%</span><span className="text-[9px] text-slate-400">work complete</span></span>
                </button>
                <div className="divide-y divide-slate-100">
                  <Signal icon={HardHat} tone="bg-emerald-50 text-emerald-600" label="Active projects" value={construction?.activeProjects ?? 0} onClick={() => navigate('/construction?status=ACTIVE')} />
                  <Signal icon={AlertTriangle} tone="bg-rose-50 text-rose-600" label="Delayed projects" value={construction?.delayedProjects ?? 0} onClick={() => navigate('/construction?status=DELAYED')} />
                  <Signal icon={PackageOpen} tone="bg-amber-50 text-amber-600" label="Pending material requests" value={construction?.pendingMaterialRequests ?? 0} onClick={() => navigate('/construction')} />
                </div>
              </div>
            )}
            {!constructionQuery.loading && !constructionQuery.error && <div className="mt-5 border-t border-slate-100 pt-4"><div className="flex items-center justify-between text-[10px]"><span className="inline-flex items-center gap-1 text-slate-500"><Scale className="h-3.5 w-3.5" /> Budget consumption</span><span className={`font-semibold ${spent > 100 ? 'text-rose-600' : 'text-slate-700'}`}>{money(actual)} of {money(budget)}{spent > 100 ? ` · ${spent}%` : ''}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${spent > 100 ? 'bg-rose-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(spent, 100)}%` }} /></div></div>}
          </article>
        )}

        {canInventory && (
          <article className="p-5">
            <div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-slate-700">Inventory readiness</p><p className="mt-0.5 text-[10px] text-slate-400">Stock value, risk and incoming supply</p></div><button type="button" onClick={() => navigate('/inventory')} className="text-[10px] font-semibold text-blue-600 hover:text-blue-700">Open inventory</button></div>
            {inventoryQuery.loading ? <div className="mt-5 space-y-3"><LoadingLine /><LoadingLine /><LoadingLine /></div> : inventoryQuery.error ? <p className="py-12 text-center text-xs text-red-500">Inventory signals could not be loaded.</p> : (
              <>
                <button type="button" onClick={() => navigate('/inventory')} className="mt-5 flex w-full items-end justify-between border-b border-slate-100 pb-5 text-left"><span><span className="block text-[10px] text-slate-400">Current inventory value</span><span className="mt-1 block text-3xl font-bold tracking-[-0.04em] text-slate-950">{money(inventory?.totalValue)}</span></span><span className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600"><IndianRupee className="h-5 w-5" /></span></button>
                <div className="divide-y divide-slate-100">
                  <Signal icon={AlertTriangle} tone="bg-rose-50 text-rose-600" label="Low-stock materials" value={`${inventory?.lowStockCount ?? 0} need attention`} onClick={() => navigate('/inventory?low=1')} />
                  <Signal icon={Truck} tone="bg-indigo-50 text-indigo-600" label="Pending vendor deliveries" value={`${inventory?.pendingVendorDeliveries ?? 0} expected`} onClick={() => navigate('/vendors/inventory')} />
                  <Signal icon={Boxes} tone="bg-cyan-50 text-cyan-600" label="Stock control" value="Review material ledger" onClick={() => navigate('/inventory')} />
                </div>
              </>
            )}
          </article>
        )}
      </div>
    </section>
  );
}
