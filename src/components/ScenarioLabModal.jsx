import { useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import { Sparkles, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';

const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

const fmtINR = (v) => {
  const n = Math.round(Number(v) || 0);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)}L`;
  return `${sign}₹${abs.toLocaleString('en-IN')}`;
};

const SCENARIOS = [
  { key: 'conservative', label: 'Conservative', text: 'text-amber-700', bg: 'bg-amber-50/70 border-amber-200' },
  { key: 'base', label: 'Base', text: 'text-indigo-700', bg: 'bg-indigo-50/70 border-indigo-200' },
  { key: 'optimistic', label: 'Optimistic', text: 'text-emerald-700', bg: 'bg-emerald-50/70 border-emerald-200' },
];

/**
 * "Cash Possibility Lab" — a pure client-side what-if lens over the
 * forecast.months[].scenarios data FinanceForecast.jsx already has loaded.
 * No new backend call: same offset/lowest/deficit-count math pattern the
 * page itself uses for its own scenarioAgg/overrideOffset.
 *
 * The parent remounts this component (via a changing `key`) each time it's
 * opened with a new seed, so the opening-cash/start-month fields below are
 * computed once as lazy initial state rather than reset from an effect.
 */
export default function ScenarioLabModal({ open, onOpenChange, forecast, initialOpeningCash, initialAmount, onApply }) {
  const [openingCash, setOpeningCash] = useState(() => {
    const base = initialOpeningCash != null ? Number(initialOpeningCash) : Number(forecast?.currentCash) || 0;
    const withAmount = base + (initialAmount ? Number(initialAmount) : 0);
    return String(round2(withAmount));
  });
  const [startMonth, setStartMonth] = useState('current');

  const openingCashNum = openingCash === '' ? (Number(forecast?.currentCash) || 0) : (Number(openingCash) || 0);

  const monthsIncluded = useMemo(() => {
    if (!forecast?.months?.length) return [];
    return startMonth === 'next' ? forecast.months.slice(1) : forecast.months;
  }, [forecast, startMonth]);

  const comparison = useMemo(() => {
    if (!monthsIncluded.length || !forecast) return [];
    const offset = round2(openingCashNum - (Number(forecast.currentCash) || 0));

    return SCENARIOS.map(({ key, label, text, bg }) => {
      let lowest = openingCashNum;
      let deficitCount = 0;
      let firstDeficit = null;
      let strongest = null;
      let weakest = null;
      const months = [];

      for (const m of monthsIncluded) {
        const s = m.scenarios[key];
        const closing = round2(s.projectedClosingCash + offset);
        if (closing < lowest) lowest = closing;
        if (closing < 0) {
          deficitCount += 1;
          if (!firstDeficit) firstDeficit = m.label;
        }
        if (!strongest || s.net > strongest.net) strongest = { label: m.label, net: s.net };
        if (!weakest || s.net < weakest.net) weakest = { label: m.label, net: s.net };
        months.push({ key: m.key, label: m.label, closing, net: s.net });
      }

      const last = months[months.length - 1];
      return {
        key, label, text, bg,
        closingCash: last?.closing ?? openingCashNum,
        lowest, deficitCount, firstDeficit, strongest, weakest, months,
      };
    });
  }, [monthsIncluded, openingCashNum, forecast]);

  const handleApply = (key) => {
    onApply?.({ scenario: key, openingOverride: openingCashNum, horizonMonths: forecast?.months?.length });
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-indigo-600" /> Cash Possibility Lab
          </DialogTitle>
          <DialogDescription>
            Compare conservative, base, and optimistic outcomes month by month.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-500">
            Opening cash
            <Input
              type="number"
              className="h-9 w-40 text-sm"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              placeholder={fmtINR(forecast?.currentCash)}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-500">
            Start from
            <Select value={startMonth} onValueChange={setStartMonth}>
              <SelectTrigger className="h-9 w-40 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current month</SelectItem>
                <SelectItem value="next">Next month</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <p className="ml-auto max-w-[220px] text-[10px] leading-4 text-slate-400">
            This is a what-if lens only — it recomputes instantly from the forecast already loaded, nothing is saved until you apply it.
          </p>
        </div>

        {comparison.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No forecast months available to compare.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {comparison.map((col) => (
              <div key={col.key} className={`flex flex-col rounded-2xl border-2 p-3 ${col.bg}`}>
                <p className={`text-xs font-semibold ${col.text}`}>{col.label}</p>

                <p className="mt-2 text-[10px] font-medium text-slate-500">Projected closing cash</p>
                <p className={`text-xl font-bold tabular-nums ${col.closingCash < 0 ? 'text-rose-600' : col.text}`}>{fmtINR(col.closingCash)}</p>

                <div className="mt-3 space-y-1.5 text-[11px] text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Lowest point</span>
                    <span className={`font-semibold tabular-nums ${col.lowest < 0 ? 'text-rose-600' : ''}`}>{fmtINR(col.lowest)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Deficit months</span>
                    <span className="font-semibold tabular-nums">{col.deficitCount}</span>
                  </div>
                  {col.strongest && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Strongest</span>
                      <span className="font-semibold">{col.strongest.label}</span>
                    </div>
                  )}
                  {col.weakest && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Weakest</span>
                      <span className="font-semibold">{col.weakest.label}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 max-h-32 space-y-1 overflow-y-auto rounded-lg border border-white/60 bg-white/60 p-1.5">
                  {col.months.map((m) => (
                    <div key={m.key} className="flex items-center justify-between px-1 text-[10px] text-slate-500">
                      <span>{m.label}</span>
                      <span className={`tabular-nums font-medium ${m.closing < 0 ? 'text-rose-600' : 'text-slate-700'}`}>{fmtINR(m.closing)}</span>
                    </div>
                  ))}
                </div>

                <Button type="button" size="sm" variant="outline" className="mt-3 h-8 rounded-full text-xs" onClick={() => handleApply(col.key)}>
                  Apply to forecast
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
