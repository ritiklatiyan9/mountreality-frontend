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

// No HTTP response at all means the server was unreachable (restart, sleeping
// laptop, dropped connection) — not a policy decision. Every real denial from
// this endpoint carries a message and must still fail closed immediately.
const transientError = (error) => !error?.response;

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

const RETRY_DELAYS = [600, 1800];   // ~2.4s of cover for a server restart
const RECOVERY_POLL_MS = 5000;      // keep probing while the app is blocked

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
  const verifiedPolicyBySite = useRef(new Map());

  const siteId = currentSite?.id === null || currentSite?.id === undefined
    ? null
    : String(currentSite.id);
  const revisionHint = currentSite?.policy_revision ?? currentSite?.policyRevision ?? null;

  const loadPolicy = useCallback(async (targetSiteId, { force = false, revision = null, background = false } = {}) => {
    if (!targetSiteId) return null;

    activeController.current?.abort();
    activeController.current = null;
    const sequence = ++requestSequence.current;
    const safePolicy = createSafeSitePolicy(targetSiteId);
    const retainedPolicy = verifiedPolicyBySite.current.get(String(targetSiteId)) || null;

    // Never carry another Site's policy across a switch. When refreshing the
    // same Site, retain its last verified policy while the route is blocked in
    // the loading state so a failed refresh cannot silently become generic.
    // A background retry leaves the current screen alone until it resolves.
    if (!background) {
      setState({
        ...(retainedPolicy || safePolicy),
        status: SITE_POLICY_STATUSES.LOADING,
        error: null,
      });
    }

    if (!force && revision !== null && revision !== undefined && revision !== '') {
      const cached = getCachedSitePolicy(targetSiteId, revision);
      if (cached && sequence === requestSequence.current) {
        verifiedPolicyBySite.current.set(String(targetSiteId), cached);
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
      // Ride out a brief outage — an API restart mid-navigation should not
      // blank the workspace. Anything the server actually answered is final.
      let data;
      for (let attempt = 0; ; attempt += 1) {
        try {
          ({ data } = await api.get('/settings/site-policy', {
            params: { site_id: targetSiteId },
            signal: controller.signal,
          }));
          break;
        } catch (error) {
          if (attempt >= RETRY_DELAYS.length || !transientError(error) || cancellationError(error)) throw error;
          await sleep(RETRY_DELAYS[attempt]);
          if (sequence !== requestSequence.current) return null;
        }
      }

      if (sequence !== requestSequence.current) return null;

      const normalized = cacheSitePolicy(normalizeSitePolicy(data, targetSiteId));
      verifiedPolicyBySite.current.set(String(targetSiteId), normalized);
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

      // Preserve the last verified same-Site policy for correct labels and
      // mode detection, but mark it errored so protected routes fail closed.
      setState((current) => (
        // A failed background probe changes nothing — returning the same state
        // keeps React from re-rendering the app on every recovery tick.
        background && current.status === SITE_POLICY_STATUSES.ERROR
          ? current
          : {
            ...(retainedPolicy || safePolicy),
            status: SITE_POLICY_STATUSES.ERROR,
            error: readableError(error),
          }
      ));
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

  // Once blocked, keep probing in the background so the workspace comes back on
  // its own the moment the API does. Without this a 3-second restart strands
  // every route behind the blocked screen until someone finds the Retry button.
  useEffect(() => {
    if (!siteId || state.status !== SITE_POLICY_STATUSES.ERROR) return undefined;
    const retry = () => {
      if (document.visibilityState === 'visible') loadPolicy(siteId, { force: true, background: true });
    };
    const timer = setInterval(retry, RECOVERY_POLL_MS);
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', retry);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', retry);
    };
  }, [loadPolicy, siteId, state.status]);

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
