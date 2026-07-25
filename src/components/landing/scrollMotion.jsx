import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';

const MotionDiv = motion.div;

/* ── Parallax ────────────────────────────────────────────────────────
   Translates a block against the scroll as it crosses the viewport.
   `distance` is the total travel in px across the whole crossing, so a
   small number is a lot of movement — 24–60 is the useful range.

   Under prefers-reduced-motion it renders a plain div: no observers, no
   spring, no transform. */
export function Parallax({ children, distance = 40, className, style }) {
  const ref = useRef(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const raw = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
  const y = useSpring(raw, { stiffness: 90, damping: 26, mass: 0.4 });

  if (reduceMotion) return <div className={className} style={style}>{children}</div>;

  return (
    <div ref={ref} className={className} style={style}>
      <MotionDiv style={{ y }}>{children}</MotionDiv>
    </div>
  );
}

/* ── Reveal ──────────────────────────────────────────────────────────
   Scroll-triggered rise: the block lifts and fades in once as it enters
   the viewport, then stays put. Deliberately never applied to the hero
   h1 — an element that starts at opacity 0 is not an LCP candidate until
   it becomes visible, so animating the largest text costs real measured
   load time. Everything below the fold is free to move.

   Under prefers-reduced-motion it renders a plain div: no observer, no
   transform, no opacity step. */
export function Reveal({ children, delay = 0, distance = 22, className }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) return <div className={className}>{children}</div>;

  return (
    <MotionDiv
      className={className}
      initial={{ opacity: 0, y: distance }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionDiv>
  );
}
