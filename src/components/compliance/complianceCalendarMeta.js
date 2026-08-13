import { format } from 'date-fns';
import { CalendarDays, ClipboardCheck, Gavel, ShieldAlert, ShieldCheck } from 'lucide-react';

export const COMPLIANCE_EVENT_META = {
  COMPLIANCE: { label: 'Compliance', Icon: ClipboardCheck, chip: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/80 dark:bg-blue-950/55 dark:text-blue-300', icon: 'bg-blue-600 text-white' },
  LEGAL_HEARING: { label: 'Legal hearing', Icon: Gavel, chip: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/80 dark:bg-violet-950/55 dark:text-violet-300', icon: 'bg-violet-600 text-white' },
  NOTICE_REPLY: { label: 'Notice reply', Icon: ShieldAlert, chip: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/80 dark:bg-rose-950/55 dark:text-rose-300', icon: 'bg-rose-600 text-white' },
  INSPECTION: { label: 'Inspection', Icon: CalendarDays, chip: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/80 dark:bg-amber-950/55 dark:text-amber-200', icon: 'bg-amber-500 text-white' },
  LICENCE_EXPIRY: { label: 'Licence expiry', Icon: ShieldCheck, chip: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/80 dark:bg-emerald-950/55 dark:text-emerald-300', icon: 'bg-emerald-600 text-white' },
};

export const complianceEventDate = (value) => new Date(`${String(value).slice(0, 10)}T00:00:00`);
export const calendarIsoDate = (value) => format(value, 'yyyy-MM-dd');
export const calendarEventTime = (event) => String(event?.event_time || '').trim();

export const complianceEventRoute = (event) => {
  if (event.event_type === 'COMPLIANCE') return `/compliance/register/${event.id}`;
  if (event.event_type === 'LEGAL_HEARING') return `/legal/cases/${event.id}`;
  if (event.event_type === 'LICENCE_EXPIRY') return '/compliance/licences';
  if (event.event_type === 'NOTICE_REPLY') return '/legal/notices';
  return '/legal/inspections';
};
