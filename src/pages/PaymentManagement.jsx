import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { cn } from '../lib/utils';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  IndianRupee, AlertTriangle, CalendarClock, TrendingUp, Wallet, Bell, MapPin, CheckCircle2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, LabelList, Cell,
} from 'recharts';

// Chart colours — validated (dataviz method): single blue for collections,
// ordinal blue ramp for the overdue aging buckets.
const C_BLUE = '#2a78d6';
const AGING_RAMP = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab'];
const CHART_GRID = '#e2e8f0';
const CHART_INK = '#898781';
const compactINR = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
const fmtCompact = (v) => `₹${compactINR.format(parseFloat(v) || 0)}`;
const chartTooltipStyle = {
  borderRadius: 8, border: `1px solid ${CHART_GRID}`, fontSize: 12,
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
};
const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

// Per-metric accent colors for the KPI cards — a colored top strip + icon
// badge per card so the four tiles scan distinctly at a glance.
const KPI_COLORS = {
  sky:     { badge: 'bg-sky-100 text-sky-600',         accent: 'bg-sky-500' },
  red:     { badge: 'bg-red-100 text-red-600',         accent: 'bg-red-500' },
  amber:   { badge: 'bg-amber-100 text-amber-600',      accent: 'bg-amber-500' },
  emerald: { badge: 'bg-emerald-100 text-emerald-600',  accent: 'bg-emerald-500' },
};

const CARD_SHELL = 'rounded-2xl border-slate-200/80 shadow-sm shadow-slate-900/[0.04]';

