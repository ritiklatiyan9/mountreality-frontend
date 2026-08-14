import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSignature,
  FileText,
  Filter,
  FolderUp,
  IndianRupee,
  LandPlot,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Ruler,
  Search,
  UserRound,
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
import RegistryDocuments from "@/components/RegistryDocuments";
import ReraWorkflowNotice from "@/components/policy/ReraWorkflowNotice";
import {
  REGISTRY_WORKFLOW_STEPS,
  advanceRegistry,
  getNextRegistryStatus,
  registryActionError,
} from "@/services/registryWorkflow";
import { cn } from "@/lib/utils";
import { getFinancePaymentPolicy } from "@/lib/financePaymentPolicy";
import { isReraOperatingProfile } from "@/lib/sitePolicy";

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
const CUSTOMER_INVENTORY_PAGE_SIZE = 200;
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

const REGISTRY_STAGE_COPY = Object.freeze({
  NOT_READY: "Review the required booking, agreement and collection checks before opening the registry workflow.",
  READY: "Confirm the appointment details and schedule the registry with the executing parties.",
  SCHEDULED: "Collect the final deed pack, NOC and supporting documents before execution.",
  DOCUMENTS_READY: "The document pack is ready. Record execution after the deed has been signed.",
  EXECUTED: "Verify the executed deed and close the registry record when every detail is correct.",
  COMPLETE: "The registry workflow is complete. Possession and handover can now be managed below.",
});

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
      ["Available", available, "bg-slate-400"],
      ["Booked", booked, "bg-blue-500"],
      ["Receivables", money(receivable), "bg-violet-500"],
      ["Overdue", money(overdue), "bg-amber-500"],
      ["Registry", registry, "bg-cyan-500"],
      ["Possession", possession, "bg-emerald-500"],
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
      <div className="grid grid-cols-2 gap-px border-b border-slate-200 bg-slate-200/70 sm:grid-cols-3 xl:grid-cols-6">
        {metrics.map(([label, value, accent]) => (
          <div key={label} className="min-w-0 bg-white px-5 py-3.5">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
              <span
                className={cn("h-1.5 w-1.5 shrink-0 rounded-full", accent)}
                aria-hidden="true"
              />
              {label}
            </p>
            <p className="mt-1 truncate text-[19px] font-semibold tabular-nums tracking-tight text-slate-900">
              {value}
            </p>
          </div>
        ))}
      </div>
      {notices.length > 0 && (
        <div className="flex gap-5 overflow-x-auto border-b border-slate-200 bg-amber-50/40 px-5 py-2 text-[11px] text-amber-800">
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
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const activeCustomers = members.filter((member) => member.status !== "INACTIVE");
  const matchingCustomers = customerSearch.trim()
    ? activeCustomers
        .filter((member) =>
          `${member.full_name || ""} ${member.phone || ""}`
            .toLowerCase()
            .includes(customerSearch.trim().toLowerCase()),
        )
        .slice(0, 50)
    : [];
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
  const scheduledTotal = schedule.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );
  const balanceRemaining = Math.max(final - scheduledTotal, 0);
  const amountOverScheduled = Math.max(scheduledTotal - final, 0);
  const scheduleBalanced =
    Math.round(scheduledTotal * 100) === Math.round(final * 100);
  const lastScheduleItem = schedule.at(-1);
  const lastInstallmentBalance = Math.max(
    final - (scheduledTotal - Number(lastScheduleItem?.amount || 0)),
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
    setCustomerSearch("");
    setCustomerSearchOpen(false);
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
  const addInstallment = () => {
    setSchedule((items) => {
      const total = items.reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0,
      );
      const remaining = Math.max(final - total, 0);
      return [
        ...items,
        {
          name: `Installment ${items.length + 1}`,
          amount: remaining ? String(remaining) : "",
          due_date: items.at(-1)?.due_date || today(),
        },
      ];
    });
  };
  const applyBalanceToLastInstallment = () => {
    setSchedule((items) =>
      items.map((item, index) =>
        index === items.length - 1
          ? { ...item, amount: String(lastInstallmentBalance) }
          : item,
      ),
    );
  };
  const submit = async () => {
    if (!row?.plot_id || !form.primary_allottee_id)
      return toast.error("Select a primary customer");
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
    "Customer",
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
              <Field label="Primary customer">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    value={customerSearch}
                    onFocus={() => setCustomerSearchOpen(true)}
                    onChange={(event) => {
                      setCustomerSearch(event.target.value);
                      setCustomerSearchOpen(true);
                      if (form.primary_allottee_id)
                        set("primary_allottee_id", "");
                    }}
                    placeholder="Search by customer name or phone number"
                    className="pl-9"
                    aria-autocomplete="list"
                    aria-expanded={customerSearchOpen}
                  />
                </div>
                {customerSearchOpen && customerSearch.trim() && (
                  <div
                    role="listbox"
                    className="mt-2 max-h-52 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white"
                  >
                    {matchingCustomers.length ? (
                      matchingCustomers.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          role="option"
                          aria-selected={
                            String(member.id) ===
                            String(form.primary_allottee_id)
                          }
                          onClick={() => {
                            set("primary_allottee_id", String(member.id));
                            set(
                              "joint_allottee_ids",
                              form.joint_allottee_ids.filter(
                                (id) => String(id) !== String(member.id),
                              ),
                            );
                            setCustomerSearch(member.full_name || "");
                            setCustomerSearchOpen(false);
                          }}
                          className="flex w-full items-center justify-between gap-4 px-3 py-2.5 text-left hover:bg-blue-50"
                        >
                          <span className="font-medium text-slate-800">
                            {member.full_name}
                          </span>
                          <span className="shrink-0 text-xs text-slate-500">
                            {member.phone || "No phone number"}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-3 text-sm text-slate-500">
                        No customer found for “{customerSearch.trim()}”.
                      </p>
                    )}
                  </div>
                )}
              </Field>
              <div>
                <Label className="text-xs font-medium text-slate-600">
                  Additional customers
                </Label>
                <div className="mt-2 max-h-44 divide-y divide-slate-100 overflow-y-auto border-y border-slate-200">
                  {activeCustomers
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
                  Existing customer and KYC records are reused; no duplicate
                  customer record is created.
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
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Payment plan
                  </p>
                  <p className="text-xs text-slate-500">
                    Split the sale value into dated instalments. Receipts remain
                    in Plot Payments.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={addInstallment}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add instalment
                </Button>
              </div>
              <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                New instalments are prefilled with the current remaining
                balance. You can adjust each amount before confirming.
              </p>
              {schedule.map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_150px_145px_32px] items-end gap-2 border-b border-slate-100 pb-3"
                >
                  <Field label={index === 0 ? "Instalment" : ""}>
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
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                        ₹
                      </span>
                      <Input
                        type="number"
                        min="0"
                        value={item.amount}
                        className="pl-7"
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
                    </div>
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
                    aria-label={`Remove ${item.name || "instalment"}`}
                  >
                    ×
                  </Button>
                </div>
              ))}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    ["Sale value", money(final), "text-slate-900"],
                    ["Scheduled", money(scheduledTotal), "text-slate-900"],
                    [
                      amountOverScheduled
                        ? "Over scheduled"
                        : "Remaining",
                      money(amountOverScheduled || balanceRemaining),
                      amountOverScheduled
                        ? "text-rose-700"
                        : balanceRemaining
                          ? "text-amber-700"
                          : "text-emerald-700",
                    ],
                  ].map(([label, value, valueClass]) => (
                    <div key={label}>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                        {label}
                      </p>
                      <p
                        className={cn(
                          "mt-1 text-sm font-semibold tabular-nums",
                          valueClass,
                        )}
                      >
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      amountOverScheduled
                        ? "bg-rose-500"
                        : scheduleBalanced
                          ? "bg-emerald-500"
                          : "bg-blue-500",
                    )}
                    style={{
                      width: `${Math.min(
                        final ? (scheduledTotal / final) * 100 : 0,
                        100,
                      )}%`,
                    }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p
                    className={cn(
                      "text-xs font-medium",
                      scheduleBalanced
                        ? "text-emerald-700"
                        : amountOverScheduled
                          ? "text-rose-700"
                          : "text-amber-700",
                    )}
                  >
                    {scheduleBalanced
                      ? "Payment plan is fully scheduled"
                      : amountOverScheduled
                        ? "The plan is higher than the sale value"
                        : `${money(balanceRemaining)} still needs to be scheduled`}
                  </p>
                  {!scheduleBalanced &&
                    !amountOverScheduled &&
                    schedule.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={applyBalanceToLastInstallment}
                        className="shrink-0"
                      >
                        Fill last: {money(lastInstallmentBalance)}
                      </Button>
                    )}
                </div>
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
                    )?.full_name || "No customer selected"}
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
              disabled={
                (step === 1 && !form.primary_allottee_id) ||
                (step === 3 && !scheduleBalanced)
              }
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

