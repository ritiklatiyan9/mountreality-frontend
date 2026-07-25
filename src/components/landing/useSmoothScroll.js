import { useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';

/* ── Smooth (Locomotive-style) scrolling ─────────────────────────────
   Eases the NATIVE window scroll toward a target instead of transforming
   a wrapper element. That distinction matters: Locomotive v4's transform
   approach breaks `position: sticky`, and this page has a sticky header.

   Deliberately inert when any of these hold — in each case the native
   scroll is already better than anything we can fake:
     · prefers-reduced-motion
     · coarse pointer (phones already have real momentum scrolling)
     · the user is dragging the scrollbar or using keys (we only hook wheel)

   ponytail: ~40 lines instead of the locomotive-scroll dependency, which
   ships its own RAF loop, resize observers and a transform wrapper we
   would have to fight. Swap it in if the feel needs tuning beyond EASE. */
const EASE = 0.22;         // 0 = never arrives, 1 = no smoothing (higher = snappier)
const SPEED = 1.15;        // wheel delta multiplier — covers ground faster
const SETTLE = 0.4;        // px below which we snap and stop the loop

export function useSmoothScroll(enabled = true) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!enabled || reduceMotion) return undefined;
    if (typeof window === 'undefined') return undefined;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined;

    let target = window.scrollY;
    let current = window.scrollY;
    let frame = 0;
    let running = false;

    const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;

    const tick = () => {
      current += (target - current) * EASE;
      if (Math.abs(target - current) < SETTLE) {
        current = target;
        running = false;
        window.scrollTo(0, current);
        return;
      }
      window.scrollTo(0, current);
      frame = requestAnimationFrame(tick);
    };

    const onWheel = (event) => {
      // Let the browser handle zoom, horizontal intent and scrollable children.
      if (event.ctrlKey || event.defaultPrevented) return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (event.target?.closest?.('[data-native-scroll]')) return;

      event.preventDefault();
      target = Math.max(0, Math.min(maxScroll(), target + event.deltaY * SPEED));
      if (!running) {
        running = true;
        current = window.scrollY;
        frame = requestAnimationFrame(tick);
      }
    };

    // Anything that moves the page by other means (keyboard, scrollbar,
    // anchor, find-in-page) resyncs the target so we never fight it.
    const resync = () => { if (!running) { target = window.scrollY; current = window.scrollY; } };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('scroll', resync, { passive: true });
    window.addEventListener('resize', resync, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('scroll', resync);
      window.removeEventListener('resize', resync);
    };
  }, [enabled, reduceMotion]);
}
