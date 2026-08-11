import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/api';
import { useAuth } from './AuthContext';
import {
  SITE_POLICY_MODES,
  SITE_POLICY_STATUSES,
  cacheSitePolicy,
  clearSitePolicyCache,
  createSafeSitePolicy,
  explainPolicyDenial,
  getCachedSitePolicy,
  isCapabilityEnabled,
  isModuleEnabled,
  normalizeSitePolicy,
  resolveFieldPolicy,
  resolveTerm,
} from '../lib/sitePolicy';

const SitePolicyContext = import.meta.hot?.data.sitePolicyContext ?? createContext(null);

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.sitePolicyContext = SitePolicyContext;
  });
}

const initialState = {
  ...createSafeSitePolicy(),
  status: SITE_POLICY_STATUSES.IDLE,
  error: null,
};

const cancellationError = (error) => (
  error?.code === 'ERR_CANCELED'
  || error?.name === 'CanceledError'
  || error?.name === 'AbortError'
);

const readableError = (error) => {
  const serverMessage = error?.response?.data?.message;
  return typeof serverMessage === 'string' && serverMessage.trim()
    ? serverMessage.trim()
    : 'The selected site settings could not be loaded.';
};

export function SitePolicyProvider({ children }) {
  const { currentSite, applySiteAuthorization } = useAuth();
  const [state, setState] = useState(initialState);
  const requestSequence = useRef(0);
  const activeController = useRef(null);

  const siteId = currentSite?.id === null || currentSite?.id === undefined
    ? null
    : String(currentSite.id);
  const revisionHint = currentSite?.policy_revision ?? currentSite?.policyRevision ?? null;

  const loadPolicy = useCallback(async (targetSiteId, { force = false, revision = null } = {}) => {
    if (!targetSiteId) return null;

    activeController.current?.abort();
    activeController.current = null;
    const sequence = ++requestSequence.current;
    const safePolicy = createSafeSitePolicy(targetSiteId);

    // Remove the previous site's policy before consulting cache or network.
    setState({
      ...safePolicy,
      status: SITE_POLICY_STATUSES.LOADING,
      error: null,
    });

    if (!force && revision !== null && revision !== undefined && revision !== '') {
      const cached = getCachedSitePolicy(targetSiteId, revision);
      if (cached && sequence === requestSequence.current) {
        setState({
          ...cached,
          status: cached.mode === SITE_POLICY_MODES.LEGACY
            ? SITE_POLICY_STATUSES.LEGACY
            : SITE_POLICY_STATUSES.READY,
          error: null,
        });
        return cached;
      }
    }

    const controller = new AbortController();
    activeController.current = controller;

    try {
      const { data } = await api.get('/settings/site-policy', {
        params: { site_id: targetSiteId },
        signal: controller.signal,
      });

      if (sequence !== requestSequence.current) return null;

      const normalized = cacheSitePolicy(normalizeSitePolicy(data, targetSiteId));
      setState({
        ...normalized,
        status: normalized.mode === SITE_POLICY_MODES.LEGACY
          ? SITE_POLICY_STATUSES.LEGACY
          : SITE_POLICY_STATUSES.READY,
        error: null,
      });
      return normalized;
    } catch (error) {
      if (cancellationError(error) || sequence !== requestSequence.current) return null;

      // Safe fallback preserves established operational screens. Policy-only
      // modules and capabilities remain denied by the pure access resolvers.
      setState({
        ...safePolicy,
        status: SITE_POLICY_STATUSES.ERROR,
        error: readableError(error),
      });
      return null;
    } finally {
      if (activeController.current === controller) activeController.current = null;
    }
  }, []);

  useEffect(() => {
    if (!siteId) {
      activeController.current?.abort();
      activeController.current = null;
      requestSequence.current += 1;
      setState(initialState);
      return undefined;
    }

    loadPolicy(siteId, { revision: revisionHint });
    return () => activeController.current?.abort();
  }, [loadPolicy, revisionHint, siteId]);

  useEffect(() => {
    applySiteAuthorization({
      siteId: state.siteId,
      mode: state.mode,
      modules: state.modules,
      modulesDeclared: state.modulesDeclared,
    });
  }, [applySiteAuthorization, state.mode, state.modules, state.modulesDeclared, state.siteId]);

  const refreshPolicy = useCallback(() => {
    if (!siteId) return Promise.resolve(null);
    clearSitePolicyCache(siteId);
    return loadPolicy(siteId, { force: true });
  }, [loadPolicy, siteId]);

  const canUseModule = useCallback(
    (moduleKey) => isModuleEnabled(state, moduleKey),
    [state],
  );

  const canUseCapability = useCallback(
    (capabilityKey) => isCapabilityEnabled(state, capabilityKey),
    [state],
  );

  const getTerm = useCallback(
    (termKey, fallback) => resolveTerm(state, termKey, fallback),
    [state],
  );

  const getFieldPolicy = useCallback(
    (fieldId, defaults) => resolveFieldPolicy(state, fieldId, defaults),
    [state],
  );

  const explainDenial = useCallback((kindOrKey, maybeKey) => {
    const kind = maybeKey === undefined ? 'module' : kindOrKey;
    const key = maybeKey === undefined ? kindOrKey : maybeKey;
    return explainPolicyDenial(state, kind, key, state.status);
  }, [state]);

  const value = useMemo(() => ({
    ...state,
    policy: state,
    isLegacy: state.status === SITE_POLICY_STATUSES.LEGACY,
    isReady: state.status === SITE_POLICY_STATUSES.READY,
    canUseModule,
    canUseCapability,
    getTerm,
    getFieldPolicy,
    explainDenial,
    refreshPolicy,
  }), [
    canUseCapability,
    canUseModule,
    explainDenial,
    getFieldPolicy,
    getTerm,
    refreshPolicy,
    state,
  ]);

  return (
    <SitePolicyContext.Provider value={value}>
      {children}
    </SitePolicyContext.Provider>
  );
}

export { SitePolicyContext };
export default SitePolicyContext;
