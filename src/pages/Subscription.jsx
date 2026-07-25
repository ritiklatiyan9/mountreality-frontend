import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertCircle, Check, RefreshCw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { formatINR, purchasePlan } from '../lib/razorpay';
import PlanCards from '../components/PlanCards';
import { Skeleton } from '../components/ui/skeleton';
import { Switch } from '../components/ui/switch';
import { PageHeader, SectionHead, StatusDot, GHOST_BTN } from '../components/ui/page';

const dateLabel = (date) => date ? new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const Subscription = () => {
  const { user, isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyPlanId, setBusyPlanId] = useState(null);
  const [billingCycle, setBillingCycle] = useState('annual');

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [subscriptionResponse, plansResponse] = await Promise.all([api.get('/billing/subscription'), api.get('/billing/plans')]);
      setData(subscriptionResponse.data);
      setPlans(plansResponse.data?.plans || []);
    } catch {
      toast.error('Could not load subscription details. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleChoosePlan = async (plan) => {
    setBusyPlanId(plan.id);
    try {
      await purchasePlan(plan, user, billingCycle);
      toast.success(`${plan.name} ${billingCycle === 'annual' ? 'annual' : 'monthly'} plan activated`);
      await load();
    } catch (error) {
      if (error.message !== 'Payment cancelled') toast.error(error.message || 'Payment could not be completed');
    } finally {
      setBusyPlanId(null);
    }
  };

  const subscription = data?.subscription;
  const active = Boolean(subscription);
  const periodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end) : null;
  const daysLeft = periodEnd ? Math.max(0, Math.ceil((periodEnd.getTime() - Date.now()) / 86400000)) : 0;
  const sitesUsed = Number(data?.sites_used) || 0;
  const siteLimit = Number(subscription?.site_limit) || 0;
  const isUnlimitedSites = siteLimit >= 999999;
  const usagePercent = siteLimit && !isUnlimitedSites ? Math.min(100, Math.round((sitesUsed / siteLimit) * 100)) : 0;
  const annualSavings = useMemo(() => plans.reduce((sum, plan) => sum + Math.round(Number(plan.price_inr || 0) * 12 * 0.15), 0), [plans]);

  return (
    <div className="mx-auto w-full max-w-5xl pb-16">
      <PageHeader
        title="Billing & plan"
        description={`${data?.organization ? `${data.organization} · ` : ''}Choose the plan that fits your active projects.`}
        actions={
          <button type="button" className={GHOST_BTN} onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} strokeWidth={1.9} aria-hidden="true" /> Refresh
          </button>
        }
      />

      {loading ? (
        <div className="mt-8 space-y-8">
          <div className="grid gap-8 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-14 rounded-control" />)}
          </div>
          <Skeleton className="h-96 rounded-control" />
        </div>
      ) : (
        <>
          {/* ── Current subscription ── */}
          <section className="mt-8">
            <SectionHead
              title="Current plan"
              actions={active
                ? <StatusDot tone="positive">Active</StatusDot>
                : <StatusDot tone="negative">No subscription</StatusDot>}
            />

            {!active ? (
              <p className="flex items-start gap-2 py-6 text-[14px] leading-relaxed text-mr-coral-ink">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
                Your organization does not have an active subscription. Choose a plan below to unlock your workspace.
              </p>
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-x-8 gap-y-6 py-6 lg:grid-cols-4">
                  <div className="min-w-0">
                    <dt className="text-[13px] text-mr-muted">Plan</dt>
                    <dd className="mt-1 truncate text-[22px] font-semibold tracking-[-0.02em] text-mr-text">{subscription.plan_name}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[13px] text-mr-muted">Renews on</dt>
                    <dd className="mt-1 text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-mr-text">{dateLabel(periodEnd)}</dd>
                    <p className="mt-1 text-[13px] text-mr-faint">{daysLeft} day{daysLeft === 1 ? '' : 's'} remaining</p>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[13px] text-mr-muted">Amount</dt>
                    <dd className="mt-1 text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-mr-text">
                      {formatINR(subscription.amount_inr || subscription.price_inr)}
                    </dd>
                    <p className="mt-1 text-[13px] text-mr-faint">
                      {subscription.billing_cycle === 'annual' ? 'for 12 months' : 'per month'}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[13px] text-mr-muted">Sites used</dt>
                    <dd className="mt-1 text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-mr-text">
                      {sitesUsed}
                      <span className="text-[15px] font-medium text-mr-faint"> / {isUnlimitedSites ? 'Unlimited' : siteLimit}</span>
                    </dd>
                  </div>
                </dl>

                {/* Capacity bar — width is the encoding, the sentence below states it in words. */}
                {!isUnlimitedSites && (
                  <div className="border-t border-mr-line py-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[14px] font-medium text-mr-text">Site capacity</span>
                      <span className="text-[13px] tabular-nums text-mr-muted">{usagePercent}% used</span>
                    </div>
                    <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-mr-surface-2">
                      <div
                        className={cn('h-full rounded-full transition-[width] duration-500', usagePercent >= 90 ? 'bg-mr-amber' : 'bg-mr-blue')}
                        style={{ width: `${usagePercent}%` }}
                      />
                    </div>
                    <p className="mt-2.5 text-[13px] leading-relaxed text-mr-muted">
                      {usagePercent >= 90
                        ? 'You are close to your site capacity. Consider upgrading before adding another site.'
                        : `${Math.max(siteLimit - sitesUsed, 0)} site${siteLimit - sitesUsed === 1 ? '' : 's'} available in your current plan.`}
                    </p>
                  </div>
                )}
                {isUnlimitedSites && (
                  <p className="border-t border-mr-line py-5 text-[13px] leading-relaxed text-mr-muted">
                    Your Enterprise plan has no site limit — add as many as you need.
                  </p>
                )}
              </>
            )}
          </section>

          {/* ── Plans ── */}
          <section className="mt-10">
            <SectionHead
              title={active ? 'Renew or change your plan' : 'Choose a plan'}
              description="All plans include the full accounting workspace and team controls."
              actions={
                <div className="flex items-center gap-2.5">
                  <span className={cn('text-[13px] font-medium transition-colors', billingCycle === 'monthly' ? 'text-mr-text' : 'text-mr-faint')}>
                    Monthly
                  </span>
                  <Switch
                    checked={billingCycle === 'annual'}
                    onCheckedChange={(checked) => setBillingCycle(checked ? 'annual' : 'monthly')}
                    aria-label="Bill annually instead of monthly"
                    className="data-[state=checked]:bg-mr-ink"
                  />
                  <span className={cn('flex items-center gap-1.5 text-[13px] font-medium transition-colors', billingCycle === 'annual' ? 'text-mr-text' : 'text-mr-faint')}>
                    Yearly
                    <span className="rounded-full bg-mr-lime-soft px-2 py-0.5 text-[11px] font-semibold text-mr-lime-ink">15% off</span>
                  </span>
                </div>
              }
            />

            {billingCycle === 'annual' && annualSavings > 0 && (
              <p className="flex items-center gap-1.5 pt-4 text-[13px] text-mr-muted">
                <Sparkles className="h-3.5 w-3.5 text-mr-lime-ink" strokeWidth={1.9} aria-hidden="true" />
                15% annual savings included across all plans.
              </p>
            )}

            <div className="pt-6">
              {isAdmin ? (
                <PlanCards
                  plans={plans}
                  currentPlanId={subscription?.plan_id}
                  busyPlanId={busyPlanId}
                  onChoose={handleChoosePlan}
                  ctaLabel={active ? `Pay ${billingCycle === 'annual' ? 'annually' : 'monthly'}` : 'Pay & activate'}
                  billingCycle={billingCycle}
                  allowCurrentSelection={active}
                />
              ) : (
                <p className="flex items-start gap-2 text-[14px] leading-relaxed text-mr-muted">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-mr-faint" strokeWidth={1.9} aria-hidden="true" />
                  Only your Super Admin can renew or change the plan. Please contact them.
                </p>
              )}
            </div>
          </section>

          <p className="mt-10 flex items-start gap-2 border-t border-mr-line pt-5 text-[13px] leading-relaxed text-mr-muted">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-mr-lime-ink" strokeWidth={2} aria-hidden="true" />
            Payments are secure through Razorpay. Renewals extend from your current expiry date.
          </p>
        </>
      )}
    </div>
  );
};

export default Subscription;
