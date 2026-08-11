const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

export const SITE_POLICY_MODES = Object.freeze({
  LEGACY: 'LEGACY',
  PROFILE: 'PROFILE',
});

export const SITE_POLICY_STATUSES = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  LEGACY: 'legacy',
  READY: 'ready',
  ERROR: 'error',
});

export const DEFAULT_FIELD_POLICY = Object.freeze({
  visible: true,
  label: null,
  required: false,
  readOnly: false,
  helpText: null,
  options: undefined,
  validation: undefined,
  configured: false,
});

const POLICY_ONLY_NAMESPACES = [
  'rera',
  'hrera',
  'regulatory',
  'operating_profile',
  'site_policy',
];

const normalizeKey = (value) => String(value ?? '')
  .trim()
  .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  .replace(/[\s:/-]+/g, '_')
  .replace(/\.+/g, '.')
  .toLowerCase();

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Identifies modules and capabilities that exist only after the operating
 * profile foundation is enabled. Established operational keys intentionally
 * remain outside this list so a policy service outage does not blank the app.
 */
export function isPolicyOnlyKey(value) {
  const key = normalizeKey(value);
  if (!key) return false;

  const tokens = key.split(/[._]/).filter(Boolean);
  if (tokens.includes('rera')) return true;

  return POLICY_ONLY_NAMESPACES.some((namespace) => (
    key === namespace
    || key.startsWith(`${namespace}_`)
    || key.startsWith(`${namespace}.`)
  ));
}

function readGateValue(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['enabled', 'allowed', 'active', 'on', 'true', 'yes'].includes(normalized)) return true;
    if (['disabled', 'denied', 'inactive', 'off', 'false', 'no'].includes(normalized)) return false;
    return false;
  }

  if (isObject(value)) {
    const candidates = ['enabled', 'allowed', 'active', 'visible', 'value'];
    const property = candidates.find((candidate) => hasOwn(value, candidate));
    return property ? readGateValue(value[property]) : false;
  }

  return false;
}

function gateEntryKey(entry) {
  if (!isObject(entry)) return '';
  return entry.key ?? entry.id ?? entry.module ?? entry.capability ?? entry.name ?? '';
}

function normalizeGateCollection(input) {
  const values = Object.create(null);
  const declared = Array.isArray(input) || isObject(input);

  if (Array.isArray(input)) {
    input.forEach((entry) => {
      if (typeof entry === 'string') {
        const key = normalizeKey(entry);
        if (key) values[key] = true;
        return;
      }

      const key = normalizeKey(gateEntryKey(entry));
      if (key) values[key] = readGateValue(entry);
    });
  } else if (isObject(input)) {
    Object.entries(input).forEach(([rawKey, value]) => {
      const key = normalizeKey(rawKey);
      if (key) values[key] = readGateValue(value);
    });
  }

  return { values, declared };
}

function normalizeTerminology(input) {
  const terms = Object.create(null);

  const visit = (value, prefix = '') => {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (!isObject(entry)) return;
        const key = normalizeKey(entry.key ?? entry.id ?? entry.term ?? entry.name);
        const label = entry.value ?? entry.label ?? entry.text;
        if (key && label !== null && label !== undefined && String(label).trim()) {
          terms[key] = String(label).trim();
        }
      });
      return;
    }

    if (!isObject(value)) return;

    Object.entries(value).forEach(([rawKey, nested]) => {
      const key = normalizeKey(prefix ? `${prefix}.${rawKey}` : rawKey);
      if (isObject(nested) || Array.isArray(nested)) {
        visit(nested, key);
      } else if (nested !== null && nested !== undefined && String(nested).trim()) {
        terms[key] = String(nested).trim();
      }
    });
  };

  visit(input);
  return terms;
}

const FIELD_POLICY_KEYS = new Set([
  'visible',
  'hidden',
  'enabled',
  'label',
  'required',
  'readonly',
  'readOnly',
  'read_only',
  'locked',
  'help',
  'helpText',
  'help_text',
  'description',
  'options',
  'validation',
]);

function looksLikeFieldPolicy(value) {
  if (typeof value === 'boolean' || typeof value === 'string') return true;
  if (!isObject(value)) return false;
  return Object.keys(value).some((key) => FIELD_POLICY_KEYS.has(key));
}

