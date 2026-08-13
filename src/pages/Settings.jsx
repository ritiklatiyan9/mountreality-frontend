import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { toast } from "sonner";
import api from "../api/api";
import {
  SectionHead,
  Row,
  FIELD_LG,
  GHOST_BTN,
  PRIMARY_BTN,
} from "../components/ui/page";
import {
  BadgeCheck,
  BellRing,
  Building2,
  Camera,
  Check,
  ChevronRight,
  CircleUserRound,
  Copy,
  Eye,
  EyeOff,
  Globe,
  Info,
  KeyRound,
  Loader2,
  ReceiptText,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";
import { orgDomainHost, orgDomainUrl } from "../lib/tenant";
import KycTimeline from "../components/kyc/KycTimeline";
import OperatingProfileSettings from "../components/settings/OperatingProfileSettings";
import { useOrgKyc } from "../hooks/useOrgKyc";
import { useNavigate, useSearchParams } from "react-router-dom";

const SMS_DEFAULTS = {
  enabled: false,
  days_before: [7, 3, 1],
  include_overdue: true,
  send_hour: 10,
};

const SETTINGS_TAB_META = {
  profile: {
    icon: CircleUserRound,
    kicker: "Account",
    title: "Your workspace identity",
    description:
      "Keep the details your team sees across the workspace current.",
  },
  kyc: {
    icon: ShieldCheck,
    kicker: "Organisation",
    title: "Verification journey",
    description:
      "Complete the evidence and ownership details required for your organisation.",
  },
  "operating-profile": {
    icon: SlidersHorizontal,
    kicker: "Site controls",
    title: "Operating behaviour",
    description:
      "Configure the workflows, modules and terminology for this Site.",
  },
  security: {
    icon: KeyRound,
    kicker: "Account protection",
    title: "Password & access",
    description: "Use a strong, private password to protect sensitive work.",
  },
  receipt: {
    icon: ReceiptText,
    kicker: "Documents",
    title: "Receipt design & identity",
    description: "Control the Site-wide receipt layout, content and authorized signatory.",
  },
  workflow: {
    icon: Workflow,
    kicker: "Site controls",
    title: "Registry workflow",
    description:
      "Choose whether authorised operators work sequentially or flexibly.",
  },
  sms: {
    icon: Smartphone,
    kicker: "Automation",
    title: "Payment reminders",
    description:
      "Set when buyers receive upcoming and overdue payment reminders.",
  },
};

const getPasswordStrength = (password) => {
  if (!password) return { level: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { level: 1, label: "Weak", color: "bg-mr-coral" };
  if (score <= 2) return { level: 2, label: "Fair", color: "bg-mr-coral" };
  if (score <= 3) return { level: 3, label: "Good", color: "bg-mr-amber" };
  if (score <= 4) return { level: 4, label: "Strong", color: "bg-mr-lime" };
  return { level: 5, label: "Excellent", color: "bg-mr-lime" };
};

/* Switch plus its current state in words — colour is never the only cue. */
const ToggleControl = ({ state, busy, ...switchProps }) => (
  <div className="flex items-center gap-3">
    {busy ? (
      <Loader2
        className="h-5 w-5 animate-spin text-mr-blue"
        aria-hidden="true"
      />
    ) : (
      <Switch className="data-[state=checked]:bg-mr-ink" {...switchProps} />
    )}
    <span className="text-[14px] text-mr-muted">{state}</span>
  </div>
);

const PasswordField = ({
  id,
  name,
  value,
  onChange,
  disabled,
  placeholder,
  shown,
  onToggle,
  label,
  className,
}) => (
  <div className="relative">
    <Input
      id={id}
      name={name}
      type={shown ? "text" : "password"}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      className={`${FIELD_LG} pr-10 ${className || ""}`}
    />
    <button
      type="button"
      onClick={onToggle}
      tabIndex={-1}
      aria-label={shown ? `Hide ${label}` : `Show ${label}`}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-mr-faint transition-colors hover:text-mr-text"
    >
      {shown ? (
        <EyeOff className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Eye className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  </div>
);

const ControlField = ({ label, hint, htmlFor, className = "", children }) => (
  <div className={`min-w-0 ${className}`}>
    <Label htmlFor={htmlFor} className="text-[12px] font-semibold text-mr-text">
      {label}
    </Label>
    {hint && (
      <p className="mt-1 text-[11px] leading-relaxed text-mr-muted">{hint}</p>
    )}
    <div className={hint ? "mt-2" : "mt-1.5"}>{children}</div>
  </div>
);

export const Settings = () => {
  const {
    user,
    organization,
    updateProfile,
    currentSite,
    isAdmin,
    hasPermission,
  } = useAuth();
  const {
    kyc,
    loading: kycLoading,
    save: saveKyc,
    submit: submitKyc,
  } = useOrgKyc();
  /* The reminder modal deep-links here as ?tab=kyc&step=<id>, so the
     wizard opens on the exact step that is still missing. */
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [nameSign, setNameSign] = useState(
    () => localStorage.getItem("nameSign") !== "0",
  );
  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
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
  const [smsDays, setSmsDays] = useState(SMS_DEFAULTS.days_before.join(", "));
  // Honours ?tab= so the KYC reminder can deep-link straight to the wizard.
  const [tab, setTab] = useState(() => searchParams.get("tab") || "profile");
  const [smsQueueReady, setSmsQueueReady] = useState(true);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsSaving, setSmsSaving] = useState(false);
  const currentSiteIdRef = useRef(currentSite?.id);

  useEffect(() => {
    currentSiteIdRef.current = currentSite?.id;
  }, [currentSite?.id]);

  useEffect(() => {
    const requested = searchParams.get("tab");
    if (requested === "receipt") {
      navigate("/settings/receipt", { replace: true });
      return;
    }
    if (requested && requested !== tab) setTab(requested);
  }, [navigate, searchParams, tab]);

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
        const response = await api.get("/settings/features", {
          params: { site_id: currentSite.id },
        });
        if (active)
          setWorkflowUnlocked(
            response.data.features?.plot_registry_workflow_unlocked === true,
          );
      } catch (error) {
        console.error("Failed to load Plot Registry workflow setting:", error);
        if (active) {
          setWorkflowUnlocked(false);
          toast.error(
            error.response?.data?.message || "Could not load workflow settings",
          );
        }
      } finally {
        if (active) setWorkflowLoading(false);
      }
    };
    fetchWorkflowSetting();
    return () => {
      active = false;
    };
  }, [currentSite?.id, isAdmin]);

  useEffect(() => {
    if (!isAdmin || !currentSite?.id) return;
    let active = true;
    setSmsLoading(true);
    api
      .get("/settings/sms-reminders", { params: { site_id: currentSite.id } })
      .then((res) => {
        if (!active) return;
        const cfg = { ...SMS_DEFAULTS, ...(res.data.settings || {}) };
        setSms(cfg);
        setSmsSaved(cfg);
        setSmsDays((cfg.days_before || []).join(", "));
        setSmsQueueReady(res.data.queue_configured !== false);
      })
      .catch((error) => {
        if (active)
          toast.error(
            error.response?.data?.message ||
              "Could not load SMS reminder settings",
          );
      })
      .finally(() => {
        if (active) setSmsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentSite?.id, isAdmin]);

  const saveSmsSettings = async (patch) => {
    if (!currentSite?.id || smsSaving) return;
    const next = {
      ...sms,
      ...patch,
      days_before:
        patch?.days_before ??
        smsDays
          .split(",")
          .map((d) => parseInt(d.trim(), 10))
          .filter(Number.isInteger),
    };
    setSmsSaving(true);
    try {
      const res = await api.put("/settings/sms-reminders", {
        site_id: currentSite.id,
        ...next,
      });
      const saved = { ...SMS_DEFAULTS, ...(res.data.settings || {}) };
      setSms(saved);
      setSmsSaved(saved);
      setSmsDays((saved.days_before || []).join(", "));
      toast.success(res.data.message || "SMS reminder settings saved");
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not save SMS reminder settings",
      );
    } finally {
      setSmsSaving(false);
    }
  };

  const passwordStrength = getPasswordStrength(passwordData.newPassword);
  const passwordsMatch =
    passwordData.newPassword &&
    passwordData.confirmPassword &&
    passwordData.newPassword === passwordData.confirmPassword;
  const roleLabel =
    user?.role
      ?.replace("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "User";

  const handleNameSignToggle = (checked) => {
    setNameSign(checked);
    localStorage.setItem("nameSign", checked ? "1" : "0");
    toast.success(
      checked
        ? "Name Sign on — receipts print your name as authorized signatory"
        : "Name Sign off — signature pad will ask for customer & authority signatures",
    );
  };

  const handleWorkflowToggle = async (enabled) => {
    if (!currentSite?.id || workflowSaving) return;
    const siteId = currentSite.id;
    const siteName = currentSite.name;
    setWorkflowSaving(true);
    try {
      const response = await api.put(
        "/settings/features/plot-registry-workflow-unlocked",
        {
          site_id: siteId,
          enabled,
        },
      );
      const savedValue =
        response.data.features?.plot_registry_workflow_unlocked === true;
      if (currentSiteIdRef.current !== siteId) return;
      setWorkflowUnlocked(savedValue);
      toast.success(
        savedValue
          ? `Flexible Plot Registry workflow enabled for ${siteName}`
          : `Sequential Plot Registry workflow restored for ${siteName}`,
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not update workflow settings",
      );
    } finally {
      setWorkflowSaving(false);
    }
  };

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setProfileData((previous) => ({ ...previous, [name]: value }));
  };

  const handleProfilePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Profile photo must be 5 MB or smaller");
      event.target.value = "";
      return;
    }
    setProfilePhoto(file);
    setProfilePhotoPreview(URL.createObjectURL(file));
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
      if (profileData.name !== user?.name) {
        data.append("name", profileData.name);
        hasChanges = true;
      }
      if (profileData.email !== user?.email) {
        data.append("email", profileData.email);
        hasChanges = true;
      }
      if (profileData.phone !== (user?.phone || "")) {
        data.append("phone", profileData.phone);
        hasChanges = true;
      }
      if (profilePhoto) {
        data.append("photo", profilePhoto);
        hasChanges = true;
      }
      if (!hasChanges) {
        toast.info("No changes to update");
        return;
      }
      await updateProfile(data);
      setProfilePhoto(null);
      setProfilePhotoPreview(null);
      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    if (
      !passwordData.currentPassword ||
      !passwordData.newPassword ||
      !passwordData.confirmPassword
    ) {
      toast.error("All password fields are required");
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New password and confirm password do not match");
      return;
    }
    setPasswordLoading(true);
    try {
      await api.put("/auth/change-password", passwordData);
      toast.success("Password changed successfully");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setShowCurrentPass(false);
      setShowNewPass(false);
      setShowConfirmPass(false);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to change password");
    } finally {
      setPasswordLoading(false);
    }
  };

  /* Only the sections this user can actually see get a nav entry. */
  /* Only the tabs this user can actually reach are offered. */
  const tabs = [
    { id: "profile", label: "My details" },
    { id: "kyc", label: "Verification" },
    ...(isAdmin || hasPermission("operating_profile", "read")
      ? [{ id: "operating-profile", label: "Operating profile" }]
      : []),
    { id: "security", label: "Password" },
    { id: "receipt", label: "Receipt identity" },
    ...(isAdmin
      ? [
          { id: "workflow", label: "Registry workflow" },
          { id: "sms", label: "Payment reminders" },
        ]
      : []),
  ];
  const active = tabs.some((t) => t.id === tab) ? tab : "profile";
  const changeTab = (nextTab) => {
    if (nextTab === "receipt") {
      navigate("/settings/receipt");
      return;
    }
    if (nextTab === active) return;
    setTab(nextTab);
    const next = new URLSearchParams(searchParams);
    next.set("tab", nextTab);
    next.delete("mode");
    next.delete("site");
    setSearchParams(next, { replace: true });
    window.requestAnimationFrame(() => {
      document
        .getElementById("settings-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  /* A save button that does nothing is worse than no button, so both
     forms compare against what the server last confirmed. */
  const profileDirty =
    Boolean(profilePhoto) ||
    profileData.name !== (user?.name || "") ||
    profileData.email !== (user?.email || "") ||
    profileData.phone !== (user?.phone || "");
  const smsDirty =
    smsDays !== (smsSaved.days_before || []).join(", ") ||
    String(sms.send_hour) !== String(smsSaved.send_hour) ||
    sms.include_overdue !== smsSaved.include_overdue;

  const resetProfile = () => {
    setProfileData({
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
    });
    setProfilePhoto(null);
    setProfilePhotoPreview(null);
  };
  const resetSms = () => {
    setSms(smsSaved);
    setSmsDays((smsSaved.days_before || []).join(", "));
  };
  const activeMeta = SETTINGS_TAB_META[active] || SETTINGS_TAB_META.profile;
  const ActiveIcon = activeMeta.icon;
  const activeTabIndex = tabs.findIndex((item) => item.id === active);

  return (
    <div className="mx-auto w-full max-w-[1760px] pb-16">
      <header className="relative overflow-hidden rounded-2xl border border-mr-line bg-mr-surface px-5 py-4 shadow-sm shadow-mr-ink/[0.035] sm:px-6 xl:px-7">
        <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-mr-blue/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-24 h-16 w-64 bg-gradient-to-l from-mr-lime/10 to-transparent blur-2xl" />
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-mr-blue">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Workspace
              configuration
            </p>
            <h1 className="mt-1.5 text-[clamp(1.7rem,3vw,2.25rem)] font-semibold tracking-[-0.045em] text-mr-text">
              Settings & workspace controls
            </h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-mr-muted">
              Manage your account, Site behaviour, controls and automations from
              one focused workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5 xl:justify-end">
            <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-mr-line bg-mr-surface/90 px-3.5 text-[13px] font-medium text-mr-text shadow-sm">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-mr-ink text-white">
                <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              {currentSite?.name || "No Site selected"}
            </span>
            <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-mr-lime-ink/15 bg-mr-lime-soft px-3.5 text-[13px] font-medium text-mr-lime-ink">
              <BadgeCheck className="h-4 w-4" aria-hidden="true" /> {roleLabel}
            </span>
          </div>
        </div>
      </header>

      <section
        className="mt-3 overflow-hidden rounded-2xl border border-mr-line bg-mr-surface shadow-sm shadow-mr-ink/[0.025] xl:hidden"
        aria-label="Settings journey"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mr-line px-4 py-2.5 sm:px-5">
          <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-mr-text">
            <Settings2 className="h-4 w-4 text-mr-blue" aria-hidden="true" />{" "}
            Configuration map
          </span>
          <span className="text-[12px] text-mr-muted">
            {tabs.length} areas available · {activeMeta.kicker}
          </span>
        </div>
        <ol className="flex min-w-max items-start px-3 py-3 sm:px-5">
          {tabs.map((item, index) => {
            const meta =
              SETTINGS_TAB_META[item.id] || SETTINGS_TAB_META.profile;
            const Icon = meta.icon;
            const selected = item.id === active;
            const beforeActive = index < activeTabIndex;
            return (
              <li
                key={item.id}
                className="flex min-w-[150px] flex-1 items-start last:flex-none xl:min-w-0"
              >
                <button
                  id={`settings-tab-${item.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => changeTab(item.id)}
                  className="group flex min-w-0 flex-col items-start text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full border text-[12px] transition-all ${selected ? "border-mr-ink bg-mr-ink text-white shadow-sm shadow-mr-ink/20" : beforeActive ? "border-mr-lime-ink/25 bg-mr-lime-soft text-mr-lime-ink" : "border-mr-line bg-mr-surface-2 text-mr-faint group-hover:border-mr-blue/40 group-hover:text-mr-blue"}`}
                  >
                    {beforeActive ? (
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </span>
                  <span
                    className={`mt-2 max-w-[132px] truncate text-[12px] font-semibold transition-colors ${selected ? "text-mr-text" : "text-mr-muted group-hover:text-mr-text"}`}
                  >
                    {item.label}
                  </span>
                </button>
                {index < tabs.length - 1 && (
                  <span
                    className={`mx-2 mt-4 h-px min-w-5 flex-1 xl:mx-3 ${beforeActive ? "bg-mr-lime-ink/35" : "bg-mr-line"}`}
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="mt-4 grid items-start gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-5">
          <div className="overflow-hidden rounded-2xl border border-mr-line bg-mr-surface shadow-sm shadow-mr-ink/[0.025]">
            <div className="border-b border-mr-line px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-mr-faint">
                Manage workspace
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-mr-muted">
                Choose a setting area to continue.
              </p>
            </div>
            <nav className="p-2" aria-label="Settings sections">
              {tabs.map((item, index) => {
                const meta =
                  SETTINGS_TAB_META[item.id] || SETTINGS_TAB_META.profile;
                const Icon = meta.icon;
                const selected = item.id === active;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => changeTab(item.id)}
                    className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue ${selected ? "bg-mr-ink text-white shadow-sm shadow-mr-ink/15" : "text-mr-muted hover:bg-mr-surface-2 hover:text-mr-text"}`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold ${selected ? "bg-white/10 text-white" : "bg-mr-surface-2 text-mr-faint group-hover:bg-mr-blue-soft group-hover:text-mr-blue"}`}
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />{" "}
                        {item.label}
                      </span>
                      <span
                        className={`mt-0.5 block truncate text-[11px] ${selected ? "text-white/65" : "text-mr-faint"}`}
                      >
                        {meta.kicker}
                      </span>
                    </span>
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 transition-transform ${selected ? "translate-x-0.5 text-white/75" : "text-mr-faint group-hover:translate-x-0.5"}`}
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </nav>
            <div className="mx-3 mb-3 rounded-xl border border-mr-blue/15 bg-mr-blue-soft/55 px-3.5 py-3">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-mr-blue">
                <BellRing className="h-3.5 w-3.5" aria-hidden="true" /> Changes
                save with an audit trail
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-mr-muted">
                Site-level controls affect only the currently selected Site.
              </p>
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <div
            id="settings-panel"
            role="tabpanel"
            aria-labelledby={`settings-tab-${active}`}
            className={
              active === "operating-profile"
                ? "min-w-0"
                : "overflow-hidden rounded-2xl border border-mr-line bg-mr-surface shadow-sm shadow-mr-ink/[0.025]"
            }
          >
            {active !== "operating-profile" && (
              <div className="flex flex-col gap-3 border-b border-mr-line bg-gradient-to-r from-mr-surface-2/75 to-mr-surface px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-mr-ink text-white shadow-sm shadow-mr-ink/15">
                  <ActiveIcon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-mr-blue">
                    {activeMeta.kicker}
                  </span>
                  <h2 className="mt-1 text-[21px] font-semibold tracking-[-0.025em] text-mr-text">
                    {activeMeta.title}
                  </h2>
                  <p className="mt-1 text-[13px] leading-relaxed text-mr-muted">
                    {activeMeta.description}
                  </p>
                </span>
                <span className="inline-flex w-fit items-center rounded-full border border-mr-line bg-mr-surface px-3 py-1.5 text-[11px] font-medium text-mr-muted">
                  Step {activeTabIndex + 1} of {tabs.length}
                </span>
              </div>
            )}
            <div
              className={
                active === "operating-profile"
                  ? ""
                  : "px-5 py-5 sm:px-6 sm:py-6"
              }
            >
              {active === "kyc" && (
                <KycTimeline
                  kyc={kyc}
                  loading={kycLoading}
                  save={saveKyc}
                  submit={submitKyc}
                  canEdit={isAdmin}
                  openStep={searchParams.get("step")}
                />
              )}

              {active === "operating-profile" &&
                (isAdmin || hasPermission("operating_profile", "read")) && (
                  <OperatingProfileSettings />
                )}

              {/* ── My details ── */}
              {active === "profile" && organization?.subdomain && (
                <div className="mb-8 flex flex-wrap items-center gap-3 rounded-panel-sm border border-mr-blue/20 bg-mr-blue-soft px-4 py-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-mr-blue text-white">
                    <Globe
                      className="h-4 w-4"
                      strokeWidth={1.9}
                      aria-hidden="true"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-medium text-mr-muted">
                      Workspace domain
                    </span>
                    <a
                      href={orgDomainUrl(organization.subdomain)}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-[14px] font-semibold tracking-[-0.01em] text-mr-blue-deep hover:underline"
                    >
                      {orgDomainHost(organization.subdomain)}
                    </a>
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard?.writeText(
                        orgDomainUrl(organization.subdomain),
                      );
                      toast.success("Link copied");
                    }}
                  >
                    <Copy
                      className="h-3.5 w-3.5"
                      strokeWidth={1.9}
                      aria-hidden="true"
                    />{" "}
                    Copy
                  </Button>
                </div>
              )}
              {active === "profile" && (
                <form onSubmit={handleUpdateProfile}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-[15px] font-semibold text-mr-text">
                        Personal details
                      </h3>
                      <p className="mt-1 text-[12px] text-mr-muted">
                        Update the identity shown across your workspace.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-mr-ink px-2.5 py-1 text-[11px] font-medium text-white">
                        <BadgeCheck
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                        {roleLabel}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-mr-surface-2 px-2.5 py-1 text-[11px] font-medium text-mr-muted">
                        <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {currentSite?.name || "No site selected"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-5 lg:grid-cols-[auto_minmax(0,1fr)]">
                    <div className="flex items-center gap-3 rounded-xl border border-mr-line bg-mr-surface-2/55 p-3 lg:w-[220px] lg:flex-col lg:items-start">
                      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-mr-line bg-mr-surface text-lg font-semibold text-mr-blue">
                        {profilePhotoPreview || user?.photo ? (
                          <img
                            src={profilePhotoPreview || user.photo}
                            alt="Profile preview"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          (user?.name || "U").charAt(0).toUpperCase()
                        )}
                        {profilePhotoPreview && (
                          <button
                            type="button"
                            onClick={() => {
                              setProfilePhoto(null);
                              setProfilePhotoPreview(null);
                            }}
                            className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-mr-ink text-white"
                            aria-label="Remove selected photo"
                          >
                            <X className="h-3 w-3" strokeWidth={2} />
                          </button>
                        )}
                      </div>
                      <div className="min-w-0 lg:w-full">
                        <p className="text-[12px] font-semibold text-mr-text">
                          Profile photo
                        </p>
                        <p className="mt-0.5 text-[11px] text-mr-muted">
                          JPG, PNG or WebP · max 5 MB
                        </p>
                        <label
                          htmlFor="settings-photo"
                          className="mt-2 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-mr-line bg-mr-surface px-2.5 text-[11px] font-semibold text-mr-text transition-colors hover:bg-mr-surface-2"
                        >
                          <Camera className="h-3.5 w-3.5" aria-hidden="true" />{" "}
                          {profilePhoto ? "Change" : "Upload"}
                        </label>
                        <input
                          id="settings-photo"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleProfilePhotoChange}
                          disabled={profileLoading}
                          className="sr-only"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <ControlField label="Full name" htmlFor="settings-name">
                        <Input
                          id="settings-name"
                          name="name"
                          value={profileData.name}
                          onChange={handleProfileChange}
                          disabled={profileLoading}
                          placeholder="Enter your full name"
                          className={FIELD_LG}
                        />
                      </ControlField>
                      <ControlField
                        label="Email address"
                        hint="Used for sign-in and account notices."
                        htmlFor="settings-email"
                      >
                        <Input
                          id="settings-email"
                          name="email"
                          type="email"
                          value={profileData.email}
                          onChange={handleProfileChange}
                          disabled={profileLoading}
                          placeholder="you@example.com"
                          className={FIELD_LG}
                        />
                      </ControlField>
                      <ControlField
                        label="Phone number"
                        htmlFor="settings-phone"
                        className="sm:max-w-sm"
                      >
                        <Input
                          id="settings-phone"
                          name="phone"
                          value={profileData.phone}
                          onChange={handleProfileChange}
                          disabled={profileLoading}
                          placeholder="Add phone number"
                          className={FIELD_LG}
                        />
                      </ControlField>
                    </div>
                  </div>

                  <div className="sticky bottom-3 z-10 -mx-2 mt-5 flex justify-end gap-3 rounded-xl border border-mr-line bg-mr-surface/95 p-2 shadow-lg shadow-mr-ink/[0.06] backdrop-blur">
                    <button
                      type="button"
                      onClick={resetProfile}
                      disabled={!profileDirty || profileLoading}
                      className={GHOST_BTN}
                    >
                      Cancel
                    </button>
                    <Button
                      type="submit"
                      disabled={!profileDirty || profileLoading}
                      className={PRIMARY_BTN}
                    >
                      {profileLoading ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />{" "}
                          Saving
                        </>
                      ) : (
                        "Save changes"
                      )}
                    </Button>
                  </div>
                </form>
              )}

              {/* ── Password ── */}
              {active === "security" && (
                <form onSubmit={handleChangePassword}>
                  <SectionHead
                    title="Change password"
                    description="Use at least 8 characters with a mix of letters, numbers and symbols."
                  />

                  <Row
                    label="Current password"
                    htmlFor="settings-currentPassword"
                  >
                    <PasswordField
                      id="settings-currentPassword"
                      name="currentPassword"
                      label="current password"
                      value={passwordData.currentPassword}
                      onChange={handlePasswordChange}
                      disabled={passwordLoading}
                      placeholder="Enter current password"
                      shown={showCurrentPass}
                      onToggle={() => setShowCurrentPass(!showCurrentPass)}
                    />
                  </Row>

                  <Row
                    label="New password"
                    hint="Protects approvals, payments and sensitive documents."
                    htmlFor="settings-newPassword"
                  >
                    <PasswordField
                      id="settings-newPassword"
                      name="newPassword"
                      label="new password"
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                      disabled={passwordLoading}
                      placeholder="Create new password"
                      shown={showNewPass}
                      onToggle={() => setShowNewPass(!showNewPass)}
                    />
                    {passwordData.newPassword && (
                      <div className="mt-2.5">
                        <div
                          className="flex gap-1"
                          role="img"
                          aria-label={`Password strength: ${passwordStrength.label}`}
                        >
                          {[1, 2, 3, 4, 5].map((item) => (
                            <span
                              key={item}
                              className={`h-1 flex-1 rounded-full ${item <= passwordStrength.level ? passwordStrength.color : "bg-mr-line"}`}
                            />
                          ))}
                        </div>
                        <p className="mt-1.5 text-[13px] text-mr-muted">
                          Strength:{" "}
                          <span className="font-medium text-mr-text">
                            {passwordStrength.label}
                          </span>
                        </p>
                      </div>
                    )}
                  </Row>

                  <Row
                    label="Confirm new password"
                    htmlFor="settings-confirmPassword"
                  >
                    <PasswordField
                      id="settings-confirmPassword"
                      name="confirmPassword"
                      label="password confirmation"
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordChange}
                      disabled={passwordLoading}
                      placeholder="Repeat new password"
                      shown={showConfirmPass}
                      onToggle={() => setShowConfirmPass(!showConfirmPass)}
                      className={
                        passwordData.confirmPassword
                          ? passwordsMatch
                            ? "border-mr-lime-ink/40"
                            : "border-mr-coral-ink/40"
                          : ""
                      }
                    />
                    {passwordData.confirmPassword && (
                      <p
                        className={`mt-2 text-[13px] font-medium ${passwordsMatch ? "text-mr-lime-ink" : "text-mr-coral-ink"}`}
                      >
                        {passwordsMatch
                          ? "Passwords match"
                          : "Passwords do not match"}
                      </p>
                    )}
                  </Row>

                  <div className="sticky bottom-3 z-10 -mx-2 mt-5 flex justify-end rounded-xl border border-mr-line bg-mr-surface/95 p-2 shadow-lg shadow-mr-ink/[0.06] backdrop-blur">
                    <Button
                      type="submit"
                      disabled={
                        passwordLoading ||
                        !passwordData.currentPassword ||
                        !passwordsMatch
                      }
                      className={PRIMARY_BTN}
                    >
                      {passwordLoading ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />{" "}
                          Updating
                        </>
                      ) : (
                        "Update password"
                      )}
                    </Button>
                  </div>
                </form>
              )}

              {/* ── Receipt identity ── */}
              {active === "receipt" && (
                <>
                  <SectionHead
                    title="Receipt identity"
                    description="Controls who is named as the authorized signatory on printed receipts."
                  />
                  <Row
                    label="Name Sign"
                    hint={
                      <>
                        Receipts print{" "}
                        <span className="font-medium text-mr-text">
                          {user?.name || "your name"}
                        </span>{" "}
                        as the authorized signatory. Turn it off to capture
                        authority signatures in the signature pad instead.
                      </>
                    }
                  >
                    <ToggleControl
                      state={
                        nameSign
                          ? "On — prints your name"
                          : "Off — use signature pad"
                      }
                      id="settings-name-sign"
                      checked={nameSign}
                      onCheckedChange={handleNameSignToggle}
                      aria-label="Print your name as the authorized signatory on receipts"
                    />
                  </Row>
                </>
              )}

              {/* ── Registry workflow (admin) ── */}
              {active === "workflow" && isAdmin && (
                <>
                  <SectionHead
                    title="Plot Registry workflow"
                    description={`Applies to ${currentSite?.name || "the selected site"} only.`}
                  />
                  <Row
                    label="Flexible workflow"
                    hint="Lets authorized operators work out of sequence. Payment-completion and step prerequisites are bypassed for NOC, deed upload and handover; module permissions and required record data remain enforced."
                  >
                    <ToggleControl
                      state={
                        workflowLoading
                          ? "Loading"
                          : workflowUnlocked
                            ? "Flexible — any step"
                            : "Sequential — in order"
                      }
                      busy={workflowLoading || workflowSaving}
                      id="settings-registry-workflow"
                      checked={workflowUnlocked}
                      onCheckedChange={handleWorkflowToggle}
                      disabled={!currentSite?.id}
                      aria-label="Enable flexible Plot Registry step navigation"
                    />
                    <p className="mt-3 flex gap-2 text-[13px] leading-relaxed text-mr-muted">
                      <Info
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mr-faint"
                        strokeWidth={1.9}
                        aria-hidden="true"
                      />
                      {workflowUnlocked
                        ? "Every workflow step is available for direct navigation on this site."
                        : "Steps remain locked until the required earlier workflow stages are complete."}
                    </p>
                  </Row>
                </>
              )}

              {/* ── Payment reminders (admin) ── */}
              {active === "sms" && isAdmin && (
                <>
                  <SectionHead
                    title="Payment reminders"
                    description={`Automatic due-date texts to buyers of ${currentSite?.name || "the selected site"}.`}
                  />

                  <Row
                    label="Automatic sending"
                    hint="Messages are queued to AWS SQS and delivered by the SMS worker. Each reminder goes out at most once a day."
                  >
                    <ToggleControl
                      state={
                        smsLoading
                          ? "Loading"
                          : sms.enabled
                            ? "On — sent automatically"
                            : "Off — manual only"
                      }
                      busy={smsLoading || smsSaving}
                      checked={sms.enabled}
                      onCheckedChange={(enabled) =>
                        saveSmsSettings({ enabled })
                      }
                      disabled={!currentSite?.id}
                      aria-label="Enable automatic payment reminder SMS"
                    />
                    {!smsQueueReady && (
                      <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-mr-amber-soft px-3 py-1.5 text-[12px] font-medium text-mr-amber-ink">
                        <Info
                          className="h-3.5 w-3.5"
                          strokeWidth={1.9}
                          aria-hidden="true"
                        />{" "}
                        AWS_SMS_QUEUE_URL not set — sending is disabled
                      </p>
                    )}
                  </Row>

                  <Row
                    label="Reminder days"
                    hint="Comma separated. 0 = on the due date."
                    htmlFor="sms-days"
                  >
                    <Input
                      id="sms-days"
                      value={smsDays}
                      onChange={(e) => setSmsDays(e.target.value)}
                      placeholder="7, 3, 1"
                      className={FIELD_LG}
                      disabled={smsSaving}
                    />
                  </Row>

                  <Row
                    label="Send at"
                    hint="IST hour, 0–23. Runs once per day."
                    htmlFor="sms-hour"
                  >
                    <Input
                      id="sms-hour"
                      type="number"
                      min="0"
                      max="23"
                      value={sms.send_hour}
                      onChange={(e) =>
                        setSms((p) => ({ ...p, send_hour: e.target.value }))
                      }
                      className={`${FIELD_LG} sm:max-w-[140px]`}
                      disabled={smsSaving}
                    />
                  </Row>

                  <Row
                    label="Overdue reminders"
                    hint="Keep texting after the due date has passed."
                  >
                    <ToggleControl
                      state={
                        sms.include_overdue
                          ? "Also remind after due date"
                          : "Only before due date"
                      }
                      id="sms-overdue"
                      checked={sms.include_overdue}
                      onCheckedChange={(v) =>
                        setSms((p) => ({ ...p, include_overdue: v }))
                      }
                      disabled={smsSaving}
                    />
                  </Row>

                  <div className="sticky bottom-3 z-10 -mx-2 mt-5 flex justify-end gap-3 rounded-xl border border-mr-line bg-mr-surface/95 p-2 shadow-lg shadow-mr-ink/[0.06] backdrop-blur">
                    <button
                      type="button"
                      onClick={resetSms}
                      disabled={!smsDirty || smsSaving}
                      className={GHOST_BTN}
                    >
                      Cancel
                    </button>
                    <Button
                      onClick={() => saveSmsSettings()}
                      disabled={!smsDirty || smsSaving || !currentSite?.id}
                      className={PRIMARY_BTN}
                    >
                      {smsSaving ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />{" "}
                          Saving
                        </>
                      ) : (
                        "Save changes"
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Settings;
