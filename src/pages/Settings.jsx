import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import api from '../api/api';
import {
  PageHeader, PageTabs, SectionHead, Row, FIELD_LG, GHOST_BTN, PRIMARY_BTN,
} from '../components/ui/page';
import { BadgeCheck, Building2, Eye, EyeOff, Info, Loader2 } from 'lucide-react';

const SMS_DEFAULTS = { enabled: false, days_before: [7, 3, 1], include_overdue: true, send_hour: 10 };

const getPasswordStrength = (password) => {
  if (!password) return { level: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { level: 1, label: 'Weak', color: 'bg-mr-coral' };
  if (score <= 2) return { level: 2, label: 'Fair', color: 'bg-mr-coral' };
  if (score <= 3) return { level: 3, label: 'Good', color: 'bg-mr-amber' };
  if (score <= 4) return { level: 4, label: 'Strong', color: 'bg-mr-lime' };
  return { level: 5, label: 'Excellent', color: 'bg-mr-lime' };
};

/* Switch plus its current state in words — colour is never the only cue. */
const ToggleControl = ({ state, busy, ...switchProps }) => (
  <div className="flex items-center gap-3">
    {busy
      ? <Loader2 className="h-5 w-5 animate-spin text-mr-blue" aria-hidden="true" />
      : <Switch className="data-[state=checked]:bg-mr-ink" {...switchProps} />}
    <span className="text-[14px] text-mr-muted">{state}</span>
  </div>
);

const PasswordField = ({ id, name, value, onChange, disabled, placeholder, shown, onToggle, label, className }) => (
  <div className="relative">
    <Input
      id={id}
      name={name}
      type={shown ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      className={`${FIELD_LG} pr-10 ${className || ''}`}
    />
    <button
      type="button"
      onClick={onToggle}
      tabIndex={-1}
      aria-label={shown ? `Hide ${label}` : `Show ${label}`}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-mr-faint transition-colors hover:text-mr-text"
    >
      {shown ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
    </button>
  </div>
);

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
  // Last value the server confirmed — the only way to know the form is dirty.
  const [smsSaved, setSmsSaved] = useState(SMS_DEFAULTS);
  const [smsDays, setSmsDays] = useState(SMS_DEFAULTS.days_before.join(', '));
  const [tab, setTab] = useState('profile');
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
        setSmsSaved(cfg);
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
      setSmsSaved(saved);
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

  /* Only the sections this user can actually see get a nav entry. */
  /* Only the tabs this user can actually reach are offered. */
  const tabs = [
    { id: 'profile', label: 'My details' },
    { id: 'security', label: 'Password' },
    { id: 'receipt', label: 'Receipt identity' },
    ...(isAdmin ? [
      { id: 'workflow', label: 'Registry workflow' },
      { id: 'sms', label: 'Payment reminders' },
    ] : []),
  ];
  const active = tabs.some((t) => t.id === tab) ? tab : 'profile';

  /* A save button that does nothing is worse than no button, so both
     forms compare against what the server last confirmed. */
  const profileDirty = profileData.name !== (user?.name || '')
    || profileData.email !== (user?.email || '')
    || profileData.phone !== (user?.phone || '');
  const smsDirty = smsDays !== (smsSaved.days_before || []).join(', ')
    || String(sms.send_hour) !== String(smsSaved.send_hour)
    || sms.include_overdue !== smsSaved.include_overdue;

  const resetProfile = () => setProfileData({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '' });
  const resetSms = () => {
    setSms(smsSaved);
    setSmsDays((smsSaved.days_before || []).join(', '));
  };

  return (
    <div className="mx-auto w-full max-w-4xl pb-16">
      <PageHeader title="Settings" description="Manage your account settings and preferences." />

      <PageTabs className="mt-7" label="Settings sections" items={tabs} value={active} onChange={setTab} />

      <div id="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${active}`} className="pt-8">
        {/* ── My details ── */}
        {active === 'profile' && (
          <form onSubmit={handleUpdateProfile}>
            <SectionHead
              title="Personal details"
              description="These details appear across your account and help your team identify the right person."
            />

            <Row label="Full name" htmlFor="settings-name">
              <Input id="settings-name" name="name" value={profileData.name} onChange={handleProfileChange} disabled={profileLoading} placeholder="Enter your full name" className={FIELD_LG} />
            </Row>

            <Row label="Email address" hint="Used for sign-in and account notices." htmlFor="settings-email">
              <Input id="settings-email" name="email" type="email" value={profileData.email} onChange={handleProfileChange} disabled={profileLoading} placeholder="you@example.com" className={FIELD_LG} />
            </Row>

            <Row label="Phone number" htmlFor="settings-phone">
              <Input id="settings-phone" name="phone" value={profileData.phone} onChange={handleProfileChange} disabled={profileLoading} placeholder="Add phone number" className={FIELD_LG} />
            </Row>

            <Row label="Role" hint="Set by an administrator — you cannot change your own role.">
              <div className="flex h-11 flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-mr-ink px-2.5 py-1 text-[12px] font-medium text-white">
                  <BadgeCheck className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" /> {roleLabel}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-mr-surface-2 px-2.5 py-1 text-[12px] font-medium text-mr-muted">
                  <Building2 className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" /> {currentSite?.name || 'No site selected'}
                </span>
              </div>
            </Row>

            <div className="flex justify-end gap-3 pt-5">
              <button type="button" onClick={resetProfile} disabled={!profileDirty || profileLoading} className={GHOST_BTN}>
                Cancel
              </button>
              <Button type="submit" disabled={!profileDirty || profileLoading} className={PRIMARY_BTN}>
                {profileLoading ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving</> : 'Save changes'}
              </Button>
            </div>
          </form>
        )}

        {/* ── Password ── */}
        {active === 'security' && (
          <form onSubmit={handleChangePassword}>
            <SectionHead
              title="Change password"
              description="Use at least 8 characters with a mix of letters, numbers and symbols."
            />

            <Row label="Current password" htmlFor="settings-currentPassword">
              <PasswordField
                id="settings-currentPassword" name="currentPassword" label="current password"
                value={passwordData.currentPassword} onChange={handlePasswordChange} disabled={passwordLoading}
                placeholder="Enter current password" shown={showCurrentPass} onToggle={() => setShowCurrentPass(!showCurrentPass)}
              />
            </Row>

            <Row label="New password" hint="Protects approvals, payments and sensitive documents." htmlFor="settings-newPassword">
              <PasswordField
                id="settings-newPassword" name="newPassword" label="new password"
                value={passwordData.newPassword} onChange={handlePasswordChange} disabled={passwordLoading}
                placeholder="Create new password" shown={showNewPass} onToggle={() => setShowNewPass(!showNewPass)}
              />
              {passwordData.newPassword && (
                <div className="mt-2.5">
                  <div className="flex gap-1" role="img" aria-label={`Password strength: ${passwordStrength.label}`}>
                    {[1, 2, 3, 4, 5].map((item) => (
                      <span key={item} className={`h-1 flex-1 rounded-full ${item <= passwordStrength.level ? passwordStrength.color : 'bg-mr-line'}`} />
                    ))}
                  </div>
                  <p className="mt-1.5 text-[13px] text-mr-muted">Strength: <span className="font-medium text-mr-text">{passwordStrength.label}</span></p>
                </div>
              )}
            </Row>

            <Row label="Confirm new password" htmlFor="settings-confirmPassword">
              <PasswordField
                id="settings-confirmPassword" name="confirmPassword" label="password confirmation"
                value={passwordData.confirmPassword} onChange={handlePasswordChange} disabled={passwordLoading}
                placeholder="Repeat new password" shown={showConfirmPass} onToggle={() => setShowConfirmPass(!showConfirmPass)}
                className={passwordData.confirmPassword ? (passwordsMatch ? 'border-mr-lime-ink/40' : 'border-mr-coral-ink/40') : ''}
              />
              {passwordData.confirmPassword && (
                <p className={`mt-2 text-[13px] font-medium ${passwordsMatch ? 'text-mr-lime-ink' : 'text-mr-coral-ink'}`}>
                  {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                </p>
              )}
            </Row>

            <div className="flex justify-end pt-5">
              <Button type="submit" disabled={passwordLoading || !passwordData.currentPassword || !passwordsMatch} className={PRIMARY_BTN}>
                {passwordLoading ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Updating</> : 'Update password'}
              </Button>
            </div>
          </form>
        )}

        {/* ── Receipt identity ── */}
        {active === 'receipt' && (
          <>
            <SectionHead
              title="Receipt identity"
              description="Controls who is named as the authorized signatory on printed receipts."
            />
            <Row
              label="Name Sign"
              hint={<>Receipts print <span className="font-medium text-mr-text">{user?.name || 'your name'}</span> as the authorized signatory. Turn it off to capture authority signatures in the signature pad instead.</>}
            >
              <ToggleControl
                state={nameSign ? 'On — prints your name' : 'Off — use signature pad'}
                id="settings-name-sign"
                checked={nameSign}
                onCheckedChange={handleNameSignToggle}
                aria-label="Print your name as the authorized signatory on receipts"
              />
            </Row>
          </>
        )}

        {/* ── Registry workflow (admin) ── */}
        {active === 'workflow' && isAdmin && (
          <>
            <SectionHead
              title="Plot Registry workflow"
              description={`Applies to ${currentSite?.name || 'the selected site'} only.`}
            />
            <Row
              label="Flexible workflow"
              hint="Lets authorized operators work out of sequence. Payment-completion and step prerequisites are bypassed for NOC, deed upload and handover; module permissions and required record data remain enforced."
            >
              <ToggleControl
                state={workflowLoading ? 'Loading' : workflowUnlocked ? 'Flexible — any step' : 'Sequential — in order'}
                busy={workflowLoading || workflowSaving}
                id="settings-registry-workflow"
                checked={workflowUnlocked}
                onCheckedChange={handleWorkflowToggle}
                disabled={!currentSite?.id}
                aria-label="Enable flexible Plot Registry step navigation"
              />
              <p className="mt-3 flex gap-2 text-[13px] leading-relaxed text-mr-muted">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mr-faint" strokeWidth={1.9} aria-hidden="true" />
                {workflowUnlocked
                  ? 'Every workflow step is available for direct navigation on this site.'
                  : 'Steps remain locked until the required earlier workflow stages are complete.'}
              </p>
            </Row>
          </>
        )}

        {/* ── Payment reminders (admin) ── */}
        {active === 'sms' && isAdmin && (
          <>
            <SectionHead
              title="Payment reminders"
              description={`Automatic due-date texts to buyers of ${currentSite?.name || 'the selected site'}.`}
            />

            <Row
              label="Automatic sending"
              hint="Messages are queued to AWS SQS and delivered by the SMS worker. Each reminder goes out at most once a day."
            >
              <ToggleControl
                state={smsLoading ? 'Loading' : sms.enabled ? 'On — sent automatically' : 'Off — manual only'}
                busy={smsLoading || smsSaving}
                checked={sms.enabled}
                onCheckedChange={(enabled) => saveSmsSettings({ enabled })}
                disabled={!currentSite?.id}
                aria-label="Enable automatic payment reminder SMS"
              />
              {!smsQueueReady && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-mr-amber-soft px-3 py-1.5 text-[12px] font-medium text-mr-amber-ink">
                  <Info className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" /> AWS_SMS_QUEUE_URL not set — sending is disabled
                </p>
              )}
            </Row>

            <Row label="Reminder days" hint="Comma separated. 0 = on the due date." htmlFor="sms-days">
              <Input id="sms-days" value={smsDays} onChange={(e) => setSmsDays(e.target.value)} placeholder="7, 3, 1" className={FIELD_LG} disabled={smsSaving} />
            </Row>

            <Row label="Send at" hint="IST hour, 0–23. Runs once per day." htmlFor="sms-hour">
              <Input id="sms-hour" type="number" min="0" max="23" value={sms.send_hour} onChange={(e) => setSms((p) => ({ ...p, send_hour: e.target.value }))} className={`${FIELD_LG} sm:max-w-[140px]`} disabled={smsSaving} />
            </Row>

            <Row label="Overdue reminders" hint="Keep texting after the due date has passed.">
              <ToggleControl
                state={sms.include_overdue ? 'Also remind after due date' : 'Only before due date'}
                id="sms-overdue"
                checked={sms.include_overdue}
                onCheckedChange={(v) => setSms((p) => ({ ...p, include_overdue: v }))}
                disabled={smsSaving}
              />
            </Row>

            <div className="flex justify-end gap-3 pt-5">
              <button type="button" onClick={resetSms} disabled={!smsDirty || smsSaving} className={GHOST_BTN}>
                Cancel
              </button>
              <Button onClick={() => saveSmsSettings()} disabled={!smsDirty || smsSaving || !currentSite?.id} className={PRIMARY_BTN}>
                {smsSaving ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving</> : 'Save changes'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Settings;