function normalizeFieldEntry(value) {
  if (typeof value === 'boolean') return { visible: value };
  if (typeof value === 'string') return { label: value };
  if (!isObject(value)) return {};

  const normalized = {};

  if (hasOwn(value, 'visible')) normalized.visible = Boolean(value.visible);
  else if (hasOwn(value, 'hidden')) normalized.visible = !value.hidden;
  else if (hasOwn(value, 'enabled')) normalized.visible = Boolean(value.enabled);

  if (hasOwn(value, 'label') && value.label !== null && value.label !== undefined) {
    normalized.label = String(value.label);
  }
  if (hasOwn(value, 'required')) normalized.required = Boolean(value.required);

  const readOnlyValue = value.readOnly ?? value.read_only ?? value.readonly ?? value.locked;
  if (readOnlyValue !== undefined) normalized.readOnly = Boolean(readOnlyValue);

  const helpText = value.helpText ?? value.help_text ?? value.help ?? value.description;
  if (helpText !== undefined && helpText !== null) normalized.helpText = String(helpText);

  if (hasOwn(value, 'options')) normalized.options = value.options;
  if (hasOwn(value, 'validation')) normalized.validation = value.validation;

  return normalized;
}

function normalizeFields(input) {
  const fields = Object.create(null);

  if (Array.isArray(input)) {
    input.forEach((entry) => {
      if (!isObject(entry)) return;
      const key = normalizeKey(entry.key ?? entry.id ?? entry.field ?? entry.name);
      if (key) fields[key] = normalizeFieldEntry(entry);
    });
    return fields;
  }

  const visit = (value, prefix = '') => {
    if (!isObject(value)) return;

    Object.entries(value).forEach(([rawKey, nested]) => {
      const key = normalizeKey(prefix ? `${prefix}.${rawKey}` : rawKey);
      if (!key) return;

      if (looksLikeFieldPolicy(nested)) fields[key] = normalizeFieldEntry(nested);
      else visit(nested, key);
    });
  };

  visit(input);
  return fields;
}

function normalizeReasons(input) {
  return isObject(input) || Array.isArray(input) ? input : {};
}

function policyRevisionKey(revision) {
  return revision === null || revision === undefined || revision === ''
    ? 'unversioned'
    : String(revision);
}

const POLICY_CACHE = import.meta.hot?.data.sitePolicyCache ?? new Map();

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.sitePolicyCache = POLICY_CACHE;
  });
}

const cacheKey = (siteId, revision) => `${String(siteId)}::${policyRevisionKey(revision)}`;

export function getCachedSitePolicy(siteId, revision) {
  if (siteId === null || siteId === undefined || siteId === '') return null;
  return POLICY_CACHE.get(cacheKey(siteId, revision)) ?? null;
}

export function cacheSitePolicy(policy) {
  if (!policy?.siteId) return policy;
  const key = cacheKey(policy.siteId, policy.policyRevision);
  const cached = POLICY_CACHE.get(key);
  if (cached) return cached;
  POLICY_CACHE.set(key, policy);
  return policy;
}

export function clearSitePolicyCache(siteId) {
  if (siteId === null || siteId === undefined || siteId === '') {
    POLICY_CACHE.clear();
    return;
  }

  const prefix = `${String(siteId)}::`;
  [...POLICY_CACHE.keys()].forEach((key) => {
    if (key.startsWith(prefix)) POLICY_CACHE.delete(key);
  });
}

export function createSafeSitePolicy(siteId = null) {
  return {
    siteId: siteId === null || siteId === undefined || siteId === '' ? null : String(siteId),
    mode: null,
    policyRevision: null,
    profile: null,
    modules: Object.create(null),
    modulesDeclared: false,
    capabilities: Object.create(null),
    capabilitiesDeclared: false,
    terminology: Object.create(null),
    fields: Object.create(null),
    reasons: {},
  };
}

export function normalizeSitePolicy(payload, expectedSiteId) {
  if (!isObject(payload)) throw new Error('The site policy response is not valid.');

  const siteId = payload.site_id ?? payload.siteId;
  if (siteId === null || siteId === undefined || siteId === '') {
    throw new Error('The site policy response does not identify a site.');
  }
  if (expectedSiteId !== null && expectedSiteId !== undefined
    && String(siteId) !== String(expectedSiteId)) {
    throw new Error('The site policy response belongs to a different site.');
  }

  const mode = String(payload.mode ?? '').toUpperCase();
  if (!Object.values(SITE_POLICY_MODES).includes(mode)) {
    throw new Error('The site policy response has an unsupported mode.');
  }

  const modules = normalizeGateCollection(payload.modules);
  const capabilities = normalizeGateCollection(payload.capabilities);

  return {
    siteId: String(siteId),
    mode,
    policyRevision: payload.policy_revision ?? payload.policyRevision ?? null,
    profile: isObject(payload.profile) ? payload.profile : null,
    modules: modules.values,
    modulesDeclared: modules.declared,
    capabilities: capabilities.values,
    capabilitiesDeclared: capabilities.declared,
    terminology: normalizeTerminology(payload.terminology),
    fields: normalizeFields(payload.fields),
    reasons: normalizeReasons(payload.reasons),
  };
}

