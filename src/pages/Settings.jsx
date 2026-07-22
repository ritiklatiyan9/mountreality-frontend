import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import api from '../api/api';
import {
  BadgeCheck, Building2, CheckCircle2, Eye, EyeOff, GitBranch, Info,
  KeyRound, Loader2, Lock, LockOpen, Mail, MessageSquare, PenLine, Phone, Shield,
  Sparkles, User, UserCircle,
} from 'lucide-react';

const SMS_DEFAULTS = { enabled: false, days_before: [7, 3, 1], include_overdue: true, send_hour: 10 };

const getPasswordStrength = (password) => {
  if (!password) return { level: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { level: 1, label: 'Weak', color: 'bg-rose-500' };
  if (score <= 2) return { level: 2, label: 'Fair', color: 'bg-orange-500' };
  if (score <= 3) return { level: 3, label: 'Good', color: 'bg-amber-400' };
  if (score <= 4) return { level: 4, label: 'Strong', color: 'bg-emerald-500' };
  return { level: 5, label: 'Excellent', color: 'bg-emerald-600' };
};

const FieldLabel = ({ htmlFor, icon, children }) => {
  const FieldIcon = icon;
  return (
  <Label htmlFor={htmlFor} className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">
    <FieldIcon className="h-3.5 w-3.5 text-slate-400" /> {children}
  </Label>
  );
};

export const Settings = () => {
  const { user, updateProfile, currentSite, isAdmin } = useAuth();
  const [nameSign, setNameSign] = useState(() => localStorage.getItem('nameSign') !== '0');
  const [profileData, setProfileData] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '' });
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [workflowUnlocked, setWorkflowUnlocked] = useState(false);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowSaving, setWorkflowSaving] = useState(false);
  const [sms, setSms] = useState(SMS_DEFAULTS);
  const [smsDays, setSmsDays] = useState(SMS_DEFAULTS.days_before.join(', '));
  const [smsQueueReady, setSmsQueueReady] = useState(true);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsSaving, setSmsSaving] = useState(false);
  const currentSiteIdRef = useRef(currentSite?.id);

  useEffect(() => {
    currentSiteIdRef.current = currentSite?.id;
  }, [currentSite?.id]);

  useEffect(() => {
    if (!isAdmin || !currentSite?.id) {
      setWorkflowUnlocked(false);
      return;
    }

    let active = true;
    const fetchWorkflowSetting = async () => {
      setWorkflowUnlocked(false);
      setWorkflowLoading(true);
      try {
        const response = await api.get('/settings/features', { params: { site_id: currentSite.id } });
        if (active) setWorkflowUnlocked(response.data.features?.plot_registry_workflow_unlocked === true);
      } catch (error) {
        console.error('Failed to load Plot Registry workflow setting:', error);
        if (active) {
          setWorkflowUnlocked(false);
          toast.error(error.response?.data?.message || 'Could not load workflow settings');
        }
      } finally {
        if (active) setWorkflowLoading(false);
      }
    };
    fetchWorkflowSetting();
    return () => { active = false; };
  }, [currentSite?.id, isAdmin]);

  useEffect(() => {
    if (!isAdmin || !currentSite?.id) return;
    let active = true;
    setSmsLoading(true);
    api.get('/settings/sms-reminders', { params: { site_id: currentSite.id } })
      .then((res) => {
        if (!active) return;
        const cfg = { ...SMS_DEFAULTS, ...(res.data.settings || {}) };
        setSms(cfg);
        setSmsDays((cfg.days_before || []).join(', '));
        setSmsQueueReady(res.data.queue_configured !== false);
      })
      .catch((error) => { if (active) toast.error(error.response?.data?.message || 'Could not load SMS reminder settings'); })
      .finally(() => { if (active) setSmsLoading(false); });
    return () => { active = false; };
  }, [currentSite?.id, isAdmin]);

  const saveSmsSettings = async (patch) => {
    if (!currentSite?.id || smsSaving) return;
    const next = {
      ...sms,
      ...patch,
      days_before: patch?.days_before ?? smsDays.split(',').map((d) => parseInt(d.trim(), 10)).filter(Number.isInteger),
    };
    setSmsSaving(true);
    try {
      const res = await api.put('/settings/sms-reminders', { site_id: currentSite.id, ...next });
      const saved = { ...SMS_DEFAULTS, ...(res.data.settings || {}) };
      setSms(saved);
      setSmsDays((saved.days_before || []).join(', '));
      toast.success(res.data.message || 'SMS reminder settings saved');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not save SMS reminder settings');
    } finally {
      setSmsSaving(false);
    }
  };

  const passwordStrength = getPasswordStrength(passwordData.newPassword);
  const passwordsMatch = passwordData.newPassword && passwordData.confirmPassword && passwordData.newPassword === passwordData.confirmPassword;
  const userInitials = user?.name ? user.name.split(' ').map((name) => name[0]).join('').toUpperCase().slice(0, 2) : '??';
  const roleLabel = user?.role?.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'User';

  const handleNameSignToggle = (checked) => {
    setNameSign(checked);
    localStorage.setItem('nameSign', checked ? '1' : '0');
    toast.success(checked
      ? 'Name Sign on — receipts print your name as authorized signatory'
      : 'Name Sign off — signature pad will ask for customer & authority signatures');
  };

  const handleWorkflowToggle = async (enabled) => {
    if (!currentSite?.id || workflowSaving) return;
    const siteId = currentSite.id;
    const siteName = currentSite.name;
    setWorkflowSaving(true);
    try {
      const response = await api.put('/settings/features/plot-registry-workflow-unlocked', {
        site_id: siteId,
        enabled,
      });
      const savedValue = response.data.features?.plot_registry_workflow_unlocked === true;
      if (currentSiteIdRef.current !== siteId) return;
      setWorkflowUnlocked(savedValue);
      toast.success(savedValue
        ? `Flexible Plot Registry workflow enabled for ${siteName}`
        : `Sequential Plot Registry workflow restored for ${siteName}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not update workflow settings');
    } finally {
      setWorkflowSaving(false);
    }
  };

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setProfileData((previous) => ({ ...previous, [name]: value }));
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;
    setPasswordData((previous) => ({ ...previous, [name]: value }));
  };

  const handleUpdateProfile = async (event) => {
    event.preventDefault();
    setProfileLoading(true);
    try {
      const data = new FormData();
      let hasChanges = false;
      if (profileData.name !== user?.name) { data.append('name', profileData.name); hasChanges = true; }
      if (profileData.email !== user?.email) { data.append('email', profileData.email); hasChanges = true; }
      if (profileData.phone !== (user?.phone || '')) { data.append('phone', profileData.phone); hasChanges = true; }
      if (!hasChanges) { toast.info('No changes to update'); return; }
      await updateProfile(data);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) { toast.error('All password fields are required'); return; }
    if (passwordData.newPassword.length < 6) { toast.error('New password must be at least 6 characters'); return; }
    if (passwordData.newPassword !== passwordData.confirmPassword) { toast.error('New password and confirm password do not match'); return; }
    setPasswordLoading(true);
    try {
      await api.put('/auth/change-password', passwordData);
      toast.success('Password changed successfully');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowCurrentPass(false); setShowNewPass(false); setShowConfirmPass(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const passwordInputClass = 'h-11 rounded-xl border-transparent bg-slate-100/80 pr-10 text-sm shadow-none placeholder:text-slate-400 focus-visible:border-blue-400 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-blue-600/10';
  const inputClass = 'h-11 rounded-xl border-transparent bg-slate-100/80 text-sm shadow-none placeholder:text-slate-400 focus-visible:border-blue-400 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-blue-600/10';

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-14 pt-5 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-5 pb-8 sm:flex-row sm:items-end">
        <div className="flex min-w-0 items-center gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-blue-600 to-blue-800 text-lg font-bold text-white shadow-lg shadow-blue-900/20">
            {userInitials}<span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-[3px] border-slate-50 bg-emerald-500" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-600"><Sparkles className="h-3.5 w-3.5" /> Account & workspace</div>
            <h1 className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Settings</h1>
            <p className="mt-1 truncate text-sm text-slate-500">Manage your profile, security, and operational preferences.</p>
          </div>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 shadow-sm shadow-blue-100 ring-1 ring-blue-200/80"><BadgeCheck className="h-4 w-4 text-blue-600" /> {roleLabel}</div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[270px_minmax(0,1fr)] xl:gap-10">
        <aside className="relative overflow-hidden rounded-[28px] bg-linear-to-br from-blue-950 via-blue-900 to-indigo-950 p-5 text-white shadow-xl shadow-blue-950/15 xl:sticky xl:top-6 xl:h-fit">
          <div className="relative">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Your account</p>
            <p className="mt-2 truncate text-base font-semibold">{user?.name || 'User'}</p>
            <p className="mt-1 truncate text-xs text-slate-400">{user?.email || 'No email added'}</p>
            <div className="mt-6 space-y-1">
              <div className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2.5 text-xs font-medium text-white"><User className="h-4 w-4 text-slate-200" /> Profile details</div>
              <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-slate-400"><Shield className="h-4 w-4" /> Password & security</div>
              <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-slate-400"><PenLine className="h-4 w-4" /> Receipt identity</div>
              {isAdmin && <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-blue-200"><GitBranch className="h-4 w-4" /> Workflow controls</div>}
            </div>
            <div className="mt-8 rounded-2xl bg-white/8 p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-white"><Shield className="h-4 w-4 text-emerald-300" /> Account protected</div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">Use a unique password and keep your account details current.</p>
            </div>
          </div>
        </aside>

        <main className="space-y-6">
          {isAdmin && (
            <section className="relative overflow-hidden rounded-[30px] border border-blue-200/80 bg-white p-5 shadow-[0_18px_50px_-30px_rgba(29,78,216,.45)] sm:p-7">
              <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-blue-100/70 blur-3xl" />
              <div className="relative">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
                      <LockOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-blue-600">Plot Registry workflow</p>
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700"><Building2 className="h-3 w-3" /> {currentSite?.name || 'No site selected'}</span>
                      </div>
                      <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">Flexible workflow override</h2>
                      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">Allow authorized operators to work out of sequence. Payment-completion and step prerequisites are bypassed for NOC, deed upload, and handover; module permissions and required record data remain enforced.</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-3.5 py-3">
                    <div className="text-right">
                      <p className={`text-xs font-bold ${workflowUnlocked ? 'text-blue-700' : 'text-slate-700'}`}>{workflowLoading ? 'Loading' : workflowUnlocked ? 'Flexible' : 'Sequential'}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">Site-specific</p>
                    </div>
                    {workflowLoading || workflowSaving ? (
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    ) : (
                      <Switch
                        id="settings-registry-workflow"
                        checked={workflowUnlocked}
                        onCheckedChange={handleWorkflowToggle}
                        disabled={!currentSite?.id}
                        aria-label="Enable flexible Plot Registry step navigation"
                        className="data-[state=checked]:bg-blue-600"
                      />
                    )}
                  </div>
                </div>
                <div className="mt-5 flex gap-2.5 rounded-2xl border border-blue-100 bg-blue-50/60 p-3 text-xs leading-relaxed text-blue-900">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  <p>{workflowUnlocked ? 'Every workflow step is available for direct navigation on this site.' : 'Steps remain locked until the required earlier workflow stages are complete.'}</p>
                </div>
              </div>
            </section>
          )}

          {isAdmin && (
            <section className="rounded-[30px] border border-emerald-200/80 bg-white p-5 shadow-[0_18px_50px_-30px_rgba(5,150,105,.4)] sm:p-7">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-200">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-emerald-700">Payment reminder SMS</p>
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"><Building2 className="h-3 w-3" /> {currentSite?.name || 'No site selected'}</span>
                    </div>
                    <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">Automatic due-date reminders</h2>
                    <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">
                      Buyers are texted when an installment is due in — or overdue by — exactly the days you list below. Messages are queued to AWS SQS and delivered by the SMS worker. Each reminder goes out at most once a day.
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-3.5 py-3">
                  <div className="text-right">
                    <p className={`text-xs font-bold ${sms.enabled ? 'text-emerald-700' : 'text-slate-700'}`}>{smsLoading ? 'Loading' : sms.enabled ? 'Automatic' : 'Manual only'}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">Site-specific</p>
                  </div>
                  {smsLoading || smsSaving
                    ? <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                    : <Switch checked={sms.enabled} onCheckedChange={(enabled) => saveSmsSettings({ enabled })} disabled={!currentSite?.id} aria-label="Enable automatic payment reminder SMS" className="data-[state=checked]:bg-emerald-600" />}
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <FieldLabel htmlFor="sms-days" icon={CheckCircle2}>Days before / after due</FieldLabel>
                  <Input id="sms-days" value={smsDays} onChange={(e) => setSmsDays(e.target.value)} placeholder="7, 3, 1" className={inputClass} disabled={smsSaving} />
                  <p className="text-[10px] text-slate-400">Comma separated. 0 = on the due date.</p>
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="sms-hour" icon={Phone}>Send at (IST hour)</FieldLabel>
                  <Input id="sms-hour" type="number" min="0" max="23" value={sms.send_hour} onChange={(e) => setSms((p) => ({ ...p, send_hour: e.target.value }))} className={inputClass} disabled={smsSaving} />
                  <p className="text-[10px] text-slate-400">0–23. Runs once per day at this hour.</p>
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="sms-overdue" icon={Info}>Overdue reminders</FieldLabel>
                  <div className="flex h-11 items-center gap-3 rounded-xl bg-slate-100/80 px-3">
                    <Switch id="sms-overdue" checked={sms.include_overdue} onCheckedChange={(v) => setSms((p) => ({ ...p, include_overdue: v }))} disabled={smsSaving} className="data-[state=checked]:bg-emerald-600" />
                    <span className="text-xs font-medium text-slate-600">{sms.include_overdue ? 'Also remind after due date' : 'Only before due date'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button onClick={() => saveSmsSettings()} disabled={smsSaving || !currentSite?.id} className="h-10 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700">
                  {smsSaving ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving</> : <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Save reminder schedule</>}
                </Button>
                {!smsQueueReady && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                    <Info className="h-3.5 w-3.5" /> AWS_SMS_QUEUE_URL not set — sending is disabled
                  </span>
                )}
              </div>
            </section>
          )}

          <section className="rounded-[30px] bg-white p-5 shadow-[0_16px_45px_-28px_rgba(15,23,42,.38)] ring-1 ring-slate-200/80 sm:p-7">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-500">Personal details</p><h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Keep your profile current</h2><p className="mt-1 max-w-xl text-sm text-slate-500">These details appear across your account and help your team identify the right person.</p></div>
              <div className="hidden items-center gap-2 text-xs text-slate-500 lg:flex"><Mail className="h-4 w-4" /> {profileData.email || 'Add an email address'}</div>
            </div>
            <form onSubmit={handleUpdateProfile} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2"><FieldLabel htmlFor="settings-name" icon={UserCircle}>Full name</FieldLabel><Input id="settings-name" name="name" value={profileData.name} onChange={handleProfileChange} disabled={profileLoading} placeholder="Enter your full name" className={inputClass} /></div>
              <div className="space-y-2"><FieldLabel htmlFor="settings-email" icon={Mail}>Email address</FieldLabel><Input id="settings-email" name="email" type="email" value={profileData.email} onChange={handleProfileChange} disabled={profileLoading} placeholder="you@example.com" className={inputClass} /></div>
              <div className="space-y-2"><FieldLabel htmlFor="settings-phone" icon={Phone}>Phone number</FieldLabel><Input id="settings-phone" name="phone" value={profileData.phone} onChange={handleProfileChange} disabled={profileLoading} placeholder="Add phone number" className={inputClass} /></div>
              <div className="sm:col-span-2 lg:col-span-3"><Button type="submit" disabled={profileLoading} className="h-10 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-lg shadow-blue-200 hover:bg-blue-700">{profileLoading ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving profile</> : <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Save changes</>}</Button></div>
            </form>
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
            <form onSubmit={handleChangePassword} className="rounded-[28px] bg-white p-5 shadow-[0_12px_40px_-20px_rgba(15,23,42,.28)] sm:p-6">
              <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-600">Security</p><h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Change password</h2><p className="mt-1 text-xs text-slate-500">Use at least 8 characters with a mix of letters, numbers and symbols.</p></div><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><KeyRound className="h-4.5 w-4.5" /></div></div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2"><FieldLabel htmlFor="settings-currentPassword" icon={Lock}>Current password</FieldLabel><div className="relative"><Input id="settings-currentPassword" name="currentPassword" type={showCurrentPass ? 'text' : 'password'} value={passwordData.currentPassword} onChange={handlePasswordChange} disabled={passwordLoading} placeholder="Enter current password" className={passwordInputClass} /><button type="button" onClick={() => setShowCurrentPass(!showCurrentPass)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">{showCurrentPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
                <div className="space-y-2"><FieldLabel htmlFor="settings-newPassword" icon={Lock}>New password</FieldLabel><div className="relative"><Input id="settings-newPassword" name="newPassword" type={showNewPass ? 'text' : 'password'} value={passwordData.newPassword} onChange={handlePasswordChange} disabled={passwordLoading} placeholder="Create new password" className={passwordInputClass} /><button type="button" onClick={() => setShowNewPass(!showNewPass)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">{showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>{passwordData.newPassword && <div className="pt-1"><div className="flex gap-1">{[1, 2, 3, 4, 5].map((item) => <span key={item} className={`h-1 flex-1 rounded-full ${item <= passwordStrength.level ? passwordStrength.color : 'bg-slate-100'}`} />)}</div><p className="mt-1 text-[10px] font-semibold text-slate-500">Strength: {passwordStrength.label}</p></div>}</div>
                <div className="space-y-2"><FieldLabel htmlFor="settings-confirmPassword" icon={Lock}>Confirm password</FieldLabel><div className="relative"><Input id="settings-confirmPassword" name="confirmPassword" type={showConfirmPass ? 'text' : 'password'} value={passwordData.confirmPassword} onChange={handlePasswordChange} disabled={passwordLoading} placeholder="Repeat new password" className={`${passwordInputClass} ${passwordData.confirmPassword ? (passwordsMatch ? 'bg-emerald-50/70 focus-visible:border-emerald-400 focus-visible:ring-emerald-500/10' : 'bg-rose-50/70 focus-visible:border-rose-400 focus-visible:ring-rose-500/10') : ''}`} /><button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">{showConfirmPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>{passwordData.confirmPassword && <p className={`text-[10px] font-semibold ${passwordsMatch ? 'text-emerald-600' : 'text-rose-600'}`}>{passwordsMatch ? 'Passwords match' : 'Passwords do not match'}</p>}</div>
              </div>
              <div className="mt-6"><Button type="submit" disabled={passwordLoading || !passwordData.currentPassword || !passwordsMatch} className="h-10 rounded-xl bg-blue-600 px-4 text-xs font-semibold shadow-lg shadow-blue-200 hover:bg-blue-700">{passwordLoading ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Updating password</> : <><Shield className="mr-1.5 h-3.5 w-3.5" /> Update password</>}</Button></div>
            </form>

            <section className="flex flex-col justify-between rounded-[28px] border border-blue-100 bg-blue-50/70 p-5 sm:p-6">
              <div><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm"><Shield className="h-4.5 w-4.5" /></div><p className="mt-5 text-sm font-bold text-slate-900">Security note</p><p className="mt-2 text-xs leading-relaxed text-slate-500">Never share your password. A strong password protects approvals, payments, and sensitive documents.</p></div>
              <div className="mt-6 rounded-2xl bg-white/80 p-3 text-[11px] font-medium leading-relaxed text-slate-600"><span className="text-emerald-600">●</span> Your account uses secure authenticated sessions.</div>
            </section>
          </section>

          <section className="flex flex-col gap-5 rounded-[28px] bg-white p-5 shadow-[0_12px_40px_-20px_rgba(15,23,42,.28)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex min-w-0 gap-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><PenLine className="h-4.5 w-4.5" /></div><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-600">Receipt identity</p><h2 className="mt-1 text-base font-bold text-slate-900">Name Sign</h2><p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">When enabled, receipts print <span className="font-semibold text-slate-700">{user?.name || 'your name'}</span> as the authorized signatory. Turn it off to capture authority signatures in the signature pad instead.</p></div></div>
            <div className="flex shrink-0 items-center gap-3 rounded-full bg-blue-50 px-3 py-2"><span className={`text-[11px] font-bold ${nameSign ? 'text-blue-700' : 'text-slate-500'}`}>{nameSign ? 'Enabled' : 'Signature pad'}</span><Switch id="settings-name-sign" checked={nameSign} onCheckedChange={handleNameSignToggle} className="data-[state=checked]:bg-blue-600" /></div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default Settings;
