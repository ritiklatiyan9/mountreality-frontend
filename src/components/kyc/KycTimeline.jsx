import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  Lock,
  MapPin,
  Pencil,
  Send,
  ShieldCheck,
  User,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import LocationPicker from "./LocationPicker";
import { KYC_STEPS, stepDone } from "../../hooks/useOrgKyc";
import { gstinHint, normaliseGstin } from "../../lib/gstin";

/* ── KYC timeline ────────────────────────────────────────────────────
   A vertical timeline where each node opens into its own step card.
   Progress is the layout: the rail between nodes fills as steps
   complete, so no separate progress widget is needed.

   Motion is state-change only — a node ticking over, a card opening,
   the rail drawing. Nothing loops, nothing animates on idle, and every
   transition is skipped under prefers-reduced-motion. ── */

const ICONS = {
  company: Building2,
  registered: MapPin,
  communication: Send,
  director: User,
};

// Aliased because the linter cannot see `motion.div` as a use of `motion`
// — the same reason components/landing/scrollMotion.jsx does this.
const MotionDiv = motion.div;
const MotionSpan = motion.span;

const FIELD =
  "h-11 rounded-control border-mr-line bg-mr-surface text-[15px] text-mr-text shadow-none transition-colors " +
  "placeholder:text-mr-faint focus-visible:border-mr-blue focus-visible:ring-2 focus-visible:ring-mr-blue/25";

const TEXTAREA =
  "w-full resize-y rounded-control border border-mr-line bg-mr-surface px-3 py-2.5 text-[15px] leading-[1.55] text-mr-text " +
  "outline-none transition-colors placeholder:text-mr-faint focus:border-mr-blue focus:ring-2 focus:ring-mr-blue/25 " +
  "disabled:bg-mr-shell disabled:text-mr-muted";

const STATUS_CHIP = {
  pending: {
    label: "Not submitted",
    cls: "bg-mr-amber-soft text-mr-amber-ink border-mr-amber-ink/20",
  },
  submitted: {
    label: "Under review",
    cls: "bg-mr-blue-soft text-mr-blue-deep border-mr-blue/25",
  },
  verified: {
    label: "Verified",
    cls: "bg-mr-lime-soft text-mr-lime-ink border-mr-lime-ink/20",
  },
  rejected: {
    label: "Needs changes",
    cls: "bg-mr-coral-soft text-mr-coral-ink border-mr-coral-ink/20",
  },
};

const HINT_TONE = {
  ok: "text-mr-lime-ink",
  error: "text-mr-coral-ink",
  muted: "text-mr-muted",
};

/** What a finished step shows when collapsed — real values, not "Completed". */
function summarise(step, d) {
  switch (step.id) {
    case "company":
      return [d.company_name, d.gst_number ? `GSTIN ${d.gst_number}` : null]
        .filter(Boolean)
        .join(" · ");
    case "registered":
      return [
        d.registered_address,
        d.registered_lat != null ? "Pinned on map" : null,
      ]
        .filter(Boolean)
        .join(" · ");
    case "communication":
      return d.same_as_registered
        ? "Same as registered address"
        : d.communication_address;
    case "director":
      return [d.director_name, d.director_phone].filter(Boolean).join(" · ");
    default:
      return "";
  }
}

function StepSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4">
          <span className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-mr-shell" />
          <div className="flex-1 space-y-2 pt-1.5">
            <span className="block h-3.5 w-40 animate-pulse rounded bg-mr-shell" />
            <span className="block h-3 w-64 animate-pulse rounded bg-mr-shell" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SubmittedReviewCard({ draft, doneCount }) {
  return (
    <section
      className="overflow-hidden rounded-2xl border border-mr-blue/20 bg-mr-surface shadow-sm shadow-mr-ink/[0.035]"
      aria-label="Company verification review status"
    >
      <div className="relative overflow-hidden border-b border-mr-blue/15 bg-gradient-to-br from-mr-blue-soft via-mr-surface to-mr-lime-soft/40 px-5 py-5 sm:px-6 sm:py-6">
        <div className="pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full bg-mr-blue/10 blur-2xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-mr-blue-deep text-white shadow-sm shadow-mr-blue/20">
              <BadgeCheck
                className="h-5 w-5"
                strokeWidth={1.9}
                aria-hidden="true"
              />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-mr-blue">
                Company verification
              </p>
              <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.025em] text-mr-text">
                Your profile is being reviewed
              </h2>
              <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-mr-muted">
                Your submitted company details are safely recorded. We will
                notify your workspace admin if any clarification is needed.
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-mr-blue/20 bg-mr-surface/85 px-3 py-1.5 text-[12px] font-semibold text-mr-blue-deep">
            <span
              className="h-1.5 w-1.5 rounded-full bg-mr-blue"
              aria-hidden="true"
            />{" "}
            Under review
          </span>
        </div>

        <ol
          className="relative mt-5 grid gap-2 sm:grid-cols-3"
          aria-label="Verification review progress"
        >
          {[
            ["Submitted", "Your information is with us", "done"],
            [
              "Review in progress",
              "Our team is checking the profile",
              "active",
            ],
            ["Verified", "We will confirm the outcome", "upcoming"],
          ].map(([label, description, state], index) => (
            <li
              key={label}
              className="flex items-center gap-2.5 rounded-xl border border-mr-line/80 bg-mr-surface/75 px-3 py-2.5"
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${state === "done" ? "bg-mr-lime-ink text-white" : state === "active" ? "bg-mr-blue-deep text-white" : "bg-mr-surface-2 text-mr-faint"}`}
              >
                {state === "done" ? (
                  <Check
                    className="h-3.5 w-3.5"
                    strokeWidth={2.4}
                    aria-hidden="true"
                  />
                ) : (
                  index + 1
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold text-mr-text">
                  {label}
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-mr-muted">
                  {description}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[13px] font-semibold text-mr-text">
              Submitted profile
            </p>
            <p className="mt-0.5 text-[11px] text-mr-muted">
              {doneCount} sections included in this review.
            </p>
          </div>
          <span className="text-[11px] font-medium text-mr-muted">
            Select a section below to view or amend it.
          </span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {KYC_STEPS.map((step) => {
            const Icon = ICONS[step.id];
            const summary = summarise(step, draft) || "Information recorded";
            return (
              <div
                key={step.id}
                className="flex min-w-0 items-center gap-2.5 rounded-xl border border-mr-line bg-mr-surface-2/45 px-3 py-2.5"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-mr-surface text-mr-blue">
                  <Icon
                    className="h-3.5 w-3.5"
                    strokeWidth={1.9}
                    aria-hidden="true"
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold text-mr-text">
                    {step.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-mr-muted">
                    {summary}
                  </span>
                </span>
                <CheckCircle2
                  className="ml-auto h-4 w-4 shrink-0 text-mr-lime-ink"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function KycTimeline({
  kyc,
  loading,
  save,
  submit,
  canEdit,
  openStep,
}) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(null);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const locked = kyc?.status === "verified" || !canEdit;

  useEffect(() => {
    if (!kyc) return;
    setDraft({
      company_name: kyc.company_name || "",
      gst_number: kyc.gst_number || "",
      registered_address: kyc.registered_address || "",
      registered_lat: kyc.registered_lat ?? null,
      registered_lng: kyc.registered_lng ?? null,
      communication_address: kyc.communication_address || "",
      same_as_registered: !!kyc.same_as_registered,
      director_name: kyc.director_name || "",
      director_phone: kyc.director_phone || "",
    });
  }, [kyc]);

  // The reminder modal deep-links to the first unfinished step.
  useEffect(() => {
    if (openStep) setActive(openStep);
  }, [openStep]);

  const doneMap = useMemo(
    () => Object.fromEntries(KYC_STEPS.map((s) => [s.id, stepDone(kyc, s)])),
    [kyc],
  );
  const doneCount = Object.values(doneMap).filter(Boolean).length;
  const allDone = doneCount === KYC_STEPS.length;

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  /* Blocking problems only — a half-typed GSTIN is not an error while you
     are still typing it, but it must not be saveable. */
  const gstHint = gstinHint(draft.gst_number);
  const phoneDigits = String(draft.director_phone || "").replace(/\D/g, "");
  const errors = {
    company:
      gstHint?.tone === "error"
        ? "Fix the GSTIN, or clear it — it is optional."
        : null,
    registered: null,
    communication: null,
    director:
      draft.director_phone &&
      (phoneDigits.length < 10 || phoneDigits.length > 15)
        ? "Enter a valid contact number."
        : null,
  };

  const canSaveStep = (step) =>
    !errors[step.id] &&
    step.fields.every((f) => String(draft[f] ?? "").trim().length > 0);

  const saveStep = async (step) => {
    const patch = {};
    for (const f of step.fields) patch[f] = draft[f];
    if (step.id === "company")
      patch.gst_number = normaliseGstin(draft.gst_number);
    if (step.id === "registered") {
      patch.registered_lat = draft.registered_lat;
      patch.registered_lng = draft.registered_lng;
    }
    if (step.id === "communication")
      patch.same_as_registered = draft.same_as_registered;

    setSaving(true);
    try {
      await save(patch);
      toast.success(`${step.label} saved`);
      // Move to the next unfinished step rather than collapsing — the
      // point of a wizard is momentum.
      const next = KYC_STEPS.find(
        (s) => s.id !== step.id && !stepDone({ ...kyc, ...patch }, s),
      );
      setActive(next ? next.id : null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await submit();
      toast.success("Submitted for review");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <StepSkeleton />;

  const chip = STATUS_CHIP[kyc?.status] || STATUS_CHIP.pending;
  const pct = Math.round((doneCount / KYC_STEPS.length) * 100);

  return (
    <div>
      {/* ── Summary card ── */}
      {kyc?.status === "submitted" ? (
        <SubmittedReviewCard draft={draft} doneCount={doneCount} />
      ) : (
        <div className="overflow-hidden rounded-panel border border-mr-line bg-mr-surface">
          <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
            <div className="flex min-w-0 gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-mr-blue-soft text-mr-blue-deep">
                <ShieldCheck
                  className="h-5 w-5"
                  strokeWidth={1.9}
                  aria-hidden="true"
                />
              </span>
              <div className="min-w-0">
                <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-mr-text">
                  Company verification
                </h2>
                <p className="mt-1 max-w-[46ch] text-[13px] leading-[1.55] text-mr-muted">
                  {kyc?.status === "verified"
                    ? "Verified. These details are locked and can no longer be edited."
                    : "Five short steps, about two minutes. Each one saves on its own — you can stop and come back."}
                </p>
              </div>
            </div>
            <span
              className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[12px] font-medium ${chip.cls}`}
            >
              {chip.label}
            </span>
          </div>

          <div className="border-t border-mr-line px-5 py-3.5 sm:px-6">
            <div className="flex items-center justify-between gap-3 text-[12px]">
              <span className="font-medium text-mr-text">
                {doneCount} of {KYC_STEPS.length} steps
              </span>
              <MotionSpan
                key={pct}
                initial={reduce ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="tabular-nums text-mr-muted"
              >
                {pct}%
              </MotionSpan>
            </div>
            {/* scaleX, not width — the transform runs on the compositor
              instead of relayouting the bar every frame. */}
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-mr-shell">
              <MotionDiv
                className="h-full w-full origin-left rounded-full bg-mr-blue-deep"
                initial={false}
                animate={{ scaleX: doneCount / KYC_STEPS.length }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 150, damping: 24 }
                }
              />
            </div>
          </div>
        </div>
      )}

      {!canEdit && (
        <p className="mt-4 flex items-start gap-2.5 rounded-control bg-mr-shell px-3.5 py-3 text-[13px] text-mr-muted">
          <Lock
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            strokeWidth={1.9}
            aria-hidden="true"
          />
          Only an admin can complete company verification. You can see the
          progress here.
        </p>
      )}

      {/* ── Timeline ── */}
      <ol className="mt-8">
        {KYC_STEPS.map((step, index) => {
          const Icon = ICONS[step.id];
          const isDone = doneMap[step.id];
          const isOpen = active === step.id;
          const isLast = index === KYC_STEPS.length - 1;
          const error = isOpen ? errors[step.id] : null;

          return (
            <li key={step.id} className="flex gap-4">
              {/* Rail + node */}
              <div className="flex flex-col items-center">
                <MotionSpan
                  initial={false}
                  animate={reduce ? {} : { scale: isDone ? [1, 1.16, 1] : 1 }}
                  transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 ${
                    isDone
                      ? "border-mr-blue-deep bg-mr-blue-deep text-white"
                      : isOpen
                        ? "border-mr-blue bg-mr-surface text-mr-blue"
                        : "border-mr-line bg-mr-surface text-mr-faint"
                  }`}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {isDone ? (
                      <MotionSpan
                        key="done"
                        initial={reduce ? false : { scale: 0, rotate: -25 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={reduce ? undefined : { scale: 0 }}
                        transition={{
                          duration: 0.24,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      >
                        <Check
                          className="h-[18px] w-[18px]"
                          strokeWidth={2.6}
                          aria-hidden="true"
                        />
                      </MotionSpan>
                    ) : (
                      <MotionSpan key="idle" initial={false}>
                        <Icon
                          className="h-[17px] w-[17px]"
                          strokeWidth={1.9}
                          aria-hidden="true"
                        />
                      </MotionSpan>
                    )}
                  </AnimatePresence>
                </MotionSpan>

                {!isLast && (
                  <span className="relative my-1.5 w-0.5 flex-1 overflow-hidden rounded-full bg-mr-line">
                    <MotionDiv
                      className="absolute inset-x-0 top-0 h-full origin-top rounded-full bg-mr-blue-deep"
                      initial={false}
                      animate={{ scaleY: isDone ? 1 : 0 }}
                      transition={
                        reduce
                          ? { duration: 0 }
                          : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }
                      }
                    />
                  </span>
                )}
              </div>

              {/* Step card */}
              <div className={`min-w-0 flex-1 ${isLast ? "pb-2" : "pb-6"}`}>
                <div
                  className={`overflow-hidden rounded-panel-sm border transition-colors duration-200 ${
                    isOpen
                      ? "border-mr-blue/35 bg-mr-surface shadow-[0_10px_30px_-20px_rgba(16,17,20,0.3)]"
                      : "border-mr-line bg-mr-surface"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActive(isOpen ? null : step.id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-mr-shell/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mr-blue"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-mr-faint tabular-nums">
                          Step {index + 1}
                        </span>
                        {isDone && !isOpen && (
                          <CheckCircle2
                            className="h-3.5 w-3.5 text-mr-lime-ink"
                            strokeWidth={2.2}
                            aria-hidden="true"
                          />
                        )}
                      </span>
                      <span className="mt-0.5 block text-[15px] font-semibold tracking-[-0.01em] text-mr-text">
                        {step.label}
                      </span>
                      <span
                        className={`mt-0.5 block truncate text-[13px] ${isDone ? "text-mr-muted" : "text-mr-faint"}`}
                      >
                        {isDone ? summarise(step, draft) : "Not filled in yet"}
                      </span>
                    </span>

                    {!isOpen && !locked && (
                      <span className="flex shrink-0 items-center gap-1.5 rounded-control border border-mr-line px-2.5 py-1.5 text-[12px] font-medium text-mr-muted">
                        <Pencil
                          className="h-3 w-3"
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                        {isDone ? "Edit" : "Fill in"}
                      </span>
                    )}
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <MotionDiv
                        key="panel"
                        initial={reduce ? false : { height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={reduce ? undefined : { height: 0, opacity: 0 }}
                        transition={{
                          duration: 0.28,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-4 border-t border-mr-line px-4 py-4">
                          {step.id === "company" && (
                            <>
                              <div className="space-y-1.5">
                                <Label
                                  htmlFor="kyc-company"
                                  className="text-[13px] font-medium text-mr-text"
                                >
                                  Registered company name
                                </Label>
                                <Input
                                  id="kyc-company"
                                  autoFocus
                                  value={draft.company_name || ""}
                                  onChange={(e) =>
                                    set({ company_name: e.target.value })
                                  }
                                  disabled={locked || saving}
                                  placeholder="As printed on your incorporation certificate"
                                  className={FIELD}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label
                                  htmlFor="kyc-gst"
                                  className="flex items-center gap-2 text-[13px] font-medium text-mr-text"
                                >
                                  GSTIN
                                  <span className="rounded-full bg-mr-shell px-2 py-0.5 text-[11px] font-medium text-mr-muted">
                                    Optional
                                  </span>
                                </Label>
                                <Input
                                  id="kyc-gst"
                                  value={draft.gst_number || ""}
                                  onChange={(e) =>
                                    set({
                                      gst_number: normaliseGstin(
                                        e.target.value,
                                      ).slice(0, 15),
                                    })
                                  }
                                  disabled={locked || saving}
                                  placeholder="22AAAAA0000A1Z5"
                                  inputMode="text"
                                  autoComplete="off"
                                  spellCheck={false}
                                  aria-invalid={gstHint?.tone === "error"}
                                  aria-describedby="kyc-gst-hint"
                                  className={`${FIELD} font-mono tracking-[0.06em] uppercase`}
                                />
                                <p
                                  id="kyc-gst-hint"
                                  className={`text-[12px] ${HINT_TONE[gstHint?.tone] || "text-mr-muted"}`}
                                >
                                  {gstHint
                                    ? gstHint.text
                                    : "Leave blank if your business is not GST-registered."}
                                </p>
                              </div>
                            </>
                          )}

                          {step.id === "registered" && (
                            <>
                              <div className="space-y-1.5">
                                <Label
                                  htmlFor="kyc-reg"
                                  className="text-[13px] font-medium text-mr-text"
                                >
                                  Registered address
                                </Label>
                                <textarea
                                  id="kyc-reg"
                                  autoFocus
                                  rows={3}
                                  value={draft.registered_address || ""}
                                  onChange={(e) =>
                                    set({ registered_address: e.target.value })
                                  }
                                  disabled={locked || saving}
                                  placeholder="Building, street, city, state, PIN"
                                  className={TEXTAREA}
                                />
                              </div>
                              <LocationPicker
                                disabled={locked || saving}
                                value={{
                                  lat: draft.registered_lat,
                                  lng: draft.registered_lng,
                                }}
                                onChange={({ lat, lng }) =>
                                  set({
                                    registered_lat: lat,
                                    registered_lng: lng,
                                  })
                                }
                                /* Only fills a BLANK address — a geocoded
                                   string must never clobber what someone
                                   typed by hand. */
                                onResolveAddress={(text) =>
                                  setDraft((d) =>
                                    d.registered_address?.trim()
                                      ? d
                                      : { ...d, registered_address: text },
                                  )
                                }
                              />
                            </>
                          )}

                          {step.id === "communication" && (
                            <>
                              <label className="flex w-fit cursor-pointer items-center gap-2.5 rounded-control bg-mr-shell px-3 py-2.5 text-[14px] text-mr-text">
                                <input
                                  type="checkbox"
                                  checked={!!draft.same_as_registered}
                                  disabled={locked || saving}
                                  onChange={(e) =>
                                    set({
                                      same_as_registered: e.target.checked,
                                      communication_address: e.target.checked
                                        ? draft.registered_address || ""
                                        : draft.communication_address,
                                    })
                                  }
                                  className="h-4 w-4 rounded border-mr-line-strong text-mr-blue-deep focus:ring-mr-blue"
                                />
                                Same as registered address
                              </label>
                              <div className="space-y-1.5">
                                <Label
                                  htmlFor="kyc-comm"
                                  className="text-[13px] font-medium text-mr-text"
                                >
                                  Communication address
                                </Label>
                                <textarea
                                  id="kyc-comm"
                                  rows={3}
                                  value={draft.communication_address || ""}
                                  onChange={(e) =>
                                    set({
                                      communication_address: e.target.value,
                                    })
                                  }
                                  disabled={
                                    locked || saving || draft.same_as_registered
                                  }
                                  placeholder="Where should we send post and invoices?"
                                  className={TEXTAREA}
                                />
                                <p className="text-[12px] text-mr-muted">
                                  Where post and invoices are sent.
                                </p>
                              </div>
                            </>
                          )}

                          {step.id === "director" && (
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label
                                  htmlFor="kyc-dir"
                                  className="text-[13px] font-medium text-mr-text"
                                >
                                  Director name
                                </Label>
                                <Input
                                  id="kyc-dir"
                                  autoFocus
                                  value={draft.director_name || ""}
                                  onChange={(e) =>
                                    set({ director_name: e.target.value })
                                  }
                                  disabled={locked || saving}
                                  placeholder="Full name"
                                  className={FIELD}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label
                                  htmlFor="kyc-phone"
                                  className="text-[13px] font-medium text-mr-text"
                                >
                                  Contact number
                                </Label>
                                <Input
                                  id="kyc-phone"
                                  type="tel"
                                  inputMode="tel"
                                  value={draft.director_phone || ""}
                                  onChange={(e) =>
                                    set({ director_phone: e.target.value })
                                  }
                                  disabled={locked || saving}
                                  placeholder="+91 98765 43210"
                                  aria-invalid={!!errors.director}
                                  className={FIELD}
                                />
                              </div>
                            </div>
                          )}

                          {error && (
                            <p
                              role="alert"
                              className="flex items-center gap-2 text-[12.5px] font-medium text-mr-coral-ink"
                            >
                              <AlertCircle
                                className="h-3.5 w-3.5 shrink-0"
                                strokeWidth={2}
                                aria-hidden="true"
                              />
                              {error}
                            </p>
                          )}

                          {!locked && (
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setActive(null)}
                                disabled={saving}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                onClick={() => saveStep(step)}
                                disabled={saving || !canSaveStep(step)}
                                className="rounded-control bg-mr-blue-deep font-semibold text-white hover:bg-mr-blue disabled:opacity-50"
                              >
                                {saving ? "Saving…" : "Save & continue"}
                              </Button>
                            </div>
                          )}
                        </div>
                      </MotionDiv>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* ── Submit ── */}
      <AnimatePresence initial={false}>
        {allDone && kyc?.status === "pending" && canEdit && (
          <MotionDiv
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-panel-sm border border-mr-blue/25 bg-mr-blue-soft px-4 py-4"
          >
            <p className="text-[13.5px] leading-[1.5] text-mr-blue-deep">
              Every step is filled in. Submit for review to finish verification.
            </p>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-control bg-mr-blue-deep font-semibold text-white hover:bg-mr-blue"
            >
              {submitting ? "Submitting…" : "Submit for review"}
            </Button>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
}