function resolveGate(policy, collectionName, declaredName, key) {
  const normalizedKey = normalizeKey(key);
  if (!normalizedKey) return false;

  // LEGACY and safe fallback states are deliberately independent of the API's
  // gate collections: all established behavior stays available, while new
  // policy-only namespaces remain unavailable.
  if (!policy?.mode || policy.mode === SITE_POLICY_MODES.LEGACY) {
    return !isPolicyOnlyKey(normalizedKey);
  }

  const collection = policy?.[collectionName];
  if (collection && hasOwn(collection, normalizedKey)) return Boolean(collection[normalizedKey]);

  // A PROFILE response with a declared collection is an allow-list. Missing
  // entries are unavailable. LEGACY, loading and error states preserve all
  // established modules while withholding policy-only functionality.
  if (policy?.mode === SITE_POLICY_MODES.PROFILE && policy?.[declaredName]) return false;
  return !isPolicyOnlyKey(normalizedKey);
}

export function isModuleEnabled(policy, moduleKey) {
  return resolveGate(policy, 'modules', 'modulesDeclared', moduleKey);
}

export function isCapabilityEnabled(policy, capabilityKey) {
  return resolveGate(policy, 'capabilities', 'capabilitiesDeclared', capabilityKey);
}

export function resolveTerm(policy, termKey, fallback = termKey) {
  const key = normalizeKey(termKey);
  const value = key ? policy?.terminology?.[key] : null;
  return value === null || value === undefined || value === '' ? fallback : value;
}

export function resolveFieldPolicy(policy, fieldId, defaults = {}) {
  const key = normalizeKey(fieldId);
  const configured = key ? policy?.fields?.[key] : null;

  return {
    ...DEFAULT_FIELD_POLICY,
    ...(isObject(defaults) ? defaults : {}),
    ...(configured ?? {}),
    fieldId: fieldId ?? null,
    configured: Boolean(configured),
  };
}

function reasonText(value) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (!isObject(value)) return null;
  const candidate = value.reason ?? value.message ?? value.description;
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}

function configuredReason(policy, kind, key) {
  const reasons = policy?.reasons;
  const normalizedKey = normalizeKey(key);
  if (!reasons || !normalizedKey) return null;

  if (Array.isArray(reasons)) {
    const match = reasons.find((entry) => (
      isObject(entry)
      && normalizeKey(entry.key ?? entry.id ?? entry.name) === normalizedKey
      && (!entry.kind || normalizeKey(entry.kind) === normalizeKey(kind))
    ));
    return reasonText(match);
  }

  const sectionNames = kind === 'capability'
    ? ['capabilities', 'capability']
    : ['modules', 'module'];

  for (const sectionName of sectionNames) {
    const section = reasons[sectionName];
    if (isObject(section)) {
      const exact = Object.entries(section).find(([candidate]) => normalizeKey(candidate) === normalizedKey);
      const text = exact ? reasonText(exact[1]) : null;
      if (text) return text;
    }
  }

  const direct = Object.entries(reasons).find(([candidate]) => (
    normalizeKey(candidate) === normalizedKey
    || normalizeKey(candidate) === normalizeKey(`${kind}.${normalizedKey}`)
  ));
  return direct ? reasonText(direct[1]) : null;
}

export function explainPolicyDenial(policy, kind = 'module', key, status = SITE_POLICY_STATUSES.READY) {
  const configured = configuredReason(policy, kind, key);
  if (configured) return configured;

  if (status === SITE_POLICY_STATUSES.LOADING) {
    return 'Site settings are still loading.';
  }
  if (status === SITE_POLICY_STATUSES.ERROR) {
    return 'This feature is unavailable until the selected site settings can be loaded.';
  }
  if (policy?.mode === SITE_POLICY_MODES.LEGACY && isPolicyOnlyKey(key)) {
    return 'This feature becomes available after an operating profile is published for this site.';
  }

  return kind === 'capability'
    ? 'This action is not enabled for the selected site.'
    : 'This module is not enabled for the selected site.';
}
