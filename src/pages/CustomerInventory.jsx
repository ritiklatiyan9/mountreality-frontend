import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSignature,
  Filter,
  IndianRupee,
  LandPlot,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import api from "@/api/api";
import { useAuth } from "@/context/AuthContext";
import { SitePolicyContext } from "@/context/SitePolicyContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MemberAvatar } from "@/components/clients/memberDisplay";
import CollectionProgress from "@/components/property-lifecycle/CollectionProgress";
import CustomerPropertyLifecycle from "@/components/property-lifecycle/CustomerPropertyLifecycle";
import PropertyCell from "@/components/property-lifecycle/PropertyCell";
import VoucherUpload from "@/components/VoucherUpload";
import BankAccountSelect from "@/components/BankAccountSelect";
import { cn } from "@/lib/utils";

const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const dateLabel = (value) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : "—";
const readable = (value) =>
  String(value || "Not started")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const tone = (value) => {
  const status = String(value || "").toUpperCase();
  if (
    [
      "EXECUTED",
      "COMPLETE",
      "POSSESSED",
      "MATCHED",
      "PAID",
      "ACTIVE",
      "EFFECTIVE",
      "ACKNOWLEDGED",
      "DOCUMENTS_DELIVERED",
      "AGREEMENT_EXECUTED",
      "REGISTRY_COMPLETE",
    ].includes(status)
  )
    return "border-emerald-200 bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100";
  if (
    [
      "OVERDUE",
      "REFUND_PENDING",
      "CANCELLATION_REQUESTED",
      "UNDER_REVIEW",
      "REGISTRY_PENDING",
      "POSSESSION_PENDING",
      "REQUESTED",
      "FINANCIAL_REVIEW",
      "AGREEMENT_REVIEW",
      "APPROVAL_PENDING",
    ].includes(status)
  )
    return "border-amber-200 bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100";
  if (["CANCELLED", "REJECTED", "BLOCKED"].includes(status))
    return "border-rose-200 bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-100";
  if (
    ["BOOKED", "PREPARED", "READY", "SCHEDULED", "DOCUMENTS_READY"].includes(
      status,
    )
  )
    return "border-blue-200 bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100";
  return "border-slate-200 bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-100";
};
const today = () => new Date().toISOString().slice(0, 10);
const idempotency = (prefix) =>
  `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;

const EMPTY_BOOKING = {
  primary_allottee_id: "",
  rera_project_id: "",
  rera_project_phase_id: "",
  booking_date: today(),
  joint_allottee_ids: [],
  base_price: "",
  charges: "0",
  discount_amount: "0",
  price_version: "",
  agreement_required: true,
  notes: "",
};

const statusDot = (value) => {
  const status = String(value || "").toUpperCase();
  if (
    [
      "EXECUTED",
      "COMPLETE",
      "POSSESSED",
      "MATCHED",
      "PAID",
      "ACTIVE",
      "EFFECTIVE",
      "ACKNOWLEDGED",
      "DOCUMENTS_DELIVERED",
      "AGREEMENT_EXECUTED",
      "REGISTRY_COMPLETE",
    ].includes(status)
  )
    return "bg-emerald-500";
  if (
    [
      "OVERDUE",
      "REFUND_PENDING",
      "CANCELLATION_REQUESTED",
      "UNDER_REVIEW",
      "REGISTRY_PENDING",
      "POSSESSION_PENDING",
      "REQUESTED",
      "FINANCIAL_REVIEW",
      "AGREEMENT_REVIEW",
      "APPROVAL_PENDING",
    ].includes(status)
  )
    return "bg-amber-500";
  if (["CANCELLED", "REJECTED", "BLOCKED"].includes(status))
    return "bg-rose-500";
  if (
    ["BOOKED", "PREPARED", "READY", "SCHEDULED", "DOCUMENTS_READY"].includes(
      status,
    )
  )
    return "bg-blue-500";
  return "bg-slate-400";
};

function StatusBadge({ value, fallback = "Pending" }) {
  const status = value || fallback;
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 max-w-[150px] gap-1.5 truncate rounded-md px-2 text-[10px] font-semibold",
        tone(status),
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDot(status))}
        aria-hidden="true"
      />
      <span className="truncate">{readable(status)}</span>
    </Badge>
  );
}

function MetricStrip({ rows, metrics: serverMetrics, attention }) {
  const metrics = useMemo(() => {
    const available =
      serverMetrics?.available ??
      rows.filter((row) => !row.booking_id && !Number(row.legacy_booking_count))
        .length;
    const booked =
      serverMetrics?.booked ?? rows.filter((row) => row.booking_id).length;
    const receivable =
      serverMetrics?.receivables ??
      rows.reduce((sum, row) => sum + Number(row.outstanding || 0), 0);
    const overdue =
      serverMetrics?.overdue ??
      rows.reduce((sum, row) => sum + Number(row.overdue || 0), 0);
    const registry =
      serverMetrics?.registry ??
      rows.filter(
        (row) =>
          row.registry_lifecycle_status &&
          row.registry_lifecycle_status !== "COMPLETE",
      ).length;
    const possession =
      serverMetrics?.possession ??
      rows.filter(
        (row) =>
          row.possession_id && row.possession_lifecycle_status !== "POSSESSED",
      ).length;
    return [
      ["Available", available, "bg-slate-50", "bg-slate-400"],
      ["Booked", booked, "bg-blue-50/70", "bg-blue-500"],
      ["Receivables", money(receivable), "bg-violet-50/70", "bg-violet-500"],
      ["Overdue", money(overdue), "bg-amber-50/80", "bg-amber-500"],
      ["Registry", registry, "bg-cyan-50/80", "bg-cyan-500"],
      ["Possession", possession, "bg-emerald-50/70", "bg-emerald-500"],
    ];
  }, [rows, serverMetrics]);
  const notices = [
    [attention?.agreements_pending, "agreements awaiting execution"],
    [attention?.overdue_accounts, "customer accounts overdue"],
    [attention?.refunds_pending, "cancellations awaiting refund"],
    [attention?.registries_ready, "registries ready to schedule"],
    [attention?.handovers_pending, "possession handovers pending"],
    [attention?.unmatched_receipts, "receipts unmatched in bank"],
  ].filter(([count]) => Number(count) > 0);
  return (
    <>
      <div className="grid gap-px border-b border-slate-200 bg-slate-200 sm:grid-cols-3 xl:grid-cols-6">
        {metrics.map(([label, value, surface, accent]) => (
          <div
            key={label}
            className={cn(
              "relative min-w-0 overflow-hidden px-5 py-4",
              surface,
            )}
          >
            <span className={cn("absolute inset-x-0 top-0 h-0.5", accent)} />
            <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400">
              {label}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-slate-900">
              {value}
            </p>
          </div>
        ))}
      </div>
      {notices.length > 0 && (
        <div className="flex gap-5 overflow-x-auto border-b border-amber-100 bg-amber-50/50 px-4 py-2 text-[11px] text-amber-800">
          <span className="flex shrink-0 items-center gap-1.5 font-semibold">
            <AlertCircle className="h-3.5 w-3.5" />
            Needs attention
          </span>
          {notices.map(([count, label]) => (
            <span key={label} className="shrink-0">
              <strong>{count}</strong> {label}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

function BookingSheet({ open, onOpenChange, row, members, projects, onSaved }) {
  const [form, setForm] = useState(EMPTY_BOOKING);
  const [schedule, setSchedule] = useState([]);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const phases =
    projects.find(
      (project) => String(project.id) === String(form.rera_project_id),
    )?.phases || [];
  const final = Math.max(
    Number(form.base_price || 0) +
      Number(form.charges || 0) -
      Number(form.discount_amount || 0),
    0,
  );

  useEffect(() => {
    if (!open || !row) return;
    const base = String(row.sale_price || "");
    setForm({
      ...EMPTY_BOOKING,
      base_price: base,
      rera_project_id: row.rera_project_id ? String(row.rera_project_id) : "",
      rera_project_phase_id: row.rera_project_phase_id
        ? String(row.rera_project_phase_id)
        : "",
    });
    setSchedule([
      { name: "Total consideration", amount: base, due_date: today() },
    ]);
    setStep(0);
  }, [open, row]);

  useEffect(() => {
    setSchedule((items) =>
      items.length === 1 && items[0].name === "Total consideration"
        ? [{ ...items[0], amount: final ? String(final) : "" }]
        : items,
    );
  }, [final]);

  const set = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async () => {
    if (!row?.plot_id || !form.primary_allottee_id)
      return toast.error("Select a primary allottee");
    setBusy(true);
    try {
      const { data } = await api.post("/property-lifecycle/bookings", {
        ...form,
        plot_id: row.plot_id,
        rera_project_id: form.rera_project_id || null,
        rera_project_phase_id: form.rera_project_phase_id || null,
        final_consideration: String(final),
        price_effective_date: form.booking_date,
        payment_schedule: schedule,
        idempotency_key: idempotency("booking"),
      });
      toast.success(
        `Plot ${row.plot_no} booked as ${data.booking.booking_no}.`,
      );
      onOpenChange(false);
      onSaved?.(data.booking);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Booking could not be created",
      );
    } finally {
      setBusy(false);
    }
  };

  const stepNames = [
    "Property",
    "Allottee",
    "Commercials",
    "Schedule",
    "Review",
  ];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-[680px]">
        <SheetHeader className="shrink-0 border-b border-slate-200 px-6 py-5">
          <SheetTitle>Book Plot {row?.plot_no}</SheetTitle>
          <SheetDescription>
            Customer, immutable commercials and payment schedule in one
            controlled flow.
          </SheetDescription>
          <div className="flex items-center pt-3">
            {stepNames.map((name, index) => (
              <div key={name} className="flex min-w-0 flex-1 items-center">
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                    index <= step
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-400",
                  )}
                >
                  {index + 1}
                </span>
                {index < stepNames.length - 1 && (
                  <span
                    className={cn(
                      "h-px flex-1",
                      index < step ? "bg-blue-300" : "bg-slate-200",
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 0 && (
            <div className="space-y-5">
              <PropertyCell
                plotNo={row?.plot_no}
                block={row?.block}
                size={row?.plot_size}
              />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Project">
                  <Select
                    value={form.rera_project_id || "none"}
                    onValueChange={(value) => {
                      set("rera_project_id", value === "none" ? "" : value);
                      set("rera_project_phase_id", "");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Not mapped" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        Not applicable / unmapped
                      </SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={String(project.id)}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Phase">
                  <Select
                    value={form.rera_project_phase_id || "none"}
                    onValueChange={(value) =>
                      set(
                        "rera_project_phase_id",
                        value === "none" ? "" : value,
                      )
                    }
                    disabled={!form.rera_project_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No phase" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No phase</SelectItem>
                      {phases.map((phase) => (
                        <SelectItem key={phase.id} value={String(phase.id)}>
                          {phase.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Booking date">
                <Input
                  type="date"
                  value={form.booking_date}
                  onChange={(event) => set("booking_date", event.target.value)}
                />
              </Field>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-5">
              <Field label="Primary allottee">
                <Select
                  value={form.primary_allottee_id || "none"}
                  onValueChange={(value) => {
                    set("primary_allottee_id", value === "none" ? "" : value);
                    set(
                      "joint_allottee_ids",
                      form.joint_allottee_ids.filter(
                        (id) => String(id) !== String(value),
                      ),
                    );
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select customer</SelectItem>
                    {members
                      .filter((member) => member.status !== "INACTIVE")
                      .map((member) => (
                        <SelectItem key={member.id} value={String(member.id)}>
                          {member.full_name} · {member.phone || "No phone"}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
              <div>
                <Label className="text-xs font-medium text-slate-600">
                  Joint allottees
                </Label>
                <div className="mt-2 max-h-44 divide-y divide-slate-100 overflow-y-auto border-y border-slate-200">
                  {members
                    .filter(
                      (member) =>
                        member.status !== "INACTIVE" &&
                        String(member.id) !== String(form.primary_allottee_id),
                    )
                    .map((member) => {
                      const checked = form.joint_allottee_ids.some(
                        (id) => String(id) === String(member.id),
                      );
                      return (
                        <label
                          key={member.id}
                          className="flex cursor-pointer items-center gap-3 py-2.5 text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(next) =>
                              set(
                                "joint_allottee_ids",
                                next
                                  ? [...form.joint_allottee_ids, member.id]
                                  : form.joint_allottee_ids.filter(
                                      (id) => String(id) !== String(member.id),
                                    ),
                              )
                            }
                          />
                          <span className="font-medium text-slate-800">
                            {member.full_name}
                          </span>
                          <span className="ml-auto text-xs text-slate-400">
                            {member.phone || "No phone"}
                          </span>
                        </label>
                      );
                    })}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Existing Member and KYC records are reused; no duplicate
                  customer is created.
                </p>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Base price">
                <Input
                  type="number"
                  min="0"
                  value={form.base_price}
                  onChange={(event) => set("base_price", event.target.value)}
                />
              </Field>
              <Field label="Other charges">
                <Input
                  type="number"
                  min="0"
                  value={form.charges}
                  onChange={(event) => set("charges", event.target.value)}
                />
              </Field>
              <Field label="Discount">
                <Input
                  type="number"
                  min="0"
                  value={form.discount_amount}
                  onChange={(event) =>
                    set("discount_amount", event.target.value)
                  }
                />
              </Field>
              <Field label="Price version">
                <Input
                  value={form.price_version}
                  onChange={(event) => set("price_version", event.target.value)}
                  placeholder="PG-2026-08"
                />
              </Field>
              <div className="col-span-2 border-t border-slate-200 pt-4">
                <p className="text-xs text-slate-500">Final consideration</p>
                <p className="text-2xl font-semibold tabular-nums text-slate-950">
                  {money(final)}
                </p>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Payment schedule
                  </p>
                  <p className="text-xs text-slate-500">
                    Schedule is a demand plan; receipts remain in Plot Payments.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSchedule((items) => [
                      ...items,
                      {
                        name: `Installment ${items.length + 1}`,
                        amount: "",
                        due_date: today(),
                      },
                    ])
                  }
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Milestone
                </Button>
              </div>
              {schedule.map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_140px_145px_32px] items-end gap-2 border-b border-slate-100 pb-3"
                >
                  <Field label={index === 0 ? "Milestone" : ""}>
                    <Input
                      value={item.name}
                      onChange={(event) =>
                        setSchedule((items) =>
                          items.map((current, i) =>
                            i === index
                              ? { ...current, name: event.target.value }
                              : current,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label={index === 0 ? "Amount" : ""}>
                    <Input
                      type="number"
                      min="0"
                      value={item.amount}
                      onChange={(event) =>
                        setSchedule((items) =>
                          items.map((current, i) =>
                            i === index
                              ? { ...current, amount: event.target.value }
                              : current,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label={index === 0 ? "Due date" : ""}>
                    <Input
                      type="date"
                      value={item.due_date}
                      onChange={(event) =>
                        setSchedule((items) =>
                          items.map((current, i) =>
                            i === index
                              ? { ...current, due_date: event.target.value }
                              : current,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={schedule.length === 1}
                    onClick={() =>
                      setSchedule((items) =>
                        items.filter((_, i) => i !== index),
                      )
                    }
                  >
                    ×
                  </Button>
                </div>
              ))}
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Scheduled</span>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    Math.round(
                      schedule.reduce(
                        (sum, item) => sum + Number(item.amount || 0),
                        0,
                      ) * 100,
                    ) === Math.round(final * 100)
                      ? "text-emerald-700"
                      : "text-red-700",
                  )}
                >
                  {money(
                    schedule.reduce(
                      (sum, item) => sum + Number(item.amount || 0),
                      0,
                    ),
                  )}{" "}
                  / {money(final)}
                </span>
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <MemberAvatar
                  name={
                    members.find(
                      (member) =>
                        String(member.id) === String(form.primary_allottee_id),
                    )?.full_name
                  }
                  size="md"
                />
                <div>
                  <p className="font-semibold text-slate-900">
                    {members.find(
                      (member) =>
                        String(member.id) === String(form.primary_allottee_id),
                    )?.full_name || "No allottee selected"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Plot {row?.plot_no} · {dateLabel(form.booking_date)}
                  </p>
                </div>
              </div>
              <dl className="divide-y divide-slate-100 border-y border-slate-200">
                {[
                  ["Base price", money(form.base_price)],
                  ["Charges", money(form.charges)],
                  ["Discount", `− ${money(form.discount_amount)}`],
                  ["Final consideration", money(final)],
                  ["Schedule milestones", schedule.length],
                  [
                    "Agreement required",
                    form.agreement_required ? "Yes" : "No",
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex justify-between py-3 text-sm"
                  >
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="font-medium text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
              <Field label="Notes">
                <Textarea
                  value={form.notes}
                  onChange={(event) => set("notes", event.target.value)}
                />
              </Field>
            </div>
          )}
        </div>
        <SheetFooter className="shrink-0 border-t border-slate-200 bg-white px-6 py-4">
          <Button
            variant="outline"
            onClick={() =>
              step ? setStep((value) => value - 1) : onOpenChange(false)
            }
          >
            {step ? (
              <>
                <ChevronLeft className="mr-1.5 h-4 w-4" />
                Back
              </>
            ) : (
              "Cancel"
            )}
          </Button>
          {step < stepNames.length - 1 ? (
            <Button
              onClick={() => setStep((value) => value + 1)}
              disabled={step === 1 && !form.primary_allottee_id}
            >
              Continue
              <ChevronRight className="ml-1.5 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={busy}>
              {busy ? "Booking…" : "Confirm booking"}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }) {
  return (
    <label className="block space-y-1.5">
      {label && (
        <Label className="text-xs font-medium text-slate-600">{label}</Label>
      )}
      {children}
    </label>
  );
}

function PaymentPanel({ row, detail, onBack, onSaved }) {
  const [form, setForm] = useState({
    amount: "",
    payment_type: "BANK",
    bank_account_id: "",
    installment_id: "",
    reference: "",
    narration: "",
    voucher_url: "",
  });
  const [decision, setDecision] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    if (!form.amount || !row?.booking_id) return setDecision(null);
    const timer = setTimeout(
      () =>
        api
          .post("/property-lifecycle/collections/guard", {
            site_id: row.site_id,
            booking_id: row.booking_id,
            amount: form.amount,
          })
          .then(({ data }) => setDecision(data.decision))
          .catch(() => setDecision(null)),
      350,
    );
    return () => clearTimeout(timer);
  }, [form.amount, row]);
  const submit = async () => {
    if (!form.amount) return toast.error("Enter a payment amount");
    if (form.payment_type !== "CASH" && !form.bank_account_id) {
      return toast.error("Select the bank account used for this payment");
    }
    setBusy(true);
    try {
      const { data } = await api.post("/plots/payments", {
        plot_id: row.plot_id,
        booking_id: row.booking_id,
        amount: form.amount,
        payment_type: form.payment_type,
        bank_account_id: form.bank_account_id || null,
        payment_from: "CUSTOMER COLLECTION",
        bank_details: form.reference,
        narration: form.narration,
        installment_id: form.installment_id || null,
        voucher_url: form.voucher_url || null,
        idempotency_key: idempotency("receipt"),
      });
      toast.success(
        `Payment of ${money(form.amount)} recorded for Plot ${row.plot_no}.`,
      );
      onSaved?.(data.payment);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Payment could not be recorded",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="border-b border-slate-200 px-6 py-5">
        <button
          className="mb-3 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
          onClick={onBack}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to customer
        </button>
        <h2 className="text-lg font-semibold text-slate-950">Record payment</h2>
        <p className="text-sm text-slate-500">
          {row.customer_name} · Plot {row.plot_no}
        </p>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <div className="border-y border-slate-200 py-4">
          <p className="text-xs text-slate-500">Outstanding</p>
          <p className="text-2xl font-semibold tabular-nums text-slate-950">
            {money(row.outstanding)}
          </p>
        </div>
        <Field label="Amount">
          <Input
            type="number"
            min="0"
            value={form.amount}
            onChange={(event) =>
              setForm((value) => ({ ...value, amount: event.target.value }))
            }
          />
        </Field>
        <div className="grid grid-cols-1 gap-4">
          <Field label="Payment method">
            <Select
              value={form.payment_type}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, payment_type: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["BANK", "CHEQUE", "CASH"].map((value) => (
                  <SelectItem key={value} value={value}>
                    {readable(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <BankAccountSelect
          value={form.bank_account_id}
          onChange={(value) => setForm((current) => ({ ...current, bank_account_id: value }))}
          paymentMode={form.payment_type}
          disabled={busy}
          required
        />
        <Field label="Allocate to">
          <Select
            value={form.installment_id || "none"}
            onValueChange={(value) =>
              setForm((current) => ({
                ...current,
                installment_id: value === "none" ? "" : value,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Unallocated receipt" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unallocated receipt</SelectItem>
              {(detail?.schedule || [])
                .filter((item) => Number(item.due_amount) > 0)
                .map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.installment_name} · {money(item.due_amount)} due
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Reference / UTR">
          <Input
            value={form.reference}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                reference: event.target.value,
              }))
            }
          />
        </Field>
        <VoucherUpload
          label="Receipt proof"
          value={form.voucher_url}
          onChange={(value) =>
            setForm((current) => ({ ...current, voucher_url: value || "" }))
          }
          onUploadingChange={setUploading}
        />
        <Field label="Remarks">
          <Textarea
            value={form.narration}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                narration: event.target.value,
              }))
            }
          />
        </Field>
        {decision && (
          <div
            className={cn(
              "border-l-2 px-3 py-2 text-xs",
              decision.decision === "ALLOWED"
                ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                : decision.decision === "BLOCKED"
                  ? "border-red-500 bg-red-50 text-red-800"
                  : "border-amber-500 bg-amber-50 text-amber-800",
            )}
          >
            <p className="font-semibold">{readable(decision.decision)}</p>
            <p className="mt-0.5">{decision.message}</p>
            {decision.rule && (
              <p className="mt-1 text-[10px] opacity-80">
                Rule: {decision.rule}
              </p>
            )}
          </div>
        )}
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-6 py-4">
        <Button variant="outline" onClick={onBack}>
          Cancel
        </Button>
        <Button
          onClick={submit}
          disabled={busy || uploading || decision?.decision === "BLOCKED"}
        >
          {uploading
            ? "Uploading proof…"
            : busy
              ? "Recording…"
              : "Record payment"}
        </Button>
      </div>
    </>
  );
}

function LifecycleRequestPanel({
  mode,
  row,
  detail,
  members,
  isAdmin,
  onBack,
  onSaved,
}) {
  const cancellation = detail?.cancellations?.[0];
  const transfer = detail?.transfers?.[0];
  const postedRefund = (detail?.refunds || [])
    .filter((item) => item.status === "POSTED")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const [form, setForm] = useState({
    reason: "",
    proposed_deduction: "0",
    commission_impact: "0",
    to_member_id: "",
    effective_date: today(),
    transfer_charge: "0",
    refund_amount: "",
    payment_mode: "BANK",
    bank_account_id: "",
    reference: "",
  });
  const [busy, setBusy] = useState("");
  useEffect(() => {
    setForm({
      reason: "",
      proposed_deduction: "0",
      commission_impact: "0",
      to_member_id: "",
      effective_date: today(),
      transfer_charge: "0",
      refund_amount: cancellation
        ? String(
            Math.max(Number(cancellation.refund_due || 0) - postedRefund, 0),
          )
        : "",
      payment_mode: "BANK",
      bank_account_id: "",
      reference: "",
    });
  }, [mode, row?.booking_id, cancellation, postedRefund]);
  const act = async (key, work, success) => {
    setBusy(key);
    try {
      await work();
      toast.success(success);
      await onSaved();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Workflow action could not be completed.",
      );
    } finally {
      setBusy("");
    }
  };
  const requestCancellation = () =>
    act(
      "request",
      () =>
        api.post(
          `/property-lifecycle/bookings/${row.booking_id}/cancellations`,
          {
            reason: form.reason,
            proposed_deduction: form.proposed_deduction,
            commission_impact: form.commission_impact,
            idempotency_key: idempotency("cancellation"),
          },
        ),
      `Cancellation review opened for Plot ${row.plot_no}.`,
    );
  const decideCancellation = (decision) =>
    act(
      "decision",
      () =>
        api.patch(
          `/property-lifecycle/cancellations/${cancellation.id}/decision`,
          {
            decision,
            reason:
              form.reason || `${decision} after financial and agreement review`,
          },
        ),
      decision === "APPROVE"
        ? Number(cancellation.refund_due) > 0
          ? `Cancellation approved. ${money(cancellation.refund_due)} refund is pending.`
          : `Cancellation approved and Plot ${row.plot_no} released.`
        : `Cancellation for Plot ${row.plot_no} rejected.`,
    );
  const prepareAndPostRefund = () =>
    act(
      "refund",
      async () => {
        const { data } = await api.post(
          `/property-lifecycle/cancellations/${cancellation.id}/refunds`,
          {
            amount: form.refund_amount,
            payment_mode: form.payment_mode,
            bank_account_id: form.bank_account_id || null,
            reference: form.reference,
            idempotency_key: idempotency("refund"),
          },
        );
        try {
          await api.post(
            `/property-lifecycle/refunds/${data.refund.id}/post`,
            {},
          );
        } catch (error) {
          const message = error.response?.data?.message || "posting failed";
          throw Object.assign(error, {
            response: {
              ...error.response,
              data: {
                ...error.response?.data,
                message: `Refund was prepared, but accounting posting failed: ${message}`,
              },
            },
          });
        }
      },
      `Refund of ${money(form.refund_amount)} posted through existing ${form.payment_mode === "CASH" ? "Day Book" : "bank transaction"} records.`,
    );
  const requestTransfer = () =>
    act(
      "request",
      () =>
        api.post(`/property-lifecycle/bookings/${row.booking_id}/transfers`, {
          to_member_id: form.to_member_id,
          reason: form.reason,
          effective_date: form.effective_date,
          transfer_charge: form.transfer_charge,
          idempotency_key: idempotency("transfer"),
        }),
      `Allottee transfer review opened for Plot ${row.plot_no}.`,
    );
  const executeTransfer = () =>
    act(
      "execute",
      () =>
        api.post(`/property-lifecycle/transfers/${transfer.id}/execute`, {
          effective_date: form.effective_date,
        }),
      `Allottee transfer for Plot ${row.plot_no} is effective.`,
    );
  const activeTransfer =
    transfer &&
    !["EFFECTIVE", "REJECTED", "CANCELLED"].includes(transfer.status);
  return (
    <>
      <div className="border-b border-slate-200 px-6 py-5">
        <button
          className="mb-3 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
          onClick={onBack}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to customer
        </button>
        <h2 className="text-lg font-semibold text-slate-950">
          {mode === "cancellation"
            ? "Cancellation & refund"
            : "Transfer allottee"}
        </h2>
        <p className="text-sm text-slate-500">
          {row.customer_name} · Plot {row.plot_no}
        </p>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {mode === "cancellation" ? (
          cancellation ? (
            <>
              <div className="flex items-start justify-between border-y border-slate-200 py-4">
                <div>
                  <p className="text-xs text-slate-500">Current workflow</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {readable(cancellation.status)}
                  </p>
                  <p className="mt-1 max-w-md text-xs text-slate-500">
                    {cancellation.reason}
                  </p>
                </div>
                <Badge variant="outline" className={tone(cancellation.status)}>
                  {readable(cancellation.status)}
                </Badge>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 border-b border-slate-200 pb-4">
                {[
                  ["Collected", money(cancellation.collected_amount)],
                  ["Deduction", money(cancellation.proposed_deduction)],
                  ["Refund due", money(cancellation.refund_due)],
                  ["Posted", money(postedRefund)],
                ].map(([label, value]) => (
                  <div key={label} className="py-2">
                    <dt className="text-[10px] uppercase tracking-wider text-slate-400">
                      {label}
                    </dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              {isAdmin &&
                [
                  "REQUESTED",
                  "FINANCIAL_REVIEW",
                  "AGREEMENT_REVIEW",
                  "APPROVAL_PENDING",
                ].includes(cancellation.status) && (
                  <>
                    <Field label="Decision reason">
                      <Textarea
                        value={form.reason}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            reason: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => decideCancellation("APPROVE")}
                        disabled={busy}
                      >
                        Approve cancellation
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => decideCancellation("REJECT")}
                        disabled={busy}
                      >
                        Reject
                      </Button>
                    </div>
                  </>
                )}
              {isAdmin && cancellation.status === "REFUND_PENDING" && (
                <>
                  <Field label="Refund amount">
                    <Input
                      type="number"
                      min="0"
                      value={form.refund_amount}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          refund_amount: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <div className="grid grid-cols-1 gap-4">
                    <Field label="Payment mode">
                      <Select
                        value={form.payment_mode}
                        onValueChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            payment_mode: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["BANK", "CHEQUE", "CASH"].map((value) => (
                            <SelectItem key={value} value={value}>
                              {readable(value)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <BankAccountSelect
                    value={form.bank_account_id}
                    onChange={(value) => setForm((current) => ({ ...current, bank_account_id: value }))}
                    paymentMode={form.payment_mode}
                    disabled={Boolean(busy)}
                    required
                  />
                  <Field label="Reference">
                    <Input
                      value={form.reference}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          reference: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Button
                    onClick={prepareAndPostRefund}
                    disabled={
                      busy ||
                      !form.refund_amount ||
                      (form.payment_mode !== "CASH" && !form.bank_account_id)
                    }
                  >
                    {busy === "refund"
                      ? "Posting refund…"
                      : "Prepare & post refund"}
                  </Button>
                </>
              )}
            </>
          ) : (
            <>
              <div className="border-y border-slate-200 py-4">
                <p className="text-xs text-slate-500">
                  Original receipts stay immutable. The property is released
                  only after approval and required refund posting.
                </p>
              </div>
              <Field label="Cancellation reason">
                <Textarea
                  value={form.reason}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      reason: event.target.value,
                    }))
                  }
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Proposed deduction">
                  <Input
                    type="number"
                    min="0"
                    value={form.proposed_deduction}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        proposed_deduction: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Commission impact">
                  <Input
                    type="number"
                    min="0"
                    value={form.commission_impact}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        commission_impact: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>
              <Button
                onClick={requestCancellation}
                disabled={busy || !form.reason.trim()}
              >
                {busy ? "Requesting…" : "Request cancellation"}
              </Button>
            </>
          )
        ) : activeTransfer ? (
          <>
            <div className="flex items-start justify-between border-y border-slate-200 py-4">
              <div>
                <p className="text-xs text-slate-500">Pending transfer</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {transfer.from_name} → {transfer.to_name}
                </p>
                <p className="mt-1 text-xs text-slate-500">{transfer.reason}</p>
              </div>
              <Badge variant="outline" className={tone(transfer.status)}>
                {readable(transfer.status)}
              </Badge>
            </div>
            {isAdmin && (
              <>
                <Field label="Effective date">
                  <Input
                    type="date"
                    value={form.effective_date}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        effective_date: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Button onClick={executeTransfer} disabled={busy}>
                  {busy ? "Executing…" : "Approve & make transfer effective"}
                </Button>
              </>
            )}
          </>
        ) : (
          <>
            <div className="border-y border-slate-200 py-4">
              <p className="text-xs text-slate-500">
                Payments, documents and agreement history remain on this
                booking. The previous allottee is retained as former.
              </p>
            </div>
            <Field label="New primary allottee">
              <Select
                value={form.to_member_id || "none"}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    to_member_id: value === "none" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select customer</SelectItem>
                  {members
                    .filter(
                      (member) =>
                        String(member.id) !== String(row.client_member_id) &&
                        member.status !== "INACTIVE",
                    )
                    .map((member) => (
                      <SelectItem key={member.id} value={String(member.id)}>
                        {member.full_name} · {member.phone || "No phone"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Effective date">
                <Input
                  type="date"
                  value={form.effective_date}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      effective_date: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Transfer charge">
                <Input
                  type="number"
                  min="0"
                  value={form.transfer_charge}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      transfer_charge: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>
            <Field label="Reason">
              <Textarea
                value={form.reason}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
              />
            </Field>
            <Button
              onClick={requestTransfer}
              disabled={busy || !form.to_member_id || !form.reason.trim()}
            >
              {busy ? "Requesting…" : "Request transfer"}
            </Button>
          </>
        )}
      </div>
    </>
  );
}

function DetailSheet({
  open,
  onOpenChange,
  row,
  detail,
  loading,
  onReload,
  onOpenPayment,
  onOpenCancellation,
  onOpenTransfer,
  canUpdate,
  navigate,
}) {
  const [tab, setTab] = useState("overview");
  const [busy, setBusy] = useState("");
  useEffect(() => {
    if (open) setTab("overview");
  }, [open, row?.booking_id]);
  const latestAgreement = detail?.agreements?.[0];
  const registry = detail?.registry;
  const act = async (key, request, message) => {
    setBusy(key);
    try {
      await request();
      toast.success(message);
      await onReload();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Action could not be completed",
      );
    } finally {
      setBusy("");
    }
  };
  const agreementAction = () => {
    if (!latestAgreement)
      return act(
        "agreement",
        () =>
          api.post(
            `/property-lifecycle/bookings/${row.booking_id}/agreements`,
            { status: "PREPARED", agreement_type: "ALLOTMENT_AGREEMENT" },
          ),
        `Agreement prepared for Plot ${row.plot_no}.`,
      );
    const next = {
      DRAFT: "PREPARED",
      PREPARED: "UNDER_REVIEW",
      UNDER_REVIEW: "APPROVED_FOR_EXECUTION",
      APPROVED_FOR_EXECUTION: "EXECUTED",
    }[latestAgreement.status];
    if (!next) return;
    return act(
      "agreement",
      () =>
        api.patch(
          `/property-lifecycle/agreements/${latestAgreement.id}/status`,
          {
            status: next,
            ...(next === "EXECUTED" ? { execution_date: today() } : {}),
          },
        ),
      `Agreement moved to ${readable(next)}.`,
    );
  };
  const registryAction = () => {
    if (!registry) return navigate("/plot-registry");
    const next = {
      NOT_READY: "READY",
      READY: "SCHEDULED",
      SCHEDULED: "DOCUMENTS_READY",
      DOCUMENTS_READY: "EXECUTED",
      EXECUTED: "COMPLETE",
    }[registry.lifecycle_status];
    if (!next) return;
    return act(
      "registry",
      () =>
        api.patch(`/property-lifecycle/registries/${registry.id}/status`, {
          status: next,
          ...(next === "SCHEDULED"
            ? { scheduled_at: new Date().toISOString() }
            : {}),
        }),
      `Registry marked ${readable(next)}.`,
    );
  };
  const possessionAction = () => {
    if (!registry?.possession_id)
      return act(
        "possession",
        () =>
          api.post(`/property-lifecycle/registries/${registry.id}/possession`, {
            idempotency_key: idempotency("possession"),
          }),
        `Possession workflow opened for Plot ${row.plot_no}.`,
      );
    const next = {
      READY: "HANDOVER_SCHEDULED",
      HANDOVER_SCHEDULED: "DOCUMENTS_DELIVERED",
      DOCUMENTS_DELIVERED: "ACKNOWLEDGED",
      ACKNOWLEDGED: "POSSESSED",
    }[registry.possession_lifecycle_status];
    if (!next) return;
    return act(
      "possession",
      () =>
        api.patch(
          `/property-lifecycle/possessions/${registry.possession_id}/status`,
          {
            status: next,
            ...(next === "HANDOVER_SCHEDULED"
              ? { scheduled_at: new Date().toISOString() }
              : {}),
            ...(next === "ACKNOWLEDGED"
              ? {
                  acknowledgement: {
                    acknowledged_at: new Date().toISOString(),
                    method: "IN_PERSON",
                  },
                }
              : {}),
            ...(next === "POSSESSED" ? { possession_date: today() } : {}),
          },
        ),
      `Possession moved to ${readable(next)}.`,
    );
  };
  const tabs = ["overview", "payments", "agreement", "registry", "activity"];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-[720px]">
        <SheetHeader className="shrink-0 border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <MemberAvatar
              src={row?.customer_photo}
              name={row?.customer_name || row?.plot_no}
              size="md"
            />
            <div className="min-w-0">
              <SheetTitle className="truncate">
                {row?.customer_name || `Plot ${row?.plot_no}`}
              </SheetTitle>
              <SheetDescription className="truncate">
                Plot {row?.plot_no} ·{" "}
                {[row?.project_name, row?.phase_name]
                  .filter(Boolean)
                  .join(" · ") || "Legacy Site context"}
              </SheetDescription>
            </div>
          </div>
          {row?.booking_id && (
            <div className="pt-4">
              <CustomerPropertyLifecycle record={row} />
            </div>
          )}
        </SheetHeader>
        <div className="flex shrink-0 gap-5 overflow-x-auto border-b border-slate-200 px-6">
          {tabs.map((value) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={cn(
                "border-b-2 py-3 text-xs font-medium transition-colors",
                tab === value
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-900",
              )}
            >
              {readable(value)}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : !row?.booking_id ? (
            <div className="py-20 text-center">
              <LandPlot className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                {Number(row?.legacy_booking_count)
                  ? "Existing booking needs mapping review"
                  : "This property is available"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {Number(row?.legacy_booking_count)
                  ? "A legacy booking is linked to this plot. It was not guessed into the new lifecycle; review it before creating another booking."
                  : "Start a booking to connect the customer, schedule, payments and registry."}
              </p>
            </div>
          ) : tab === "overview" ? (
            <div className="space-y-6">
              <div className="grid grid-cols-3 border-y border-slate-200">
                <Mini label="Value" value={money(row.final_consideration)} />
                <Mini label="Received" value={money(row.received)} border />
                <Mini label="Due" value={money(row.outstanding)} border />
              </div>
              <CollectionProgress
                received={row.received}
                consideration={row.final_consideration}
                overdue={row.overdue}
              />
              <section>
                <Heading title="Booking" />
                <dl className="divide-y divide-slate-100">
                  {[
                    ["Booking number", row.booking_no],
                    ["Booking date", dateLabel(row.booking_date)],
                    [
                      "Project / phase",
                      [row.project_name, row.phase_name]
                        .filter(Boolean)
                        .join(" · ") || "Unmapped",
                    ],
                    ["Status", readable(row.booking_status)],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex justify-between py-2.5 text-sm"
                    >
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="font-medium text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          ) : tab === "payments" ? (
            <div>
              <Heading
                title="Payment schedule"
                description="Actual receipts remain in Plot Payments."
              />
              {detail?.schedule?.length ? (
                <ol className="relative ml-2 border-l border-slate-200">
                  {detail.schedule.map((item) => (
                    <li
                      key={item.id}
                      className="relative grid grid-cols-[1fr_auto] gap-4 pb-5 pl-5"
                    >
                      <span
                        className={cn(
                          "absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white",
                          Number(item.due_amount) <= 0
                            ? "bg-emerald-500"
                            : new Date(item.due_date) < new Date()
                              ? "bg-amber-500"
                              : "bg-slate-300",
                        )}
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {item.installment_name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {Number(item.due_amount) <= 0
                            ? "Paid"
                            : `Due ${dateLabel(item.due_date)}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums text-slate-900">
                          {money(item.amount)}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {money(item.allocated_amount)} allocated
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <Empty
                  title="No payment schedule"
                  text="Add installments from the existing Plot Payments screen."
                />
              )}
              {detail?.payments?.length > 0 && (
                <>
                  <Heading title="Recent receipts" />
                  <div className="divide-y divide-slate-100">
                    {detail.payments.slice(0, 8).map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between py-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {payment.receipt_no || `Receipt ${payment.id}`}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {dateLabel(payment.date)} · {payment.payment_type} ·{" "}
                            {readable(payment.reconciliation_status)}
                          </p>
                        </div>
                        <p className="font-semibold tabular-nums text-slate-900">
                          {money(payment.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : tab === "agreement" ? (
            <div>
              <Heading
                title="Agreement history"
                description="Executed revisions are immutable and remain traceable."
              />
              {detail?.agreements?.length ? (
                <div className="divide-y divide-slate-100 border-y border-slate-200">
                  {detail.agreements.map((agreement) => (
                    <div
                      key={agreement.id}
                      className="flex items-center justify-between py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          Agreement v{agreement.version_number}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {agreement.agreement_number ||
                            agreement.agreement_type}{" "}
                          ·{" "}
                          {dateLabel(
                            agreement.execution_date || agreement.created_at,
                          )}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={tone(agreement.status)}
                      >
                        {readable(agreement.status)}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  title="No agreement prepared"
                  text="Create the first structured agreement revision for this booking."
                />
              )}
              <Button
                className="mt-5"
                onClick={agreementAction}
                disabled={
                  busy === "agreement" ||
                  ["EXECUTED", "SUPERSEDED", "CANCELLED"].includes(
                    latestAgreement?.status,
                  )
                }
              >
                <FileSignature className="mr-2 h-4 w-4" />
                {latestAgreement
                  ? `Move to ${readable({ DRAFT: "PREPARED", PREPARED: "UNDER_REVIEW", UNDER_REVIEW: "APPROVED_FOR_EXECUTION", APPROVED_FOR_EXECUTION: "EXECUTED" }[latestAgreement.status] || latestAgreement.status)}`
                  : "Prepare agreement"}
              </Button>
            </div>
          ) : tab === "registry" ? (
            <div>
              <Heading
                title="Registry & possession"
                description="The existing Plot Registry remains the conveyance record."
              />
              {registry ? (
                <div className="space-y-5">
                  <dl className="divide-y divide-slate-100 border-y border-slate-200">
                    {[
                      ["Registry status", readable(registry.lifecycle_status)],
                      ["Registry date", dateLabel(registry.registry_date)],
                      [
                        "Possession",
                        readable(
                          registry.possession_lifecycle_status ||
                            registry.possession_status,
                        ),
                      ],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="flex justify-between py-3 text-sm"
                      >
                        <dt className="text-slate-500">{label}</dt>
                        <dd className="font-medium text-slate-900">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  {registry.readiness_result?.checks?.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold text-slate-700">
                        Readiness
                      </p>
                      {registry.readiness_result.checks.map((check) => (
                        <div
                          key={check.key}
                          className="flex items-center gap-2 py-1 text-xs"
                        >
                          <CheckCircle2
                            className={cn(
                              "h-3.5 w-3.5",
                              check.passed
                                ? "text-emerald-600"
                                : "text-slate-300",
                            )}
                          />
                          {check.label}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={registryAction}
                      disabled={
                        busy === "registry" ||
                        registry.lifecycle_status === "COMPLETE"
                      }
                    >
                      {registry.lifecycle_status === "COMPLETE"
                        ? "Registry complete"
                        : `Move to ${readable({ NOT_READY: "READY", READY: "SCHEDULED", SCHEDULED: "DOCUMENTS_READY", DOCUMENTS_READY: "EXECUTED", EXECUTED: "COMPLETE" }[registry.lifecycle_status])}`}
                    </Button>
                    {registry.lifecycle_status === "COMPLETE" && (
                      <Button
                        variant="outline"
                        onClick={possessionAction}
                        disabled={
                          busy === "possession" ||
                          registry.possession_lifecycle_status === "POSSESSED"
                        }
                      >
                        {registry.possession_id
                          ? `Move handover to ${readable({ READY: "HANDOVER_SCHEDULED", HANDOVER_SCHEDULED: "DOCUMENTS_DELIVERED", DOCUMENTS_DELIVERED: "ACKNOWLEDGED", ACKNOWLEDGED: "POSSESSED" }[registry.possession_lifecycle_status] || registry.possession_lifecycle_status)}`
                          : "Start possession"}
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <Empty
                  title="No connected registry"
                  text="Create it from the existing Plot Registry and map an existing receipt."
                  action={
                    <Button
                      variant="outline"
                      onClick={() => navigate("/plot-registry")}
                    >
                      Open Plot Registry
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  }
                />
              )}
            </div>
          ) : (
            <div>
              <Heading
                title="Activity"
                description="Audit events from booking, agreement, cancellation, transfer and possession."
              />
              {detail?.activity?.length ? (
                <ol className="divide-y divide-slate-100 border-y border-slate-200">
                  {detail.activity.map((event) => (
                    <li key={event.id} className="py-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {readable(event.action)}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {event.user_name || "MountReality user"} ·{" "}
                            {dateLabel(event.created_at)}
                          </p>
                        </div>
                        <span className="text-[10px] uppercase text-slate-400">
                          {readable(event.entity_type)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <Empty
                  title="No lifecycle activity yet"
                  text="Confirmed workflow changes will appear here."
                />
              )}
            </div>
          )}
        </div>
        {row?.booking_id && (
          <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-6 py-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="mr-1.5 h-4 w-4" />
                  More
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onSelect={() => navigate(`/plot-payments/${row.plot_id}`)}
                >
                  Open Plot Payments
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate("/plot-registry")}>
                  Open Plot Registry
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={onOpenCancellation}
                  disabled={!canUpdate}
                >
                  Cancellation & refund
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={onOpenTransfer}
                  disabled={!canUpdate}
                >
                  Transfer allottee
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={onOpenPayment}>
              <IndianRupee className="mr-1.5 h-4 w-4" />
              Record payment
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Mini({ label, value, border }) {
  return (
    <div
      className={cn("py-4 text-center", border && "border-l border-slate-100")}
    >
      <p className="text-[10px] uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold tabular-nums text-slate-900">
        {value}
      </p>
    </div>
  );
}
function Heading({ title, description }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && (
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      )}
    </div>
  );
}
function Empty({ title, text, action }) {
  return (
    <div className="py-14 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default function CustomerInventory() {
  const { currentSite, hasPermission, user } = useAuth();
  const policy = useContext(SitePolicyContext);
  const navigate = useNavigate();
  const siteId = currentSite?.id;
  const title =
    policy?.getTerm?.(
      "customer_inventory",
      policy?.isLegacy ? "Customer & Inventory" : "Allottees & Collections",
    ) || "Customer & Inventory";
  const [state, setState] = useState({
    rows: [],
    pagination: { page: 1, limit: 30, total: 0 },
    needs_attention: {},
    loading: true,
    error: "",
  });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState("updated_at:desc");
  const [page, setPage] = useState(1);
  const [members, setMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [bookingRow, setBookingRow] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [drawerMode, setDrawerMode] = useState("detail");
  const request = useRef(0);
  const canWrite = hasPermission("plot_payments", "write");
  const canUpdate = hasPermission("plot_payments", "update");
  const isAdmin = ["admin", "super_admin"].includes(user?.role);

  const load = useCallback(async () => {
    if (!siteId) return;
    const sequence = ++request.current;
    const [sortBy, sortOrder] = sort.split(":");
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const { data } = await api.get("/property-lifecycle/workspace", {
        params: {
          site_id: siteId,
          page,
          limit: 30,
          sort_by: sortBy,
          sort_order: sortOrder,
          ...(query ? { q: query } : {}),
          ...(status !== "ALL" ? { status } : {}),
        },
      });
      if (sequence === request.current)
        setState({ ...data, loading: false, error: "" });
    } catch (error) {
      if (sequence === request.current)
        setState((current) => ({
          ...current,
          loading: false,
          error:
            error.response?.data?.message ||
            "Customer and property workspace could not be loaded.",
        }));
    }
  }, [page, query, siteId, sort, status]);
  useEffect(() => {
    const timer = setTimeout(load, 180);
    return () => clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (!siteId) return;
    Promise.allSettled([
      api.get("/members", { params: { site_id: siteId } }),
      api.get("/rera/control-centre", { params: { site_id: siteId } }),
    ]).then(([memberResult, projectResult]) => {
      if (memberResult.status === "fulfilled")
        setMembers(memberResult.value.data.members || []);
      if (projectResult.status === "fulfilled")
        setProjects(projectResult.value.data.projects || []);
    });
  }, [siteId]);
  const openDetail = useCallback(
    async (row) => {
      setSelected({ ...row, site_id: siteId });
      setDrawerMode("detail");
      setDetail(null);
      if (!row.booking_id) return;
      setDetailLoading(true);
      try {
        const { data } = await api.get(
          `/property-lifecycle/bookings/${row.booking_id}`,
        );
        setDetail(data);
      } catch (error) {
        toast.error(
          error.response?.data?.message ||
            "Lifecycle details could not be loaded",
        );
      } finally {
        setDetailLoading(false);
      }
    },
    [siteId],
  );
  const reloadSelected = useCallback(async () => {
    await load();
    if (selected?.booking_id) await openDetail(selected);
  }, [load, openDetail, selected]);
  const totalPages = Math.max(
    Math.ceil((state.pagination?.total || 0) / 30),
    1,
  );

  return (
    <div className="min-h-full bg-[#f6f8fb]">
      <div className="mx-auto w-full max-w-[1920px] px-4 py-5 sm:px-6 2xl:max-w-none 2xl:px-8">
        <header className="mb-5 flex flex-col gap-5 rounded-2xl border border-slate-200/80 bg-white px-5 py-5 shadow-sm shadow-slate-900/[0.035] sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              <span>Operations</span>
              <span>/</span>
              <span>
                {policy?.isLegacy ? "Plot Payments" : "Developer lifecycle"}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[28px]">
              {title}
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">
              Bookings, collections, agreements, registry and possession across
              the selected Site.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/project-finance")}
            >
              Project finance
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            {canWrite && (
              <Button
                onClick={() =>
                  setBookingRow(
                    state.rows.find(
                      (row) =>
                        !row.booking_id && !Number(row.legacy_booking_count),
                    ) || null,
                  )
                }
                disabled={
                  !state.rows.some(
                    (row) =>
                      !row.booking_id && !Number(row.legacy_booking_count),
                  )
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Book property
              </Button>
            )}
          </div>
        </header>
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-900/[0.035]">
          <MetricStrip
            rows={state.rows}
            metrics={state.metrics}
            attention={state.needs_attention}
          />
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-4 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search property, customer or phone…"
                className="h-10 border-slate-200 bg-white pl-9 shadow-sm focus-visible:ring-blue-500"
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-full border-slate-200 bg-white shadow-sm md:w-48">
                <Filter className="mr-2 h-3.5 w-3.5 text-slate-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  "ALL",
                  "AVAILABLE",
                  "BOOKED",
                  "AGREEMENT_EXECUTED",
                  "REGISTRY_PENDING",
                  "REGISTRY_COMPLETE",
                  "POSSESSION_PENDING",
                  "POSSESSED",
                ].map((value) => (
                  <SelectItem key={value} value={value}>
                    {readable(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={sort}
              onValueChange={(value) => {
                setSort(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-full border-slate-200 bg-white shadow-sm md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated_at:desc">
                  Recently updated
                </SelectItem>
                <SelectItem value="property:asc">Property A–Z</SelectItem>
                <SelectItem value="customer:asc">Customer A–Z</SelectItem>
                <SelectItem value="consideration:desc">
                  Highest value
                </SelectItem>
                <SelectItem value="agreement:asc">Agreement status</SelectItem>
                <SelectItem value="registry:asc">Registry status</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={load}
              aria-label="Refresh"
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  state.loading && "animate-spin motion-reduce:animate-none",
                )}
              />
            </Button>
          </div>
          {state.error ? (
            <div className="py-20 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-red-400" />
              <p className="mt-3 text-sm font-semibold text-slate-800">
                Workspace unavailable
              </p>
              <p className="mt-1 text-xs text-slate-500">{state.error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={load}
              >
                Try again
              </Button>
            </div>
          ) : state.loading ? (
            <div className="space-y-px">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="grid grid-cols-6 gap-5 border-b border-slate-100 px-4 py-3"
                >
                  <Skeleton className="h-9 w-40" />
                  <Skeleton className="h-9 w-36" />
                  <Skeleton className="h-9 w-32" />
                  <Skeleton className="h-9 w-36" />
                  <Skeleton className="h-7 w-20" />
                  <Skeleton className="h-7 w-20" />
                </div>
              ))}
            </div>
          ) : state.rows.length === 0 ? (
            <Empty
              title="No properties match these filters"
              text="Change the search or status filter. New plots continue to be created in the existing Plot Payments module."
            />
          ) : (
            <div className="overflow-x-auto bg-white">
              <Table className="min-w-[1440px]">
                <TableHeader className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-12 pl-5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                      Property
                    </TableHead>
                    <TableHead className="h-12 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                      Customer
                    </TableHead>
                    <TableHead className="h-12 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                      Project / Phase
                    </TableHead>
                    <TableHead className="h-12 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                      Consideration
                    </TableHead>
                    <TableHead className="h-12 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                      Collection
                    </TableHead>
                    <TableHead className="h-12 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                      Agreement
                    </TableHead>
                    <TableHead className="h-12 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                      Registry
                    </TableHead>
                    <TableHead className="h-12 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                      Possession
                    </TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.rows.map((row) => (
                    <TableRow
                      key={row.plot_id}
                      onClick={() => openDetail(row)}
                      className="group cursor-pointer border-slate-100 transition-colors duration-150 hover:bg-blue-50/60"
                    >
                      <TableCell className="py-4 pl-5">
                        <PropertyCell
                          plotNo={row.plot_no}
                          block={row.block}
                          size={row.plot_size}
                        />
                        {row.booking_id && (
                          <div className="mt-2 w-[170px]">
                            <CustomerPropertyLifecycle record={row} compact />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        {row.customer_name ? (
                          <div className="flex items-center gap-2">
                            <MemberAvatar
                              src={row.customer_photo}
                              name={row.customer_name}
                              size="sm"
                              className="h-8 w-8 text-[10px]"
                            />
                            <div>
                              <p className="max-w-[150px] truncate text-[13px] font-medium text-slate-800">
                                {row.customer_name}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {row.customer_phone || row.booking_no}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span
                            className={cn(
                              "text-xs",
                              Number(row.legacy_booking_count)
                                ? "text-amber-700"
                                : "text-slate-400",
                            )}
                          >
                            {Number(row.legacy_booking_count)
                              ? "Existing booking · mapping review"
                              : "Available"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        <p className="max-w-[160px] truncate text-xs font-medium text-slate-700">
                          {row.project_name ||
                            (row.project_mapping_status === "NOT_APPLICABLE"
                              ? "Not applicable"
                              : "Unmapped")}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {row.phase_name ||
                            readable(row.project_mapping_status)}
                        </p>
                      </TableCell>
                      <TableCell className="py-4 text-xs font-semibold tabular-nums text-slate-800">
                        {money(row.final_consideration || row.sale_price)}
                      </TableCell>
                      <TableCell className="py-4">
                        {row.booking_id ? (
                          <CollectionProgress
                            received={
                              Number(row.received) - Number(row.refunded)
                            }
                            consideration={
                              row.final_consideration || row.sale_price
                            }
                            overdue={row.overdue}
                          />
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        <StatusBadge
                          value={
                            row.latest_agreement_status || row.agreement_status
                          }
                          fallback="Not started"
                        />
                      </TableCell>
                      <TableCell className="py-4">
                        <StatusBadge value={row.registry_lifecycle_status} />
                      </TableCell>
                      <TableCell className="py-4">
                        <StatusBadge value={row.possession_lifecycle_status} />
                      </TableCell>
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => openDetail(row)}>
                              Open lifecycle
                            </DropdownMenuItem>
                            {!row.booking_id &&
                              !Number(row.legacy_booking_count) &&
                              canWrite && (
                                <DropdownMenuItem
                                  onSelect={() => setBookingRow(row)}
                                >
                                  Book property
                                </DropdownMenuItem>
                              )}
                            {row.booking_id && (
                              <DropdownMenuItem
                                onSelect={() =>
                                  navigate(`/plot-payments/${row.plot_id}`)
                                }
                              >
                                Open Plot Payments
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/60 px-5 py-3.5 text-xs text-slate-500">
            <span className="font-medium text-slate-600">
              {state.pagination?.total || 0} properties
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-slate-200 bg-white shadow-sm"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[90px] text-center font-medium text-slate-600">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-slate-200 bg-white shadow-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      <BookingSheet
        open={Boolean(bookingRow)}
        onOpenChange={(open) => !open && setBookingRow(null)}
        row={bookingRow}
        members={members}
        projects={projects}
        onSaved={load}
      />
      {drawerMode === "detail" ? (
        <DetailSheet
          open={Boolean(selected)}
          onOpenChange={(open) => !open && setSelected(null)}
          row={selected}
          detail={detail}
          loading={detailLoading}
          onReload={reloadSelected}
          onOpenPayment={() => setDrawerMode("payment")}
          onOpenCancellation={() => setDrawerMode("cancellation")}
          onOpenTransfer={() => setDrawerMode("transfer")}
          canUpdate={canUpdate}
          navigate={navigate}
        />
      ) : (
        <Sheet
          open={Boolean(selected)}
          onOpenChange={(open) => !open && setSelected(null)}
        >
          <SheetContent className="flex w-full flex-col p-0 sm:max-w-[760px]">
            {drawerMode === "payment" ? (
              <PaymentPanel
                row={selected}
                detail={detail}
                onBack={() => setDrawerMode("detail")}
                onSaved={async () => {
                  await reloadSelected();
                  setDrawerMode("detail");
                }}
              />
            ) : (
              <LifecycleRequestPanel
                mode={drawerMode}
                row={selected}
                detail={detail}
                members={members}
                isAdmin={isAdmin}
                onBack={() => setDrawerMode("detail")}
                onSaved={async () => {
                  await reloadSelected();
                  setDrawerMode("detail");
                }}
              />
            )}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
