import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import {
  AlertCircle, Building2, Eye, EyeOff, ArrowRight, ShieldCheck, Layers, Users2, BarChart3,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { googleSignInForIdToken } from '../lib/firebase';

const FEATURES = [
  { icon: Layers, text: 'Multi-site accounting, all in one dashboard' },
  { icon: Users2, text: 'Role-based access for admins & sub-admins' },
  { icon: BarChart3, text: 'Real-time reports, cash flow & balance sheets' },
];

// Official multicolour Google "G" mark for the sign-in button.
const GoogleMark = () => (
  <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
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
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, loginWithGoogle, logout } = useAuth();
  const navigate = useNavigate();

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
    <div className="min-h-screen w-full flex flex-col lg:grid lg:grid-cols-2 bg-background font-sans overflow-hidden">
      {/* ── Left Panel (branding) ── */}
      <div className="hidden lg:flex relative overflow-hidden bg-slate-900 flex-col justify-between p-8 lg:p-12 text-white">
        {/* Abstract Background Elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px] -translate-x-1/2 translate-y-1/2" />

        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-2.5 inline-flex">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold tracking-tight">Mount<span className="text-primary">Reality</span></span>
          </Link>
        </div>

        <div className="relative z-10 space-y-6 max-w-lg mb-12">
          <h2 className="text-3xl lg:text-4xl font-semibold leading-tight tracking-tight">Modernize your real estate accountancy framework.</h2>
          <p className="text-base lg:text-lg text-slate-400">Streamline multi-site finances, organize your documents, and maintain 100% control over roles and permissions securely.</p>

          <ul className="space-y-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm font-medium text-slate-300">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/10">
                  <Icon className="w-4 h-4 text-primary" />
                </span>
                {text}
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-3 text-sm font-medium text-slate-300 pt-2 border-t border-white/10">
             <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
             End-to-end encrypted access control
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-sm text-slate-500">&copy; {new Date().getFullYear()} Mount Reality. All rights reserved.</p>
        </div>
      </div>

      {/* ── Right Panel (form) ── */}
      <div className="flex flex-1 items-center justify-center p-4 sm:p-6 md:p-8 lg:p-12 relative w-full">
        <div className="absolute inset-0 bg-slate-50/50 dark:bg-transparent -z-10" />

        <div className="w-full max-w-[420px] space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center text-center space-y-4 mb-2">
            <Link to="/" className="flex items-center gap-2.5 justify-center">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg">
                <Building2 className="w-6 h-6 text-white" />
              </div>
            </Link>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Mount Reality</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Sign in to your dashboard</p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
          <Card className="border-border/50 shadow-lg shadow-black/5 dark:shadow-none w-full">
            <CardHeader className="space-y-2 text-center pb-4 sm:pb-6 px-4 sm:px-6">
              <CardTitle className="text-lg sm:text-2xl font-semibold tracking-tight">
                Welcome back
              </CardTitle>
              <CardDescription className="text-xs sm:text-base text-muted-foreground">
                <span className="hidden sm:block">Sign in to your dashboard</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              {error && (
                <Alert variant="destructive" className="mb-6 bg-destructive/5 text-destructive border-destructive/20 rounded-xl text-xs sm:text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-foreground text-xs sm:text-sm">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                        className="h-10 sm:h-11 rounded-lg bg-background text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-foreground text-xs sm:text-sm">Password</Label>
                      </div>
                      <div className="relative relative-group">
                        <Input
                          id="password"
                          type={showPass ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          disabled={loading}
                          className="h-10 sm:h-11 rounded-lg bg-background pr-10 text-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent"
                          onClick={() => setShowPass(!showPass)}
                          tabIndex={-1}
                        >
                          {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          <span className="sr-only">Toggle password visibility</span>
                        </Button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={loading || googleLoading}
                      className="w-full h-10 sm:h-11 text-sm sm:text-base font-medium rounded-full mt-2 sm:mt-4"
                    >
                      {loading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                          Signing in...
                        </>
                      ) : (
                        <>Sign in <ArrowRight className="w-4 h-4 ml-2" /></>
                      )}
                    </Button>
              </form>

              {/* ── Sign in with Google ── */}
              <div className="mt-4 sm:mt-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="h-px flex-1 bg-border" />
                      <span className="text-[10px] sm:text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                        or continue with
                      </span>
                      <span className="h-px flex-1 bg-border" />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGoogle}
                      disabled={googleLoading || loading}
                      className="w-full h-10 sm:h-11 text-sm sm:text-base font-medium rounded-full gap-2.5"
                    >
                      {googleLoading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                          Waiting for Google...
                        </>
                      ) : (
                        <><GoogleMark /> Continue with Google</>
                      )}
                    </Button>
                    <p className="text-center text-[10px] sm:text-[11px] leading-relaxed text-muted-foreground">
                      Use the Gmail attached to your account. New accounts are created by your admin.
                    </p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col border-t border-border/50 pt-4 sm:pt-6 mt-2 px-4 sm:px-6 pb-4 sm:pb-6">
              <p className="text-center text-xs sm:text-sm text-muted-foreground">
                New company? <br className="sm:hidden" />
                <span className="hidden sm:inline"> </span>
                <Link to="/signup" className="font-medium text-primary hover:underline underline-offset-2">
                  Sign up &amp; choose a plan
                </Link>
                <span className="block mt-1 text-[11px]">Team members: accounts are created by your admin.</span>
              </p>
            </CardFooter>
          </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Login;