function PaymentPanel({ row, detail, onBack, onSaved, onOpenAgreement }) {
  const sitePolicy = useContext(SitePolicyContext);
  const financePaymentPolicy = getFinancePaymentPolicy(sitePolicy);
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
    if (!financePaymentPolicy.bankOnly) return;
    setForm((current) => current.payment_type === "CASH"
      ? { ...current, payment_type: "BANK", bank_account_id: "" }
      : current);
  }, [financePaymentPolicy.bankOnly]);
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
    if (financePaymentPolicy.bankOnly && form.payment_type === "CASH") {
      return toast.error("Cash is disabled by this Site finance profile");
    }
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
                {financePaymentPolicy.paymentTypes.map((value) => (
                  <SelectItem key={value} value={value}>
                    {readable(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {financePaymentPolicy.bankOnly && (
              <p className="mt-1.5 text-[11px] text-blue-700">Bank-only profile active · Cash is hidden for new receipts.</p>
            )}
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
            {decision.code === "RERA_PRE_AGREEMENT_COLLECTION_LIMIT" && onOpenAgreement && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 h-7 border-red-200 bg-white px-2.5 text-[11px] text-red-700 hover:bg-red-50"
                onClick={onOpenAgreement}
              >
                Open agreement registration
                <ArrowRight className="ml-1.5 h-3 w-3" />
              </Button>
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

function AgreementRegistrationSheet({ open, onOpenChange, agreement, onSaved }) {
  const [form, setForm] = useState({
    execution_date: today(),
    registration_status: "REGISTERED",
    registration_number: "",
    registration_date: today(),
    registration_office: "",
    review_notes: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !agreement) return;
    setForm({
      execution_date: String(agreement.execution_date || today()).slice(0, 10),
      registration_status: agreement.registration_status === "PENDING" ? "PENDING" : "REGISTERED",
      registration_number: agreement.registration_number || "",
      registration_date: agreement.registration_date
        ? String(agreement.registration_date).slice(0, 10)
        : agreement.registration_status === "REGISTERED"
          ? today()
          : "",
      registration_office: agreement.registration_office || "",
      review_notes: "",
    });
  }, [agreement, open]);

  const submit = async () => {
    if (!agreement?.id || !form.execution_date) return toast.error("Agreement execution date is required.");
    if (form.registration_status === "REGISTERED" && (!form.registration_number.trim() || !form.registration_date || !form.registration_office.trim())) {
      return toast.error("Registration number, date and Sub-Registrar office are required.");
    }
    if (form.registration_date && form.execution_date && form.registration_date < form.execution_date) {
      return toast.error("Registration date cannot be earlier than the agreement execution date.");
    }
    setBusy(true);
    try {
      await api.patch(`/property-lifecycle/agreements/${agreement.id}/status`, {
        status: "EXECUTED",
        execution_date: form.execution_date,
        registration_status: form.registration_status,
        registration_number: form.registration_number.trim() || null,
        registration_date: form.registration_date || null,
        registration_office: form.registration_office.trim() || null,
        review_notes: form.review_notes.trim() || "Agreement registration recorded from Customer & Inventory.",
      });
      toast.success(form.registration_status === "REGISTERED" ? "Agreement registration recorded." : "Agreement registration marked pending.");
      onOpenChange(false);
      await onSaved();
    } catch (error) {
      toast.error(error.response?.data?.message || "Agreement registration could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-[560px]">
        <SheetHeader className="border-b border-slate-200 px-6 py-5">
          <SheetTitle>Record agreement registration</SheetTitle>
          <SheetDescription>Execution and Sub-Registrar registration are separate controls. A complete registered agreement unlocks the RERA pre-agreement collection limit.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <Field label="Execution date *"><Input type="date" value={form.execution_date} onChange={(event) => setForm((current) => ({ ...current, execution_date: event.target.value }))} /></Field>
          <Field label="Registration status *">
            <Select value={form.registration_status} onValueChange={(value) => setForm((current) => ({
              ...current,
              registration_status: value,
              registration_date: value === "REGISTERED" ? (current.registration_date || today()) : "",
            }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Pending at Sub-Registrar</SelectItem>
                <SelectItem value="REGISTERED">Registered</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={form.registration_status === "REGISTERED" ? "Registration number *" : "Registration number"}><Input value={form.registration_number} onChange={(event) => setForm((current) => ({ ...current, registration_number: event.target.value.toUpperCase() }))} /></Field>
            <Field label={form.registration_status === "REGISTERED" ? "Registration date *" : "Registration date"}><Input type="date" value={form.registration_date} min={form.execution_date || undefined} onChange={(event) => setForm((current) => ({ ...current, registration_date: event.target.value }))} /></Field>
          </div>
          <Field label={form.registration_status === "REGISTERED" ? "Registration office *" : "Registration office"}><Input value={form.registration_office} onChange={(event) => setForm((current) => ({ ...current, registration_office: event.target.value.toUpperCase() }))} placeholder="Sub-Registrar office" /></Field>
          <Field label="Audit note"><Textarea rows={3} value={form.review_notes} onChange={(event) => setForm((current) => ({ ...current, review_notes: event.target.value }))} placeholder="Verification reference or internal note" /></Field>
        </div>
        <SheetFooter className="border-t border-slate-200 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save registration"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
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
  const sitePolicy = useContext(SitePolicyContext);
  const financePaymentPolicy = getFinancePaymentPolicy(sitePolicy);
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
  const prepareAndPostRefund = () => {
    if (financePaymentPolicy.bankOnly && form.payment_mode === "CASH") {
      return toast.error("Cash is disabled by this Site finance profile");
    }
    return act(
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
  };
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
      `Customer transfer review opened for Plot ${row.plot_no}.`,
    );
  const executeTransfer = () =>
    act(
      "execute",
      () =>
        api.post(`/property-lifecycle/transfers/${transfer.id}/execute`, {
          effective_date: form.effective_date,
        }),
      `Customer transfer for Plot ${row.plot_no} is effective.`,
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
            : "Transfer customer"}
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
                          {financePaymentPolicy.paymentTypes.map((value) => (
                            <SelectItem key={value} value={value}>
                              {readable(value)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {financePaymentPolicy.bankOnly && (
                        <p className="mt-1.5 text-[11px] text-blue-700">Bank-only profile active · Cash refunds are disabled.</p>
                      )}
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
                booking. The previous customer is retained as former.
              </p>
            </div>
            <Field label="New primary customer">
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

const isPostedReceipt = (payment) =>
  String(payment?.status || "approved").toLowerCase() === "approved" &&
  !["BOUNCED", "RETURNED"].includes(
    String(payment?.cheque_status || "").toUpperCase(),
  );

const isCashReceipt = (payment) =>
  [payment?.payment_type, payment?.payment_from]
    .filter(Boolean)
    .some((value) => String(value).toUpperCase() === "CASH");

function PaymentWorkspace({ row, detail }) {
  const transactions = useMemo(() => {
    const items = [
      ...(detail?.payments || [])
        .filter(isPostedReceipt)
        .map((payment) => ({
          ...payment,
          key: `payment-${payment.id}`,
          kind: "receipt",
          signedAmount: Number(payment.amount || 0),
          occurredAt: payment.date || payment.created_at,
        })),
      ...(detail?.refunds || [])
        .filter((refund) => String(refund.status).toUpperCase() === "POSTED")
        .map((refund) => ({
          ...refund,
          key: `refund-${refund.id}`,
          kind: "refund",
          signedAmount: -Number(refund.amount || 0),
          occurredAt: refund.posted_at || refund.created_at,
        })),
    ].sort(
      (a, b) =>
        new Date(a.occurredAt || 0).getTime() -
          new Date(b.occurredAt || 0).getTime() ||
        Number(a.id || 0) - Number(b.id || 0),
    );
    return items.map((item, index) => ({
      ...item,
      cumulative: items
        .slice(0, index + 1)
        .reduce((sum, entry) => sum + entry.signedAmount, 0),
    }));
  }, [detail?.payments, detail?.refunds]);

  const saleValue = Number(row?.final_consideration || row?.sale_price || 0);
  const bankTarget = Number(row?.to_receive_bank || 0);
  const cashTarget = Math.max(saleValue - bankTarget, 0);
  const receiptTotals = useMemo(
    () =>
      (detail?.payments || [])
        .filter(isPostedReceipt)
        .reduce(
          (totals, payment) => ({
            bank:
              totals.bank +
              (isCashReceipt(payment) ? 0 : Number(payment.amount || 0)),
            cash:
              totals.cash +
              (isCashReceipt(payment) ? Number(payment.amount || 0) : 0),
          }),
          { bank: 0, cash: 0 },
        ),
    [detail?.payments],
  );
  const bankReceived = receiptTotals.bank;
  const cashReceived = receiptTotals.cash;
  const refunds = (detail?.refunds || [])
    .filter((refund) => String(refund.status).toUpperCase() === "POSTED")
    .reduce((sum, refund) => sum + Number(refund.amount || 0), 0);
  const netReceived = Math.max(bankReceived + cashReceived - refunds, 0);
  const outstanding = Math.max(saleValue - netReceived, 0);
  const collectionPercent = saleValue
    ? Math.min((netReceived / saleValue) * 100, 100)
    : 0;

  return (
    <div className="space-y-6">
      <section>
        <Heading
          title="Collection position"
          description="The same cumulative money view used in Plot Payments, scoped to this plot."
        />
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 text-white">
          <div className="grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-4">
            {[
              ["Sale value", money(saleValue), "text-white"],
              ["Net received", money(netReceived), "text-emerald-300"],
              ["Refunded", money(refunds), "text-rose-300"],
              ["Outstanding", money(outstanding), outstanding ? "text-amber-200" : "text-emerald-300"],
            ].map(([label, value, valueClass]) => (
              <div key={label} className="bg-slate-950 px-4 py-3.5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/45">
                  {label}
                </p>
                <p className={cn("mt-1 text-base font-semibold tabular-nums", valueClass)}>
                  {value}
                </p>
              </div>
            ))}
          </div>
          <div className="grid gap-px border-t border-white/10 bg-white/10 sm:grid-cols-2">
            {[
              ["Bank collection", bankTarget, bankReceived],
              ["Cash collection", cashTarget, cashReceived],
            ].map(([label, target, received]) => {
              const due = Math.max(Number(target) - Number(received), 0);
              return (
                <div key={label} className="bg-slate-950 px-4 py-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/55">
                    {label}
                  </p>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div><p className="text-white/40">Target</p><p className="mt-0.5 font-semibold tabular-nums">{money(target)}</p></div>
                    <div><p className="text-white/40">Collected</p><p className="mt-0.5 font-semibold tabular-nums text-emerald-300">{money(received)}</p></div>
                    <div><p className="text-white/40">Due</p><p className={cn("mt-0.5 font-semibold tabular-nums", due ? "text-amber-200" : "text-emerald-300")}>{money(due)}</p></div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t border-white/10 px-4 py-3">
            <div className="mb-1.5 flex items-center justify-between text-[10px]">
              <span className="text-white/50">Collection progress</span>
              <span className="font-semibold tabular-nums text-white">{collectionPercent.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${collectionPercent}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section>
        <Heading title="Payment schedule" description="Demand milestones and their allocation status." />
        {detail?.schedule?.length ? (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            {detail.schedule.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_auto] gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0">
                <div>
                  <p className="text-sm font-medium text-slate-800">{item.installment_name}</p>
                  <p className="text-[11px] text-slate-500">Due {dateLabel(item.due_date)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums text-slate-900">{money(item.amount)}</p>
                  <p className={cn("text-[10px]", Number(item.due_amount) <= 0 ? "text-emerald-600" : "text-amber-600")}>
                    {Number(item.due_amount) <= 0 ? "Fully allocated" : `${money(item.due_amount)} due`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty title="No payment schedule" text="Create a payment plan from the booking workflow." />
        )}
      </section>

      <section>
        <Heading title="Cumulative ledger" description="Receipts and posted refunds in chronological order." />
        {transactions.length ? (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="grid grid-cols-[1fr_100px_110px] border-b border-slate-200 bg-slate-50 px-4 py-2 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
              <span>Transaction</span><span className="text-right">Amount</span><span className="text-right">Cumulative</span>
            </div>
            {transactions.map((transaction) => (
              <div key={transaction.key} className="grid grid-cols-[1fr_100px_110px] items-center border-b border-slate-100 px-4 py-3 last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-800">
                    {transaction.kind === "refund"
                      ? `Refund ${transaction.reference || transaction.id}`
                      : transaction.receipt_no || `Receipt ${transaction.id}`}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {dateLabel(transaction.occurredAt)} · {transaction.kind === "refund" ? readable(transaction.payment_mode) : readable(transaction.payment_type)}
                  </p>
                </div>
                <p className={cn("text-right text-xs font-semibold tabular-nums", transaction.signedAmount < 0 ? "text-rose-600" : "text-emerald-700")}>
                  {transaction.signedAmount < 0 ? "−" : "+"}{money(Math.abs(transaction.signedAmount))}
                </p>
                <p className="text-right text-xs font-semibold tabular-nums text-slate-900">{money(transaction.cumulative)}</p>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_100px_110px] items-center bg-slate-950 px-4 py-3 text-white">
              <div>
                <p className="text-xs font-semibold">Net cumulative</p>
                <p className="text-[10px] text-white/45">{transactions.length} posted transaction{transactions.length === 1 ? "" : "s"}</p>
              </div>
              <span />
              <p className="text-right text-sm font-semibold tabular-nums text-emerald-300">
                {money(transactions[transactions.length - 1].cumulative)}
              </p>
            </div>
          </div>
        ) : (
          <Empty title="No receipts yet" text="Record the first payment without leaving this sheet." />
        )}
      </section>
    </div>
  );
}

function RegistryStartPanel({ row, detail, canWrite, canDelete, isAdmin, isReraProfile, policy, onSaved }) {
  const registryFinancePolicy = getFinancePaymentPolicy(policy);
  const eligiblePayments = useMemo(() => {
    const payments = detail?.payments || [];
    const reversedPaymentIds = new Set(
      payments
        .filter(isPostedReceipt)
        .map((payment) => payment.reversal_of_payment_id)
        .filter(Boolean)
        .map(String),
    );
    return payments.filter(
        (payment) =>
          isPostedReceipt(payment) &&
          !payment.reversal_of_payment_id &&
          !payment.payment_is_reversal &&
          !payment.payment_was_reversed &&
          !reversedPaymentIds.has(String(payment.id)) &&
          (!registryFinancePolicy.bankOnly || !isCashReceipt(payment)) &&
          !payment.mapped_registry_payment_id &&
          (!isReraProfile || (
            Number(payment.rera_project_id) === Number(row?.rera_project_id) &&
            Number(payment.rera_project_phase_id || 0) === Number(row?.rera_project_phase_id || 0)
          )),
      );
  }, [detail?.payments, isReraProfile, registryFinancePolicy.bankOnly, row?.rera_project_id, row?.rera_project_phase_id]);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState(() => new Set());
  const [clearance, setClearance] = useState(null);
  const [autocomplete, setAutocomplete] = useState({
    farmerNames: [],
    clientNames: [],
    customerNames: [],
    firmNames: [],
  });
  const [approvers, setApprovers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    customer_name: "",
    size_sqyard: "",
    size_meter: "",
    circle_rate: "",
    registry_date: today(),
    created_entry_date: today(),
    bank_amount: "",
    registry_payment: "",
    farmer_name: "",
    seller_name: "",
    firm_name: "",
    deed_number: "",
    registration_number: "",
    sub_registrar_office: "",
    registrar_district: "",
    deed_execution_date: "",
    registration_date: "",
    stamp_duty_amount: "",
    registration_fee_amount: "",
    assigned_admin_id: "",
    notes: "",
  });

  useEffect(() => {
    const ids = new Set(eligiblePayments.map((payment) => String(payment.id)));
    const total = eligiblePayments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0,
    );
    const numberInput = (value, decimals = 2) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed === 0) return "";
      return String(Number(parsed.toFixed(decimals)));
    };
    const sizeSqyard = Number(row?.plot_size || 0);
    setSelectedPaymentIds(ids);
    setForm({
      customer_name: row?.customer_name || "",
      size_sqyard: numberInput(sizeSqyard),
      size_meter: numberInput(
        row?.plot_size_mtr || (sizeSqyard ? sizeSqyard * 0.8364 : 0),
      ),
      circle_rate: numberInput(row?.circle_rate),
      registry_date: today(),
      created_entry_date: today(),
      bank_amount: numberInput(row?.to_receive_bank),
      registry_payment: numberInput(total),
      farmer_name: row?.farmer_name || "",
      seller_name: row?.seller_name || "",
      firm_name: row?.firm_name || "",
      deed_number: "",
      registration_number: "",
      sub_registrar_office: "",
      registrar_district: "",
      deed_execution_date: "",
      registration_date: "",
      stamp_duty_amount: "",
      registration_fee_amount: "",
      assigned_admin_id: "",
      notes: "",
    });
  }, [
    row?.circle_rate,
    row?.customer_name,
    row?.farmer_name,
    row?.firm_name,
    row?.plot_id,
    row?.plot_size,
    row?.plot_size_mtr,
    row?.seller_name,
    row?.to_receive_bank,
    eligiblePayments,
  ]);

  useEffect(() => {
    if (!row?.plot_id) return;
    let active = true;
    Promise.allSettled([
      api.get("/registries/plot-clearance", {
        params: { plot_id: row.plot_id },
      }),
      api.get("/registries/autocomplete", {
        params: { site_id: row.site_id },
      }),
      api.get("/admin/approvers", { params: { site_id: row.site_id } }),
    ]).then(([clearanceResult, autocompleteResult, approversResult]) => {
      if (!active) return;
      setClearance(
        clearanceResult.status === "fulfilled"
          ? clearanceResult.value.data.clearance || null
          : null,
      );
      if (autocompleteResult.status === "fulfilled") {
        setAutocomplete((current) => ({
          ...current,
          ...autocompleteResult.value.data,
        }));
      }
      setApprovers(
        approversResult.status === "fulfilled"
          ? approversResult.value.data.approvers || []
          : [],
      );
    });
    return () => {
      active = false;
    };
  }, [row?.plot_id, row?.site_id]);

  const updateForm = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const updateArea = (value) => {
    const area = Number(value || 0);
    setForm((current) => ({
      ...current,
      size_sqyard: value,
      size_meter: area > 0 ? String(Number((area * 0.8364).toFixed(2))) : "",
    }));
  };

  const selectedPayments = eligiblePayments.filter((payment) =>
    selectedPaymentIds.has(String(payment.id)),
  );
  const mappedTotal = selectedPayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );
  const registryAmount = isReraProfile ? mappedTotal : Number(form.registry_payment || 0);
  const reraRequiresPhase = String(policy?.profile?.project_structure || '').toUpperCase() === 'PHASE_WISE';
  const reraContextReady = Boolean(row?.rera_project_id && (!reraRequiresPhase || row?.rera_project_phase_id) && row?.agreement_id);
  // RERA registries use the staged readiness workflow enforced by the registry
  // API. The legacy bank-clear/edit-request gate applies only to generic Sites.
  const needsApproval = Boolean(
    !isReraProfile && clearance && !clearance.clear && !isAdmin,
  );
  const paymentDifference = registryAmount - mappedTotal;
  const missingRegistrationMetadata = isReraProfile
    ? [
        ["Deed number", form.deed_number],
        ["Registration number", form.registration_number],
        ["Sub-Registrar office", form.sub_registrar_office],
        ["Deed execution date", form.deed_execution_date],
        ["Registration date", form.registration_date],
      ].filter(([, value]) => !String(value || "").trim()).map(([label]) => label)
    : [];
  const allPaymentsSelected =
    eligiblePayments.length > 0 &&
    selectedPaymentIds.size === eligiblePayments.length;

  const createRegistry = async () => {
    if (!canWrite) return;
    if (isReraProfile && !reraContextReady) {
      return toast.error(`Map this booking to a RERA project${reraRequiresPhase ? " and phase" : ""}, then prepare its agreement before starting registry.`);
    }
    if (!selectedPayments.length)
      return toast.error("Select at least one receipt to map to the registry");
    if (!registryAmount)
      return toast.error("Enter the registry payment amount");
    if (form.deed_execution_date && form.registration_date && form.registration_date < form.deed_execution_date) {
      return toast.error("Registration date cannot be earlier than the deed execution date.");
    }
    setSubmitting(true);
    const payload = {
      site_id: row.site_id,
      plot_id: row.plot_id,
      plot_no: row.plot_no,
      customer_name: form.customer_name,
      size_sqyard: form.size_sqyard,
      size_meter: form.size_meter,
      circle_rate: form.circle_rate,
      registry_date: form.registry_date,
      created_entry_date: form.created_entry_date,
      farmer_name: form.farmer_name,
      seller_name: form.seller_name,
      firm_name: form.firm_name,
      deed_number: form.deed_number,
      registration_number: form.registration_number,
      sub_registrar_office: form.sub_registrar_office,
      registrar_district: form.registrar_district,
      deed_execution_date: form.deed_execution_date || null,
      registration_date: form.registration_date || null,
      stamp_duty_amount: form.stamp_duty_amount || null,
      registration_fee_amount: form.registration_fee_amount || null,
      bank_amount: isReraProfile ? null : form.bank_amount,
      registry_payment: Number(registryAmount.toFixed(2)),
      notes: form.notes.trim(),
      assigned_admin_id: form.assigned_admin_id || null,
      payments: selectedPayments.map((payment) => ({
        source_plot_payment_id: payment.id,
      })),
    };
    try {
      if (needsApproval) {
        await api.post("/edit-requests", {
          module: "plot_registry_create",
          record_id: row.plot_id,
          site_id: row.site_id,
          proposed_data: JSON.stringify(payload),
        });
        toast.success("Registry sent for admin approval");
      } else {
        await api.post("/registries", payload);
        toast.success(`Registry started for Plot ${row.plot_no}`);
        await onSaved();
      }
    } catch (error) {
      if (
          error.response?.data?.code === "PAYMENTS_NOT_CLEAR" &&
        !isAdmin
      ) {
        try {
          await api.post("/edit-requests", {
            module: "plot_registry_create",
            record_id: row.plot_id,
            site_id: row.site_id,
            proposed_data: JSON.stringify(payload),
          });
          toast.success("Registry sent for admin approval");
        } catch (approvalError) {
          toast.error(
            approvalError.response?.data?.message ||
              "Registry approval request could not be created",
          );
        }
      } else {
        toast.error(
          error.response?.data?.message || "Registry could not be created",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-2">
      {isReraProfile && (
        <div className="-mx-1 overflow-hidden rounded-lg">
          <ReraWorkflowNotice
            policy={policy}
            area="registry"
            actions={[{ label: "Project payments", href: "/plot-payments" }]}
          />
        </div>
      )}
      <header className="border-b border-slate-200 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-600">New registry</p>
            <h3 className="mt-1 truncate text-lg font-semibold text-slate-950">
              Plot {row.plot_no} · {form.customer_name || "Customer not set"}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Verify the prefilled details, choose the funding receipts, then create the registry.
            </p>
          </div>
          <StatusBadge value="DRAFT" />
        </div>
        <dl className="mt-5 grid grid-cols-3 divide-x divide-slate-200 border-y border-slate-200">
          {[
            ["Area", `${form.size_sqyard || "—"} sq yd`],
            ["Selected receipts", money(mappedTotal)],
            [isReraProfile ? "Canonical source" : "Bank target", isReraProfile ? `${selectedPayments.length} receipt${selectedPayments.length === 1 ? "" : "s"}` : money(form.bank_amount)],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0 px-3 py-3 first:pl-0 last:pr-0 sm:px-5">
              <dt className="text-[10px] font-medium text-slate-500">{label}</dt>
              <dd className="mt-1 truncate text-xs font-semibold tabular-nums text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
      </header>

      {clearance && (
        <div className={cn("flex items-start gap-3 border-l-2 px-4 py-3 text-xs", clearance.clear ? "border-emerald-500 bg-emerald-50/60 text-emerald-800" : "border-amber-500 bg-amber-50/60 text-amber-900")}>
          {clearance.clear ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{clearance.clear ? "Collection position verified" : "Collection remains in progress"}</p>
            <p className="mt-0.5 leading-5 opacity-80">
              {money(clearance.received_bank)} received of {money(clearance.to_receive_bank)}.
              {!clearance.clear && ` ${money(clearance.pending_bank)} remains.${needsApproval ? " Saving will submit this registry for admin approval." : isReraProfile ? " Registry preparation can start; each later transition remains controlled by live readiness checks." : " You can continue with an admin override."}`}
            </p>
          </div>
        </div>
      )}

      <section>
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">1</span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Property and valuation</p>
            <p className="text-[11px] text-slate-500">Verify the values copied from the booking.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Plot number">
            <Input value={row.plot_no || ""} readOnly className="bg-slate-50 font-semibold" />
          </Field>
          <Field label="Customer name">
            <Input value={form.customer_name} onChange={(event) => updateForm("customer_name", event.target.value.toUpperCase())} placeholder="Registered customer name" list={`registry-customers-${row.plot_id}`} />
            <datalist id={`registry-customers-${row.plot_id}`}>
              {(autocomplete.customerNames || []).map((name) => <option key={name} value={name} />)}
            </datalist>
          </Field>
          <Field label="Area (sq yd / gaz)">
            <div className="relative">
              <Ruler className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input type="number" min="0" step="0.01" className="pl-9" value={form.size_sqyard} onChange={(event) => updateArea(event.target.value)} />
            </div>
          </Field>
          <Field label="Area (m², auto-calculated)">
            <Input type="number" value={form.size_meter} readOnly className="bg-slate-50 text-slate-600" />
          </Field>
          <Field label="Circle rate">
            <Input type="number" min="0" step="0.01" value={form.circle_rate} onChange={(event) => updateForm("circle_rate", event.target.value)} />
          </Field>
          <Field label="Project context">
            <div className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
              <Building2 className="h-4 w-4 text-slate-400" />
              <span className="truncate">{row.project_name || row.phase_name || "Current site"}</span>
            </div>
          </Field>
        </div>
      </section>

      {isReraProfile && (
        <details className="group border-t border-slate-200 pt-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Deed & Sub-Registrar details</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Complete progressively; these become mandatory before registry execution.</p>
            </div>
            <span className={cn("shrink-0 text-[10px] font-semibold", missingRegistrationMetadata.length ? "text-amber-700" : "text-emerald-700")}>
              {missingRegistrationMetadata.length ? `${missingRegistrationMetadata.length} required item${missingRegistrationMetadata.length === 1 ? "" : "s"} missing` : "Execution metadata ready"}
            </span>
          </summary>
          <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <Field label="Deed number"><Input value={form.deed_number} onChange={(event) => updateForm("deed_number", event.target.value.toUpperCase())} /></Field>
            <Field label="Registration number"><Input value={form.registration_number} onChange={(event) => updateForm("registration_number", event.target.value.toUpperCase())} /></Field>
            <Field label="Deed execution date"><Input type="date" value={form.deed_execution_date} onChange={(event) => updateForm("deed_execution_date", event.target.value)} /></Field>
            <Field label="Registration date"><Input type="date" min={form.deed_execution_date || undefined} value={form.registration_date} onChange={(event) => updateForm("registration_date", event.target.value)} /></Field>
            <Field label="Sub-Registrar office"><Input value={form.sub_registrar_office} onChange={(event) => updateForm("sub_registrar_office", event.target.value.toUpperCase())} /></Field>
            <Field label="Registrar district"><Input value={form.registrar_district} onChange={(event) => updateForm("registrar_district", event.target.value.toUpperCase())} /></Field>
            <Field label="Stamp duty amount"><Input type="number" min="0" step="0.01" value={form.stamp_duty_amount} onChange={(event) => updateForm("stamp_duty_amount", event.target.value)} /></Field>
            <Field label="Registration fee amount"><Input type="number" min="0" step="0.01" value={form.registration_fee_amount} onChange={(event) => updateForm("registration_fee_amount", event.target.value)} /></Field>
          </div>
          {missingRegistrationMetadata.length > 0 && (
            <p className="mt-3 text-[10px] leading-4 text-amber-700">Still needed for execution: {missingRegistrationMetadata.join(", ")}.</p>
          )}
        </details>
      )}

      <section className="border-t border-slate-200 pt-5">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">2</span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Registry particulars</p>
            <p className="text-[11px] text-slate-500">Dates, executing parties and internal ownership.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Registry date *">
            <Input type="date" value={form.registry_date} onChange={(event) => updateForm("registry_date", event.target.value)} />
          </Field>
          <Field label="Entry date *">
            <Input type="date" value={form.created_entry_date} onChange={(event) => updateForm("created_entry_date", event.target.value)} />
          </Field>
          <Field label="Farmer / landowner">
            <Input value={form.farmer_name} onChange={(event) => updateForm("farmer_name", event.target.value.toUpperCase())} placeholder="Name as per land record" list={`registry-farmers-${row.plot_id}`} />
            <datalist id={`registry-farmers-${row.plot_id}`}>
              {(autocomplete.farmerNames || []).map((name) => <option key={name} value={name} />)}
            </datalist>
          </Field>
          <Field label="Seller / executing party">
            <Input value={form.seller_name} onChange={(event) => updateForm("seller_name", event.target.value.toUpperCase())} placeholder="Seller name" list={`registry-sellers-${row.plot_id}`} />
            <datalist id={`registry-sellers-${row.plot_id}`}>
              {(autocomplete.clientNames || []).map((name) => <option key={name} value={name} />)}
            </datalist>
          </Field>
          <Field label="Firm / developer">
            <Input value={form.firm_name} onChange={(event) => updateForm("firm_name", event.target.value.toUpperCase())} placeholder="Firm name" list={`registry-firms-${row.plot_id}`} />
            <datalist id={`registry-firms-${row.plot_id}`}>
              {(autocomplete.firmNames || []).map((name) => <option key={name} value={name} />)}
            </datalist>
          </Field>
          <Field label="Assigned approver">
            <Select value={form.assigned_admin_id || "__auto"} onValueChange={(value) => updateForm("assigned_admin_id", value === "__auto" ? "" : value)}>
              <SelectTrigger><SelectValue placeholder="Auto-assign" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__auto">Auto-assign / none</SelectItem>
                {approvers.map((approver) => (
                  <SelectItem key={approver.id} value={String(approver.id)}>
                    {approver.full_name || approver.name || approver.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </section>

      <section className="border-t border-slate-200 pt-5">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">3</span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Payment and receipts</p>
            <p className="text-[11px] text-slate-500">Confirm the registry amount and the receipts funding it.</p>
          </div>
        </div>
        {isReraProfile ? (
          <div className="mt-4 flex items-center justify-between border-y border-blue-100 bg-blue-50/40 px-3 py-3">
            <div>
              <p className="text-xs font-semibold text-slate-800">Canonical receipt total</p>
              <p className="mt-0.5 text-[10px] text-slate-500">Derived automatically from the selected Project Payment receipts.</p>
            </div>
            <p className="text-sm font-semibold tabular-nums text-blue-700">{money(mappedTotal)}</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Bank amount">
              <div className="relative">
                <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input type="number" min="0" step="0.01" className="pl-9" value={form.bank_amount} onChange={(event) => updateForm("bank_amount", event.target.value)} />
              </div>
            </Field>
            <Field label="Registry payment *">
              <div className="relative">
                <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input type="number" min="0" step="0.01" className="pl-9" value={form.registry_payment} onChange={(event) => updateForm("registry_payment", event.target.value)} />
              </div>
            </Field>
          </div>
        )}

        <div className="mt-4 border-t border-slate-100 pt-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={allPaymentsSelected ? true : selectedPaymentIds.size ? "indeterminate" : false}
              onCheckedChange={(checked) => setSelectedPaymentIds(checked ? new Set(eligiblePayments.map((payment) => String(payment.id))) : new Set())}
            />
            <span>
              <span className="block text-xs font-semibold text-slate-800">Approved plot receipts</span>
              <span className="block text-[10px] text-slate-500">Select the receipts funding this registry.</span>
            </span>
          </label>
          <span className="text-xs font-semibold tabular-nums text-blue-700">{money(mappedTotal)} selected</span>
        </div>
        {eligiblePayments.length ? (
          <div className="max-h-52 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
            {eligiblePayments.map((payment) => {
              const checked = selectedPaymentIds.has(String(payment.id));
              return (
                <label key={payment.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(next) =>
                      setSelectedPaymentIds((current) => {
                        const updated = new Set(current);
                        if (next) updated.add(String(payment.id));
                        else updated.delete(String(payment.id));
                        return updated;
                      })
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-800">{payment.receipt_no || `Receipt ${payment.id}`}</p>
                    <p className="text-[10px] text-slate-500">{dateLabel(payment.date)} · {readable(payment.payment_type)}</p>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-slate-900">{money(payment.amount)}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center">
            <p className="text-xs font-medium text-slate-700">No approved, unlinked receipt is available</p>
            <p className="mt-1 text-[11px] text-slate-500">Record or approve a receipt from the Payments tab first.</p>
          </div>
        )}

      {!isReraProfile && registryAmount > 0 && (
        <div className={cn("mt-3 flex items-center justify-between rounded-xl border px-3 py-2.5 text-xs", Math.abs(paymentDifference) < 0.01 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800")}>
          <span className="flex items-center gap-2">
            {Math.abs(paymentDifference) < 0.01 ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {Math.abs(paymentDifference) < 0.01
              ? "Receipts match the registry payment"
              : paymentDifference > 0
                ? "Registry amount not covered by selected receipts"
                : "Selected receipts exceed the registry amount"}
          </span>
          <strong className="tabular-nums">{money(Math.abs(paymentDifference))}</strong>
        </div>
      )}
        </div>
      </section>

      <section className="border-t border-slate-200 pt-5">
        <div className="flex items-center gap-3">
          <UserRound className="h-4 w-4 text-slate-600" />
          <div>
            <p className="text-xs font-semibold text-slate-900">Internal notes</p>
            <p className="text-[11px] text-slate-500">Optional deed references, appointment details or exceptions.</p>
          </div>
        </div>
        <div className="mt-3">
          <Textarea className="min-h-24 resize-y" value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} placeholder="Optional registry notes…" />
        </div>
      </section>

      <section className="border-t border-slate-200 pt-5">
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <FolderUp className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-900">Registry photos & PDFs</p>
            <p className="text-[10px] leading-4 text-slate-500">Upload appointment slips, photos, scans, or supporting PDFs now. The executed deed remains controlled by the NOC workflow.</p>
          </div>
        </div>
        <RegistryDocuments
          plotId={row.plot_id}
          plotNo={row.plot_no}
          canWrite={canWrite}
          canDelete={canDelete}
          registryDeedAllowed={false}
          defaultCategory="REGISTRY_SUPPORT"
          embedded
        />
      </section>

      <div className="flex justify-end border-t border-slate-200 pt-5">
        <Button className="shrink-0" onClick={createRegistry} disabled={!canWrite || submitting || !selectedPayments.length || !registryAmount || !form.registry_date || !form.created_entry_date || (isReraProfile && !reraContextReady)}>
          {submitting ? "Saving registry…" : needsApproval ? "Submit for approval" : "Start registry"}
          {!submitting && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function RegistryDetailsPanel({ registry, canonicalReceiptTotal, canUpdate, isReraProfile, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approvers, setApprovers] = useState([]);
  const [form, setForm] = useState({});

  const resetForm = useCallback(() => {
    const dateValue = (value) => value ? String(value).slice(0, 10) : "";
    setForm({
      customer_name: registry.customer_name || "",
      size_sqyard: registry.size_sqyard ?? "",
      size_meter: registry.size_meter ?? "",
      circle_rate: registry.circle_rate ?? "",
      registry_date: dateValue(registry.registry_date),
      created_entry_date: dateValue(registry.created_entry_date || registry.created_at),
      farmer_name: registry.farmer_name || "",
      seller_name: registry.seller_name || "",
      firm_name: registry.firm_name || "",
      bank_amount: registry.bank_amount ?? "",
      registry_payment: registry.registry_payment ?? "",
      deed_number: registry.deed_number || "",
      registration_number: registry.registration_number || "",
      sub_registrar_office: registry.sub_registrar_office || "",
      registrar_district: registry.registrar_district || "",
      deed_execution_date: dateValue(registry.deed_execution_date),
      registration_date: dateValue(registry.registration_date),
      stamp_duty_amount: registry.stamp_duty_amount ?? "",
      registration_fee_amount: registry.registration_fee_amount ?? "",
      assigned_admin_id: registry.assigned_admin_id ? String(registry.assigned_admin_id) : "",
      notes: registry.notes || "",
    });
  }, [registry]);

  useEffect(() => {
    resetForm();
    setEditing(false);
  }, [resetForm]);

  useEffect(() => {
    if (!registry.site_id) return;
    let active = true;
    api.get("/admin/approvers", { params: { site_id: registry.site_id } })
      .then(({ data }) => active && setApprovers(data.approvers || []))
      .catch(() => active && setApprovers([]));
    return () => { active = false; };
  }, [registry.site_id]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateArea = (value) => {
    const area = Number(value || 0);
    setForm((current) => ({
      ...current,
      size_sqyard: value,
      size_meter: area > 0 ? String(Number((area * 0.8364).toFixed(2))) : "",
    }));
  };
  const save = async () => {
    if (!form.registry_date || (!isReraProfile && !Number(form.registry_payment || 0))) {
      return toast.error(isReraProfile ? "Registry date is required" : "Registry date and registry payment are required");
    }
    if (form.deed_execution_date && form.registration_date && form.registration_date < form.deed_execution_date) {
      return toast.error("Registration date cannot be earlier than the deed execution date.");
    }
    setSaving(true);
    try {
      const editableForm = { ...form };
      if (isReraProfile) {
        delete editableForm.registry_payment;
        delete editableForm.bank_amount;
      }
      await api.put(`/registries/${registry.id}`, {
        plot_id: registry.plot_id,
        plot_no: registry.plot_no,
        ...editableForm,
        ...(!isReraProfile ? { registry_payment: Number(Number(form.registry_payment).toFixed(2)) } : {}),
        assigned_admin_id: form.assigned_admin_id || null,
      });
      toast.success("Registry details updated");
      setEditing(false);
      await onSaved();
    } catch (error) {
      toast.error(error.response?.data?.message || "Registry details could not be updated");
    } finally {
      setSaving(false);
    }
  };

  const approverName = approvers.find(
    (approver) => String(approver.id) === String(registry.assigned_admin_id),
  );
  const details = [
    ["Customer", registry.customer_name || "—"],
    ["Registry date", dateLabel(registry.registry_date)],
    ["Entry date", dateLabel(registry.created_entry_date || registry.created_at)],
    ["Area", `${registry.size_sqyard || "—"} sq yd · ${registry.size_meter || "—"} m²`],
    ["Circle rate", registry.circle_rate != null ? money(registry.circle_rate) : "—"],
    ...(isReraProfile
      ? [["Canonical receipt total", money(canonicalReceiptTotal)]]
      : [
          ["Bank amount", registry.bank_amount != null ? money(registry.bank_amount) : "—"],
          ["Registry payment", money(registry.registry_payment)],
        ]),
    ["Farmer / landowner", registry.farmer_name || "—"],
    ["Seller", registry.seller_name || "—"],
    ["Firm / developer", registry.firm_name || "—"],
    ["Assigned approver", approverName?.full_name || approverName?.name || approverName?.email || "Auto-assign / none"],
  ];
  const registrationMetadataSource = editing ? form : registry;
  const missingRegistrationMetadata = isReraProfile
    ? [
        ["Deed number", registrationMetadataSource.deed_number],
        ["Registration number", registrationMetadataSource.registration_number],
        ["Sub-Registrar office", registrationMetadataSource.sub_registrar_office],
        ["Deed execution date", registrationMetadataSource.deed_execution_date],
        ["Registration date", registrationMetadataSource.registration_date],
      ].filter(([, value]) => !String(value || "").trim()).map(([label]) => label)
    : [];
  const registrationDetails = [
    ["Deed number", registry.deed_number || "—"],
    ["Registration number", registry.registration_number || "—"],
    ["Deed execution", dateLabel(registry.deed_execution_date)],
    ["Registration date", dateLabel(registry.registration_date)],
    ["Sub-Registrar office", registry.sub_registrar_office || "—"],
    ["Registrar district", registry.registrar_district || "—"],
    ["Stamp duty", registry.stamp_duty_amount != null ? money(registry.stamp_duty_amount) : "—"],
    ["Registration fee", registry.registration_fee_amount != null ? money(registry.registration_fee_amount) : "—"],
  ];

  return (
    <section className="border-y border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Registry details</p>
            <p className="text-[11px] text-slate-500">Deed, parties, valuation and assignment information.</p>
          </div>
        </div>
        {canUpdate && !editing && (
          <Button variant="ghost" size="sm" className="text-blue-700 hover:bg-blue-50 hover:text-blue-800" onClick={() => setEditing(true)}>
            Edit details
          </Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-4 border-t border-slate-200 bg-slate-50/60 px-4 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer name"><Input value={form.customer_name || ""} onChange={(event) => update("customer_name", event.target.value.toUpperCase())} /></Field>
            <Field label="Area (sq yd / gaz)"><Input type="number" min="0" step="0.01" value={form.size_sqyard} onChange={(event) => updateArea(event.target.value)} /></Field>
            <Field label="Area (m², auto-calculated)"><Input type="number" value={form.size_meter} readOnly className="bg-slate-50" /></Field>
            <Field label="Circle rate"><Input type="number" min="0" step="0.01" value={form.circle_rate} onChange={(event) => update("circle_rate", event.target.value)} /></Field>
            <Field label="Registry date *"><Input type="date" value={form.registry_date} onChange={(event) => update("registry_date", event.target.value)} /></Field>
            <Field label="Entry date"><Input type="date" value={form.created_entry_date} onChange={(event) => update("created_entry_date", event.target.value)} /></Field>
            {!isReraProfile && <Field label="Bank amount"><Input type="number" min="0" step="0.01" value={form.bank_amount} onChange={(event) => update("bank_amount", event.target.value)} /></Field>}
            {!isReraProfile && <Field label="Registry payment *"><Input type="number" min="0" step="0.01" value={form.registry_payment} onChange={(event) => update("registry_payment", event.target.value)} /></Field>}
            <Field label="Farmer / landowner"><Input value={form.farmer_name || ""} onChange={(event) => update("farmer_name", event.target.value.toUpperCase())} /></Field>
            <Field label="Seller / executing party"><Input value={form.seller_name || ""} onChange={(event) => update("seller_name", event.target.value.toUpperCase())} /></Field>
            <Field label="Firm / developer"><Input value={form.firm_name || ""} onChange={(event) => update("firm_name", event.target.value.toUpperCase())} /></Field>
            <Field label="Assigned approver">
              <Select value={form.assigned_admin_id || "__auto"} onValueChange={(value) => update("assigned_admin_id", value === "__auto" ? "" : value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto">Auto-assign / none</SelectItem>
                  {approvers.map((approver) => <SelectItem key={approver.id} value={String(approver.id)}>{approver.full_name || approver.name || approver.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          {isReraProfile && (
            <details className="border-y border-slate-200 py-3" open={missingRegistrationMetadata.length > 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold text-slate-800">
                Deed & Sub-Registrar details
                <span className={missingRegistrationMetadata.length ? "text-amber-700" : "text-emerald-700"}>{missingRegistrationMetadata.length ? `${missingRegistrationMetadata.length} missing` : "Ready"}</span>
              </summary>
              <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
                <Field label="Deed number"><Input value={form.deed_number || ""} onChange={(event) => update("deed_number", event.target.value.toUpperCase())} /></Field>
                <Field label="Registration number"><Input value={form.registration_number || ""} onChange={(event) => update("registration_number", event.target.value.toUpperCase())} /></Field>
                <Field label="Deed execution date"><Input type="date" value={form.deed_execution_date || ""} onChange={(event) => update("deed_execution_date", event.target.value)} /></Field>
                <Field label="Registration date"><Input type="date" min={form.deed_execution_date || undefined} value={form.registration_date || ""} onChange={(event) => update("registration_date", event.target.value)} /></Field>
                <Field label="Sub-Registrar office"><Input value={form.sub_registrar_office || ""} onChange={(event) => update("sub_registrar_office", event.target.value.toUpperCase())} /></Field>
                <Field label="Registrar district"><Input value={form.registrar_district || ""} onChange={(event) => update("registrar_district", event.target.value.toUpperCase())} /></Field>
                <Field label="Stamp duty amount"><Input type="number" min="0" step="0.01" value={form.stamp_duty_amount || ""} onChange={(event) => update("stamp_duty_amount", event.target.value)} /></Field>
                <Field label="Registration fee amount"><Input type="number" min="0" step="0.01" value={form.registration_fee_amount || ""} onChange={(event) => update("registration_fee_amount", event.target.value)} /></Field>
              </div>
            </details>
          )}
          <Field label="Notes"><Textarea className="min-h-20" value={form.notes || ""} onChange={(event) => update("notes", event.target.value)} /></Field>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button variant="outline" onClick={() => { resetForm(); setEditing(false); }} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </div>
        </div>
      ) : (
        <div>
          <dl className="grid border-t border-slate-200 sm:grid-cols-2">
            {details.map(([label, value], index) => (
              <div
                key={label}
                className={cn(
                  "py-3.5",
                  index > 0 && "border-t border-slate-100",
                  index === 1 && "sm:border-t-0",
                  index % 2 === 0 ? "sm:border-r sm:pr-5" : "sm:pl-5",
                )}
              >
                <dt className="text-[10px] font-medium text-slate-500">{label}</dt>
                <dd className="mt-1 text-xs font-semibold leading-5 text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
          {isReraProfile && (
            <details className="border-t border-slate-200 py-3" open={missingRegistrationMetadata.length > 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold text-slate-800">
                Deed & Sub-Registrar details
                <span className={missingRegistrationMetadata.length ? "text-amber-700" : "text-emerald-700"}>{missingRegistrationMetadata.length ? `${missingRegistrationMetadata.length} required item${missingRegistrationMetadata.length === 1 ? "" : "s"} missing` : "Execution metadata ready"}</span>
              </summary>
              <dl className="mt-3 grid border-t border-slate-100 sm:grid-cols-2">
                {registrationDetails.map(([label, value], index) => (
                  <div key={label} className={cn("py-3", index > 1 && "border-t border-slate-100", index % 2 === 0 ? "sm:border-r sm:pr-5" : "sm:pl-5")}>
                    <dt className="text-[10px] font-medium text-slate-500">{label}</dt>
                    <dd className="mt-1 text-xs font-semibold text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
              {missingRegistrationMetadata.length > 0 && <p className="border-t border-amber-100 pt-2 text-[10px] text-amber-700">Still needed: {missingRegistrationMetadata.join(", ")}.</p>}
            </details>
          )}
          {registry.notes && (
            <div className="border-t border-slate-200 py-3.5">
              <p className="text-[10px] font-medium text-slate-500">Internal notes</p>
              <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-700">{registry.notes}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function WorkflowTimeline({ title, steps, currentStatus }) {
  const currentIndex = Math.max(
    steps.findIndex((step) => step.status === currentStatus),
    0,
  );
  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <span className="text-[11px] font-medium text-slate-500">
          {currentIndex + 1} of {steps.length}
        </span>
      </div>
      <div className="-mx-1 overflow-x-auto px-1">
        <ol className="flex min-w-max pb-1 sm:min-w-0">
          {steps.map((step, index) => {
            const done = index < currentIndex;
            const active = index === currentIndex;
            return (
              <li key={step.status} className="min-w-[92px] flex-1 last:min-w-[72px]">
              <div className="flex items-center">
                <div
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold transition-colors",
                    done
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : active
                        ? "border-blue-600 bg-blue-600 text-white ring-4 ring-blue-50"
                        : "border-slate-200 bg-white text-slate-400",
                  )}
                >
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "mx-2 h-px min-w-8 flex-1",
                      index < currentIndex ? "bg-emerald-300" : "bg-slate-200",
                    )}
                  />
                )}
              </div>
              <p
                className={cn(
                  "mt-2 pr-2 text-[10px] font-medium leading-4",
                  active
                    ? "text-blue-700"
                    : done
                      ? "text-slate-700"
                      : "text-slate-400",
                )}
              >
                {step.label}
              </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function RegistryHandoverPanel({ registry, row, canWrite }) {
  const [handovers, setHandovers] = useState([]);
  const [recipient, setRecipient] = useState(row?.customer_name || "");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const loadHandovers = useCallback(async () => {
    if (!registry?.id) return;
    try {
      const { data } = await api.get(`/registries/${registry.id}/handovers`);
      setHandovers(data.handovers || []);
    } catch {
      setHandovers([]);
    }
  }, [registry?.id]);
  useEffect(() => {
    setRecipient(row?.customer_name || "");
    loadHandovers();
  }, [loadHandovers, row?.customer_name]);
  const save = async () => {
    if (!recipient.trim()) return toast.error("Enter the recipient name");
    setBusy(true);
    try {
      await api.post(`/registries/${registry.id}/handovers`, {
        given_to: recipient,
        notes,
        given_at: new Date().toISOString(),
      });
      toast.success("Document handover recorded");
      setNotes("");
      await loadHandovers();
    } catch (error) {
      toast.error(error.response?.data?.message || "Handover could not be recorded");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-800">Document handover</p>
          <p className="text-[11px] text-slate-500">Record delivery of the executed registry deed.</p>
        </div>
        <Badge variant="outline">{handovers.length} recorded</Badge>
      </div>
      {canWrite && (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="Recipient name" />
          <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Handover notes" />
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Record"}</Button>
        </div>
      )}
      {handovers.length > 0 && (
        <ol className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
          {handovers.map((handover) => (
            <li key={handover.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
              <span className="font-medium text-slate-800">Given to {handover.given_to}</span>
              <span className="text-slate-500">{dateLabel(handover.given_at)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function DetailSheet({
  open,
  onOpenChange,
  row,
  detail,
  loading,
  initialTab,
  onReload,
  onOpenPayment,
  onOpenCancellation,
  onOpenTransfer,
  onStartBooking,
  canWrite,
  canUpdate,
  canWriteRegistry,
  canUpdateRegistry,
  canDeleteRegistry,
  isAdmin,
  isReraProfile,
  workflowUnlocked,
  policy,
  navigate,
}) {
  const [tab, setTab] = useState("overview");
  const [busy, setBusy] = useState("");
  const [agreementRegistrationOpen, setAgreementRegistrationOpen] = useState(false);
  const [registryReadiness, setRegistryReadiness] = useState(null);
  useEffect(() => {
    if (open)
      setTab(
        row?.booking_id &&
          ["overview", "payments", "agreement", "registry", "activity"].includes(
            initialTab,
          )
          ? initialTab
          : "overview",
      );
  }, [initialTab, open, row?.booking_id]);
  const latestAgreement = detail?.agreements?.[0];
  const registry = detail?.registry;
  useEffect(() => {
    if (!open || tab !== "registry" || !registry?.id || !row?.site_id) {
      setRegistryReadiness(null);
      return undefined;
    }
    let active = true;
    api.get(`/property-lifecycle/registries/${registry.id}/readiness`, {
      params: { site_id: row.site_id },
    }).then(({ data }) => {
      if (active) setRegistryReadiness(data.readiness || null);
    }).catch(() => {
      if (active) setRegistryReadiness(registry.readiness_result || null);
    });
    return () => { active = false; };
  }, [open, registry?.id, registry?.readiness_result, row?.site_id, tab]);
  const registryStatus = String(
    registry?.lifecycle_status || "NOT_READY",
  ).toUpperCase();
  const nextRegistryStatus = getNextRegistryStatus(registryStatus);
  const effectiveRegistryReadiness = registryReadiness || registry?.readiness_result;
  const canonicalReceiptTotal = Number(
    effectiveRegistryReadiness?.facts?.canonical_registry_received
      ?? (registry?.id
        ? (detail?.payments || []).filter((payment) => String(payment.mapped_registry_id) === String(registry.id)).reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
        : 0),
  );
  const registryReadinessChecks = Array.isArray(effectiveRegistryReadiness?.checks)
    ? effectiveRegistryReadiness.checks
    : [];
  const passedRegistryChecks = registryReadinessChecks.filter(
    (check) => check.passed,
  ).length;
  const missingRegistryChecks = registryReadinessChecks.filter(
    (check) => check.required && !check.passed,
  );
  const act = async (key, request, message, errorFormatter = null) => {
    setBusy(key);
    try {
      const result = await request();
      toast.success(message);
      await onReload();
      return result;
    } catch (error) {
      // A failed transaction changes no data, but reloading here guarantees
      // the sheet also recovers cleanly from a stale second browser session.
      if (key === "registry") {
        try {
          await onReload();
        } catch {
          // Preserve the original, more useful action error.
        }
      }
      toast.error(errorFormatter?.(error) || error.response?.data?.message || "Action could not be completed");
      return null;
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
    const next = getNextRegistryStatus(registry.lifecycle_status);
    if (!next) return;
    return act(
      "registry",
      () => advanceRegistry(registry, next),
      `Registry marked ${readable(next)}.`,
      registryActionError,
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
  const canStartBooking =
    !row?.booking_id && !Number(row?.legacy_booking_count) && canWrite;
  const tabs = row?.booking_id
    ? ["overview", "payments", "agreement", "registry", "activity"]
    : ["overview"];
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
            <PaymentWorkspace row={row} detail={detail} />
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
                      className="flex items-start justify-between gap-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">
                          Agreement v{agreement.version_number}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {agreement.agreement_number ||
                            agreement.agreement_type}{" "}
                          · {agreement.status === "EXECUTED" ? `executed ${dateLabel(agreement.execution_date)}` : `created ${dateLabel(agreement.created_at)}`}
                        </p>
                        {isReraProfile && (
                          <p className="mt-1 text-[10px] text-slate-500">
                            Registration: {readable(agreement.registration_status || "NOT_REGISTERED")}
                            {agreement.registration_number ? ` · ${agreement.registration_number}` : ""}
                            {agreement.registration_date ? ` · ${dateLabel(agreement.registration_date)}` : ""}
                            {agreement.registration_office ? ` · ${agreement.registration_office}` : ""}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge variant="outline" className={tone(agreement.status)}>{readable(agreement.status)}</Badge>
                        {isReraProfile && agreement.status === "EXECUTED" && (
                          <Badge variant="outline" className={tone(agreement.registration_status === "REGISTERED" ? "COMPLETE" : "UNDER_REVIEW")}>{readable(agreement.registration_status || "NOT_REGISTERED")}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  title="No agreement prepared"
                  text="Create the first structured agreement revision for this booking."
                />
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
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
                {isReraProfile && isAdmin && canUpdate && latestAgreement?.status === "EXECUTED" && (
                  <Button variant="outline" onClick={() => setAgreementRegistrationOpen(true)}>
                    {latestAgreement.registration_status === "REGISTERED" ? "Update registration" : "Record registration"}
                  </Button>
                )}
              </div>
            </div>
          ) : tab === "registry" ? (
            registry ? (
              <div className="space-y-7 pb-2">
                {isReraProfile && (
                  <div className="overflow-hidden rounded-lg">
                    <ReraWorkflowNotice
                      policy={policy}
                      area="registry"
                      actions={[{ label: "Project payments", href: "/plot-payments" }]}
                    />
                  </div>
                )}
                <section className="border-b border-slate-200 pb-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-200">
                        <FileSignature className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-600">
                          Registry workspace
                        </p>
                        <h3 className="mt-0.5 truncate text-base font-semibold text-slate-950">
                          Plot {row.plot_no} registration
                        </h3>
                      </div>
                    </div>
                    <StatusBadge value={registryStatus} />
                  </div>

                  <dl className="mt-5 grid grid-cols-3 divide-x divide-slate-200 border-y border-slate-200">
                    {[
                      ["Registry date", dateLabel(registry.registry_date)],
                      [isReraProfile ? "Canonical receipts" : "Registry value", money(isReraProfile ? canonicalReceiptTotal : registry.registry_payment)],
                      ["NOC", registry.noc_generated_at ? "Generated" : "Pending"],
                    ].map(([label, value]) => (
                      <div key={label} className="min-w-0 px-3 py-3 first:pl-0 last:pr-0 sm:px-5">
                        <dt className="text-[10px] font-medium text-slate-500">{label}</dt>
                        <dd className="mt-1 truncate text-xs font-semibold tabular-nums text-slate-900">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>

                <WorkflowTimeline
                  title="Registry timeline"
                  currentStatus={registryStatus}
                  steps={REGISTRY_WORKFLOW_STEPS}
                />

                <section
                  className={cn(
                    "overflow-hidden rounded-xl border border-l-4",
                    registryStatus === "COMPLETE"
                      ? "border-emerald-200 border-l-emerald-500 bg-emerald-50/40"
                      : "border-blue-200 border-l-blue-600 bg-blue-50/40",
                  )}
                >
                  <div className="px-4 py-4">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {registryStatus === "COMPLETE" ? "Workflow status" : "Next required action"}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">
                        {registryStatus === "COMPLETE"
                          ? "Registry complete"
                          : readable(nextRegistryStatus)}
                      </p>
                      <p className="mt-1 max-w-md text-[11px] leading-5 text-slate-600">
                        {REGISTRY_STAGE_COPY[registryStatus] || "Continue the registry workflow from this workspace."}
                      </p>
                    </div>
                  </div>

                  {registryReadinessChecks.length > 0 && (
                    <div className="border-t border-slate-200/80 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-semibold text-slate-700">Readiness checks</p>
                        <span className="text-[10px] font-medium tabular-nums text-slate-500">
                          {passedRegistryChecks} of {registryReadinessChecks.length} passed
                        </span>
                      </div>
                      {missingRegistryChecks.length > 0 ? (
                        <ul className="mt-2 space-y-1.5">
                          {missingRegistryChecks.map((check) => (
                            <li key={check.key} className="flex items-center gap-2 text-[11px] text-amber-800">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                              {check.label}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 flex items-center gap-2 text-[11px] font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          All required checks are complete
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 border-t border-slate-200/80 px-4 py-2.5">
                    <span className="text-[10px] text-slate-500">
                      {registry.noc_generated_at ? "NOC is ready" : "Prepare and verify the NOC before execution"}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 text-blue-700 hover:bg-blue-100/70 hover:text-blue-800"
                      onClick={() => navigate(`/plot-registry/${registry.id}/noc`)}
                    >
                      Open NOC
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </section>

                <RegistryDetailsPanel
                  registry={registry}
                  canonicalReceiptTotal={canonicalReceiptTotal}
                  canUpdate={canUpdateRegistry}
                  isReraProfile={isReraProfile}
                  onSaved={onReload}
                />

                <section className="border-t border-slate-200 pt-5">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <FolderUp className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Registry documents</h3>
                      <p className="text-[11px] text-slate-500">Upload deeds, photos and supporting files from this sheet.</p>
                    </div>
                  </div>
                  <RegistryDocuments
                    plotId={row.plot_id}
                    plotNo={row.plot_no}
                    canWrite={canWriteRegistry}
                    canDelete={canDeleteRegistry}
                    registryDeedAllowed={Boolean(registry.noc_generated_at) || workflowUnlocked}
                    embedded
                  />
                </section>

                {registryStatus === "COMPLETE" && (
                  <section className="space-y-5 border-t border-slate-200 pt-5">
                    <WorkflowTimeline
                      title="Possession timeline"
                      currentStatus={registry.possession_lifecycle_status || "READY"}
                      steps={[
                        { status: "READY", label: "Ready" },
                        { status: "HANDOVER_SCHEDULED", label: "Scheduled" },
                        { status: "DOCUMENTS_DELIVERED", label: "Delivered" },
                        { status: "ACKNOWLEDGED", label: "Acknowledged" },
                        { status: "POSSESSED", label: "Possessed" },
                      ]}
                    />
                    <div>
                      <Button
                        variant="outline"
                        onClick={possessionAction}
                        disabled={
                          !canUpdateRegistry ||
                          busy === "possession" ||
                          registry.possession_lifecycle_status === "POSSESSED"
                        }
                      >
                        {registry.possession_id
                          ? `Move handover to ${readable({ READY: "HANDOVER_SCHEDULED", HANDOVER_SCHEDULED: "DOCUMENTS_DELIVERED", DOCUMENTS_DELIVERED: "ACKNOWLEDGED", ACKNOWLEDGED: "POSSESSED" }[registry.possession_lifecycle_status] || registry.possession_lifecycle_status)}`
                          : "Start possession"}
                      </Button>
                    </div>
                    <RegistryHandoverPanel
                      registry={registry}
                      row={row}
                      canWrite={canWriteRegistry}
                    />
                  </section>
                )}
              </div>
            ) : (
              <RegistryStartPanel
                row={row}
                detail={detail}
                canWrite={canWriteRegistry}
                canDelete={canDeleteRegistry}
                isAdmin={isAdmin}
                isReraProfile={isReraProfile}
                policy={policy}
                onSaved={onReload}
              />
            )
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
        {row?.booking_id && !(tab === "registry" && !registry) && (
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
                  Transfer customer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {tab === "registry" ? (
              registry ? (
                registryStatus === "COMPLETE" ? (
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/plot-registry/${registry.id}/noc`)}
                  >
                    Open NOC workspace
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={registryAction}
                    disabled={!canUpdateRegistry || busy === "registry" || !nextRegistryStatus}
                  >
                    {busy === "registry" ? "Updating registry…" : `Move to ${readable(nextRegistryStatus)}`}
                    {busy !== "registry" && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
                )
              ) : (
                <span className="text-xs text-slate-500">Complete the registry form above</span>
              )
            ) : (
              <Button onClick={onOpenPayment}>
                <IndianRupee className="mr-1.5 h-4 w-4" />
                Record payment
              </Button>
            )}
          </div>
        )}
        {canStartBooking && (
          <div className="flex shrink-0 justify-end border-t border-slate-200 bg-white px-6 py-4">
            <Button onClick={onStartBooking}>
              <Plus className="mr-2 h-4 w-4" />
              Start booking
            </Button>
          </div>
        )}
        <AgreementRegistrationSheet
          open={agreementRegistrationOpen}
          onOpenChange={setAgreementRegistrationOpen}
          agreement={latestAgreement}
          onSaved={onReload}
        />
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
  const isReraProfile = isReraOperatingProfile(policy);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deepLinkedPlotId = searchParams.get("plot_id");
  const siteId = currentSite?.id;
  const title =
    policy?.getTerm?.(
      "customer_inventory",
      policy?.isLegacy ? "Customer & Inventory" : "Customers & Collections",
    ) || "Customer & Inventory";
  const [state, setState] = useState({
    rows: [],
    pagination: { page: 1, limit: CUSTOMER_INVENTORY_PAGE_SIZE, total: 0 },
    needs_attention: {},
    loading: true,
    error: "",
  });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState("property:asc");
  const [page, setPage] = useState(1);
  const [members, setMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [workflowUnlocked, setWorkflowUnlocked] = useState(false);
  const [bookingRow, setBookingRow] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailInitialTab, setDetailInitialTab] = useState("overview");
  const [drawerMode, setDrawerMode] = useState("detail");
  const request = useRef(0);
  const detailRequest = useRef(0);
  const deepLinkHandled = useRef("");
  const canWrite = hasPermission("plot_payments", "write");
  const canUpdate = hasPermission("plot_payments", "update");
  const canWriteRegistry = hasPermission("plot_registry", "write");
  const canUpdateRegistry = hasPermission("plot_registry", "update");
  const canDeleteRegistry = hasPermission("plot_registry", "delete");
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
          limit: CUSTOMER_INVENTORY_PAGE_SIZE,
          sort_by: sortBy,
          sort_order: sortOrder,
          ...(query ? { q: query } : {}),
          ...(status !== "ALL" ? { status } : {}),
          ...(deepLinkedPlotId ? { plot_id: deepLinkedPlotId } : {}),
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
  }, [deepLinkedPlotId, page, query, siteId, sort, status]);
  useEffect(() => {
    const timer = setTimeout(load, 180);
    return () => {
      clearTimeout(timer);
      request.current += 1;
    };
  }, [load]);
  useEffect(() => {
    if (!siteId) return;
    let active = true;
    Promise.allSettled([
      api.get("/members", { params: { site_id: siteId } }),
      api.get("/rera/control-centre", { params: { site_id: siteId } }),
    ]).then(([memberResult, projectResult]) => {
      if (!active) return;
      if (memberResult.status === "fulfilled")
        setMembers(memberResult.value.data.members || []);
      if (projectResult.status === "fulfilled")
        setProjects(projectResult.value.data.projects || []);
    });
    return () => {
      active = false;
    };
  }, [siteId]);
  useEffect(() => {
    let active = true;
    setWorkflowUnlocked(false);
    if (!siteId) return () => { active = false; };
    api.get("/settings/features", { params: { site_id: siteId } })
      .then(({ data }) => {
        if (active) {
          setWorkflowUnlocked(
            Boolean(data.features?.plot_registry_workflow_unlocked),
          );
        }
      })
      .catch(() => {
        // Sequential registry rules remain active if feature settings fail.
        if (active) setWorkflowUnlocked(false);
      });
    return () => { active = false; };
  }, [siteId]);
  const openDetail = useCallback(
    async (row, initialTab = "overview") => {
      const sequence = ++detailRequest.current;
      setDetailInitialTab(initialTab);
      setSelected({ ...row, site_id: siteId });
      setDrawerMode("detail");
      setDetail(null);
      if (!row.booking_id) {
        setDetailLoading(false);
        return;
      }
      setDetailLoading(true);
      try {
        const { data } = await api.get(
          `/property-lifecycle/bookings/${row.booking_id}`,
        );
        if (sequence === detailRequest.current) setDetail(data);
      } catch (error) {
        if (sequence === detailRequest.current) {
          toast.error(
            error.response?.data?.message ||
              "Lifecycle details could not be loaded",
          );
        }
      } finally {
        if (sequence === detailRequest.current) setDetailLoading(false);
      }
    },
    [siteId],
  );
  const closeSelected = useCallback(() => {
    detailRequest.current += 1;
    setSelected(null);
    setDetail(null);
    setDetailLoading(false);
  }, []);
  useEffect(() => {
    closeSelected();
  }, [closeSelected, siteId]);
  useEffect(() => {
    if (state.loading) return;
    const plotId = searchParams.get("plot_id");
    if (!plotId) return;
    const requestedTab = searchParams.get("tab") || "overview";
    const key = `${siteId || "site"}:${plotId}:${requestedTab}`;
    if (deepLinkHandled.current === key) return;
    const row = state.rows.find(
      (record) => String(record.plot_id) === String(plotId),
    );
    if (!row) return;
    deepLinkHandled.current = key;
    openDetail(row, requestedTab);
    navigate("/customer-inventory", { replace: true });
  }, [navigate, openDetail, searchParams, siteId, state.loading, state.rows]);
  const reloadSelected = useCallback(async () => {
    await load();
    if (selected?.booking_id)
      await openDetail(selected, detailInitialTab);
  }, [detailInitialTab, load, openDetail, selected]);
  const handleBookingSaved = useCallback(
    async (booking) => {
      const bookedRow = bookingRow || selected;
      if (!bookedRow) return load();
      await load();
      await openDetail(
        {
          ...bookedRow,
          booking_id: booking.id,
          booking_no: booking.booking_no,
          booking_date: booking.booking_date,
          final_consideration: booking.final_consideration,
        },
        "overview",
      );
    },
    [bookingRow, load, openDetail, selected],
  );
  const totalPages = Math.max(
    Math.ceil((state.pagination?.total || 0) / CUSTOMER_INVENTORY_PAGE_SIZE),
    1,
  );

  return (
    /* ponytail: negative margins cancel Layout's <main> padding for a full-bleed page */
    <div className="-mx-4 -mt-4 min-h-full bg-white md:-mx-6 md:-mt-6">
      <div className="w-full">
        <header className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-semibold tracking-tight text-slate-900">
              {title}
            </h1>
            <p className="mt-0.5 truncate text-[13px] text-slate-500">
              {policy?.isLegacy ? "Plot Payments" : "Developer lifecycle"} ·
              Bookings, collections, agreements, registry and possession.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => navigate("/project-finance")}
            >
              Project finance
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </header>
        <div className="bg-white">
          <MetricStrip
            rows={state.rows}
            metrics={state.metrics}
            attention={state.needs_attention}
          />
          <div className="flex flex-col gap-2 border-b border-slate-200 bg-white px-5 py-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1 lg:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search property, customer or phone…"
                className="h-9 border-slate-200 bg-slate-50/80 pl-9 focus-visible:bg-white focus-visible:ring-blue-500"
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-full border-slate-200 bg-white md:w-44 lg:ml-auto">
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
              <SelectTrigger className="h-9 w-full border-slate-200 bg-white md:w-44">
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
          <div className="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-3 text-xs text-slate-500">
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
        onSaved={handleBookingSaved}
      />
      {drawerMode === "detail" ? (
        <DetailSheet
          open={Boolean(selected)}
          onOpenChange={(open) => !open && closeSelected()}
          row={selected}
          detail={detail}
          loading={detailLoading}
          initialTab={detailInitialTab}
          onReload={reloadSelected}
          onOpenPayment={() => setDrawerMode("payment")}
          onOpenCancellation={() => setDrawerMode("cancellation")}
          onOpenTransfer={() => setDrawerMode("transfer")}
          onStartBooking={() => setBookingRow(selected)}
          canWrite={canWrite}
          canUpdate={canUpdate}
          canWriteRegistry={canWriteRegistry}
          canUpdateRegistry={canUpdateRegistry}
          canDeleteRegistry={canDeleteRegistry}
          isAdmin={isAdmin}
          isReraProfile={isReraProfile}
          workflowUnlocked={workflowUnlocked}
          policy={policy}
          navigate={navigate}
        />
      ) : (
        <Sheet
          open={Boolean(selected)}
          onOpenChange={(open) => !open && closeSelected()}
        >
          <SheetContent className="flex w-full flex-col p-0 sm:max-w-[760px]">
            {drawerMode === "payment" ? (
              <PaymentPanel
                row={selected}
                detail={detail}
                onBack={() => setDrawerMode("detail")}
                onOpenAgreement={() => {
                  setDetailInitialTab("agreement");
                  setDrawerMode("detail");
                }}
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
