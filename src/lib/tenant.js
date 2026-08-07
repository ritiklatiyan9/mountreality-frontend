/* ── Tenant hosts ─────────────────────────────────────────────────────
   One place that knows the domain layout:

     mountreality.com / www   → marketing
     console.mountreality.com → the shared sign-in door
     {slug}.mountreality.com  → a tenant's dedicated door

   Wildcard DNS already sends every one of these to this same SPA, so a
   "dedicated domain" is purely which hostname the visitor arrived on —
   these helpers are how the app notices. */

export const ROOT_DOMAIN = 'mountreality.com';

/** Full https URL for a tenant slug. */
export const orgDomainUrl = (subdomain) => `https://${subdomain}.${ROOT_DOMAIN}`;

/** Bare hostname for display — what you print, not what you link. */
export const orgDomainHost = (subdomain) => `${subdomain}.${ROOT_DOMAIN}`;

/* The tenant slug of the current hostname, or null on the marketing
   hosts, the console, localhost and *.vercel.app. */
export function currentTenantSlug() {
  const host = window.location.hostname.toLowerCase();
  if (!host.endsWith(`.${ROOT_DOMAIN}`)) return null;
  const slug = host.slice(0, -(ROOT_DOMAIN.length + 1));
  if (!slug || slug.includes('.') || slug === 'www' || slug === 'console') return null;
  return slug;
}

/** True on any host whose front door should be the login page, not marketing. */
export function isAppHost() {
  const host = window.location.hostname.toLowerCase();
  return host === `console.${ROOT_DOMAIN}` || currentTenantSlug() !== null;
}
