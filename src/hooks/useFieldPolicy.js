import { useSitePolicy } from './useSitePolicy';

/**
 * Resolves presentation policy for a stable field identifier. The returned
 * object never mutates form values; callers continue to own all form state.
 */
export function useFieldPolicy(fieldId, defaults = {}) {
  const { getFieldPolicy } = useSitePolicy();
  return getFieldPolicy(fieldId, defaults);
}

export default useFieldPolicy;

