import { memo } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_REVENUE_VS_EXPENSE, GET_PROFIT_TREND, GET_EXPENSES_BY_CATEGORY } from '../../graphql/queries';
import { Skeleton } from '../ui/skeleton';
import { ErrorState } from './primitives';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';

const fmt = (v) => {
  const n = parseFloat(v) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}${(abs / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `${sign}${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(0)}K`;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

const fmtTooltip = (v) => {
  const n = parseFloat(v) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const fmtFull = (v) => parseFloat(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const ChartLoader = () => (
  <div className="space-y-3">
    <Skeleton className="h-52 w-full rounded-xl" />
    <div className="flex gap-3">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-3 w-16" />
    </div>
  </div>
);

const ChartEmpty = () => (
  <div className="flex items-center justify-center py-16 text-[12px] text-mr-faint">
    No data for this period
  </div>
);

/* Shared chart shell — one surface, no icon tile, no inner shadow. */
const ChartPanel = ({ title, subtitle, legend, children }) => (
  <section className="rounded-panel border border-mr-line bg-mr-surface p-5 sm:p-6">
    <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-mr-text">{title}</h2>
        <p className="mt-0.5 text-[12px] text-mr-muted">{subtitle}</p>
      </div>
      {legend && <div className="flex items-center gap-4 text-[12px] text-mr-muted">{legend}</div>}
    </div>
    {children}
  </section>
);

/* Direct-labelled legend key — replaces Recharts' default legend. */
const LegendKey = ({ color, children }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden="true" />
    {children}
  </span>
);

const TOOLTIP_STYLE = {
  borderRadius: 14,
  border: '1px solid rgba(16,17,20,0.08)',
  boxShadow: '0 8px 24px rgba(16,17,20,0.08)',
  fontSize: 12,
  padding: '8px 10px',
};

const AXIS_TICK = { fontSize: 11, fill: '#98a0ad' };
const AQUA = '#15803d';   // credit / incoming
const CORAL = '#dc2626';  // debit / outgoing
const LIME = '#15803d';   // positive profit

/* ── Revenue vs Expense Bar Chart ── */
export const RevenueVsExpenseChart = memo(function RevenueVsExpenseChart({ siteId, range, resolution = 'MONTH', excludeOldPlots = false }) {
  const { data, loading, error, refetch } = useQuery(GET_REVENUE_VS_EXPENSE, {
    variables: { siteId: String(siteId), range, resolution, excludeOldPlots },
    skip: !siteId,
  });

  const chartData = data?.revenueVsExpense || [];
  // For YEAR resolution with many years, use wider bars
  const isYearly = resolution === 'YEAR';
  const barSize = isYearly ? Math.min(48, Math.max(16, Math.floor(560 / (chartData.length || 1)))) : undefined;

  return (
    <ChartPanel
      title="Incoming vs outgoing"
      subtitle={isYearly ? 'Yearly totals' : resolution === 'DAY' ? 'Daily breakdown' : 'Monthly totals'}
      legend={chartData.length > 0 && (
        <>
          <LegendKey color={AQUA}>Revenue</LegendKey>
          <LegendKey color={CORAL}>Expense</LegendKey>
        </>
      )}
    >
      {loading ? (
        <ChartLoader />
      ) : error ? (
        <ErrorState title="This chart could not be loaded" onRetry={() => refetch()} />
      ) : chartData.length === 0 ? (
        <ChartEmpty />
      ) : (
        <div className="mr-rise h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={3} barCategoryGap={isYearly ? '30%' : '22%'}>
              <CartesianGrid stroke="rgba(16,17,20,0.06)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                interval={chartData.length > 20 ? Math.ceil(chartData.length / 12) - 1 : 0}
              />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={fmt} width={52} />
              <RechartsTooltip
                cursor={{ fill: 'rgba(16,17,20,0.04)' }}
                contentStyle={TOOLTIP_STYLE}
                formatter={(value, name) => [fmtTooltip(value), name]}
                labelStyle={{ fontWeight: 600, color: '#101114' }}
              />
              <Bar dataKey="revenue" name="Revenue" fill={AQUA} radius={[6, 6, 0, 0]} maxBarSize={barSize} isAnimationActive animationBegin={80} animationDuration={800} animationEasing="ease-out" />
              <Bar dataKey="expense" name="Expense" fill={CORAL} radius={[6, 6, 0, 0]} maxBarSize={barSize} isAnimationActive animationBegin={160} animationDuration={800} animationEasing="ease-out" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartPanel>
  );
});

/* ── Profit Trend Area Chart ── */
export const ProfitTrendChart = memo(function ProfitTrendChart({ siteId, range, resolution = 'MONTH', excludeOldPlots = false }) {
  const { data, loading, error, refetch } = useQuery(GET_PROFIT_TREND, {
    variables: { siteId: String(siteId), range, resolution, excludeOldPlots },
    skip: !siteId,
  });

  const chartData = data?.profitTrend || [];
  const isYearly = resolution === 'YEAR';
  // Colour based on last value: green = positive, red = negative
  const lastVal = chartData.length ? chartData[chartData.length - 1]?.value ?? 0 : 0;
  const trendColor = lastVal >= 0 ? LIME : CORAL;
  const gradId = lastVal >= 0 ? 'profitGradPos' : 'profitGradNeg';

  return (
    <ChartPanel
      title="Profit trend"
      subtitle={isYearly ? 'Yearly net profit' : resolution === 'DAY' ? 'Daily net profit' : 'Monthly net profit'}
      legend={chartData.length > 0 && (
        <LegendKey color={trendColor}>{lastVal >= 0 ? 'In surplus' : 'In deficit'}</LegendKey>
      )}
    >
      {loading ? (
        <ChartLoader />
      ) : error ? (
        <ErrorState title="This chart could not be loaded" onRetry={() => refetch()} />
      ) : chartData.length === 0 ? (
        <ChartEmpty />
      ) : (
        <div className="mr-rise h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="profitGradPos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={LIME} stopOpacity={0.30} />
                  <stop offset="95%" stopColor={LIME} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="profitGradNeg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CORAL} stopOpacity={0.26} />
                  <stop offset="95%" stopColor={CORAL} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(16,17,20,0.06)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                interval={chartData.length > 20 ? Math.ceil(chartData.length / 12) - 1 : 0}
              />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={fmt} width={52} />
              <RechartsTooltip
                cursor={{ stroke: 'rgba(16,17,20,0.16)' }}
                contentStyle={TOOLTIP_STYLE}
                formatter={(value) => [fmtTooltip(value), 'Net profit']}
                labelStyle={{ fontWeight: 600, color: '#101114' }}
              />
              <Area
                type={isYearly ? 'step' : 'monotone'}
                dataKey="value"
                stroke={trendColor}
                strokeWidth={2.25}
                strokeLinecap="round"
                fillOpacity={1}
                fill={`url(#${gradId})`}
                dot={isYearly ? { r: 4, fill: trendColor, strokeWidth: 2, stroke: '#fff' } : false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                isAnimationActive
                animationBegin={80}
                animationDuration={900}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartPanel>
  );
});

/* ── Expense By Category Radar Chart (GraphQL version) ── */
export const ExpenseByCategoryRadar = memo(function ExpenseByCategoryRadar({ siteId, range }) {
  const { data, loading, error, refetch } = useQuery(GET_EXPENSES_BY_CATEGORY, {
    variables: { siteId: String(siteId), range, top: 8 },
    skip: !siteId,
  });

  const chartData = data?.expensesByCategory || [];

  return (
    <ChartPanel title="Spend by category" subtitle="Top expense categories in this period">
      {loading ? (
        <ChartLoader />
      ) : error ? (
        <ErrorState title="This chart could not be loaded" onRetry={() => refetch()} />
      ) : chartData.length === 0 ? (
        <ChartEmpty />
      ) : (
        <div className="mr-rise h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="72%" data={chartData}>
              <PolarGrid stroke="rgba(16,17,20,0.08)" />
              <PolarAngleAxis
                dataKey="category"
                tick={{ fontSize: 12, fill: '#626b7a' }}
                tickFormatter={(v) => v.length > 12 ? `${v.slice(0, 11)}…` : v}
              />
              <PolarRadiusAxis
                tick={{ fontSize: 11, fill: '#98a0ad' }}
                tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(0)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
              />
              <Radar
                name="Expense"
                dataKey="amount"
                stroke={CORAL}
                strokeWidth={2}
                strokeLinejoin="round"
                fill={CORAL}
                fillOpacity={0.12}
                dot={{ r: 3, fill: CORAL, strokeWidth: 0 }}
                isAnimationActive
                animationBegin={80}
                animationDuration={900}
                animationEasing="ease-out"
              />
              <RechartsTooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [`₹${fmtFull(value)}`, 'Expense']} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartPanel>
  );
});
