import { Check, MapPin, Loader2, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { formatINR } from '../lib/razorpay';

const FEATURES = [
  'All modules included',
  'Unlimited admins & sub-admins',
  'Approvals, permissions & reports',
  'Documents, imprest & UPI collect',
];

/** Pricing cards shared by the SignUp and Subscription pages. */
const PlanCards = ({ plans, currentPlanId, busyPlanId, onChoose, ctaLabel = 'Choose plan', billingCycle = 'monthly', allowCurrentSelection = false }) => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {plans.map((plan) => {
      const isCurrent = plan.id === currentPlanId;
      const isBusy = plan.id === busyPlanId;
      const highlighted = plan.code === 'growth';
      const monthlyPrice = Number(plan.price_inr) || 0;
      const annualPrice = Math.round(monthlyPrice * 12 * 0.85);
      const isAnnual = billingCycle === 'annual';
      const displayPrice = isAnnual ? annualPrice : monthlyPrice;
      const savings = Math.round(monthlyPrice * 12 - annualPrice);
      return (
        <Card
          key={plan.id}
          className={`relative flex flex-col overflow-hidden rounded-[24px] border-2 bg-white transition-shadow ${highlighted ? 'border-emerald-400 shadow-lg shadow-emerald-900/[0.08]' : isCurrent ? 'border-cyan-300 shadow-md shadow-cyan-900/[0.05]' : 'border-slate-200 hover:shadow-lg hover:shadow-slate-900/[0.05]'}`}
        >
          {highlighted && (
            <Badge className="absolute right-4 top-4 bg-emerald-600 text-white hover:bg-emerald-600">Most popular</Badge>
          )}
          {isCurrent && <span className="absolute left-4 top-4 rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-bold text-cyan-700">Current plan</span>}
          <CardHeader className={`pb-2 ${highlighted ? 'pt-14' : isCurrent ? 'pt-14' : ''}`}>
            <CardTitle className="text-lg text-slate-950">{plan.name}</CardTitle>
            <CardDescription className="flex items-center gap-1.5 text-slate-500">
              <MapPin className="h-3.5 w-3.5" />
              {plan.site_limit} site{plan.site_limit === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <div>
              <span className="text-3xl font-bold tracking-tight text-slate-950">{formatINR(displayPrice)}</span>
              <span className="ml-1 text-sm text-slate-500">/{isAnnual ? 'year' : 'month'}</span>
              {isAnnual ? <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700"><Sparkles className="h-3.5 w-3.5" />Save {formatINR(savings)} annually · 15% off</div> : <p className="mt-2 text-[11px] text-slate-400">Switch to annual and save 15%</p>}
            </div>
            <ul className="space-y-2 text-sm text-slate-500">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              className={`mt-auto w-full rounded-xl ${highlighted ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
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
