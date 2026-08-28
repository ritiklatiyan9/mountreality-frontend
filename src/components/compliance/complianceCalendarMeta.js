import { format } from 'date-fns';
import { CalendarDays, CalendarPlus, ClipboardCheck, Gavel, ShieldAlert, ShieldCheck } from 'lucide-react';

export const COMPLIANCE_EVENT_META = {
  COMPLIANCE: { label: 'Compliance', Icon: ClipboardCheck, chip: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/80 dark:bg-blue-950/55 dark:text-blue-300', icon: 'bg-blue-600 text-white' },
  LEGAL_HEARING: { label: 'Legal hearing', Icon: Gavel, chip: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/80 dark:bg-violet-950/55 dark:text-violet-300', icon: 'bg-violet-600 text-white' },
  NOTICE_REPLY: { label: 'Notice reply', Icon: ShieldAlert, chip: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/80 dark:bg-rose-950/55 dark:text-rose-300', icon: 'bg-rose-600 text-white' },
  INSPECTION: { label: 'Inspection', Icon: CalendarDays, chip: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/80 dark:bg-amber-950/55 dark:text-amber-200', icon: 'bg-amber-500 text-white' },
  LICENCE_EXPIRY: { label: 'Licence expiry', Icon: ShieldCheck, chip: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/80 dark:bg-emerald-950/55 dark:text-emerald-300', icon: 'bg-emerald-600 text-white' },
  SCHEDULED_EVENT: { label: 'Scheduled event', Icon: CalendarPlus, chip: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/80 dark:bg-cyan-950/55 dark:text-cyan-300', icon: 'bg-cyan-600 text-white' },
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const IST_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
});

// Calendar dates are business dates in India. Timed records arrive as UTC
// timestamps (e.g. an 18th-at-midnight event may be 17th in UTC), so never
// derive their calendar day by slicing an ISO string.
export const complianceEventDate = (value) => {
  const raw = String(value ?? '').trim();
  if (DATE_ONLY.test(raw)) return new Date(`${raw}T00:00:00`);

  // Datetimes without an offset are already a local wall-clock date.
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw) && !/(Z|[+-]\d{2}:?\d{2})$/i.test(raw)) {
    return new Date(`${raw.slice(0, 10)}T00:00:00`);
  }

  const instant = value instanceof Date ? value : new Date(raw);
  if (Number.isNaN(instant.getTime())) return new Date('');
  const parts = Object.fromEntries(IST_DATE_FORMATTER
    .formatToParts(instant)
    .filter(({ type }) => type !== 'literal')
    .map(({ type, value: part }) => [type, part]));
  return new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00`);
};
export const calendarIsoDate = (value) => format(value, 'yyyy-MM-dd');
export const calendarEventTime = (event) => String(event?.event_time || '').trim();

export const complianceEventRoute = (event) => {
  if (event.event_type === 'COMPLIANCE') return `/compliance/register/${event.id}`;
  if (event.event_type === 'LEGAL_HEARING') return `/legal/cases/${event.id}`;
  if (event.event_type === 'LICENCE_EXPIRY') return '/compliance/licences';
  if (event.event_type === 'NOTICE_REPLY') return '/legal/notices';
  if (event.event_type === 'SCHEDULED_EVENT') {
    return `/compliance/calendar?date=${calendarIsoDate(complianceEventDate(event.event_date))}`;
  }
  return '/legal/inspections';
};
