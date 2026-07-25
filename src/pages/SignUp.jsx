import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertCircle, Eye, EyeOff, ArrowRight, ShieldCheck, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { purchasePlan } from '../lib/razorpay';
import PlanCards from '../components/PlanCards';
import PublicNav from '../components/ui/public-nav';
import SiteFooter from '../components/SiteFooter';
import AuthShell from '../components/landing/AuthShell';
import { BTN_INK, LINK_SM, META, RING } from '../components/landing/layout';
import { PUBLIC_PLANS } from '../lib/plans';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';

const STEPS = [
  { key: 'account', label: 'Account' },
  { key: 'plan', label: 'Plan & payment' },
];

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
  { label: '', color: 'bg-mr-surface-2' },
  { label: 'Weak', color: 'bg-mr-coral' },
  { label: 'Okay', color: 'bg-mr-amber' },
  { label: 'Strong', color: 'bg-mr-lime-ink' },
];

const LABEL_CLASS = 'text-[13px] font-medium text-mr-muted';
const FIELD_CLASS =
  'h-11 rounded-control border-mr-line bg-mr-surface text-[15px] text-mr-text shadow-none transition-colors ' +
  'placeholder:text-mr-faint focus-visible:border-mr-blue focus-visible:ring-2 focus-visible:ring-mr-blue/25';

const Field = ({ id, label, hint, className = '', ...props }) => (
  <div className="space-y-1.5">
    <div className="flex items-baseline justify-between">
      <Label htmlFor={id} className={LABEL_CLASS}>{label}</Label>
      {hint && <span className="text-[12px] text-mr-faint">{hint}</span>}
    </div>
    <Input id={id} name={id} className={`${FIELD_CLASS} ${className}`} {...props} />
  </div>
);

/**
 * SaaS signup: company + super admin account (step 1), then plan selection and
 * Razorpay payment (step 2). The account exists after step 1 — if payment is
 * abandoned, logging in later lands on /subscription to finish paying.
 */
