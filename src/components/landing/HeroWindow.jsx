import DemoLedgerPanel from './DemoLedgerPanel';
import { DEMO_LEDGER } from './demoLedger';

/* ── Hero window ─────────────────────────────────────────────────────
   The app surface shown under the headline, cropped by its parent. The
   inner bg-mr-canvas pad is what stops the nested panel border reading
   as a double frame: it is a panel sitting on the app's canvas, exactly
   as it does in the real dashboard.

   Chrome-bar text comes from DEMO_LEDGER rather than a string literal,
   so it cannot drift from the figures inside the panel. ── */
export default function HeroWindow() {
  return (
    <div className="rounded-t-panel border border-b-0 border-mr-line bg-mr-surface">
      <div className="flex items-center gap-2 border-b border-mr-line px-4 py-3.5">
        <span className="h-2.5 w-2.5 rounded-full bg-mr-line-strong" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-mr-line-strong" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-mr-line-strong" aria-hidden="true" />
        <p className="ml-2 truncate text-[12px] text-mr-muted">
          MountReality · {DEMO_LEDGER.site} · {DEMO_LEDGER.period}
        </p>
      </div>
      <div className="bg-mr-canvas p-3 sm:p-4">
        <DemoLedgerPanel />
      </div>
    </div>
  );
}
