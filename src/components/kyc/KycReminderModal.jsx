import { useEffect, useReducer, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, Clock, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { KYC_STEPS, stepDone, useOrgKyc } from '../../hooks/useOrgKyc';

/* ── KYC reminder ────────────────────────────────────────────────────
   Reappears every five minutes until company verification is done.

   Rules that keep a recurring interrupt from becoming hostile:
   · It never opens on top of the page it is asking you to go to. Being
     on /settings means you are already doing the thing.
   · The snooze deadline lives in sessionStorage, so reloading the page
     does not reset it — otherwise every refresh would re-prompt.
   · Sub-admins never see it: they cannot write KYC, so nagging them is
     asking for something they are not allowed to do.
   · It defers to the first-login domain intro; two modals stacked on a
     brand-new account is not a welcome.

   Visibility is DERIVED from a stored deadline rather than pushed by an
   interval. A repeating timer that calls setState is both a React 19
   lint error and a real bug source — it keeps firing behind a finished
   flow. Here a single timeout re-renders exactly when the snooze
   expires, and nothing runs once KYC is complete. ── */

const INTERVAL_MS = 5 * 60 * 1000;
const SNOOZE_KEY = 'mr:kyc-snooze-until';

const readSnooze = () => {
  try {
    return Number(sessionStorage.getItem(SNOOZE_KEY)) || 0;
  } catch {
    return 0; // private mode / storage disabled
  }
};

// Aliased because the linter cannot see `motion.div` as a use of `motion`
// — the same reason components/landing/scrollMotion.jsx does this.
const MotionDiv = motion.div;
const MotionLi = motion.li;

export default function KycReminderModal() {
  const { user, isAdmin } = useAuth();
  const { kyc, loading } = useOrgKyc();
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = useReducedMotion();

  /* Starts true so the dialog cannot flash before the stored deadline has
     been read. Time is read only inside the timeout — never during
     render, which would make the component impure and its output depend
     on when React happened to re-run it. */
  const [snoozing, setSnoozing] = useState(true);
  const [snoozeVersion, bumpSnooze] = useReducer((n) => n + 1, 0);

  const settled = kyc?.status === 'submitted' || kyc?.status === 'verified';
  const outstanding = !loading && !!kyc && !kyc.is_complete && !settled;
  const domainIntroPending = !!user && !user.domain_intro_seen;
  const onSettings = location.pathname.startsWith('/settings');

  const eligible = outstanding && isAdmin && !domainIntroPending && !onSettings;
  const open = eligible && !snoozing;

  // Re-arms itself for exactly the time remaining, so the dialog returns
  // the instant the snooze lapses. Nothing runs once KYC stops being
  // outstanding — the effect tears the timer down.
  useEffect(() => {
    if (!eligible) return undefined;
    let timer;
    const evaluate = () => {
      const remaining = readSnooze() - Date.now();
      if (remaining <= 0) {
        setSnoozing(false);
        return;
      }
      setSnoozing(true);
      timer = setTimeout(evaluate, remaining);
    };
    // Deferred rather than called inline: a synchronous setState in an
    // effect body triggers a cascading render.
    timer = setTimeout(evaluate, 0);
    return () => clearTimeout(timer);
  }, [eligible, snoozeVersion]);

  const snooze = () => {
    try { sessionStorage.setItem(SNOOZE_KEY, String(Date.now() + INTERVAL_MS)); } catch { /* ignore */ }
    bumpSnooze();
  };

  const start = () => {
    const next = KYC_STEPS.find((s) => !stepDone(kyc, s));
    // Snooze as well as navigate: without it, stepping back off /settings
    // would re-prompt immediately.
    snooze();
    navigate(`/settings?tab=kyc${next ? `&step=${next.id}` : ''}`);
  };

  if (!eligible) return null;

  const doneCount = KYC_STEPS.filter((s) => stepDone(kyc, s)).length;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="kyc-reminder-title">
          <MotionDiv
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            onClick={snooze}
          />

          <MotionDiv
            className="relative w-full max-w-md overflow-hidden rounded-panel bg-mr-surface shadow-2xl shadow-slate-950/25"
            initial={reduce ? false : { opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="bg-mr-ink px-6 py-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mr-blue">
                <ShieldCheck className="h-5 w-5 text-white" strokeWidth={1.9} aria-hidden="true" />
              </span>
              <h2 id="kyc-reminder-title" className="mt-3 text-[17px] font-semibold text-white">
                Finish verifying your company
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-white/60">
                A few company details are still missing. It takes about two minutes.
              </p>
            </div>

            <div className="px-6 py-5">
              <ol className="space-y-2.5">
                {KYC_STEPS.map((step, i) => {
                  const done = stepDone(kyc, step);
                  return (
                    <MotionLi
                      key={step.id}
                      initial={reduce ? false : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: reduce ? 0 : 0.05 * i, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="flex items-center gap-3 text-[14px]"
                    >
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                        done ? 'border-mr-lime-ink/25 bg-mr-lime-soft text-mr-lime-ink' : 'border-mr-line bg-mr-shell text-mr-faint'
                      }`}>
                        {done
                          ? <Check className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden="true" />
                          : <span className="text-[11px] font-semibold tabular-nums">{i + 1}</span>}
                      </span>
                      <span className={done ? 'text-mr-muted line-through' : 'font-medium text-mr-text'}>{step.label}</span>
                    </MotionLi>
                  );
                })}
              </ol>

              <p className="mt-5 text-[12px] text-mr-muted">{doneCount} of {KYC_STEPS.length} done</p>

              <button
                type="button"
                onClick={start}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-control bg-mr-blue-deep text-[14.5px] font-semibold text-white transition-colors hover:bg-mr-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-offset-2"
              >
                {doneCount > 0 ? 'Continue onboarding' : 'Start onboarding'}
                <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={snooze}
                className="mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-control text-[13px] font-medium text-mr-muted transition-colors hover:bg-mr-shell hover:text-mr-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
              >
                <Clock className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />
                Remind me in 5 minutes
              </button>
            </div>
          </MotionDiv>
        </div>
      )}
    </AnimatePresence>
  );
}
