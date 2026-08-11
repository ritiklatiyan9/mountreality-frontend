import { useRef } from 'react';
import { motion } from 'framer-motion';

const MotionSpan = motion.span;

const PRESETS = [
  { key: 'today',      label: 'Today' },
  { key: 'this_week',  label: 'This week' },
  { key: 'this_month', label: 'This month' },
  { key: 'this_year',  label: 'This year' },
  { key: 'overall',    label: 'Overall' },
];

/* ── Period segmented control ────────────────────────────────────────
   A radio group, not a row of buttons: arrow keys move between periods
   and only the selected one is in the tab order. Selection logic is
   unchanged — it still just calls onChange with the preset key. ── */
export default function TimeFilter({ value, onChange, label = 'Reporting period' }) {
  const ref = useRef(null);

  const onKeyDown = (event) => {
    const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!dir) return;
    event.preventDefault();
    const index = PRESETS.findIndex((p) => p.key === value);
    const next = PRESETS[(index + dir + PRESETS.length) % PRESETS.length];
    onChange(next.key);
    ref.current?.querySelector(`[data-period="${next.key}"]`)?.focus();
  };

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="mr-glass flex flex-wrap items-center gap-0.5 rounded-full p-1"
    >
      {PRESETS.map(({ key, label: text }) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            data-period={key}
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(key)}
            /* No press-scale here: this button hosts the layout-animated
               pill, and transforming the parent corrupts the box framer
               measures — that is what made the selection judder. */
            className={`relative rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors duration-200
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-offset-1
              ${active ? 'text-white' : 'text-mr-muted hover:text-mr-text'}`}
          >
            {active && (
              <MotionSpan
                layoutId="mr-period-pill"
                className="mr-gloss absolute inset-0 bg-mr-ink"
                /* Inline numeric radius so framer un-distorts the corners
                   while it scales the pill between two different widths. */
                style={{ borderRadius: 9999 }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative z-10 whitespace-nowrap">{text}</span>
          </button>
        );
      })}
    </div>
  );
}
