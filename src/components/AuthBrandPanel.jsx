import { motion, useReducedMotion } from 'framer-motion';
import { Building2, Check } from 'lucide-react';

const Bar = ({ w = '100%', h = 'h-2', tone = 'bg-slate-200/90' }) => (
  <span className={`block rounded-full ${h} ${tone}`} style={{ width: w }} />
);

/** Product preview for the brand panel — real section labels, placeholder bars
 * instead of numbers. A sign-in screen must never advertise invented figures. */
const NAV = ['Dashboard', 'Day book', 'Clients', 'Plots', 'Vendors', 'Approvals', 'Reports'];

export const AppPreview = ({ active = 'Dashboard', heading = 'Overview', tiles, chart = 'bars' }) => (
  <div className="w-full overflow-hidden rounded-t-2xl border border-slate-200/80 bg-white shadow-[0_28px_80px_-28px_rgba(15,23,42,0.4)]">
    <div className="flex">
      {/* sidebar */}
      <div className="hidden w-[190px] shrink-0 border-r border-slate-100 bg-slate-50/70 p-5 sm:block">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <Building2 className="h-4 w-4 text-white" />
          </span>
          <span className="text-[12px] font-semibold tracking-tight text-slate-800">MountReality</span>
        </div>
        <div className="mt-6 space-y-2">
          {NAV.map((item) => {
            const on = item === active;
            return (
              <div key={item} className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${on ? 'bg-primary/10' : ''}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-primary' : 'bg-slate-300'}`} />
                <span className={`text-[11px] ${on ? 'font-semibold text-primary' : 'font-medium text-slate-400'}`}>{item}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* main */}
      <div className="min-w-0 flex-1 p-5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold tracking-tight text-slate-800">{heading}</span>
          <span className="rounded-full border border-slate-200 px-2.5 py-1.5"><Bar w="52px" h="h-1.5" /></span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {(tiles || ['Collections', 'Expenses', 'Net position']).map((k) => (
            <div key={k} className="rounded-xl border border-slate-100 bg-white p-3">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{k}</span>
              <span className="mt-2.5 block"><Bar w="70%" h="h-3" tone="bg-slate-800/80" /></span>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-xl border border-slate-100 p-4">
          <span className="text-[11px] font-semibold text-slate-700">
            {chart === 'line' ? 'Trend by month' : 'Cash flow'}
          </span>
          {chart === 'line' ? (
            <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="mt-3 h-24 w-full">
              <polyline points="0,26 16,19 32,22 48,11 64,14 80,6 100,2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary" vectorEffect="non-scaling-stroke" />
            </svg>
          ) : (
            <div className="mt-3 flex h-24 items-end gap-2">
              {[38, 55, 44, 68, 52, 80, 62, 92].map((h, i) => (
                <span
                  key={i}
                  className={`flex-1 rounded ${i > 5 ? 'bg-primary' : 'bg-primary/25'}`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 space-y-3 rounded-xl border border-slate-100 p-4">
          <span className="text-[11px] font-semibold text-slate-700">Recent activity</span>
          {[0, 1, 2, 3].map((r) => (
            <div key={r} className="flex items-center gap-3">
              <Bar w="24%" h="h-1.5" />
              <Bar w="32%" h="h-1.5" tone="bg-slate-100" />
              <Bar w="18%" h="h-1.5" tone="bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

/**
 * Marketing half of the auth screens (/login, /signup). Desktop only — on mobile
 * the form owns the whole viewport.
 */
export const AuthBrandPanel = ({ eyebrow, title, highlight, subtitle, features = [] }) => {
  const reduceMotion = useReducedMotion();
  const rise = (delay) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] },
  });

  return (
    <div className="relative hidden min-h-0 overflow-hidden bg-slate-50 lg:flex lg:flex-col lg:px-14 lg:pt-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_10%_0%,#eef4ff_0%,#f7f8fa_45%,#f2f4f7_100%)]" />
        <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(to_right,rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.045)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(90%_70%_at_50%_0%,black,transparent)]" />
      </div>

      <motion.div {...rise(0.05)} className="relative max-w-[560px]">
        {eyebrow && (
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-[12px] font-medium text-slate-600 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {eyebrow}
          </span>
        )}

        <h2 className="mt-6 text-[40px] font-semibold leading-[1.08] tracking-[-0.03em] text-slate-900 xl:text-[44px]">
          {title}{' '}
          <span className="relative inline-block">
            {highlight}
            <svg viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden="true" className="absolute -bottom-1.5 left-0 h-[10px] w-full text-primary/35">
              <motion.path
                d="M3 8.4C58 3.6 142 2.4 297 5.8"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                initial={reduceMotion ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.85, delay: 0.45, ease: 'easeOut' }}
              />
            </svg>
          </span>
        </h2>

        <p className="mt-6 max-w-[440px] text-[15px] leading-relaxed text-slate-500">{subtitle}</p>

        <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2.5">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-[13px] font-medium text-slate-600">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10">
                <Check className="h-2.5 w-2.5 text-primary" strokeWidth={3.5} />
              </span>
              {f}
            </li>
          ))}
        </ul>
      </motion.div>

      {/* Cropped by the panel's bottom edge, like a screenshot sliding into frame. */}
      <motion.div {...rise(0.18)} className="relative mx-auto mt-10 w-full min-h-0 flex-1 max-w-[660px] xl:max-w-[760px]">
        <AppPreview />
      </motion.div>
    </div>
  );
};

export default AuthBrandPanel;
