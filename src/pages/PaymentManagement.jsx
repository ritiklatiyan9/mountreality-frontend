import { createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SitePolicyContext } from '../context/SitePolicyContext';
import api from '../api/api';
import { cn } from '../lib/utils';
import { getPropertyTerminology, unitCountLabel } from '../lib/propertyTerminology';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import PaymentAnalytics from './PaymentAnalytics';
import {
  AlertTriangle, BarChart3, Bell, CalendarClock, CheckCircle2,
  IndianRupee, LayoutDashboard, MapPin, TrendingUp, Wallet,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer,
  Tooltip as ChartTooltip, XAxis, YAxis,
} from 'recharts';

const C_BLUE = '#2a78d6';
const AGING_RAMP = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab'];
const CHART_GRID = '#e2e8f0';
const CHART_INK = '#898781';
const compactINR = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
const fmtCompact = (value) => `₹${compactINR.format(parseFloat(value) || 0)}`;
const fmt = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const chartTooltipStyle = {
  borderRadius: 10,
  border: `1px solid ${CHART_GRID}`,
  fontSize: 12,
  boxShadow: '0 10px 30px rgba(15,23,42,0.1)',
};

const VIEW_OPTIONS = [
  { value: 'overview', label: 'Overview', icon: LayoutDashboard },
  { value: 'analytics', label: 'Analysis', icon: BarChart3 },
];

