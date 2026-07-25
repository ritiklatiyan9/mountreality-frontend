import { Check, MapPin, Loader2, Users, Building2, Layers, TrendingUp, Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { formatINR } from '../lib/razorpay';

const UNLIMITED_SITE_LIMIT = 999999;

const PLAN_ICON = { starter: Building2, professional: Layers, growth: TrendingUp, enterprise: Rocket };

// Every plan gets the full platform — differences are capacity, not features.
const FEATURES = [
  'Dashboard & reports',
  'Plot management',
  'Farmer payments',
  'Registry management',
  'Expense management',
  'Inventory & construction',
  'Unlimited storage',
];

const USER_LIMIT_LABEL = {
  starter: 'Up to 500 users',
  professional: 'Unlimited users',
  growth: 'Unlimited users',
  enterprise: 'Unlimited users',
};

const siteLimitLabel = (plan) => {
  if (Number(plan.site_limit) >= UNLIMITED_SITE_LIMIT) return 'Unlimited sites';
  return `${plan.site_limit} site${plan.site_limit === 1 ? '' : 's'}`;
};

/** Pricing cards shared by the Pricing, SignUp and Subscription pages. Pass
 * `dark` for the dark card treatment used on the Subscription page. */
const PlanCards = ({
  plans, currentPlanId, busyPlanId, onChoose, ctaLabel = 'Choose plan',
  billingCycle = 'monthly', allowCurrentSelection = false, dark = false,
}) => (
  <div className="grid gap-5 pt-3 sm:grid-cols-2 lg:grid-cols-3">
    {plans.map((plan) => {
      const isCurrent = plan.id === currentPlanId;
      const isBusy = plan.id === busyPlanId;
      const highlighted = plan.code === 'professional';
      const monthlyPrice = Number(plan.price_inr) || 0;
      const annualPrice = Math.round(monthlyPrice * 12 * 0.85);
      const isAnnual = billingCycle === 'annual';
      const displayPrice = isAnnual ? annualPrice : monthlyPrice;
      const savings = Math.round(monthlyPrice * 12 - annualPrice);
      const userLimit = USER_LIMIT_LABEL[plan.code];
      const Icon = PLAN_ICON[plan.code] || Layers;

      return (
        <div
          key={plan.id}
          className={cn(
            'relative flex flex-col rounded-[22px] p-7 transition-all duration-300',
            dark
              ? cn(
                  'bg-slate-900 text-slate-100 ring-1',
                  highlighted ? 'ring-2 ring-primary' : 'ring-slate-700/70 hover:ring-slate-600',
                )
              : cn(
                  'ring-1 hover:-translate-y-1',
                  highlighted
                    ? 'bg-gradient-to-b from-primary/[0.055] via-white to-white shadow-[0_24px_60px_-24px_rgba(37,99,235,0.45)] ring-2 ring-primary'
                    : isCurrent
                      ? 'bg-white shadow-md ring-2 ring-cyan-300'
                      : 'bg-white ring-slate-200 hover:shadow-xl hover:shadow-slate-900/[0.07]',
                )
          )}
        >
          {highlighted && (
            <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-primary-foreground shadow-sm shadow-primary/30">
              Most popular
            </span>
          )}
          {isCurrent && (
            <span className="absolute -top-3 right-7 rounded-full bg-cyan-500 px-3 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-white">
              Current plan
            </span>
          )}

          <span className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl',
            highlighted ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
              : dark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-500'
          )}>
            <Icon className="h-[18px] w-[18px]" />
          </span>

          <h3 className={cn('mt-4 text-[18px] font-semibold tracking-[-0.015em]', dark ? 'text-white' : 'text-slate-900')}>
            {plan.name}
          </h3>
          <p className={cn('mt-1 flex items-center gap-1.5 text-[13px]', dark ? 'text-slate-400' : 'text-slate-500')}>
            <MapPin className="h-3.5 w-3.5" />
            {siteLimitLabel(plan)}
          </p>

          <div className="mt-6 flex items-end gap-2">
            <span className={cn('text-[40px] font-semibold leading-none tracking-[-0.04em]', dark ? 'text-white' : 'text-slate-900')}>
              {formatINR(displayPrice)}
            </span>
            <span className="pb-1 text-[14px] text-slate-400">/{isAnnual ? 'year' : 'month'}</span>
          </div>

          <div className="mt-3 min-h-[26px] text-[12px]">
            {isAnnual ? (
              <span className="flex flex-wrap items-center gap-2">
                {/* Struck price is the honest comparison: 12 × the monthly rate. */}
                <span className={cn('line-through', dark ? 'text-slate-500' : 'text-slate-400')}>
                  {formatINR(monthlyPrice * 12)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-600">
                  Save {formatINR(savings)}
                </span>
              </span>
            ) : (
              <span className={dark ? 'text-slate-500' : 'text-slate-400'}>
                {formatINR(annualPrice)}/year on yearly billing — save 15%
              </span>
            )}
          </div>

          <div className={cn('my-6 h-px', dark ? 'bg-slate-700/60' : 'bg-slate-100')} />

          <ul className={cn('space-y-2.5 text-[13.5px]', dark ? 'text-slate-300' : 'text-slate-600')}>
            {userLimit && (
              <li className="flex items-start gap-2.5 font-medium">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {userLimit}
              </li>
            )}
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/12">
                  <Check className="h-2.5 w-2.5 text-emerald-600" strokeWidth={3.5} />
                </span>
                {f}
              </li>
            ))}
          </ul>

          <Button
            className={cn(
              'mt-8 h-11 w-full rounded-xl text-[14px] font-semibold transition active:scale-[0.99]',
              highlighted && 'shadow-sm shadow-primary/25',
              dark && !highlighted && 'border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700'
            )}
            variant={highlighted ? 'default' : 'outline'}
            disabled={!!busyPlanId || (isCurrent && !allowCurrentSelection)}
            onClick={() => onChoose(plan)}
          >
            {isBusy ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>
            ) : isCurrent && !allowCurrentSelection ? 'Current plan' : isCurrent ? `Renew ${plan.name}` : ctaLabel}
          </Button>
        </div>
      );
    })}
  </div>
);

export default PlanCards;
