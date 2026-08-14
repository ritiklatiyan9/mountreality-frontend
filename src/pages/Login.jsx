import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  AlertCircle, ArrowRight, Eye, EyeOff, Lock, LockOpen, Mail, MailCheck,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import BrandMark from '../components/BrandMark';
import PublicNav from '../components/ui/public-nav';
import { currentTenantSlug, orgDomainHost } from '../lib/tenant';
import { RING } from '../components/landing/layout';
import { googleSignInForIdToken } from '../lib/firebase';

/* ── Sign in ─────────────────────────────────────────────────────────
   The shared public header, then one full-height split, edge to edge:
   the ink-and-aurora brand panel owns the left half, the form the
   right. The page itself never scrolls — the root is
   h-screen/overflow-hidden — so the split absorbs whatever height the
   header leaves instead of running past the viewport.

   Typing feedback is state-driven transitions, never per-keystroke
   keyframe retriggers (those read as flicker):

   · the mail icon crossfades to a lime check when the address is valid;
     the lock crossfades open only when the password is revealed
   · the submit button "charges" — lifts and gains its glow — once both
     fields are ready
   · the error alert shakes on each new message; entrance is a
     three-step stagger

   All transform/opacity/width CSS, neutralised by the global
   prefers-reduced-motion rule in index.css. ── */

// Official multicolour Google "G" mark for the sign-in button.
const GoogleMark = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

const LEGAL = [
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/terms', label: 'Terms' },
  { to: '/contact', label: 'Contact' },
];

/* Filled, borderless fields with room for the leading icon — the blue
   focus ring is the only line that ever appears. 48px rather than the
   old 56px: four stacked controls at 56 plus the divider and the legal
   row overran a 768px-tall laptop, and this page is not allowed to
   scroll. Still well over the 44px touch minimum. */
const FIELD =
  'h-12 rounded-control border-transparent bg-mr-shell pl-11 pr-4 text-[15px] text-mr-text shadow-none transition-colors '
  + 'placeholder:text-mr-faint focus-visible:border-mr-blue focus-visible:bg-mr-surface focus-visible:ring-2 focus-visible:ring-mr-blue/25';

const FIELD_ICON =
  'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mr-faint transition-colors duration-200 group-focus-within:text-mr-blue';

/* Stacked-icon crossfade: both icons occupy the same box; state fades
   and scales one in as the other leaves. No remounting, no flicker. */
