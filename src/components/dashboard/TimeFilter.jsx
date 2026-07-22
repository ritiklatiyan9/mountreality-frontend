import { motion } from 'framer-motion';

const MotionSpan = motion.span;

const PRESETS = [
  { key: 'today',      label: 'Today' },
  { key: 'this_week',  label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'this_year',  label: 'This Year' },
  { key: 'overall',    label: 'Overall' },
];

export default function TimeFilter({ value, onChange }) {
  return (
    <div className="flex items-center gap-0.5 flex-wrap rounded-full bg-slate-100 p-1">
      {PRESETS.map(({ key, label }) => {
        const active = value === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`relative px-3 py-1 rounded-full text-[11px] font-semibold transition-colors duration-200
              ${active ? 'text-white' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {active && (
              <MotionSpan
                layoutId="time-filter-pill"
                className="absolute inset-0 rounded-full bg-slate-950 shadow-sm"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              />
            )}
            <span className="relative z-10">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
