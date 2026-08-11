import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ACCENT, toneFor } from './accents';

/* ── Workflow strip ──────────────────────────────────────────────────
   The accounting modules as one connected run of steps. Each step keeps
   a stable brand tint (see toneFor) so the same module reads the same
   colour in the activity table and the breakdown bar, joined by a single
   gradient connector. Routes and permission filtering are decided by the
   caller — this component only draws them. ── */
export default function WorkflowStrip({ items, title = 'Business workflow', description }) {
  if (!items?.length) return null;

  return (
    <section
      aria-labelledby="mr-workflow-title"
      className="rounded-panel border border-mr-line bg-mr-surface px-5 py-5 sm:px-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="mr-workflow-title" className="text-[15px] font-semibold tracking-[-0.01em] text-mr-text">{title}</h2>
        {description && <p className="hidden text-[12px] text-mr-muted sm:block">{description}</p>}
      </div>

      <div className="relative mt-4">
        {/* connector — sits behind the step markers */}
        <span
          className="pointer-events-none absolute left-6 right-6 top-[38px] hidden h-px lg:block"
          aria-hidden="true"
          style={{ background: 'linear-gradient(90deg, rgba(47,107,255,.28), rgba(80,221,235,.28), rgba(185,255,69,.35), rgba(255,176,46,.28), rgba(255,101,74,.28))' }}
        />
        <ul className="mr-rail flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-flow-col lg:auto-cols-fr lg:gap-1 lg:overflow-visible">
          {items.map((item) => {
            const Icon = item.icon;
            const accent = ACCENT[toneFor(item.module || item.to)];
            return (
              <li key={item.to} className="min-w-[136px] shrink-0 lg:min-w-0">
                <Link
                  to={item.to}
                  className="mr-press group relative flex h-full flex-col gap-2 rounded-control px-3 py-2 hover:bg-mr-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
                >
                  <span className={`flex h-11 w-11 items-center justify-center rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_6px_14px_-8px_rgba(16,17,20,0.35)] ring-4 ring-mr-surface transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-0.5 group-hover:scale-105 ${accent.chip}`}>
                    <Icon className="h-[19px] w-[19px]" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-mr-text">{item.label}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-[12px] text-mr-faint">
                      <span className="truncate">{item.desc}</span>
                      <ArrowRight className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