export default function PaymentManagement() {
  const { currentSite } = useAuth();
  const sitePolicy = useContext(SitePolicyContext);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const siteId = currentSite?.id;
  const view = searchParams.get('view') === 'analytics' ? 'analytics' : 'overview';
  const propertyTerms = useMemo(
    () => getPropertyTerminology(sitePolicy),
    [sitePolicy],
  );

  const [summary, setSummary] = useState({});
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reminderTotal, setReminderTotal] = useState(0);

  const fetchOverview = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/plots/payment-management?site_id=${siteId}`);
      setSummary(data.summary || {});
      setCollections(data.collections || []);
    } catch {
      setSummary({});
      setCollections([]);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  const fetchReminderCount = useCallback(async () => {
    if (!siteId) return;
    try {
      const { data } = await api.get(`/plots/payment-reminders?site_id=${siteId}&page=1&limit=1`);
      setReminderTotal(data.summary?.total || 0);
    } catch {
      setReminderTotal(0);
    }
  }, [siteId]);

  useEffect(() => {
    fetchReminderCount();
  }, [fetchReminderCount]);

  useEffect(() => {
    if (view === 'overview') fetchOverview();
  }, [fetchOverview, view]);

  const changeView = (nextView) => {
    const next = new URLSearchParams(searchParams);
    if (nextView === 'overview') next.delete('view');
    else next.set('view', nextView);
    setSearchParams(next, { replace: true });
  };

  if (!currentSite) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-mr-faint">
        <IndianRupee className="h-10 w-10" />
        <p className="text-sm">Select a Site to manage payments</p>
      </div>
    );
  }

  const agingData = [
    { bucket: '1–30 days', amount: summary.aging?.d1_30 || 0 },
    { bucket: '31–60 days', amount: summary.aging?.d31_60 || 0 },
    { bucket: '61–90 days', amount: summary.aging?.d61_90 || 0 },
    { bucket: '90+ days', amount: summary.aging?.d90_plus || 0 },
  ];
  const collectionsData = collections.map((collection) => ({
    month: new Date(`${collection.month}-01`).toLocaleDateString('en-IN', { month: 'short' }),
    amount: collection.amount,
  }));
  const previousMonth = collections.length > 1 ? collections[collections.length - 2].amount : null;
  const collectedDelta = previousMonth > 0
    ? (((summary.collected_this_month || 0) - previousMonth) / previousMonth) * 100
    : null;

  const metrics = [
    {
      label: 'Outstanding', icon: Wallet, value: `₹${fmt(summary.outstanding_amount)}`,
      helper: unitCountLabel(summary.total_count, propertyTerms), tone: 'text-mr-text',
    },
    {
      label: 'Overdue', icon: AlertTriangle, value: `₹${fmt(summary.overdue_amount)}`,
      helper: `${unitCountLabel(summary.overdue_count, propertyTerms)}${summary.interest_due > 0 ? ` · ₹${fmt(summary.interest_due)} interest` : ''}`,
      tone: 'text-rose-600',
    },
    {
      label: 'Due this month', icon: CalendarClock, value: `₹${fmt(summary.due_this_month_amount)}`,
      helper: `${summary.due_this_month_count ?? 0} installment${Number(summary.due_this_month_count) === 1 ? '' : 's'}`,
      tone: 'text-amber-700',
    },
    {
      label: 'Collected this month', icon: TrendingUp, value: `₹${fmt(summary.collected_this_month)}`,
      helper: collectedDelta == null ? 'Across approved receipts' : `${collectedDelta >= 0 ? '+' : ''}${collectedDelta.toFixed(0)}% vs last month`,
      tone: 'text-emerald-700',
    },
  ];

  return (
    <div className="-mx-4 -mt-4 min-w-0 bg-mr-surface md:-mx-6 md:-mt-6">
      <header className="border-b border-mr-line px-4 pb-0 pt-5 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[clamp(1.5rem,2.6vw,2rem)] font-semibold tracking-[-0.035em] text-mr-text">Payments workspace</h1>
              <Badge variant="outline" className="rounded-full border-mr-line bg-mr-surface-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-mr-muted">
                {propertyTerms.isMixedUse ? 'Mixed-use portfolio' : `${propertyTerms.singular} portfolio`}
              </Badge>
            </div>
            <p className="mt-1 text-[13px] text-mr-muted">
              Collections, outstanding balances and payment analysis for <span className="font-medium text-mr-text">{currentSite.name}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/payment-management/reminders')} className="h-9 rounded-full border-mr-line px-3 text-xs">
              <Bell className="mr-1.5 h-3.5 w-3.5" /> Reminders
              {reminderTotal > 0 && <span className="ml-1.5 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">{reminderTotal}</span>}
            </Button>
            <Button onClick={() => navigate('/payment-management/plots')} className="h-9 rounded-full bg-mr-ink px-4 text-xs hover:bg-mr-ink-2">
              <MapPin className="mr-1.5 h-3.5 w-3.5" /> All {propertyTerms.plural}
            </Button>
          </div>
        </div>
        <nav className="flex gap-6" aria-label="Payments workspace views">
          {VIEW_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => changeView(value)}
              className={cn(
                'flex items-center gap-2 border-b-2 px-0.5 py-3 text-sm font-semibold transition-colors',
                view === value ? 'border-blue-600 text-blue-700' : 'border-transparent text-mr-muted hover:text-mr-text',
              )}
              aria-current={view === value ? 'page' : undefined}
            >
              {createElement(Icon, { className: 'h-4 w-4' })} {label}
            </button>
          ))}
        </nav>
      </header>

      {view === 'analytics' ? (
        <PaymentAnalytics embedded />
      ) : (
        <main>
          <section className="grid border-b border-mr-line bg-mr-line sm:grid-cols-2 xl:grid-cols-4" aria-label="Payment summary">
            {metrics.map(({ label, icon: Icon, value, helper, tone }) => (
              <div key={label} className="bg-mr-surface px-4 py-5 md:px-6">
                <div className="flex items-center gap-2 text-mr-muted">
                  {createElement(Icon, { className: 'h-3.5 w-3.5' })}
                  <p className="text-[10px] font-semibold uppercase tracking-[0.13em]">{label}</p>
                </div>
                {loading ? <div className="mt-3 h-7 w-28 animate-pulse rounded bg-mr-surface-2" /> : <p className={cn('mt-2 text-xl font-semibold tabular-nums tracking-tight', tone)}>{value}</p>}
                <p className="mt-1 truncate text-[11px] text-mr-faint">{helper}</p>
              </div>
            ))}
          </section>

          <section className="grid divide-y divide-mr-line border-b border-mr-line lg:grid-cols-2 lg:divide-x lg:divide-y-0">
            <div className="min-w-0 px-4 py-5 md:px-6">
              <h2 className="text-sm font-semibold text-mr-text">Collection trend</h2>
              <p className="mt-0.5 text-[11px] text-mr-faint">Approved receipts across the last six months</p>
              {collectionsData.length === 0 ? (
                <p className="py-14 text-center text-sm text-mr-faint">No collections yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={collectionsData} margin={{ top: 28, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={CHART_GRID} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: CHART_INK }} axisLine={{ stroke: CHART_GRID }} tickLine={false} />
                    <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11, fill: CHART_INK }} axisLine={false} tickLine={false} width={54} />
                    <ChartTooltip formatter={(value) => [`₹${fmt(value)}`, 'Collected']} contentStyle={chartTooltipStyle} cursor={{ fill: 'rgba(15,23,42,0.03)' }} />
                    <Bar dataKey="amount" fill={C_BLUE} barSize={26} radius={[5, 5, 0, 0]}>
                      <LabelList dataKey="amount" position="top" formatter={fmtCompact} style={{ fontSize: 10, fill: CHART_INK }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="min-w-0 px-4 py-5 md:px-6">
              <h2 className="text-sm font-semibold text-mr-text">Overdue aging</h2>
              <p className="mt-0.5 text-[11px] text-mr-faint">How long scheduled money has remained outstanding</p>
              {(summary.overdue_amount || 0) <= 0 ? (
                <div className="py-14 text-center">
                  <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
                  <p className="text-sm font-medium text-mr-muted">No overdue installments</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={agingData} layout="vertical" margin={{ top: 12, right: 64, left: 8, bottom: 0 }}>
                    <CartesianGrid horizontal={false} stroke={CHART_GRID} />
                    <XAxis type="number" tickFormatter={fmtCompact} tick={{ fontSize: 11, fill: CHART_INK }} axisLine={{ stroke: CHART_GRID }} tickLine={false} />
                    <YAxis type="category" dataKey="bucket" width={82} tick={{ fontSize: 11, fill: '#52514e' }} axisLine={false} tickLine={false} />
                    <ChartTooltip formatter={(value) => [`₹${fmt(value)}`, 'Overdue']} contentStyle={chartTooltipStyle} cursor={{ fill: 'rgba(15,23,42,0.03)' }} />
                    <Bar dataKey="amount" barSize={16} radius={[0, 5, 5, 0]}>
                      {agingData.map((item, index) => <Cell key={item.bucket} fill={AGING_RAMP[index]} />)}
                      <LabelList dataKey="amount" position="right" formatter={fmtCompact} style={{ fontSize: 10, fill: CHART_INK }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
