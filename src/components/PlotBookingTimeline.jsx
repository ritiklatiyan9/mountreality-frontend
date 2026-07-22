import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import {
  CheckCircle2,
  Circle,
  Clock,
  MapPin,
  ArrowUpRight,
  ArrowDownLeft,
  ExternalLink,
  User,
} from 'lucide-react';

/**
 * Amazon-parcel-style horizontal progress tracker for a plot that has been
 * resold across multiple bookings. Each "stop" is a booking cycle (a distinct
 * buyer + agent). Tap a stop to reveal its commission ledger and to pay /
 * recover money from that booking's agent(s) — including previous agents.
 *
 * `timeline` is ordered oldest → newest.
 */
export default function PlotBookingTimeline({
  timeline = [],
  grand,
  currentPlotId,
  siteId,
  navigate,
  canWrite,
  onPay,
  formatCurrency,
  formatDate,
}) {
  if (!timeline || timeline.length <= 1) return null;

  const settledOf = (t) =>
    t.total_commission > 0 && t.total_paid_all >= t.total_commission - 0.5;

  const grandCommission = grand?.total_commission ?? 0;
  const grandGiven = grand?.total_paid_all ?? 0;
  const grandPending = grand?.balance ?? grandCommission - grandGiven;
  const overallPct =
    grandCommission > 0
      ? Math.min(Math.round((grandGiven / grandCommission) * 100), 100)
      : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Heading */}
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4 pb-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
          <MapPin className="h-4 w-4" />
        </div>
        <h2 className="text-sm font-semibold text-slate-800">Plot Journey</h2>
        <Badge variant="outline" className="border-slate-200 px-1.5 py-0 text-[10px] text-slate-500">
          {timeline.length} bookings
        </Badge>
        <span className="ml-auto text-[11px] text-slate-400">Tap a stop for details &amp; payouts</span>
      </div>

      {/* Parcel-style horizontal tracker */}
      <div className="overflow-x-auto px-4 pb-2">
        <div
          className="grid min-w-max items-start gap-0 pt-3"
          style={{ gridTemplateColumns: `repeat(${timeline.length}, minmax(116px, 1fr))` }}
        >
          {timeline.map((t, idx) => {
            const settled = settledOf(t);
            const isCurrent = t.plot_id === currentPlotId;
            const started = t.total_paid_all > 0 || settled;
            const prevSettled = idx > 0 && settledOf(timeline[idx - 1]);

            const nodeCls = settled
              ? 'bg-emerald-500 border-emerald-400 text-white'
              : started
              ? 'bg-amber-500 border-amber-400 text-white'
              : 'bg-white border-slate-300 text-slate-400';

            return (
              <div key={t.plot_id} className="relative flex flex-col items-center">
                {/* Connector to previous node (drawn left of this node) */}
                {idx > 0 && (
                  <span
                    className={`absolute top-[18px] right-1/2 h-1 w-full ${
                      prevSettled ? 'bg-emerald-400' : 'bg-slate-200'
                    }`}
                  />
                )}

                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="group relative z-10 flex flex-col items-center focus:outline-none"
                    >
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-full border-2 shadow-sm transition-transform group-hover:scale-110 ${nodeCls} ${
                          isCurrent ? 'ring-4 ring-blue-200' : ''
                        }`}
                      >
                        {settled ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : started ? (
                          <span className="text-xs font-bold">{idx + 1}</span>
                        ) : (
                          <Circle className="h-4 w-4" />
                        )}
                      </span>
                      <span className="mt-2 max-w-[108px] truncate text-[11px] font-semibold text-slate-700">
                        {t.buyer_name || 'No buyer'}
                      </span>
                      <span className="max-w-[108px] truncate text-[10px] text-slate-400">
                        {t.agent_names || '—'}
                      </span>
                      <span className="mt-0.5 text-[11px] font-bold tabular-nums text-slate-600">
                        ₹{formatCurrency(t.total_commission)}
                      </span>
                      {isCurrent && (
                        <Badge className="mt-1 border-blue-200 bg-blue-100 px-1 py-0 text-[8px] text-blue-700" variant="outline">
                          CURRENT
                        </Badge>
                      )}
                    </button>
                  </PopoverTrigger>

                  <PopoverContent align="center" className="w-72 p-0" sideOffset={8}>
                    <BookingDetailCard
                      booking={t}
                      isCurrent={isCurrent}
                      settled={settled}
                      canWrite={canWrite}
                      onPay={onPay}
                      siteId={siteId}
                      navigate={navigate}
                      formatCurrency={formatCurrency}
                      formatDate={formatDate}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            );
          })}
        </div>
      </div>

      {/* Plot-wide rollup footer */}
      <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3">
        <div className="mb-2 flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Whole plot — all {timeline.length} bookings combined
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <RollupStat label="Commission" value={`₹${formatCurrency(grandCommission)}`} tone="slate" />
          <RollupStat label="Given" value={`₹${formatCurrency(grandGiven)}`} tone="emerald" />
          <RollupStat label="Pending" value={`₹${formatCurrency(Math.abs(grandPending))}`} tone={grandPending > 0.5 ? 'amber' : 'emerald'} />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${overallPct}%` }} />
          </div>
          <span className="text-[10px] font-medium tabular-nums text-slate-500">{overallPct}%</span>
        </div>
      </div>
    </div>
  );
}

