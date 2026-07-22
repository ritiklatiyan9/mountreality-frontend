import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BarChart3, AreaChart, PieChart, TrendingDown, LineChart, Activity, FileText } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { playMoneyCount } from '../../lib/moneySound';

const MotionDiv = motion.div;

const fmt = (v) => {
  const n = parseFloat(v) || 0;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

/** Pick a text-size class that keeps the value inside the card */
const valueSizeClass = (formatted) => {
  const len = formatted.length;
  if (len <= 10) return 'text-2xl sm:text-3xl';
  if (len <= 14) return 'text-xl sm:text-2xl';
  if (len <= 18) return 'text-lg sm:text-xl';
  return 'text-base sm:text-lg';
};

/** rAF ease-out count-up — animates value changes without re-render storms.
 *  onStart fires only when a real count animation begins (value actually changed). */
function useCountUp(target, { duration = 900, disabled = false, onStart } = {}) {
  const [display, setDisplay] = useState(disabled ? target : 0);
  const fromRef = useRef(0);
  const activeTarget = useRef(target);
  const onStartRef = useRef(onStart);
  useEffect(() => { onStartRef.current = onStart; }, [onStart]);
  useEffect(() => {
    if (disabled) {
      fromRef.current = target;
      const frame = requestAnimationFrame(() => setDisplay(target));
      return () => cancelAnimationFrame(frame);
    }
    const from = fromRef.current;
    const to = target;
    activeTarget.current = to;
    if (from === to) return undefined;
    onStartRef.current?.();
    let raf;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1 && activeTarget.current === to) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, disabled]);
  return display;
}

const CARD_DEFS = {
  totalIncoming: {
    label: 'Total Incoming',
    formula: 'Approved ledger credits in the selected period',
    Icon: BarChart3,
    positive: true,
    colorPos: { accent: '#3b82f6', border: 'border-blue-200/60', bg: 'bg-linear-to-br from-blue-50 via-white to-indigo-50', iconBg: 'bg-linear-to-br from-blue-500 to-indigo-600', valueTxt: 'text-blue-700', tagBg: 'bg-blue-100 text-blue-700', curve: 'rgba(59,130,246,0.08)', curve2: 'rgba(59,130,246,0.05)' },
  },
  plotPayments: {
    label: 'Plot Payments',
    formula: 'SUM(plot_payments + installment_payments)',
    Icon: AreaChart,
    positive: true,
    colorPos: { accent: '#10b981', border: 'border-emerald-200/60', bg: 'bg-linear-to-br from-emerald-50 via-white to-teal-50', iconBg: 'bg-linear-to-br from-emerald-500 to-teal-600', valueTxt: 'text-emerald-700', tagBg: 'bg-emerald-100 text-emerald-700', curve: 'rgba(16,185,129,0.08)', curve2: 'rgba(16,185,129,0.05)' },
  },
  personalLedger: {
    label: 'Personal Ledger',
    formula: 'Person Ledger: Given / Received',
    Icon: PieChart,
    dynamic: true,
    colorPos: { accent: '#f59e0b', border: 'border-amber-200/60', bg: 'bg-linear-to-br from-amber-50 via-white to-yellow-50', iconBg: 'bg-linear-to-br from-amber-500 to-orange-500', valueTxt: 'text-amber-700', tagBg: 'bg-amber-100 text-amber-700', tagLabel: 'To Receive', curve: 'rgba(245,158,11,0.08)', curve2: 'rgba(245,158,11,0.05)' },
    colorNeg: { accent: '#ef4444', border: 'border-red-200/60', bg: 'bg-linear-to-br from-rose-50 via-white to-red-50', iconBg: 'bg-linear-to-br from-rose-500 to-red-600', valueTxt: 'text-red-700', tagBg: 'bg-red-100 text-red-700', tagLabel: 'To Give', curve: 'rgba(239,68,68,0.08)', curve2: 'rgba(239,68,68,0.05)' },
  },
  totalExpense: {
    label: 'Total Expenses',
    formula: 'Approved farmer + expense + commission + vendor + orphan Day Book rows',
    Icon: TrendingDown,
    positive: false,
    colorNeg: { accent: '#ef4444', border: 'border-red-200/60', bg: 'bg-linear-to-br from-red-50 via-white to-rose-50', iconBg: 'bg-linear-to-br from-rose-500 to-red-600', valueTxt: 'text-red-700', tagBg: 'bg-red-100 text-red-700', curve: 'rgba(239,68,68,0.08)', curve2: 'rgba(239,68,68,0.05)' },
  },
  profit: {
    label: 'Profit',
    formula: 'Plot Payments − Expenses',
    Icon: LineChart,
    dynamic: true,
    colorPos: { accent: '#10b981', border: 'border-emerald-200/60', bg: 'bg-linear-to-br from-emerald-50 via-white to-teal-50', iconBg: 'bg-linear-to-br from-emerald-500 to-teal-600', valueTxt: 'text-emerald-700', tagBg: 'bg-emerald-100 text-emerald-700', tagLabel: 'Positive', curve: 'rgba(16,185,129,0.08)', curve2: 'rgba(16,185,129,0.05)' },
    colorNeg: { accent: '#ef4444', border: 'border-red-200/60', bg: 'bg-linear-to-br from-red-50 via-white to-rose-50', iconBg: 'bg-linear-to-br from-rose-500 to-red-600', valueTxt: 'text-red-700', tagBg: 'bg-red-100 text-red-700', tagLabel: 'Negative', curve: 'rgba(239,68,68,0.08)', curve2: 'rgba(239,68,68,0.05)' },
  },
  registryPayments: {
    label: 'Registry Payments',
    formula: 'Mapped approved plot receipts in the selected period. Informational only; never added to incoming or outgoing.',
    Icon: FileText,
    positive: true,
    colorPos: { accent: '#8b5cf6', border: 'border-violet-200/60', bg: 'bg-linear-to-br from-violet-50 via-white to-fuchsia-50', iconBg: 'bg-linear-to-br from-violet-500 to-fuchsia-600', valueTxt: 'text-violet-700', tagBg: 'bg-violet-100 text-violet-700', tagLabel: 'Registry', curve: 'rgba(139,92,246,0.08)', curve2: 'rgba(139,92,246,0.05)' },
  },
  siteBalance: {
    label: 'Site Balance',
    formula: 'Opening Balance + Total Incoming − Total Outgoing',
    Icon: Activity,
    dynamic: true,
    colorPos: { accent: '#06b6d4', border: 'border-cyan-200/60', bg: 'bg-linear-to-br from-cyan-50 via-white to-sky-50', iconBg: 'bg-linear-to-br from-cyan-500 to-sky-600', valueTxt: 'text-cyan-700', tagBg: 'bg-cyan-100 text-cyan-700', tagLabel: 'Positive', curve: 'rgba(6,182,212,0.08)', curve2: 'rgba(6,182,212,0.05)' },
    colorNeg: { accent: '#ef4444', border: 'border-red-200/60', bg: 'bg-linear-to-br from-rose-50 via-white to-red-50', iconBg: 'bg-linear-to-br from-rose-500 to-red-600', valueTxt: 'text-red-700', tagBg: 'bg-red-100 text-red-700', tagLabel: 'Negative', curve: 'rgba(239,68,68,0.08)', curve2: 'rgba(239,68,68,0.05)' },
  },
};