const ICON_ON = 'absolute inset-0 transition-all duration-300 opacity-100 scale-100';
const ICON_OFF = 'absolute inset-0 transition-all duration-300 opacity-0 scale-50';

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, loginWithGoogle, logout } = useAuth();
  const navigate = useNavigate();

  const busy = loading || googleLoading;
  const tenant = currentTenantSlug();
  const emailOk = EMAIL_OK.test(email);
  const formReady = emailOk && password.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(email, password);
      if (res?.role === 'owner') {
        // The Owner Panel is a separate application — tenants never ship its code.
        await logout();
        setError('This login belongs to the platform owner. Please use the dedicated Owner Panel app.');
        return;
      }
      navigate(res?.role === 'portal_user' ? '/portal' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const idToken = await googleSignInForIdToken();
      const res = await loginWithGoogle(idToken);
      navigate(res?.role === 'portal_user' ? '/portal' : '/dashboard');
    } catch (err) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') return;
      if (err?.code === 'auth/popup-blocked') {
        setError('Your browser blocked the Google popup. Allow popups for this site and try again.');
        return;
      }
      if (err?.code === 'auth/unauthorized-domain') {
        setError('This domain is not authorised in Firebase Console → Authentication → Settings → Authorized domains.');
        return;
      }
      if (err?.code === 'auth/operation-not-allowed' || err?.code === 'auth/configuration-not-found') {
        setError('Google sign-in is not enabled yet — enable the Google provider in Firebase Console → Authentication.');
        return;
      }
      setError(err.response?.data?.message || err?.message || 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    /* h-screen, not min-h-screen: the page is a fixed frame the header and
       the split below it divide up. overflow-hidden on the root kills the
       document scrollbar; the form column carries its own overflow-y-auto
       so a short viewport still reaches the submit button rather than
       clipping it out of reach. */
    <div className="auth-type mr-tech-field flex h-screen w-full flex-col overflow-hidden bg-mr-shell text-mr-text">
      <PublicNav active="login" />

      {/* min-h-0 on the split: a flex child defaults to min-height:auto and
          would grow past the header instead of taking the space left. */}
      <div className="grid min-h-0 flex-1 lg:grid-cols-[1.05fr_1fr]">

        {/* ── Brand panel ──
            A deliberately quiet counterpart to the form: no product render,
            no proof wall, just a little orientation for desktop users. */}
        <div
          className="relative hidden flex-col overflow-hidden p-10 text-white lg:flex xl:p-12"
          style={{ background: 'linear-gradient(155deg, #101114 0%, #111c3c 57%, #1f4ec8 150%)' }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-[380px] w-[380px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(80, 221, 235, 0.19) 0%, rgba(80, 221, 235, 0) 68%)' }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 -left-16 h-[420px] w-[420px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(47, 107, 255, 0.25) 0%, rgba(47, 107, 255, 0) 70%)' }}
          />

          <div className="animate-fade-rise relative my-auto max-w-md">
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-mr-aqua">
              <span className="h-1.5 w-1.5 rounded-full bg-mr-aqua" />
              MountReality
            </span>
            <h2 className="mt-5 text-[clamp(2.25rem,3.2vw,3.45rem)] font-semibold leading-[1.02] tracking-[-0.045em]">
              Your workday,
              <br />
              <span className="text-white/60">in clear view.</span>
            </h2>
            <p className="mt-5 max-w-sm text-[15px] leading-6 text-white/60">
              Sign in to your team’s workspace.
            </p>
          </div>

          <p className="animate-fade-rise-delay relative shrink-0 text-[12px] font-medium text-white/40">
            Secure workspace access
          </p>
        </div>

        {/* ── Form ──
            bg-mr-surface is load-bearing, not decoration: FIELD is a filled,
            borderless control on bg-mr-shell, so on a shell-coloured column
            the inputs are the same colour as what is behind them and simply
            disappear. The card this replaced was what used to supply the
            white. */}
        <main id="main" className="flex h-full flex-col justify-center overflow-y-auto bg-mr-surface px-5 py-8 sm:px-10 lg:px-12">
          <div className="mx-auto w-full max-w-[400px]">

            <div className="animate-fade-rise">
              {/* The wordmark is the way back to the marketing site now that
                  the page carries no header. */}
              <Link to="/" aria-label="MountReality home" className={`inline-flex rounded-control ${RING}`}>
                <BrandMark size="lg" />
              </Link>
              <h1 className="mt-6 text-[30px] font-semibold leading-[1.1] tracking-[-0.035em] text-mr-text">
                Welcome back
              </h1>
              <p className="mt-1.5 text-[14px] text-mr-muted">
                {tenant ? `Sign in to ${orgDomainHost(tenant)}` : 'Sign in to your workspace.'}
              </p>
            </div>

            {error && (
              /* key = error retriggers the shake on every new message. */
              <Alert
                key={error}
                role="alert"
                variant="destructive"
                className="mr-shake mt-4 rounded-control border-mr-coral-ink/20 bg-mr-coral-soft text-[13px] text-mr-coral-ink"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="animate-fade-rise-delay mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[13.5px] font-medium text-mr-text">Email</Label>
                <div className="group relative">
                  <span className={FIELD_ICON}>
                    <span className="relative block h-[18px] w-[18px]">
                      <Mail className={`h-[18px] w-[18px] ${emailOk ? ICON_OFF : ICON_ON}`} />
                      <MailCheck className={`h-[18px] w-[18px] text-mr-lime-ink ${emailOk ? ICON_ON : ICON_OFF}`} />
                    </span>
                  </span>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={busy}
                    aria-invalid={!!error}
                    className={FIELD}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[13.5px] font-medium text-mr-text">Password</Label>
                <div className="group relative">
                  <span className={FIELD_ICON}>
                    <span className="relative block h-[18px] w-[18px]">
                      <Lock className={`h-[18px] w-[18px] ${showPass ? ICON_OFF : ICON_ON}`} />
                      <LockOpen className={`h-[18px] w-[18px] ${showPass ? ICON_ON : ICON_OFF}`} />
                    </span>
                  </span>
                  <Input
                    id="password"
                    name="password"
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyUp={(e) => setCapsOn(e.getModifierState?.('CapsLock') ?? false)}
                    onBlur={() => setCapsOn(false)}
                    required
                    disabled={busy}
                    aria-invalid={!!error}
                    className={`${FIELD} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-control text-mr-faint transition-all duration-150 hover:text-mr-text active:scale-90"
                  >
                    {showPass ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
                {capsOn && <p className="mr-rise text-[12px] font-medium text-mr-amber-ink">Caps Lock is on.</p>}
              </div>

              {/* Charges up — lifts and gains its glow — once both fields
                  are ready. Always enabled; the browser handles required. */}
              <Button
                type="submit"
                disabled={busy}
                className={`group h-12 w-full justify-center rounded-control bg-mr-blue-deep text-[15px] font-semibold text-white transition-all duration-300 hover:bg-mr-blue ${
                  formReady
                    ? 'shadow-[0_14px_30px_-12px_rgba(33,84,221,0.85)] -translate-y-px'
                    : 'shadow-[0_6px_16px_-12px_rgba(33,84,221,0.5)]'
                } ${RING}`}
              >
                {loading ? (
                  <>
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight
                      className={`ml-1 h-[18px] w-[18px] transition-all duration-300 group-hover:translate-x-1 ${formReady ? 'opacity-100' : 'opacity-50'}`}
                    />
                  </>
                )}
              </Button>
            </form>

            <div className="animate-fade-rise-delay-2">
              {/* Google stays below the form: team accounts are created by
                  an admin, and Google only works against that same email. */}
              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-mr-line" />
                <span className="text-[12px] text-mr-muted">or</span>
                <span className="h-px flex-1 bg-mr-line" />
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleGoogle}
                disabled={busy}
                className={`h-12 w-full gap-2.5 rounded-control border-mr-line bg-mr-surface text-[14px] font-medium text-mr-text shadow-none transition-colors hover:bg-mr-shell ${RING}`}
              >
                {googleLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-mr-line-strong border-t-mr-muted" />
                    Waiting for Google…
                  </>
                ) : (
                  <><GoogleMark /> Continue with Google</>
                )}
              </Button>

              <p className="mt-6 text-center text-[14px] text-mr-muted">
                No account yet?{' '}
                <Link to="/signup" className={`font-semibold text-mr-blue-deep hover:underline ${RING}`}>
                  Get yours now
                </Link>
              </p>

              <nav aria-label="Legal" className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                {LEGAL.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`text-[12.5px] text-mr-muted transition-colors hover:text-mr-text ${RING}`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Login;