function RollupStat({ label, value, tone }) {
  const toneCls = {
    slate: 'text-slate-800',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
  }[tone];
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-0.5 text-sm font-bold tabular-nums ${toneCls}`}>{value}</p>
    </div>
  );
}

function BookingDetailCard({
  booking,
  isCurrent,
  settled,
  canWrite,
  onPay,
  siteId,
  navigate,
  formatCurrency,
  formatDate,
}) {
  const agents = booking.agents_detail || [];
  return (
    <div className="text-sm">
      {/* Header */}
      <div className="rounded-t-md border-b border-slate-100 bg-slate-50/80 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold text-slate-800">{booking.buyer_name || 'No buyer'}</span>
          {isCurrent && (
            <Badge className="border-blue-200 bg-blue-100 px-1 py-0 text-[8px] text-blue-700" variant="outline">CURRENT</Badge>
          )}
          <Badge
            variant="outline"
            className={`ml-auto px-1.5 py-0 text-[9px] uppercase ${
              settled
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : booking.total_paid_all > 0
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}
          >
            {settled ? 'Settled' : booking.total_paid_all > 0 ? 'Partial' : 'Pending'}
          </Badge>
        </div>
        <p className="mt-1 text-[10px] text-slate-400">Booked {formatDate(booking.first_created)}</p>
      </div>

      {/* Booking totals */}
      <div className="grid grid-cols-3 gap-px bg-slate-100 text-center">
        <div className="bg-white px-1 py-1.5">
          <p className="text-[8px] uppercase text-slate-400">Comm.</p>
          <p className="text-[11px] font-bold tabular-nums text-slate-700">₹{formatCurrency(booking.total_commission)}</p>
        </div>
        <div className="bg-white px-1 py-1.5">
          <p className="text-[8px] uppercase text-slate-400">Given</p>
          <p className="text-[11px] font-bold tabular-nums text-emerald-700">₹{formatCurrency(booking.total_paid_all)}</p>
        </div>
        <div className="bg-white px-1 py-1.5">
          <p className="text-[8px] uppercase text-slate-400">Pending</p>
          <p className="text-[11px] font-bold tabular-nums text-amber-700">₹{formatCurrency(Math.abs(booking.balance))}</p>
        </div>
      </div>

      {/* Per-agent rows + actions */}
      <div className="max-h-56 space-y-2 overflow-y-auto p-3">
        {agents.map((a) => {
          const aPct = a.total_commission > 0 ? Math.min(Math.round((a.total_paid_all / a.total_commission) * 100), 100) : 0;
          const aSettled = a.status === 'Completed' || (a.total_commission > 0 && a.total_paid_all >= a.total_commission - 0.5);
          return (
            <div key={a.commission_id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-2">
              <div className="flex items-center gap-1.5">
                <User className="h-3 w-3 shrink-0 text-slate-400" />
                <span className="truncate text-[12px] font-semibold text-slate-700">{a.agent_name}</span>
                <span className="ml-auto text-[10px] tabular-nums text-slate-400">{aPct}%</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200">
                  <div className={`h-full rounded-full ${aSettled ? 'bg-emerald-500' : a.total_paid_all > 0 ? 'bg-amber-400' : 'bg-slate-300'}`} style={{ width: `${aPct}%` }} />
                </div>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500">
                <span>Given <strong className="text-emerald-600">₹{formatCurrency(a.total_paid_all)}</strong></span>
                <span>Due <strong className="text-amber-600">₹{formatCurrency(Math.abs(a.balance))}</strong></span>
              </div>
              {canWrite && (
                <div className="mt-2 flex items-center gap-1.5">
                  {!aSettled && (
                    <Button
                      size="sm"
                      className="h-6 flex-1 bg-emerald-600 px-1 text-[10px] hover:bg-emerald-700"
                      onClick={() => onPay(a.commission_id, 'pay', a)}
                    >
                      <ArrowUpRight className="mr-0.5 h-3 w-3" /> Pay
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 flex-1 border-cyan-200 px-1 text-[10px] text-cyan-700 hover:bg-cyan-50 disabled:opacity-50"
                    disabled={(parseFloat(a.total_paid_all) || 0) <= 0}
                    onClick={() => onPay(a.commission_id, 'get', a)}
                  >
                    <ArrowDownLeft className="mr-0.5 h-3 w-3" /> Get
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* View this booking */}
      {!isCurrent && (
        <div className="border-t border-slate-100 p-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-full text-[11px] text-slate-600"
            onClick={() => navigate(`/plot-commission/plot/${booking.plot_id}?site_id=${siteId}`)}
          >
            <ExternalLink className="mr-1 h-3 w-3" /> Open this booking
          </Button>
        </div>
      )}
    </div>
  );
}
