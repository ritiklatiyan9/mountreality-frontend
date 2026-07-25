import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useCountUp, prefersReducedMotion } from '@/hooks/useCountUp';

/* ── Entrance motion ─────────────────────────────────────────────────
   Figures count up and bars fill once, when the value they represent
   first arrives. Both are decoration over data that is already correct:
   the count lands exactly on the real number and the bar's final width
   is the real percentage, so a reader who arrives late — or who has
   reduced motion on — sees exactly what everyone else sees. ── */

/* `value` is a percentage. It is clamped, because a bar wider than its
   track would overstate the figure it is drawn from. */
export function ProgressBar({ value, tone = 'bg-mr-ink', track = 'bg-mr-surface-2', height = 'h-2', label, className }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const [width, setWidth] = useState(() => (prefersReducedMotion() ? pct : 0));

  useEffect(() => {
    // Next frame, so the browser has a zero-width start state to grow from.
    const raf = requestAnimationFrame(() => setWidth(pct));
    return () => cancelAnimationFrame(raf);
  }, [pct]);

  return (
    <div
      className={cn('overflow-hidden rounded-full', track, height, className)}
      role="img"
      aria-label={label || `${pct.toFixed(1)}%`}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-[900ms] ease-out', tone)}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

/* Number text that counts up. `format` keeps the caller's own formatter,
   so an animated figure is written exactly like a static one. */
export function CountUp({ value, format = (n) => Math.round(n).toLocaleString('en-IN'), duration, className, title }) {
  const n = useCountUp(value, duration);
  return <span className={cn('tabular-nums', className)} title={title}>{format(n)}</span>;
}
