import { useEffect, useRef, useState } from 'react';

/* ── Count-up ────────────────────────────────────────────────────────
   Animates a figure up from where it last settled. Decoration over data
   that is already correct: the final frame is set to the exact target,
   never a rounded approximation, so the number on screen always matches
   the number in the payload once the animation ends.

   Honours prefers-reduced-motion by starting at the target and never
   animating — index.css disables CSS transitions under that setting, but
   a JS-driven count is not a CSS transition and has to opt out itself. ── */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const easeOutCubic = (t) => 1 - (1 - t) ** 3;

export function useCountUp(value, duration = 900) {
  const target = Number(value) || 0;
  const [display, setDisplay] = useState(() => (prefersReducedMotion() ? target : 0));
  const fromRef = useRef(prefersReducedMotion() ? target : 0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return undefined;

    if (prefersReducedMotion()) {
      fromRef.current = target;
      // Deferred so the effect never sets state synchronously.
      const id = requestAnimationFrame(() => setDisplay(target));
      return () => cancelAnimationFrame(id);
    }

    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(t === 1 ? target : from + (target - from) * easeOutCubic(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}
