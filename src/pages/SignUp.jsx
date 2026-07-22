import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  AlertCircle, Building2, User, Mail, Phone, Lock, Eye, EyeOff, ArrowRight,
  ShieldCheck, Check, Layers, Users2, BarChart3,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { purchasePlan } from '../lib/razorpay';
import PlanCards from '../components/PlanCards';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';

const FEATURES = [
  { icon: Layers, text: 'Multi-site accounting, all in one dashboard' },
  { icon: Users2, text: 'Role-based access for admins & sub-admins' },
  { icon: BarChart3, text: 'Real-time reports, cash flow & balance sheets' },
];

const STEPS = [
  { key: 'account', label: 'Account details' },
  { key: 'plan', label: 'Choose plan' },
];

/** Field with a leading icon — matches the icon+input pattern used elsewhere in the app. */
const IconField = ({ icon: Icon, id, label, ...inputProps }) => (
  <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input id={id} {...inputProps} className="h-10 rounded-lg pl-9" />
    </div>
  </div>
);

const passwordStrength = (pw) => {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 3);
};
const STRENGTH_META = [
  { label: '', color: 'bg-border' },
  { label: 'Weak', color: 'bg-destructive' },
  { label: 'Okay', color: 'bg-amber-500' },
  { label: 'Strong', color: 'bg-emerald-500' },
];

/**
 * SaaS signup: company + super admin account (step 1), then plan selection and
 * Razorpay payment (step 2). The account exists after step 1 — if payment is
 * abandoned, logging in later lands on /subscription to finish paying.
 */