export const SignUp = () => {
  const { signup, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  /* /pricing hands over the plan and cycle the visitor already picked.
     Both used to be discarded, so the signup step restarted at monthly. */
  const { billingCycle = 'monthly' } = useLocation().state ?? {};

  const [step, setStep] = useState('account'); // 'account' | 'plan'
  const [form, setForm] = useState({ company_name: '', name: '', email: '', phone: '', password: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [plans, setPlans] = useState([]);
  const [busyPlanId, setBusyPlanId] = useState(null);

  useEffect(() => {
    api.get('/billing/plans').then(({ data }) => setPlans(PUBLIC_PLANS(data.plans))).catch(() => {});
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
      // Honour the cycle chosen on /pricing. purchasePlan already takes it
      // and already posts billing_cycle to POST /billing/order; it was just
      // never being passed, so every signup was charged monthly.
      await purchasePlan(plan, user, billingCycle);
      toast.success('Subscription active! Create your first site to get started.');
      navigate('/sites');
    } catch (err) {
      if (err.message !== 'Payment cancelled') setError(err.message);
    } finally {
      setBusyPlanId(null);
    }
  };

  const stepper = (
    <div className="flex items-center gap-2.5">
      {STEPS.map((s, i) => {
        const isActive = s.key === step;
        const isDone = STEPS.findIndex((x) => x.key === step) > i;
        return (
          <div key={s.key} className="flex items-center gap-2.5">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold transition-colors ${
                isDone ? 'bg-mr-ink text-white'
                  : isActive ? 'bg-mr-blue-soft text-mr-blue ring-2 ring-mr-blue/25'
                  : 'bg-mr-surface-2 text-mr-faint'
              }`}
            >
              {isDone ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className={`text-[12px] font-medium ${isActive ? 'text-mr-text' : 'text-mr-muted'}`}>{s.label}</span>
            {i < STEPS.length - 1 && <span className="h-px w-7 bg-mr-line-strong" />}
          </div>
        );
      })}
    </div>
  );

  // The plan step needs the full width for the cards.
  if (step === 'plan') {
    return (
      <div className="auth-type flex min-h-screen w-full flex-col bg-mr-canvas text-mr-text">
        <PublicNav active="signup" compact />
        {/* pt-10 clears the floating pill nav, which carries its own inset */}
        <main id="main" className="mx-auto w-full max-w-[1120px] flex-1 px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
          <div className="flex justify-center">{stepper}</div>
          <h1 className="mt-7 text-center text-[clamp(1.75rem,3vw,2.25rem)] font-semibold leading-[1.05] tracking-[-0.04em] text-mr-text">
            Choose your plan
          </h1>
          <p className="mx-auto mt-3 max-w-[52ch] text-center text-[15px] leading-[1.6] text-mr-muted">
            Every plan includes the full platform. They differ only by how many sites you can manage.
          </p>
          {user?.email && (
            <p className="mx-auto mt-5 flex w-fit items-center gap-1.5 rounded-full border border-mr-line bg-mr-surface px-3 py-1.5 text-[12px] font-medium text-mr-muted">
              <ShieldCheck className="h-3.5 w-3.5 text-mr-lime-ink" strokeWidth={2} aria-hidden="true" />
              Signed in as {user.email}
            </p>
          )}

          {error && (
            <Alert role="alert" variant="destructive" className="mx-auto mt-6 max-w-md rounded-control border-mr-coral-ink/20 bg-mr-coral-soft text-[13px] text-mr-coral-ink">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="mt-10">
            {plans.length > 0 ? (
              <PlanCards plans={plans} busyPlanId={busyPlanId} onChoose={handleChoosePlan} ctaLabel="Pay & activate" billingCycle={billingCycle} />
            ) : (
              /* Two placeholders — PUBLIC_PLANS returns two plans, so a
                 three-cell skeleton reflowed into an empty column. */
              <div className="grid gap-5 sm:grid-cols-2">
                {[0, 1].map((i) => (
                  <div key={i} className="h-80 rounded-panel border border-mr-line bg-mr-surface" />
                ))}
              </div>
            )}
            <p className={`mt-8 text-center ${META}`}>
              Payments secured by Razorpay · Cancel or change plans any time · GST invoice on every payment
            </p>
          </div>
        </main>

        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="auth-type flex min-h-screen w-full flex-col bg-mr-canvas text-mr-text">
      <PublicNav active="signup" compact />

      <main id="main" className="flex-1">
        <AuthShell
          title="Create your company account"
          subtitle="You will be the Super Admin of your organisation."
          footer={(
            <>
              <p>
                Already have an account? <Link to="/login" className={LINK_SM}>Sign in</Link>
              </p>
              <p className="mt-2 leading-relaxed">
                By continuing you agree to our{' '}
                <Link to="/terms" className={LINK_SM}>Terms</Link> and{' '}
                <Link to="/privacy" className={LINK_SM}>Privacy Policy</Link>.
              </p>
            </>
          )}
        >
          <div className="mb-7">{stepper}</div>

          {error && (
            <Alert role="alert" variant="destructive" className="mb-6 rounded-control border-mr-coral-ink/20 bg-mr-coral-soft text-[13px] text-mr-coral-ink">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleAccountSubmit} className="space-y-4">
            <Field
              id="company_name" label="Company name" placeholder="Shree Ganesh Developers"
              autoComplete="organization" autoFocus
              value={form.company_name} onChange={set('company_name')} required disabled={loading}
            />
            <Field
              id="name" label="Your name" placeholder="Full name" autoComplete="name"
              value={form.name} onChange={set('name')} required disabled={loading}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="email" label="Work email" type="email" placeholder="you@company.com" autoComplete="email"
                value={form.email} onChange={set('email')} required disabled={loading}
              />
              <Field
                id="phone" label="Phone" hint="optional" type="tel" placeholder="98XXXXXXXX" autoComplete="tel"
                value={form.phone} onChange={set('phone')} disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="password" className={LABEL_CLASS}>Password</Label>
                <span className="text-[12px] text-mr-faint">min. 6 characters</span>
              </div>
              <div className="relative">
                <Input
                  id="password" name="password" type={showPass ? 'text' : 'password'} placeholder="••••••••"
                  autoComplete="new-password"
                  value={form.password} onChange={set('password')} required disabled={loading}
                  className={`${FIELD_CLASS} pr-11`}
                />
                <button
                  type="button" tabIndex={-1}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-control text-mr-faint transition-colors hover:text-mr-text"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.password && (
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex flex-1 gap-1">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < strength ? STRENGTH_META[strength].color : 'bg-mr-surface-2'}`} />
                    ))}
                  </div>
                  <span className="w-11 text-right text-[12px] font-medium text-mr-muted">{STRENGTH_META[strength].label}</span>
                </div>
              )}
            </div>

            <Field
              id="confirm" label="Confirm password" type={showPass ? 'text' : 'password'} placeholder="••••••••"
              autoComplete="new-password"
              value={form.confirm} onChange={set('confirm')} required disabled={loading}
            />

            <Button type="submit" disabled={loading} className={`w-full justify-center ${BTN_INK}`}>
              {loading ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Creating account…
                </>
              ) : (
                <>
                  Continue to plans
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

export default SignUp;
