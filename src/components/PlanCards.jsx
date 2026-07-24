import { Check, MapPin, Loader2, Sparkles, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { formatINR } from '../lib/razorpay';

const UNLIMITED_SITE_LIMIT = 999999;

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
  enterprise: 'Unlimited users',
};

const siteLimitLabel = (plan) => {
  if (Number(plan.site_limit) >= UNLIMITED_SITE_LIMIT) return 'Unlimited sites';
  return `${plan.site_limit} site${plan.site_limit === 1 ? '' : 's'}`;
};

/** Pricing cards shared by the SignUp and Subscription pages. Pass `dark`
 * for the dark, dribbble-style card treatment used on the Subscription
 * page; the public Pricing page keeps the original light cards. */
const PlanCards = ({
  plans, currentPlanId, busyPlanId, onChoose, ctaLabel = 'Choose plan',
  billingCycle = 'monthly', allowCurrentSelection = false, dark = false,
}) => (
  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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

      return (
        <Card
          key={plan.id}
          className={cn(
            'relative flex flex-col overflow-hidden rounded-[24px] border-2 transition-shadow',
            dark
              ? cn(
                  'bg-slate-900 text-slate-100',
                  highlighted ? 'border-emerald-400 shadow-lg shadow-emerald-950/40' : 'border-slate-700/70 hover:border-slate-600',
                )
              : cn(
                  'bg-white',
                  highlighted ? 'border-emerald-400 shadow-lg shadow-emerald-900/[0.08]' : isCurrent ? 'border-cyan-300 shadow-md shadow-cyan-900/[0.05]' : 'border-slate-200 hover:shadow-lg hover:shadow-slate-900/[0.05]',
                )
          )}
        >
          {highlighted && (
            <Badge className="absolute right-4 top-4 bg-emerald-500 text-white hover:bg-emerald-500">Most popular</Badge>
          )}
          {isCurrent && (
            <span className={cn(
              'absolute left-4 top-4 rounded-full px-2.5 py-1 text-[10px] font-bold',
              dark ? 'bg-cyan-500/15 text-cyan-300' : 'bg-cyan-50 text-cyan-700'
            )}>
              Current plan
            </span>
          )}
          <CardHeader className={cn('pb-2', (highlighted || isCurrent) && 'pt-14')}>
            <CardTitle className={cn('text-lg', dark ? 'text-white' : 'text-slate-950')}>{plan.name}</CardTitle>
            <CardDescription className={cn('flex items-center gap-1.5', dark ? 'text-slate-400' : 'text-slate-500')}>
              <MapPin className="h-3.5 w-3.5" />
              {siteLimitLabel(plan)}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <div>
              <span className={cn('text-3xl font-bold tracking-tight', dark ? 'text-white' : 'text-slate-950')}>{formatINR(displayPrice)}</span>
              <span className={cn('ml-1 text-sm', dark ? 'text-slate-400' : 'text-slate-500')}>/{isAnnual ? 'year' : 'month'}</span>
              {isAnnual ? (
                <div className={cn('mt-2 flex items-center gap-1.5 text-[11px] font-medium', dark ? 'text-emerald-400' : 'text-emerald-700')}>
                  <Sparkles className="h-3.5 w-3.5" />Save {formatINR(savings)} annually · 15% off
                </div>
              ) : (
                <p className={cn('mt-2 text-[11px]', dark ? 'text-slate-500' : 'text-slate-400')}>Switch to annual and save 15%</p>
              )}
            </div>
            <ul className={cn('space-y-2 text-sm', dark ? 'text-slate-300' : 'text-slate-500')}>
              {userLimit && (
                <li className="flex items-start gap-2 font-medium">
                  <Users className={cn('mt-0.5 h-4 w-4 shrink-0', dark ? 'text-emerald-400' : 'text-emerald-600')} />
                  {userLimit}
                </li>
              )}
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className={cn('mt-0.5 h-4 w-4 shrink-0', dark ? 'text-emerald-400' : 'text-emerald-600')} />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              className={cn(
                'mt-auto w-full rounded-xl',
                highlighted && 'bg-emerald-500 text-white hover:bg-emerald-600',
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
          </CardContent>
        </Card>
      );
    })}
  </div>
);

export default PlanCards;
