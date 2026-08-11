import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Building2, Check, Loader2, Moon, SunDim, Users } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/api/api';
import { useAuth } from '@/context/AuthContext';
import { applyTheme, currentTheme, normaliseTheme } from '@/lib/appearance';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: SunDim },
  { value: 'dark', label: 'Dark', icon: Moon },
];

const themeLabel = (theme) => (normaliseTheme(theme) === 'dark' ? 'Dark' : 'Light');

/* Company-aware appearance control. Every member owns a private preference;
   company administrators can intentionally publish their selection to all
   members, resetting per-user overrides in the same transaction. */
export function AnimatedThemeToggler({ className, ...props }) {
  const { user, isAdmin } = useAuth();
  const buttonRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(currentTheme);
  const [personalTheme, setPersonalTheme] = useState(null);
  const [companyTheme, setCompanyTheme] = useState('light');
  const [canApplyCompanyTheme, setCanApplyCompanyTheme] = useState(false);
  const [saving, setSaving] = useState('');

  const applyWithReveal = useCallback(async (nextTheme) => {
    const apply = () => {
      const next = applyTheme(nextTheme);
      setTheme(next);
    };

    if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      apply();
      return;
    }

    const root = document.documentElement;
    root.classList.add('theme-switching');
    const transition = document.startViewTransition(() => flushSync(apply));
    transition.finished.finally(() => root.classList.remove('theme-switching'));

    try {
      await transition.ready;
      const { top, left, width, height } = buttonRef.current?.getBoundingClientRect() || {};
      if (![top, left, width, height].every(Number.isFinite)) return;
      const x = left + width / 2;
      const y = top + height / 2;
      const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 520, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' },
      );
    } catch {
      // The theme has already been applied; a skipped browser transition is safe.
    }
  }, []);

  const loadAppearance = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await api.get('/appearance');
      const nextTheme = normaliseTheme(data.effective_theme);
      applyTheme(nextTheme);
      setTheme(nextTheme);
      setPersonalTheme(data.personal_theme || null);
      setCompanyTheme(normaliseTheme(data.company_theme));
      setCanApplyCompanyTheme(Boolean(data.can_apply_company_theme));
    } catch {
      // Keep the already-applied local value while an older API is restarting.
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return undefined;
    void loadAppearance();
    const refresh = () => {
      if (document.visibilityState === 'visible') void loadAppearance();
    };
    const interval = window.setInterval(refresh, 5 * 60_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [loadAppearance, user?.id]);

  const savePersonalTheme = async (nextTheme) => {
    setSaving('personal');
    try {
      const { data } = await api.put('/appearance/personal', { theme: nextTheme });
      await applyWithReveal(data.effective_theme);
      setPersonalTheme(data.personal_theme || nextTheme);
      setCompanyTheme(normaliseTheme(data.company_theme));
      toast.success(`${themeLabel(nextTheme)} theme saved for you`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Your theme could not be saved');
    } finally {
      setSaving('');
    }
  };

  const useCompanyTheme = async () => {
    setSaving('personal');
    try {
      const { data } = await api.delete('/appearance/personal');
      await applyWithReveal(data.effective_theme);
      setPersonalTheme(null);
      setCompanyTheme(normaliseTheme(data.company_theme));
      toast.success('Company theme restored');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Company theme could not be restored');
    } finally {
      setSaving('');
    }
  };

  const applyToCompany = async () => {
    if (!window.confirm(`Apply the ${themeLabel(theme)} theme to every company member? Their personal theme choices will be reset.`)) return;
    setSaving('company');
    try {
      const { data } = await api.put('/appearance/company', { theme });
      await applyWithReveal(data.effective_theme);
      setCompanyTheme(normaliseTheme(data.company_theme));
      setPersonalTheme(null);
      toast.success('Company theme applied to all members');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Company theme could not be applied');
    } finally {
      setSaving('');
    }
  };

  const canPublish = isAdmin && canApplyCompanyTheme;
  const ThemeIcon = theme === 'dark' ? SunDim : Moon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          ref={buttonRef}
          type="button"
          className={cn(className)}
          title="Appearance"
          aria-label={`Appearance: ${themeLabel(theme)} theme`}
          {...props}
        >
          <ThemeIcon className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[21rem] rounded-panel-sm border-mr-line bg-mr-surface p-4 text-mr-text shadow-xl shadow-black/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold">Workspace appearance</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-mr-muted">Set your own theme, or publish the current choice for the company.</p>
          </div>
          <span className="rounded-full bg-mr-surface-2 px-2 py-1 text-[10px] font-medium text-mr-muted">{personalTheme ? 'Personal' : 'Company'}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Personal theme">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
            const selected = theme === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => savePersonalTheme(value)}
                disabled={Boolean(saving)}
                className={cn(
                  'flex h-12 items-center justify-between rounded-control border px-3 text-left text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue disabled:opacity-60',
                  selected ? 'border-mr-blue bg-mr-blue-soft text-mr-blue-deep' : 'border-mr-line bg-mr-surface hover:bg-mr-surface-2',
                )}
              >
                <span className="flex items-center gap-2"><Icon className="h-4 w-4" strokeWidth={1.9} /> {label}</span>
                {selected ? <Check className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>

        {personalTheme ? (
          <button type="button" onClick={useCompanyTheme} disabled={Boolean(saving)} className="mt-3 text-[11px] font-medium text-mr-blue hover:underline disabled:opacity-60">
            Use company default ({themeLabel(companyTheme)})
          </button>
        ) : (
          <p className="mt-3 text-[11px] text-mr-muted">Using the company default: {themeLabel(companyTheme)}.</p>
        )}

        {canPublish ? (
          <div className="mt-4 rounded-control border border-mr-line bg-mr-surface-2 p-3">
            <div className="flex gap-2.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mr-ink text-white"><Building2 className="h-3.5 w-3.5" strokeWidth={1.9} /></span>
              <div>
                <p className="text-[12px] font-semibold">Company appearance</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-mr-muted">Apply {themeLabel(theme).toLowerCase()} to all members and reset personal overrides.</p>
              </div>
            </div>
            <button type="button" onClick={applyToCompany} disabled={Boolean(saving)} className="mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-control bg-mr-ink px-3 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60">
              {saving === 'company' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />} Apply to company
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
