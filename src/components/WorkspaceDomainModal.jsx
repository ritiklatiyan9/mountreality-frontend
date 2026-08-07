import { useState } from 'react';
import { Check, Copy, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROOT_DOMAIN, orgDomainHost, orgDomainUrl } from '../lib/tenant';

/* ── First-login workspace-domain modal ──────────────────────────────
   Shown once per user, the first time they land in the dashboard: here
   is your dedicated domain, here is what the other two hosts are for.
   `domain_intro_seen` comes from the server, so "once" holds across
   devices; dismissing flips it via AuthContext.

   Rendered by Layout, so it can only ever appear after a successful
   sign-in — which is exactly the "on first login" the feature asks for. */

export default function WorkspaceDomainModal() {
  const { user, organization, dismissDomainIntro } = useAuth();
  const [copied, setCopied] = useState(false);

  const subdomain = organization?.subdomain;
  if (!subdomain || !user || user.domain_intro_seen) return null;

  const host = orgDomainHost(subdomain);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(orgDomainUrl(subdomain));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard can be denied — the address is on screen to select */
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Your workspace domain">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={dismissDomainIntro} />

      <div className="relative w-full max-w-md overflow-hidden rounded-panel bg-mr-surface shadow-2xl shadow-slate-950/25 animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-mr-ink px-6 py-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mr-blue">
            <Globe className="h-5 w-5 text-white" strokeWidth={1.9} aria-hidden="true" />
          </span>
          <h2 className="mt-3 text-[17px] font-semibold text-white">
            {organization.name} has its own address
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-white/60">
            Your workspace lives at a dedicated domain your whole team can use.
          </p>
        </div>

        <div className="px-6 py-5">
          <button
            type="button"
            onClick={copy}
            title="Copy link"
            className="flex w-full items-center justify-between gap-3 rounded-control border border-mr-blue/25 bg-mr-blue-soft px-4 py-3 text-left transition-colors hover:border-mr-blue/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
          >
            <span className="truncate text-[15px] font-semibold tracking-[-0.01em] text-mr-blue-deep">{host}</span>
            {copied
              ? <Check className="h-4 w-4 shrink-0 text-mr-lime-ink" strokeWidth={2.2} aria-hidden="true" />
              : <Copy className="h-4 w-4 shrink-0 text-mr-blue" strokeWidth={1.9} aria-hidden="true" />}
          </button>

          <dl className="mt-5 space-y-3">
            <div className="flex gap-3 text-[13px]">
              <dt className="w-2/5 shrink-0 font-medium text-mr-text">{ROOT_DOMAIN}</dt>
              <dd className="text-mr-muted">The public website</dd>
            </div>
            <div className="flex gap-3 text-[13px]">
              <dt className="w-2/5 shrink-0 font-medium text-mr-text">console.{ROOT_DOMAIN}</dt>
              <dd className="text-mr-muted">Sign-in for every workspace</dd>
            </div>
            <div className="flex gap-3 text-[13px]">
              <dt className="w-2/5 shrink-0 font-medium text-mr-blue-deep">{host}</dt>
              <dd className="text-mr-muted">Yours — bookmark it and sign in here directly</dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={dismissDomainIntro}
            className="mt-6 h-11 w-full rounded-control bg-mr-ink text-[14px] font-semibold text-white transition-colors hover:bg-mr-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
          >
            Got it
          </button>
          <p className="mt-3 text-center text-[11.5px] text-mr-faint">
            Always available under Settings → Profile.
          </p>
        </div>
      </div>
    </div>
  );
}
