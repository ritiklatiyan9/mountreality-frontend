import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertCircle, ArrowRight, BadgeCheck, CalendarClock, Check, Crown, MapPin, RefreshCw, Sparkles, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { formatINR, purchasePlan } from '../lib/razorpay';
import PlanCards from '../components/PlanCards';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';

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
  const usagePercent = siteLimit ? Math.min(100, Math.round((sitesUsed / siteLimit) * 100)) : 0;
  const annualSavings = useMemo(() => plans.reduce((sum, plan) => sum + Math.round(Number(plan.price_inr || 0) * 12 * 0.15), 0), [plans]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white px-5 py-6 shadow-sm shadow-slate-900/[0.03] sm:px-7">
        <div className="pointer-events-none absolute right-0 top-0 h-48 w-96 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,.16),transparent_65%)]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><Crown className="h-5 w-5" /></span><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-600">Billing & plan</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Keep your workspace growing</h1><p className="mt-1 text-sm text-slate-500">{data?.organization ? `${data.organization} · ` : ''}choose the plan that fits your active projects.</p></div></div>
          <Button variant="outline" size="sm" className="relative w-fit rounded-full border-slate-200 bg-white" onClick={() => load(true)} disabled={refreshing}><RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>
      </section>

      {loading ? <div className="space-y-4"><Skeleton className="h-52 w-full rounded-[28px]" /><Skeleton className="h-10 w-56 rounded-full" /><div className="grid gap-4 md:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-96 rounded-[24px]" />)}</div></div> : <>
        {!active ? <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50 text-red-800"><AlertCircle className="h-4 w-4" /><AlertDescription>Your organization does not have an active subscription. Choose a plan below to unlock your workspace.</AlertDescription></Alert> : <section className="grid overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03] lg:grid-cols-[1.1fr_.9fr]">
          <div className="p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><BadgeCheck className="h-5 w-5" /></span><div><p className="text-sm font-bold text-slate-900">{subscription.plan_name} plan</p><p className="text-[11px] text-slate-500">Your subscription is active</p></div></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Active</span></div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"><span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400"><CalendarClock className="h-3.5 w-3.5" /> Renewal</span><p className="mt-2 text-base font-bold text-slate-900">{dateLabel(periodEnd)}</p><p className="mt-1 text-xs text-slate-500">{daysLeft} day{daysLeft === 1 ? '' : 's'} remaining · {subscription.billing_cycle === 'annual' ? 'Annual billing' : 'Monthly billing'}</p></div><div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"><span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400"><Zap className="h-3.5 w-3.5" /> Current investment</span><p className="mt-2 text-base font-bold text-slate-900">{formatINR(subscription.amount_inr || subscription.price_inr)}</p><p className="mt-1 text-xs text-slate-500">{subscription.billing_cycle === 'annual' ? 'for 12 months' : 'per month'}</p></div></div>
          </div>
          <div className="border-t border-slate-200 bg-linear-to-br from-cyan-50 via-white to-emerald-50 p-5 lg:border-l lg:border-t-0 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-bold text-slate-900">Site capacity</p><p className="mt-0.5 text-[11px] text-slate-500">Usage from your current plan</p></div><span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-cyan-600 shadow-sm"><MapPin className="h-4.5 w-4.5" /></span></div><div className="mt-7"><div className="flex items-end justify-between"><span className="text-3xl font-bold tracking-tight text-slate-950">{sitesUsed}<span className="text-base font-semibold text-slate-400"> / {siteLimit}</span></span><span className="text-xs font-bold text-cyan-700">{usagePercent}% used</span></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-white ring-1 ring-slate-200"><div className={`h-full rounded-full transition-[width] duration-500 ${usagePercent >= 90 ? 'bg-amber-500' : 'bg-cyan-500'}`} style={{ width: `${usagePercent}%` }} /></div><p className="mt-3 text-xs leading-5 text-slate-500">{usagePercent >= 90 ? 'You are close to your site capacity. Consider upgrading before adding another site.' : `${Math.max(siteLimit - sitesUsed, 0)} site${siteLimit - sitesUsed === 1 ? '' : 's'} available in your current plan.`}</p></div></div>
        </section>}

        <section className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[0.02] sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><p className="text-sm font-bold text-slate-900">Choose how you pay</p><p className="mt-0.5 text-xs text-slate-500">Annual billing gives every plan 15% off.</p></div><div className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 p-1"><button type="button" onClick={() => setBillingCycle('monthly')} className={`rounded-full px-4 py-2 text-xs font-bold transition ${billingCycle === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Monthly</button><button type="button" onClick={() => setBillingCycle('annual')} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition ${billingCycle === 'annual' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400'}`}>Annual <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${billingCycle === 'annual' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>SAVE 15%</span></button></div></section>

        <section><div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-bold tracking-tight text-slate-950">{active ? 'Renew or change your plan' : 'Choose your plan'}</h2><p className="mt-1 text-sm text-slate-500">All plans include the full accounting workspace and team controls.</p></div>{billingCycle === 'annual' && annualSavings > 0 && <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700"><Sparkles className="h-3.5 w-3.5" />15% annual savings included</span>}</div>
          {isAdmin ? <div className="mt-5"><PlanCards plans={plans} currentPlanId={subscription?.plan_id} busyPlanId={busyPlanId} onChoose={handleChoosePlan} ctaLabel={active ? `Pay ${billingCycle === 'annual' ? 'annually' : 'monthly'}` : 'Pay & activate'} billingCycle={billingCycle} allowCurrentSelection={active} /></div> : <Alert className="mt-5 rounded-2xl border-slate-200 bg-slate-50"><AlertCircle className="h-4 w-4" /><AlertDescription>Only your Super Admin can renew or change the plan. Please contact them.</AlertDescription></Alert>}
        </section>

        <section className="flex flex-col gap-3 rounded-[24px] border border-cyan-100 bg-cyan-50/60 px-5 py-4 text-sm text-cyan-950 sm:flex-row sm:items-center sm:justify-between"><span className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />Payments are secure through Razorpay. Renewals extend from your current expiry date.</span><span className="inline-flex items-center gap-1 text-xs font-bold text-cyan-700">Need more capacity? Choose a higher plan <ArrowRight className="h-3.5 w-3.5" /></span></section>
      </>}
    </div>
  );
};

export default Subscription;
