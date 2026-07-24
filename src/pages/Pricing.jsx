import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, ShieldCheck, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '../api/api';
import PublicNav from '../components/ui/public-nav';
import PlanCards from '../components/PlanCards';
import { Switch } from '../components/ui/switch';

export const Pricing = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [billingCycle, setBillingCycle] = useState('monthly');

  useEffect(() => {
    api.get('/billing/plans').then(({ data }) => setPlans(data.plans)).catch(() => {});
  }, []);

  const annualSavings = useMemo(
    () => plans.reduce((sum, plan) => sum + Math.round(Number(plan.price_inr || 0) * 12 * 0.15), 0),
    [plans]
  );

  return (
    <div className="min-h-screen w-full scroll-smooth relative overflow-x-hidden flex flex-col" style={{ backgroundColor: 'hsl(214 32% 98%)' }}>
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-140px] h-[460px] w-[460px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-[-120px] right-[-60px] h-[380px] w-[380px] rounded-full bg-blue-600/10 blur-[120px]" />
      </div>

      <PublicNav active="pricing" />

      {/* flex-1 fills any leftover space when content is short (keeps the
          footer pinned to the bottom instead of leaving a dead gap), and
          just scrolls normally when content is taller than the viewport. */}
      <main className="flex-1">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="mx-auto mt-10 max-w-2xl px-6 text-center md:mt-16"
        >
          <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Smart tech with smart pricing
          </h1>
          <p className="mt-4 text-sm text-muted-foreground md:text-base">
            No feature gates or hidden tiers — every plan gets the full platform. Plans differ only
            by how many sites you can manage, and yearly billing is always cheaper.
          </p>

          <div className="mt-8 flex items-center justify-center gap-3">
            <span className={cn('text-xs font-bold transition-colors', billingCycle === 'monthly' ? 'text-foreground' : 'text-muted-foreground')}>Monthly</span>
            <Switch
              checked={billingCycle === 'annual'}
              onCheckedChange={(checked) => setBillingCycle(checked ? 'annual' : 'monthly')}
              className="data-[state=checked]:bg-emerald-500"
            />
            <span className={cn('flex items-center gap-1.5 text-xs font-bold transition-colors', billingCycle === 'annual' ? 'text-foreground' : 'text-muted-foreground')}>
              Yearly
              <span className={cn('rounded-full px-2 py-0.5 text-[10px]', billingCycle === 'annual' ? 'bg-emerald-50 text-emerald-700' : 'bg-secondary text-muted-foreground')}>
                15% off
              </span>
            </span>
          </div>

          {billingCycle === 'annual' && annualSavings > 0 && (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-emerald-600">
              <Sparkles className="h-3.5 w-3.5" /> 15% annual savings included across all plans
            </p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
          className="mx-auto mt-12 max-w-5xl px-6 pb-24"
        >
          {plans.length > 0 ? (
            <PlanCards
              plans={plans}
              ctaLabel="Get started"
              onChoose={() => navigate('/signup')}
              billingCycle={billingCycle}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-72 animate-pulse rounded-[24px] border border-border/60 bg-card" />
              ))}
            </div>
          )}

          <div className="mt-10 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Payments secured by Razorpay · Cancel or change plans any time
          </div>
        </motion.div>
      </main>

      <footer className="border-t border-border bg-background py-6 sm:py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 sm:w-6 h-5 sm:h-6 rounded bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center">
              <Building2 className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-primary-foreground" />
            </div>
            <span className="text-xs sm:text-sm font-medium text-foreground">Mount Reality</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-5 text-xs text-muted-foreground">
            <Link to="/login" className="hover:text-foreground transition-colors">Sign In</Link>
            <Link to="/signup" className="hover:text-foreground transition-colors">Sign Up</Link>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Mount Reality. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Pricing;
