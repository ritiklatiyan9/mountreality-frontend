import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import {
  AlertCircle, Building2, Eye, EyeOff, ArrowRight,
  IndianRupee, BarChart3, MapPin, Tractor, TrendingUp, FileCheck,
  Clock, Store, Users2, Gauge, ShieldCheck,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { googleSignInForIdToken } from '../lib/firebase';
import loginBg from '../assets/login-bg.jpg';

// Official multicolour Google "G" mark for the sign-in button.
const GoogleMark = () => (
  <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

// ── Floating stat cards for the right-panel carousel ──
const CARD_COLORS = {
  emerald: 'bg-emerald-500/15 text-emerald-600',
  indigo: 'bg-indigo-500/15 text-indigo-600',
  amber: 'bg-amber-500/15 text-amber-600',
  violet: 'bg-violet-500/15 text-violet-600',
  cyan: 'bg-cyan-500/15 text-cyan-600',
  rose: 'bg-rose-500/15 text-rose-600',
  blue: 'bg-blue-500/15 text-blue-600',
  orange: 'bg-orange-500/15 text-orange-600',
  purple: 'bg-purple-500/15 text-purple-600',
  teal: 'bg-teal-500/15 text-teal-600',
};

const FLOATING_CARDS = [
  { type: 'teaser' },
  {
    type: 'bars', icon: BarChart3, label: 'ENGAGEMENT', value: '+78.12%', badge: 'last month', color: 'violet',
    description: 'This significant increase in engagement highlights the effectiveness of our recent strategies.',
    bars: [45, 60, 40, 75, 65, 90],
  },
  {
    type: 'stat', icon: IndianRupee, label: 'TOTAL REVENUE', value: '₹4.82 Cr', badge: '+18%', color: 'emerald',
    description: 'Total revenue collected across all active sites this month.',
  },
  {
    type: 'stat', icon: MapPin, label: 'ACTIVE PLOTS', value: '128', badge: '+6 new', color: 'indigo',
    description: 'New plots added to the portfolio this month across every active site.',
  },
  {
    type: 'stat', icon: Tractor, label: 'FARMER PAYMENTS', value: '₹32.4 L', color: 'amber',
    description: 'Disbursed to land-owning farmers so far this month.',
  },
  {
    type: 'line', icon: TrendingUp, label: 'CASH FLOW TREND', value: '₹91.2 L', badge: '6 months', color: 'violet',
    description: 'Steady upward trend in net cash position across the last two quarters.',
  },
  {
    type: 'stat', icon: FileCheck, label: 'REGISTRIES', value: '47', badge: 'this quarter', color: 'cyan',
    description: 'Registries completed and filed without a single pending document.',
  },
  {
    type: 'stat', icon: Clock, label: 'PENDING APPROVALS', value: '6', color: 'rose',
    description: 'Awaiting review from an admin before they post to the ledger.',
  },
  {
    type: 'bars', icon: Building2, label: 'SITES MANAGED', value: '9', color: 'blue',
    description: 'Active projects currently tracked in one unified dashboard.',
    bars: [55, 70, 50, 80, 60, 95],
  },
  {
    type: 'stat', icon: Store, label: 'VENDOR PAYMENTS', value: '₹18.7 L', color: 'orange',
    description: 'Settled to vendors and contractors across all sites this month.',
  },
  {
    type: 'stat', icon: Users2, label: 'NEW MEMBERS', value: '214', badge: 'onboarded', color: 'purple',
    description: 'Clients, farmers and staff onboarded into the platform.',
  },
  {
    type: 'line', icon: Gauge, label: 'OCCUPANCY RATE', value: '92%', badge: '+4%', color: 'emerald',
    description: 'Plots sold against total inventory across all live sites.',
  },
  {
    type: 'stat', icon: ShieldCheck, label: 'AUDIT SCORE', value: '98 / 100', color: 'teal',
    description: 'Compliance score from the latest internal ledger audit.',
  },
];

const FloatingCard = ({ card }) => {
  // A plain chart-only teaser card (top of the reference's stack) — no label/value chrome.
  if (card.type === 'teaser') {
    return (
      <div className="mx-auto w-full max-w-[420px] rounded-3xl bg-white/90 p-10 shadow-xl shadow-black/10 backdrop-blur-sm">
        <svg viewBox="0 0 200 70" className="h-36 w-full" preserveAspectRatio="none">
          <polyline points="0,55 40,42 80,48 120,18 160,28 200,6" fill="none" stroke="#111827" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="200" cy="6" r="5" fill="#111827" />
        </svg>
      </div>
    );
  }

  const Icon = card.icon;
  return (
    <div className="mx-auto w-full max-w-[420px] rounded-3xl bg-white p-10 shadow-xl shadow-black/15">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2.5">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${CARD_COLORS[card.color]}`}>
            <Icon className="h-6 w-6" />
          </span>
          <span className="text-sm font-bold uppercase tracking-wide text-slate-500">{card.label}</span>
        </span>
        {card.badge && (
          <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-500">{card.badge}</span>
        )}
      </div>
      <p className="mt-6 text-6xl font-bold tracking-tight text-slate-900">{card.value}</p>
      {card.description && (
        <p className="mt-3 text-base leading-6 text-slate-400 line-clamp-2">{card.description}</p>
      )}
      {card.type === 'bars' && card.bars ? (
        <div className="mt-7 flex h-28 items-end gap-2">
          {card.bars.map((h, i) => (
            <div key={i} className="flex-1 rounded-md bg-violet-400/80" style={{ height: `${h}%` }} />
          ))}
        </div>
      ) : card.type === 'line' ? (
        <svg viewBox="0 0 100 30" className="mt-7 h-28 w-full" preserveAspectRatio="none">
          <polyline points="0,25 20,18 40,20 60,8 80,12 100,3" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </div>
  );
};

/** Infinite vertical marquee — the card list rendered twice, animated by
 * exactly -50% of its own height, looping seamlessly with no visible seam.
 * Cards are sized so roughly 2 are visible in the panel at once. */
const FloatingCardsCarousel = () => (
  <div className="relative h-full w-full overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)]">
    <motion.div
      className="flex flex-col gap-12 py-4"
      animate={{ y: ['0%', '-50%'] }}
      transition={{ duration: 130, repeat: Infinity, ease: 'linear' }}
    >
      {[...FLOATING_CARDS, ...FLOATING_CARDS].map((card, i) => (
        <FloatingCard key={i} card={card} />
      ))}
    </motion.div>
  </div>
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
    <div className="min-h-screen w-full flex flex-col lg:grid lg:grid-cols-2 bg-white font-sans overflow-hidden">
      {/* ── Left Panel (gradient + floating cards carousel) ── */}
      <div className="hidden lg:block lg:h-screen relative overflow-hidden bg-violet-400 p-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-300 via-fuchsia-400 to-purple-500" />
          <div className="absolute -top-32 left-1/4 h-[440px] w-[440px] rounded-full bg-white/40 blur-[110px]" />
          <div className="absolute top-1/3 -right-24 h-[380px] w-[380px] rounded-full bg-fuchsia-300/50 blur-[110px]" />
          <div className="absolute -bottom-32 -left-20 h-[420px] w-[420px] rounded-full bg-purple-400/50 blur-[110px]" />
          <div className="absolute bottom-1/4 right-1/4 h-[300px] w-[300px] rounded-full bg-white/20 blur-[100px]" />
        </div>
        <div className="relative h-full w-full">
          <FloatingCardsCarousel />
        </div>
      </div>

      {/* ── Right Panel (logo + headline + form, on a soft blue/pink gradient backdrop) ── */}
      <div
        className="flex flex-1 items-center justify-center p-4 sm:p-6 md:p-8 lg:p-12 relative w-full overflow-hidden bg-slate-50 bg-cover bg-center"
        style={{ backgroundImage: `url(${loginBg})` }}
      >
        <div className="w-full max-w-[420px] space-y-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-950">Mount<span className="text-primary">Reality</span></span>
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="space-y-6"
          >
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight tracking-tight text-slate-950">
                Keep your real estate<br />business organized
              </h1>
              <p className="text-sm text-slate-500">Sign in to your dashboard</p>
            </div>

            {error && (
              <Alert variant="destructive" className="bg-destructive/5 text-destructive border-destructive/20 rounded-xl text-xs sm:text-sm">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogle}
              disabled={googleLoading || loading}
              className="w-full h-11 text-sm font-medium rounded-xl gap-2.5"
            >
              {googleLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                  Waiting for Google...
                </>
              ) : (
                <><GoogleMark /> Sign in with Google</>
              )}
            </Button>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground text-xs sm:text-sm">Email<span className="text-red-500">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11 rounded-lg bg-background text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground text-xs sm:text-sm">Password<span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11 rounded-lg bg-background pr-10 text-sm"
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
                className="w-full h-11 text-sm font-medium rounded-xl mt-2"
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

            <p className="text-center text-xs sm:text-sm text-muted-foreground">
              New company?{' '}
              <Link to="/signup" className="font-medium text-primary hover:underline underline-offset-2">
                Sign up &amp; choose a plan
              </Link>
              <span className="block mt-1 text-[11px]">Team members: accounts are created by your admin.</span>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Login;
