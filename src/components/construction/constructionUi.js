export const money = (value, compact = false) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? 'compact' : 'standard',
  }).format(amount);
};

export const formatDate = (value, short = false) => {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-IN', short
    ? { day: '2-digit', month: 'short' }
    : { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
};

export const today = () => new Date().toISOString().slice(0, 10);

export const title = (value) => String(value || 'Not recorded')
  .replaceAll('_', ' ')
  .toLowerCase()
  .replace(/(^|\s)\S/g, (character) => character.toUpperCase());

export const statusTone = (status) => {
  const value = String(status || '').toUpperCase();
  if (['ACTIVE', 'ON_TRACK', 'COMPLETED', 'APPROVED', 'CERTIFIED', 'READY', 'ACCEPTED', 'PASS', 'RESOLVED', 'COMPLETE', 'DONE', 'FULFILLED'].includes(value)) return 'success';
  if (['DELAYED', 'BLOCKED', 'REJECTED', 'ERROR', 'MISSING', 'CRITICAL'].includes(value)) return 'danger';
  if (['AT_RISK', 'EVIDENCE_PENDING', 'REVISION_REQUIRED', 'REVIEW_REQUIRED', 'WARNING', 'HIGH', 'ON_HOLD', 'REQUESTED', 'PARTIALLY_FULFILLED'].includes(value)) return 'warning';
  if (['SUBMITTED', 'UNDER_REVIEW', 'INTERNAL_REVIEW', 'PROFESSIONAL_REVIEW', 'REVIEW', 'IN_PROGRESS'].includes(value)) return 'info';
  return 'neutral';
};

export const toneClasses = {
  success: 'border-emerald-200/80 bg-emerald-50 text-emerald-700',
  danger: 'border-rose-200/80 bg-rose-50 text-rose-700',
  warning: 'border-amber-200/80 bg-amber-50 text-amber-700',
  info: 'border-blue-200/80 bg-blue-50 text-blue-700',
  neutral: 'border-mr-line bg-mr-surface-2 text-mr-muted',
};

export const initials = (name) => String(name || 'Unassigned').split(/\s+/).slice(0, 2)
  .map((part) => part[0]).join('').toUpperCase();

export const numberValue = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
