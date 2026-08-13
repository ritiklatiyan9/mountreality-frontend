export const STATUS_OPTIONS = [
  'DRAFT', 'NOT_STARTED', 'IN_PROGRESS', 'AWAITING_DOCUMENTS',
  'AWAITING_EXTERNAL_AUTHORITY', 'UNDER_REVIEW', 'APPROVAL_PENDING',
  'SUBMITTED', 'COMPLETED', 'REJECTED', 'RETURNED_FOR_CORRECTION',
  'ON_HOLD', 'NOT_APPLICABLE', 'OVERDUE', 'CANCELLED',
];

export const RISK_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const COMPLIANCE_TYPES = [
  'ONE_TIME_APPROVAL', 'RECURRING_FILING', 'LICENCE_RENEWAL', 'REGISTRATION_RENEWAL',
  'DOCUMENT_EXPIRY', 'TAX_COMPLIANCE', 'PROJECT_APPROVAL', 'CONSTRUCTION_APPROVAL',
  'ENVIRONMENT_COMPLIANCE', 'LABOUR_COMPLIANCE', 'FIRE_SAFETY', 'ELECTRICAL_SAFETY',
  'LAND_REVENUE_COMPLIANCE', 'LOCAL_AUTHORITY_COMPLIANCE', 'RERA_COMPLIANCE',
  'INTERNAL_POLICY', 'COURT_MATTER', 'LEGAL_NOTICE', 'CONTRACT_OBLIGATION',
  'INSURANCE_RENEWAL', 'VENDOR_COMPLIANCE', 'EMPLOYEE_COMPLIANCE', 'OTHER',
];

export const STATUS_STYLE = {
  DRAFT: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  NOT_STARTED: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
  IN_PROGRESS: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/55 dark:text-blue-300',
  AWAITING_DOCUMENTS: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/55 dark:text-violet-300',
  AWAITING_EXTERNAL_AUTHORITY: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/55 dark:text-cyan-300',
  UNDER_REVIEW: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/55 dark:text-indigo-300',
  APPROVAL_PENDING: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/55 dark:text-amber-200',
  SUBMITTED: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/55 dark:text-sky-300',
  COMPLETED: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/55 dark:text-emerald-300',
  REJECTED: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/55 dark:text-red-300',
  RETURNED_FOR_CORRECTION: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/55 dark:text-orange-300',
  ON_HOLD: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/55 dark:text-amber-200',
  NOT_APPLICABLE: 'border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  OVERDUE: 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/55 dark:text-red-300',
  CANCELLED: 'border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
};

export const RISK_STYLE = {
  LOW: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/55 dark:text-emerald-300',
  MEDIUM: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/55 dark:text-amber-200',
  HIGH: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/55 dark:text-orange-300',
  CRITICAL: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/55 dark:text-red-300',
};

export const labelize = (value) => String(value || '—')
  .toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());

export const fmtDate = (value, withTime = false) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
};

export const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
export const isoDate = (value = new Date()) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
