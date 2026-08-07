import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import PublicNav from '../components/ui/public-nav';
import SiteFooter from '../components/SiteFooter';
import AuthShell from '../components/landing/AuthShell';
import { BTN_INK, LINK_SM, META, RING } from '../components/landing/layout';
import { googleSignInForIdToken } from '../lib/firebase';

// Official multicolour Google "G" mark for the sign-in button.
const GoogleMark = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

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
      navigate('/dashboard');
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
      await loginWithGoogle(idToken);
      navigate('/dashboard');
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

  const fieldClass =
    'h-11 rounded-control border-mr-line bg-mr-surface text-[15px] text-mr-text shadow-none transition-colors ' +
    'placeholder:text-mr-faint focus-visible:border-mr-blue focus-visible:ring-2 focus-visible:ring-mr-blue/25';
  const labelClass = 'text-[13px] font-medium text-mr-muted';

  return (
    <div className="auth-type mr-tech-field flex min-h-screen w-full flex-col bg-mr-shell text-mr-text">
      <PublicNav active="login" compact />

      <main id="main" className="flex-1">
        <AuthShell
          title="Welcome back"
          subtitle="Sign in to your workspace to continue."
          footer={(
            <>
              <p>
                New company?{' '}
                <Link to="/signup" className={LINK_SM}>Create an account</Link>
              </p>
              <p className="mt-2">
                Team members: your admin creates your account, and Google sign-in uses that same email.
              </p>
            </>
          )}
        >
          {error && (
            <Alert
              role="alert"
              variant="destructive"
              className="mb-6 rounded-control border-mr-coral-ink/20 bg-mr-coral-soft text-[13px] text-mr-coral-ink"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogle}
            disabled={busy}
            className={`h-11 w-full gap-2.5 rounded-control border-mr-line bg-mr-surface text-[14px] font-medium text-mr-text shadow-none transition-colors hover:bg-mr-surface-2 ${RING}`}
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

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-mr-line" />
            <span className="text-[12px] text-mr-muted">or</span>
            <span className="h-px flex-1 bg-mr-line" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className={labelClass}>Work email</Label>
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
                className={fieldClass}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className={labelClass}>Password</Label>
              <div className="relative">
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
                  className={`${fieldClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-control text-mr-faint transition-colors hover:text-mr-text"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {capsOn && <p className="text-[12px] font-medium text-mr-amber-ink">Caps Lock is on.</p>}
            </div>

            <Button type="submit" disabled={busy} className={`w-full justify-center ${BTN_INK}`}>
              {loading ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </>
              )}
            </Button>
          </form>
        </AuthShell>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Login;
