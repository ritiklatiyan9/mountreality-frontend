import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, ShieldCheck } from 'lucide-react';
import api from '../api/api';
import PublicNav from '../components/ui/public-nav';
import PlanCards from '../components/PlanCards';

export const Pricing = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    api.get('/billing/plans').then(({ data }) => setPlans(data.plans)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen w-full bg-background scroll-smooth relative overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-140px] h-[460px] w-[460px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-[-120px] right-[-60px] h-[380px] w-[380px] rounded-full bg-blue-600/10 blur-[120px]" />
      </div>

      <PublicNav active="pricing" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="mx-auto mt-10 max-w-2xl px-6 text-center md:mt-16"
      >
        <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
          Simple pricing, every feature included
        </h1>
        <p className="mt-4 text-sm text-muted-foreground md:text-base">
          No feature gates or hidden tiers — every plan gets the full platform. Plans differ only
          by how many sites you can manage. Pick the one that fits your portfolio and upgrade any time.
        </p>
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
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-72 animate-pulse rounded-xl border border-border/60 bg-card" />
            ))}
          </div>
        )}

        <div className="mt-10 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Payments secured by Razorpay · Cancel or change plans any time
        </div>
      </motion.div>

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
