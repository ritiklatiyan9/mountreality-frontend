export const WORKSPACE_VIEWS = [
  { id: 'overview', label: 'Overview' },
  { id: 'acquisitions', label: 'Acquisitions' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'reports', label: 'Reports & Analytics' },
];

export const DETAIL_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'land', label: 'Land' },
  { id: 'agreement', label: 'Agreement' },
  { id: 'financials', label: 'Financials' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'documents', label: 'Documents' },
  { id: 'activity', label: 'Activity' },
];

export const PROGRESS_STEPS = [
  { key: 'LAND_DETAILS', label: 'Land Details' },
  { key: 'AGREEMENT_COMPLETED', label: 'Agreement' },
  { key: 'FINANCIAL_TERMS_CONFIRMED', label: 'Financial Terms' },
  { key: 'PAYMENT_IN_PROGRESS', label: 'Transactions' },
  { key: 'COMPLETED', label: 'Completed' },
];

const ORDER = {
  DRAFT: 0,
  LAND_DETAILS: 1,
  AGREEMENT_PENDING: 1,
  AGREEMENT_COMPLETED: 2,
  FINANCIAL_TERMS_CONFIRMED: 3,
  PAYMENT_IN_PROGRESS: 4,
  FULLY_PAID: 4,
  COMPLETED: 5,
};

export const progressIndex = (status) => ORDER[String(status || '').toUpperCase()] ?? 0;

export const readable = (value, fallback = 'Not recorded') => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value).toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export const money = (value, compact = false) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '₹0';
  if (compact) {
    if (Math.abs(number) >= 10_000_000) return `₹${(number / 10_000_000).toFixed(number % 10_000_000 ? 2 : 0)} Cr`;
    if (Math.abs(number) >= 100_000) return `₹${(number / 100_000).toFixed(number % 100_000 ? 1 : 0)}L`;
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(number);
};

export const dateLabel = (value, fallback = 'Not recorded') => {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
};

export const dateTimeLabel = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(parsed);
};

export const initials = (name) => String(name || 'Landowner')
  .split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'LA';

export const statusTone = (status) => {
  const value = String(status || '').toUpperCase();
  if (['COMPLETED', 'FULLY_PAID', 'EXECUTED', 'PAID', 'APPROVED'].includes(value)) return 'positive';
  if (['OVERDUE', 'CANCELLED', 'REJECTED', 'BOUNCED', 'RETURNED'].includes(value)) return 'negative';
  if (['DRAFT', 'PENDING', 'AGREEMENT_PENDING', 'PARTIALLY_PAID', 'PAYMENT_IN_PROGRESS', 'REVIEW_REQUIRED'].includes(value)) return 'attention';
  if (['LAND_DETAILS', 'AGREEMENT_COMPLETED', 'FINANCIAL_TERMS_CONFIRMED'].includes(value)) return 'info';
  return 'neutral';
};

export const areaLabel = (acquisition) => {
  const amount = Number(acquisition?.land_size_bigha);
  if (!Number.isFinite(amount) || amount <= 0) return 'Land area not recorded';
  return `${amount.toLocaleString('en-IN', { maximumFractionDigits: 4 })} ${readable(acquisition.land_size_unit || 'BIGHA')}`;
};

export const apiMessage = (error, fallback) => error?.response?.data?.message || fallback;