export const SignUp = () => {
  const { signup, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState('account'); // 'account' | 'plan'
  const [form, setForm] = useState({ company_name: '', name: '', email: '', phone: '', password: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [plans, setPlans] = useState([]);
  const [busyPlanId, setBusyPlanId] = useState(null);

  useEffect(() => {
    api.get('/billing/plans').then(({ data }) => setPlans(data.plans)).catch(() => {});
  }, []);

  // Already signed in (e.g. came back mid-flow) — go straight to plan selection.
  useEffect(() => {
    if (isAuthenticated && step === 'account') setStep('plan');
  }, [isAuthenticated, step]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const strength = useMemo(() => passwordStrength(form.password), [form.password]);

  const handleAccountSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await signup({
        company_name: form.company_name,
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
      });
      setStep('plan');
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChoosePlan = async (plan) => {
    setError('');
    setBusyPlanId(plan.id);
    try {
      await purchasePlan(plan, user);
      toast.success('Subscription active! Create your first site to get started.');
      navigate('/sites');
    } catch (err) {
      if (err.message !== 'Payment cancelled') setError(err.message);
    } finally {
      setBusyPlanId(null);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:grid lg:grid-cols-2 bg-background font-sans overflow-hidden">
      {/* ── Left Panel (branding) ── */}
      <div className="hidden lg:flex relative overflow-hidden bg-slate-900 flex-col justify-between p-8 lg:p-12 text-white">
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

        <div className="relative z-10 space-y-8 max-w-lg mb-12">
          <div className="space-y-4">
            <h2 className="text-3xl lg:text-4xl font-semibold leading-tight tracking-tight">
              Run your real estate company's accounts on one platform.
            </h2>
            <p className="text-base lg:text-lg text-slate-400">
              Create your company, pick a plan, and invite your admins. Every plan includes all features — plans differ only by how many sites you can manage.
            </p>
          </div>

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
            Payments secured by Razorpay
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-sm text-slate-500">&copy; {new Date().getFullYear()} Mount Reality. All rights reserved.</p>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex flex-1 items-start lg:items-center justify-center p-4 sm:p-6 md:p-8 lg:p-12 overflow-y-auto">
        <div className={`w-full space-y-5 py-6 transition-[max-width] duration-300 ${step === 'plan' ? 'max-w-3xl' : 'max-w-[440px]'}`}>
          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center text-center gap-3 mb-2">
            <Link to="/" className="flex items-center gap-2.5 justify-center">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg">
                <Building2 className="w-5 h-5 text-white" />
              </div>
            </Link>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Mount Reality</h2>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 select-none">
            {STEPS.map((s, i) => {
              const isActive = s.key === step;
              const isDone = STEPS.findIndex((x) => x.key === step) > i;
              return (
                <div key={s.key} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                        isDone ? 'bg-primary text-primary-foreground' :
                        isActive ? 'bg-primary/15 text-primary ring-2 ring-primary/30' :
                        'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isDone ? <Check className="h-3 w-3" /> : i + 1}
                    </span>
                    <span className={`text-xs font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <span className="h-px w-8 bg-border" />}
                </div>
              );
            })}
          </div>

          <motion.div
            key={step}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
          <Card className="border-border/50 shadow-lg shadow-black/5 dark:shadow-none w-full">
            <CardHeader className="space-y-2 text-center pb-4 sm:pb-6">
              <CardTitle className="text-lg sm:text-2xl font-semibold tracking-tight">
                {step === 'account' ? 'Create your company account' : 'Choose your plan'}
              </CardTitle>
              <CardDescription className="text-xs sm:text-base text-muted-foreground">
                {step === 'account'
                  ? 'You will be the Super Admin of your organization'
                  : 'All features on every plan — pick by number of sites'}
              </CardDescription>
              {step === 'plan' && user?.email && (
                <p className="inline-flex items-center justify-center gap-1.5 mx-auto text-[11px] font-medium text-muted-foreground bg-muted/60 rounded-full px-3 py-1 w-fit">
                  <ShieldCheck className="h-3 w-3 text-primary" /> Signed in as {user.email}
                </p>
              )}
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-6 bg-destructive/5 text-destructive border-destructive/20 rounded-xl text-xs sm:text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {step === 'account' ? (
                <form onSubmit={handleAccountSubmit} className="space-y-4">
                  <IconField
                    icon={Building2} id="company" label="Company name" placeholder="Shree Ganesh Developers"
                    value={form.company_name} onChange={set('company_name')} required disabled={loading}
                  />
                  <IconField
                    icon={User} id="name" label="Your name" placeholder="Full name"
                    value={form.name} onChange={set('name')} required disabled={loading}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <IconField
                      icon={Mail} id="email" label="Email" type="email" placeholder="you@company.com"
                      value={form.email} onChange={set('email')} required disabled={loading}
                    />
                    <IconField
                      icon={Phone} id="phone" label="Phone" type="tel" placeholder="98XXXXXXXX"
                      value={form.phone} onChange={set('phone')} disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password" type={showPass ? 'text' : 'password'} placeholder="••••••••"
                        value={form.password} onChange={set('password')} required disabled={loading}
                        className="h-10 rounded-lg pl-9 pr-10"
                      />
                      <Button type="button" variant="ghost" size="icon" tabIndex={-1}
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent"
                        onClick={() => setShowPass(!showPass)}>
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {form.password && (
                      <div className="flex items-center gap-2 pt-0.5">
                        <div className="flex flex-1 gap-1">
                          {[0, 1, 2].map((i) => (
                            <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < strength ? STRENGTH_META[strength].color : 'bg-border'}`} />
                          ))}
                        </div>
                        <span className="text-[11px] text-muted-foreground w-10 text-right">{STRENGTH_META[strength].label}</span>
                      </div>
                    )}
                  </div>
                  <IconField
                    icon={Lock} id="confirm" label="Confirm password" type={showPass ? 'text' : 'password'} placeholder="••••••••"
                    value={form.confirm} onChange={set('confirm')} required disabled={loading}
                  />
                  <Button type="submit" disabled={loading} className="w-full h-10 sm:h-11 font-medium rounded-full mt-2">
                    {loading ? (
                      <><span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" /> Creating account…</>
                    ) : (
                      <>Continue to plans <ArrowRight className="w-4 h-4 ml-2" /></>
                    )}
                  </Button>
                </form>
              ) : (
                <PlanCards plans={plans} busyPlanId={busyPlanId} onChoose={handleChoosePlan} ctaLabel="Pay & activate" />
              )}
            </CardContent>
            <CardFooter className="flex flex-col border-t border-border/50 pt-4 sm:pt-6 mt-2">
              <p className="text-center text-xs sm:text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-primary hover:underline underline-offset-2">Sign in</Link>
              </p>
            </CardFooter>
          </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
