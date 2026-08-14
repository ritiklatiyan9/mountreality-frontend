import api from '@/api/api';

export const REGISTRY_WORKFLOW_STEPS = Object.freeze([
  { status: 'NOT_READY', label: 'Readiness' },
  { status: 'READY', label: 'Ready' },
  { status: 'SCHEDULED', label: 'Scheduled' },
  { status: 'DOCUMENTS_READY', label: 'Documents' },
  { status: 'EXECUTED', label: 'Executed' },
  { status: 'COMPLETE', label: 'Complete' },
]);

const NEXT_STATUS = Object.freeze({
  NOT_READY: 'READY',
  READY: 'SCHEDULED',
  SCHEDULED: 'DOCUMENTS_READY',
  DOCUMENTS_READY: 'EXECUTED',
  EXECUTED: 'COMPLETE',
});

export const getNextRegistryStatus = (status) => NEXT_STATUS[String(status || '').toUpperCase()] || null;

export const registryStatusIndex = (status) => REGISTRY_WORKFLOW_STEPS.findIndex(
  (step) => step.status === String(status || '').toUpperCase(),
);

/**
 * The single client entry point for Registry lifecycle changes. Customer &
 * Inventory and Project Registries both call the canonical Registry resource,
 * send the version they rendered, and receive the authoritative next record.
 */
export async function advanceRegistry(registry, targetStatus = null) {
  if (!registry?.id) throw new Error('A registry is required');
  const status = targetStatus || getNextRegistryStatus(registry.lifecycle_status);
  if (!status) return { registry, idempotent: true };

  const { data } = await api.patch(`/registries/${registry.id}/status`, {
    status,
    expected_version: registry.workflow_version || undefined,
    ...(status === 'SCHEDULED' ? { scheduled_at: new Date().toISOString() } : {}),
  });
  return data;
}

export function registryActionError(error) {
  const payload = error?.response?.data;
  if (payload?.code === 'REGISTRY_VERSION_CONFLICT') {
    return 'This registry changed in another session. Its latest status has been reloaded.';
  }
  if (payload?.code === 'REGISTRY_NOT_READY' && Array.isArray(payload?.details?.checks)) {
    const missing = payload.details.checks
      .filter((check) => check.required && !check.passed)
      .map((check) => check.label)
      .filter(Boolean);
    return missing.length
      ? `Complete these readiness checks first: ${missing.join(', ')}.`
      : payload.message;
  }
  if (payload?.message && payload.message !== 'An unexpected server error occurred') return payload.message;
  return payload?.requestId
    ? `Registry action failed. Reference ${payload.requestId}; no data was changed.`
    : 'Registry action could not be completed. No data was changed.';
}
