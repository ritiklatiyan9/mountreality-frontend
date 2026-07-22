import { memo } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_REVENUE_VS_EXPENSE, GET_PROFIT_TREND, GET_EXPENSES_BY_CATEGORY } from '../../graphql/queries';
import { Skeleton } from '../ui/skeleton';
import { BarChart3, Radar as RadarIcon, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, AreaChart, Area,
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
  <div className="space-y-3 p-2">
    <Skeleton className="h-4 w-36" />
    <Skeleton className="h-52 w-full rounded-xl" />
    <div className="flex gap-3">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-3 w-16" />
    </div>
  </div>
);

const ChartEmpty = () => (
  <div className="flex items-center justify-center py-16 text-xs text-slate-400">
    No data for this period
  </div>
);

/* ── Revenue vs Expense Bar Chart ── */
export const RevenueVsExpenseChart = memo(function RevenueVsExpenseChart({ siteId, range, resolution = 'MONTH', excludeOldPlots = false }) {
  const { data, loading } = useQuery(GET_REVENUE_VS_EXPENSE, {
    variables: { siteId: String(siteId), range, resolution, excludeOldPlots },
    skip: !siteId,
  });

  const chartData = data?.revenueVsExpense || [];
  // For YEAR resolution with many years, use wider bars
  const isYearly = resolution === 'YEAR';
  const barSize = isYearly ? Math.min(48, Math.max(16, Math.floor(560 / (chartData.length || 1)))) : undefined;

  return (
    <div className="relative overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.03]">
      <div className="relative p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600"><BarChart3 className="h-4.5 w-4.5" /></span>
          <div><span className="text-sm font-semibold text-slate-900">Revenue vs Expenses</span>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {isYearly ? 'Yearly totals' : resolution === 'DAY' ? 'Daily breakdown' : 'Monthly totals'}
          </p></div>
        </div>
        {loading ? (
          <ChartLoader />
        ) : chartData.length === 0 ? (
          <ChartEmpty />
        ) : (
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={2} barCategoryGap={isYearly ? '30%' : '20%'}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: isYearly ? 11 : 10, fill: '#64748b', fontWeight: isYearly ? 600 : 400 }}
                  axisLine={false}
                  tickLine={false}
                  interval={chartData.length > 20 ? Math.ceil(chartData.length / 12) - 1 : 0}
                />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={fmt} width={52} />
                <RechartsTooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', fontSize: 11 }}
                  formatter={(value, name) => [fmtTooltip(value), name]}
                  labelStyle={{ fontWeight: 600, color: '#334155' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={barSize} />
                <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={barSize} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
});

/* ── Profit Trend Area Chart ── */
export const ProfitTrendChart = memo(function ProfitTrendChart({ siteId, range, resolution = 'MONTH', excludeOldPlots = false }) {
  const { data, loading } = useQuery(GET_PROFIT_TREND, {
    variables: { siteId: String(siteId), range, resolution, excludeOldPlots },
    skip: !siteId,
  });

  const chartData = data?.profitTrend || [];
  const isYearly = resolution === 'YEAR';
  // Colour based on last value: green = positive, red = negative
  const lastVal = chartData.length ? chartData[chartData.length - 1]?.value ?? 0 : 0;
  const trendColor = lastVal >= 0 ? '#10b981' : '#f43f5e';
  const gradId = lastVal >= 0 ? 'profitGradPos' : 'profitGradNeg';

  return (
    <div className="relative overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.03]">
      <div className="relative p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><TrendingUp className="h-4.5 w-4.5" /></span>
          <div><span className="text-sm font-semibold text-slate-900">Profit Trend</span>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {isYearly ? 'Yearly net profit' : resolution === 'DAY' ? 'Daily net profit' : 'Monthly net profit'}
          </p></div>
        </div>
        {loading ? (
          <ChartLoader />
        ) : chartData.length === 0 ? (
          <ChartEmpty />
        ) : (
          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="profitGradPos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="profitGradNeg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: isYearly ? 11 : 10, fill: '#64748b', fontWeight: isYearly ? 600 : 400 }}
                  axisLine={false}
                  tickLine={false}
                  interval={chartData.length > 20 ? Math.ceil(chartData.length / 12) - 1 : 0}
                />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={fmt} width={52} />
                <RechartsTooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', fontSize: 11 }}
                  formatter={(value) => [fmtTooltip(value), 'Net Profit']}
                  labelStyle={{ fontWeight: 600, color: '#334155' }}
                />
                <Area
                  type={isYearly ? 'step' : 'monotone'}
                  dataKey="value"
                  stroke={trendColor}
                  strokeWidth={isYearly ? 3 : 2}
                  fillOpacity={1}
                  fill={`url(#${gradId})`}
                  dot={isYearly ? { r: 5, fill: trendColor, strokeWidth: 2, stroke: '#fff' } : { r: 2, fill: trendColor }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
});

/* ── Expense By Category Radar Chart (GraphQL version) ── */
export const ExpenseByCategoryRadar = memo(function ExpenseByCategoryRadar({ siteId, range }) {
  const { data, loading } = useQuery(GET_EXPENSES_BY_CATEGORY, {
    variables: { siteId: String(siteId), range, top: 8 },
    skip: !siteId,
  });

  const chartData = data?.expensesByCategory || [];

  return (
    <div className="relative overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.03]">
      <div className="relative p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600"><RadarIcon className="h-4.5 w-4.5" /></span>
          <div><span className="text-sm font-semibold text-slate-900">Expense Radar</span>
          <p className="text-[10px] text-slate-400 mt-0.5">Top categories by spend</p></div>
        </div>
        {loading ? (
          <ChartLoader />
        ) : chartData.length === 0 ? (
          <ChartEmpty />
        ) : (
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis
                  dataKey="category"
                  tick={{ fontSize: 9, fill: '#64748b' }}
                  tickFormatter={(v) => v.length > 10 ? v.slice(0, 9) + '…' : v}
                />
                <PolarRadiusAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(0)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                <Radar name="Expense" dataKey="amount" stroke="#f43f5e" strokeWidth={2} fill="#f43f5e" fillOpacity={0.15} dot={{ r: 3, fill: '#f43f5e', strokeWidth: 0 }} />
                <RechartsTooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', fontSize: 11 }}
                  formatter={(value) => [`₹${fmtFull(value)}`, 'Expense']}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
});