function KpiCard({ kpiKey, value, loading, onClick, subtitle, details, sound = false }) {
  const def = CARD_DEFS[kpiKey];
  const reducedMotion = useReducedMotion();
  const numVal = parseFloat(value) || 0;
  const animated = useCountUp(loading ? 0 : numVal, {
    disabled: !!reducedMotion || !!loading,
    onStart: sound ? () => playMoneyCount(900) : undefined,
  });
  if (!def) return null;

  const isPositive = def.positive != null ? def.positive : numVal >= 0;
  const colors = isPositive ? (def.colorPos || def.colorNeg) : (def.colorNeg || def.colorPos);
  const { Icon } = def;

  const shown = loading ? numVal : animated;
  const formatted = `${numVal < 0 ? '-' : ''}₹${fmt(Math.abs(shown))}`;
  const sizeClass = valueSizeClass(`${numVal < 0 ? '-' : ''}₹${fmt(Math.abs(numVal))}`);

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={reducedMotion ? undefined : { y: -2 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="group relative h-full min-h-[210px] cursor-pointer overflow-hidden rounded-[22px] border border-transparent bg-white transition-colors duration-300 hover:border-slate-200 hover:bg-slate-50/70"
      onClick={onClick}
      style={{ '--kpi-accent': colors.accent }}
    >
      {/* Restrained accent and micro trend */}
      <span
        className="absolute bottom-5 left-5 top-5 w-[3px] rounded-full opacity-70"
        style={{ background: colors.accent }}
      />
      <svg className="pointer-events-none absolute right-4 top-20 h-10 w-24 opacity-60" viewBox="0 0 96 40" preserveAspectRatio="none" aria-hidden="true">
        <path d="M2 32 C18 28, 22 12, 38 20 S62 34, 72 15 S86 8, 94 4" fill="none" stroke={colors.accent} strokeWidth="2" strokeLinecap="round" />
        <path d="M2 32 C18 28, 22 12, 38 20 S62 34, 72 15 S86 8, 94 4 L94 40 L2 40 Z" fill={colors.curve} />
      </svg>

      <div className="relative flex h-full flex-col py-4 pl-8 pr-4 sm:py-5 sm:pr-5">
        <div className="mb-4 flex min-h-10 items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white shadow-sm transition-transform duration-300 group-hover:scale-105 ${colors.iconBg}`}
              style={{ boxShadow: `0 7px 18px -10px ${colors.accent}` }}
            >
              <Icon className="h-4.5 w-4.5" />
            </div>
            <span className="truncate text-xs font-semibold text-slate-600">{def.label}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {colors.tagLabel && (
              <span className={`text-[9px] sm:text-[10px] font-semibold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full whitespace-nowrap ${colors.tagBg}`}>
                {colors.tagLabel}
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2.5 flex-1">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
        ) : (
          <div className="flex flex-1 flex-col min-w-0">
            <p className={`${sizeClass} font-bold tabular-nums tracking-[-0.035em] leading-tight break-all text-slate-950`}>
              {formatted}
            </p>
            <p className="mt-1.5 truncate text-[9px] text-slate-400" title={def.formula}>{def.formula}</p>
            {subtitle && <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1 truncate" title={subtitle}>{subtitle}</p>}
            {details && (
              <div className="mt-auto pt-2 space-y-0.5">
                {details.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] sm:text-[11px] gap-1">
                    <span className="text-slate-500 truncate">{d.label}</span>
                    <span className={`font-semibold tabular-nums whitespace-nowrap ${d.color || 'text-slate-700'}`}>{d.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </MotionDiv>
  );
}

export default KpiCard;
