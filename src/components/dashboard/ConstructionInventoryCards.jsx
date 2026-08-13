import { createElement } from 'react';
import { useQuery } from '@apollo/client/react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowUpRight, Boxes, HardHat, PackageOpen, Truck,
} from 'lucide-react';
import { GET_CONSTRUCTION_DASHBOARD, GET_INVENTORY_DASHBOARD } from '../../graphql/queries';
import { useAuth } from '../../context/AuthContext';
import { CurrencyValue, ErrorState, SkeletonBlock, StatusPill } from './primitives';
import { money, moneyCompact } from '@/lib/utils';

/* One row inside the shared surface — no card, no coloured tile. */
const Signal = ({ icon, label, value, attention, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-mr-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
  >
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
      attention ? 'border-mr-coral-ink/15 bg-mr-coral-soft text-mr-coral-ink' : 'border-mr-line text-mr-muted'
    }`}>
      {createElement(icon, { className: 'h-4 w-4', strokeWidth: 1.9, 'aria-hidden': 'true' })}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[12px] text-mr-muted">{label}</span>
      <span className="mt-0.5 block text-[14px] font-medium text-mr-text">{value}</span>
    </span>
    <ArrowUpRight className="h-4 w-4 text-mr-faint transition-colors group-hover:text-mr-text" strokeWidth={1.9} aria-hidden="true" />
  </button>
);

/* ── Delivery operations ─────────────────────────────────────────────
   Construction progress and material readiness in one surface. Both
   halves keep their own permission gate and their own query. ── */
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
  const overBudget = spent > 100;

  return (
    <section
      aria-labelledby="mr-delivery-title"
      className="overflow-hidden rounded-panel border border-mr-line bg-mr-surface"
    >
      <div className="border-b border-mr-line px-5 py-4 sm:px-6">
        <h2 id="mr-delivery-title" className="text-[15px] font-semibold tracking-[-0.01em] text-mr-text">Delivery operations</h2>
        <p className="mt-0.5 text-[12px] text-mr-muted">Project execution and material readiness</p>
      </div>

      <div className={`grid ${canConstruction && canInventory ? 'lg:grid-cols-2' : 'grid-cols-1'} divide-y divide-mr-line lg:divide-x lg:divide-y-0`}>
        {canConstruction && (
          <article className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[13px] font-semibold text-mr-text">Construction delivery</h3>
                <p className="mt-0.5 text-[12px] text-mr-muted">Average progress across active work</p>
              </div>
              <button type="button" onClick={() => navigate('/construction')} className="mr-press rounded-full px-2 py-1 text-[12px] font-semibold text-mr-blue hover:bg-mr-blue-soft">
                Open projects
              </button>
            </div>

            {constructionQuery.loading ? (
              <div className="mt-5 space-y-3">
                {[0, 1, 2].map((i) => <SkeletonBlock key={i} className="h-11 w-full" />)}
              </div>
            ) : constructionQuery.error ? (
              <ErrorState title="Construction signals could not be loaded" onRetry={() => constructionQuery.refetch()} />
            ) : (
              <>
                <div className="mt-5 grid gap-5 sm:grid-cols-[128px_minmax(0,1fr)]">
                  <button
                    type="button"
                    onClick={() => navigate('/construction')}
                    className="relative mx-auto h-32 w-32 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
                    aria-label={`${progress}% of active construction work complete`}
                  >
                    <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90" aria-hidden="true">
                      <circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--color-mr-line-strong)" strokeWidth="2.4" />
                      <circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--color-mr-text)" strokeWidth="2.4" strokeLinecap="round" pathLength="100" strokeDasharray={`${progress} ${100 - progress}`} />
                    </svg>
                    <span className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[26px] font-semibold tracking-[-0.04em] text-mr-text">{progress}%</span>
                      <span className="text-[12px] text-mr-faint">complete</span>
                    </span>
                  </button>
                  <div className="divide-y divide-mr-line">
                    <Signal icon={HardHat} label="Active projects" value={construction?.activeProjects ?? 0} onClick={() => navigate('/construction?status=ACTIVE')} />
                    <Signal icon={AlertTriangle} label="Delayed projects" value={construction?.delayedProjects ?? 0} attention={(construction?.delayedProjects ?? 0) > 0} onClick={() => navigate('/construction?status=DELAYED')} />
                    <Signal icon={PackageOpen} label="Pending material requests" value={construction?.pendingMaterialRequests ?? 0} onClick={() => navigate('/construction')} />
                  </div>
                </div>

                <div className="mt-5 border-t border-mr-line pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                    <span className="text-mr-muted">Budget consumption</span>
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-mr-text" title={`${money(actual)} of ${money(budget)}`}>
                        {moneyCompact(actual)} of {moneyCompact(budget)}
                      </span>
                      {overBudget && <StatusPill tone="negative">Over budget · {spent}%</StatusPill>}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-mr-surface-2">
                    <div
                      className={`h-full rounded-full transition-[width] duration-500 ${overBudget ? 'bg-mr-coral' : 'bg-mr-text'}`}
                      style={{ width: `${Math.min(spent, 100)}%` }}
                    />
                  </div>
                </div>
              </>
            )}
          </article>
        )}

        {canInventory && (
          <article className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[13px] font-semibold text-mr-text">Inventory readiness</h3>
                <p className="mt-0.5 text-[12px] text-mr-muted">Stock value, risk and incoming supply</p>
              </div>
              <button type="button" onClick={() => navigate('/inventory')} className="mr-press rounded-full px-2 py-1 text-[12px] font-semibold text-mr-blue hover:bg-mr-blue-soft">
                Open inventory
              </button>
            </div>

            {inventoryQuery.loading ? (
              <div className="mt-5 space-y-3">
                {[0, 1, 2].map((i) => <SkeletonBlock key={i} className="h-11 w-full" />)}
              </div>
            ) : inventoryQuery.error ? (
              <ErrorState title="Inventory signals could not be loaded" onRetry={() => inventoryQuery.refetch()} />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => navigate('/inventory')}
                  className="mt-5 w-full border-b border-mr-line pb-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
                >
                  <span className="block text-[12px] text-mr-muted">Current inventory value</span>
                  <CurrencyValue value={inventory?.totalValue} size="lg" className="mt-1" compactAbove={1e5} />
                </button>
                <div className="divide-y divide-mr-line">
                  <Signal icon={AlertTriangle} label="Low-stock materials" value={`${inventory?.lowStockCount ?? 0} need attention`} attention={(inventory?.lowStockCount ?? 0) > 0} onClick={() => navigate('/inventory?low=1')} />
                  <Signal icon={Truck} label="Pending vendor deliveries" value={`${inventory?.pendingVendorDeliveries ?? 0} expected`} onClick={() => navigate('/vendors/inventory')} />
                  <Signal icon={Boxes} label="Stock control" value="Review material ledger" onClick={() => navigate('/inventory')} />
                </div>
              </>
            )}
          </article>
        )}
      </div>
    </section>
  );
}
