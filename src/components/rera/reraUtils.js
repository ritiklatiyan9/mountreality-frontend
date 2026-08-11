export const asList = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.rows)) return value.rows;
  return [];
};

export const firstValue = (object, keys, fallback = null) => {
  for (const key of keys) {
    const value = object?.[key];
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return fallback;
};

export const recordId = (record) => firstValue(record, ['id', 'project_id', 'phase_id', 'stakeholder_id', 'approval_id']);

export const readable = (value, fallback = 'Not recorded') => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value)
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export const formatDate = (value, { withTime = false, fallback = 'Not recorded' } = {}) => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
};

export const cleanPayload = (payload) => Object.fromEntries(
  Object.entries(payload).map(([key, value]) => [key, value === '' ? null : value]),
);

/**
 * Omit explicitly hidden or server-owned values before a RERA form is sent.
 * Keeping form state intact makes an edit reversible in the UI; filtering at
 * the request boundary prevents stale hidden/read-only values from colliding
 * with backend field-policy enforcement.
 */
export const writablePolicyPayload = (
  payload,
  section,
  getFieldPolicy,
  { fieldIds = {} } = {},
) => Object.fromEntries(Object.entries(payload || {}).filter(([field]) => {
  const policyField = fieldIds[field] || field;
  const policy = getFieldPolicy?.(`${section}.${policyField}`) || {};
  return policy.visible !== false && policy.readOnly !== true;
}));