export default function PaymentManagement() {
  const { currentSite } = useAuth();
  const siteId = currentSite?.id;
  const navigate = useNavigate();

  const [summary, setSummary] = useState({});
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reminderTotal, setReminderTotal] = useState(0);

  // Unfiltered overview — this page is analytics-only, so it always reflects
  // every plot, not whatever filter was last set on the All Plots table.
  const fetchOverview = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const res = await api.get(`/plots/payment-management?site_id=${siteId}`);
      setSummary(res.data.summary || {});
      setCollections(res.data.collections || []);
    } catch {
      // Overview is non-critical decoration for this page; fail quietly.
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  const fetchReminderCount = useCallback(async () => {
    if (!siteId) return;
    try {
      const res = await api.get(`/plots/payment-reminders?site_id=${siteId}&page=1&limit=1`);
      setReminderTotal(res.data.summary?.total || 0);
    } catch {
      setReminderTotal(0);
    }
  }, [siteId]);

  useEffect(() => { fetchOverview(); fetchReminderCount(); }, [fetchOverview, fetchReminderCount]);

  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-slate-400 gap-3">
        <IndianRupee className="w-10 h-10" />
        <p className="text-sm">Select a site to manage payments</p>
      </div>
    );
  }

  const agingData = [
    { bucket: '1–30 days', amount: summary.aging?.d1_30 || 0 },
    { bucket: '31–60 days', amount: summary.aging?.d31_60 || 0 },
    { bucket: '61–90 days', amount: summary.aging?.d61_90 || 0 },
    { bucket: '90+ days', amount: summary.aging?.d90_plus || 0 },
  ];
  const collectionsData = collections.map((c) => ({
    month: new Date(`${c.month}-01`).toLocaleDateString('en-IN', { month: 'short' }),
    amount: c.amount,
  }));
  const prevMonthAmt = collections.length > 1 ? collections[collections.length - 2].amount : null;
  const collectedDelta = prevMonthAmt > 0
    ? (((summary.collected_this_month || 0) - prevMonthAmt) / prevMonthAmt) * 100
    : null;

  const kpis = [
    {
      label: 'Outstanding', icon: Wallet, color: 'sky', value: `₹${fmt(summary.outstanding_amount)}`,
      sub: `across ${summary.total_count ?? 0} plots`,
    },
    {
      label: 'Overdue', icon: AlertTriangle, color: 'red', tone: 'text-red-600', value: `₹${fmt(summary.overdue_amount)}`,
      sub: `${summary.overdue_count ?? 0} plots${summary.interest_due > 0 ? ` · +₹${fmt(summary.interest_due)} interest` : ''}`,
    },
    {
      label: 'Due This Month', icon: CalendarClock, color: 'amber', value: `₹${fmt(summary.due_this_month_amount)}`,
      sub: `${summary.due_this_month_count ?? 0} installment${(summary.due_this_month_count ?? 0) === 1 ? '' : 's'}`,
    },
    {
      label: 'Collected This Month', icon: TrendingUp, color: 'emerald', tone: 'text-emerald-700', value: `₹${fmt(summary.collected_this_month)}`,
      sub: collectedDelta === null ? 'both payment sources' : 'vs last month',
      trend: collectedDelta,
    },
  ];

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Payment Tracker</h1>
          <p className="text-xs text-slate-500">
            Installments, collections & overdue interest{currentSite?.name ? ` · ${currentSite.name}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            className="h-11 gap-2 rounded-xl border-slate-200 px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() => navigate('/payment-management/reminders')}
          >
            <span className={cn('flex h-7 w-7 items-center justify-center rounded-full', reminderTotal > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600')}>
              <Bell className="w-3.5 h-3.5" />
            </span>
            Payment Reminders
            {reminderTotal > 0 && (
              <Badge variant="outline" className="h-5 min-w-5 justify-center rounded-full border-red-300 bg-red-100 px-1.5 text-[10px] font-bold text-red-700">
                {reminderTotal}
              </Badge>
            )}
          </Button>
          <Button
            className="h-11 gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold shadow-sm shadow-blue-600/25 hover:bg-blue-700"
            onClick={() => navigate('/payment-management/plots')}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
              <MapPin className="w-3.5 h-3.5" />
            </span>
            All Plots
          </Button>
        </div>
      </div>

      {/* ── KPI tiles (₹) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(({ label, icon: Icon, color, value, sub, tone, trend }) => (
          <Card key={label} className={cn('relative overflow-hidden transition-shadow hover:shadow-md', CARD_SHELL)}>
            <span className={cn('absolute inset-x-0 top-0 h-1', KPI_COLORS[color].accent)} />
            <CardContent className="p-4 pt-5">
              <div className="flex items-start justify-between">
                <span className={cn('flex h-9 w-9 items-center justify-center rounded-full', KPI_COLORS[color].badge)}>
                  <Icon className="w-4 h-4" />
                </span>
                {trend != null && (
                  <span className={cn(
                    'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                    trend >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  )}>
                    {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(0)}%
                  </span>
                )}
              </div>
              {loading ? (
                <div className="mt-3 h-7 w-24 animate-pulse rounded bg-slate-100" />
              ) : (
                <p className={cn('mt-3 text-2xl font-bold tracking-tight', tone || 'text-slate-900')}>{value}</p>
              )}
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
              <p className="mt-0.5 text-[11px] text-slate-400 truncate">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Analytics: collections trend + overdue aging ── */}
      <div className="grid lg:grid-cols-2 gap-3 items-start">
        <Card className={CARD_SHELL}>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold text-slate-800">Collections — last 6 months</h2>
            <p className="text-[11px] text-slate-400 mb-2">All plot & installment payments received</p>
            {collectionsData.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">No collections yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={collectionsData} margin={{ top: 18, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART_GRID} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: CHART_INK }} axisLine={{ stroke: CHART_GRID }} tickLine={false} />
                  <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11, fill: CHART_INK }} axisLine={false} tickLine={false} width={54} />
                  <ChartTooltip formatter={(v) => [`₹${fmt(v)}`, 'Collected']} contentStyle={chartTooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Bar dataKey="amount" fill={C_BLUE} barSize={26} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="amount" position="top" formatter={fmtCompact} style={{ fontSize: 10, fill: CHART_INK }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className={CARD_SHELL}>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold text-slate-800">Overdue aging</h2>
            <p className="text-[11px] text-slate-400 mb-2">How long overdue money has been outstanding</p>
            {(summary.overdue_amount || 0) <= 0 ? (
              <div className="py-10 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Nothing overdue — great!</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={agingData} layout="vertical" margin={{ top: 0, right: 56, left: 8, bottom: 0 }}>
                  <CartesianGrid horizontal={false} stroke={CHART_GRID} />
                  <XAxis type="number" tickFormatter={fmtCompact} tick={{ fontSize: 11, fill: CHART_INK }} axisLine={{ stroke: CHART_GRID }} tickLine={false} />
                  <YAxis type="category" dataKey="bucket" width={80} tick={{ fontSize: 11, fill: '#52514e' }} axisLine={false} tickLine={false} />
                  <ChartTooltip formatter={(v) => [`₹${fmt(v)}`, 'Overdue']} contentStyle={chartTooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Bar dataKey="amount" barSize={16} radius={[0, 4, 4, 0]}>
                    {agingData.map((_, i) => <Cell key={i} fill={AGING_RAMP[i]} />)}
                    <LabelList dataKey="amount" position="right" formatter={fmtCompact} style={{ fontSize: 10, fill: CHART_INK }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
