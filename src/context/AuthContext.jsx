/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/api';
import { isPolicyOnlyKey, SITE_POLICY_MODES } from '../lib/sitePolicy';
import { resetThemeToWhite } from '../lib/appearance';

// Keep the same context object during Vite hot updates. Without this, an already
// rendered provider can retain the previous context while a reloaded consumer
// (for example ProtectedRoute) reads a newly-created one.
const AuthContext = import.meta.hot?.data.authContext ?? createContext(null);

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.authContext = AuthContext;
  });
}
const INACTIVITY_TIMEOUT = 7 * 24 * 60 * 60 * 1000;
const INACTIVITY_CHECK_INTERVAL = 60 * 1000; // poll instead of one long setTimeout (its delay is capped at ~24.8 days)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [sites, setSites] = useState([]);
  const [currentSite, setCurrentSiteState] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [portalMemberships, setPortalMemberships] = useState([]);
  const [siteAuthorization, setSiteAuthorization] = useState({ siteId: null, mode: null, modules: null, modulesDeclared: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch current user + sites from /auth/me
  const fetchMe = useCallback(async () => {
    try {
      const response = await api.get('/auth/me');
      const { user: userData, organization: org, sites: userSites, permissions: userPerms, portalMemberships: memberships } = response.data;

      setUser(userData);
      setOrganization(org || null);
      setSites(userSites || []);
      localStorage.setItem('user', JSON.stringify(userData));
      if (org) localStorage.setItem('organization', JSON.stringify(org)); else localStorage.removeItem('organization');
      localStorage.setItem('sites', JSON.stringify(userSites || []));
      setPortalMemberships(memberships || []);
      localStorage.setItem('portalMemberships', JSON.stringify(memberships || []));

      if (userPerms) {
        setPermissions(userPerms);
        localStorage.setItem('permissions', JSON.stringify(userPerms));
      }

      // Resolve the selected ID against the freshly authorised site list. The
      // older build stored a whole Site object; accept it once for migration,
      // but never restore that stale object directly.
      let selectedId = localStorage.getItem('currentSiteId');
      if (!selectedId) {
        try {
          selectedId = JSON.parse(localStorage.getItem('currentSite') || 'null')?.id;
        } catch {
          selectedId = null;
        }
      }
      const selected = (userSites || []).find((site) => String(site.id) === String(selectedId))
        || userSites?.[0]
        || null;
      setCurrentSiteState(selected);
      if (selected) {
        localStorage.setItem('currentSiteId', String(selected.id));
        localStorage.setItem('currentSite', JSON.stringify(selected));
      } else {
        localStorage.removeItem('currentSiteId');
        localStorage.removeItem('currentSite');
      }
    } catch (err) {
      console.error('Failed to fetch user data:', err);
      const status = err?.response?.status;
      // A 403 means the authenticated user cannot perform that operation; it
      // must never destroy an otherwise valid session. Only a confirmed 401
      // from /auth/me is an authentication failure.
      if (status === 401) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('sessionId');
        localStorage.removeItem('user');
        localStorage.removeItem('sites');
        localStorage.removeItem('currentSite');
        localStorage.removeItem('currentSiteId');
        localStorage.removeItem('permissions');
        localStorage.removeItem('portalMemberships');
        resetThemeToWhite();
        setUser(null);
        setSites([]);
        setCurrentSiteState(null);
        setPermissions([]);
        setPortalMemberships([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Restore session on mount
  useEffect(() => {
    const initAuth = async () => {
      const accessToken = localStorage.getItem('accessToken');
      const sessionId = localStorage.getItem('sessionId');
      const userData = localStorage.getItem('user');
      const sitesData = localStorage.getItem('sites');
      const activeSiteId = localStorage.getItem('currentSiteId');
      const activeSite = localStorage.getItem('currentSite');
      const permsData = localStorage.getItem('permissions');
      const portalMembershipData = localStorage.getItem('portalMemberships');

      if (accessToken) {
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        // Set sessionId in headers if it exists
        if (sessionId) {
          api.defaults.headers.common['X-Session-ID'] = sessionId;
        }

        try {
          if (userData) {
            setUser(JSON.parse(userData));
          }
          if (sitesData) {
            setSites(JSON.parse(sitesData));
          }
          if (activeSiteId && sitesData) {
            const restoredSites = JSON.parse(sitesData);
            setCurrentSiteState(restoredSites.find((site) => String(site.id) === String(activeSiteId)) || null);
          } else if (activeSite) {
            // One-release compatibility path for the previous storage shape.
            const legacySite = JSON.parse(activeSite);
            const restoredSites = sitesData ? JSON.parse(sitesData) : [];
            setCurrentSiteState(restoredSites.find((site) => String(site.id) === String(legacySite?.id)) || null);
          }
          if (permsData) {
            setPermissions(JSON.parse(permsData));
          }
          if (portalMembershipData) setPortalMemberships(JSON.parse(portalMembershipData));
          // Fetch latest details (including permissions) from backend so they are up-to-date
          await fetchMe();
        } catch (err) {
          // fetchMe already handles clearing state and local storage on error
          console.error('Error during initial auth fetchMe:', err);
        }
      } else {
        setLoading(false);
      }
    };

    initAuth();
    return undefined;
  }, [fetchMe]);

  // Permission edits take effect on the backend immediately. Refresh a
  // sub-admin's local route/action guards while the session stays open so
  // grants and revocations do not require a logout or manual reload.
  useEffect(() => {
    if (user?.role !== 'sub_admin') return undefined;
    let lastRefresh = 0;
    const refreshAuthorization = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastRefresh < 5000) return;
      lastRefresh = Date.now();
      void fetchMe();
    };
    const interval = setInterval(refreshAuthorization, 60 * 1000);
    window.addEventListener('focus', refreshAuthorization);
    document.addEventListener('visibilitychange', refreshAuthorization);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refreshAuthorization);
      document.removeEventListener('visibilitychange', refreshAuthorization);
    };
  }, [fetchMe, user?.role]);


  const setCurrentSite = (site) => {
    // Never carry the previous Site's effective module policy into the next
    // Site, even for one render while its policy request is in flight.
    setSiteAuthorization({ siteId: site?.id ? String(site.id) : null, mode: null, modules: null, modulesDeclared: false });
    setCurrentSiteState(site);
    if (site) {
      localStorage.setItem('currentSiteId', String(site.id));
      localStorage.setItem('currentSite', JSON.stringify(site));
    } else {
      localStorage.removeItem('currentSiteId');
      localStorage.removeItem('currentSite');
    }
  };

  // Password and Google sign-in return the same session payload.
  const applyLoginData = (data) => {
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    if (data.sessionId) {
      localStorage.setItem('sessionId', data.sessionId);
    } else {
      localStorage.removeItem('sessionId');
    }

    api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
    if (data.sessionId) {
      api.defaults.headers.common['X-Session-ID'] = data.sessionId;
    } else {
      delete api.defaults.headers.common['X-Session-ID'];
    }

    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('sites', JSON.stringify(data.sites || []));
    localStorage.setItem('portalMemberships', JSON.stringify(data.portalMemberships || []));

    if (data.permissions) {
      localStorage.setItem('permissions', JSON.stringify(data.permissions));
      setPermissions(data.permissions);
    }

    setUser(data.user);
    setOrganization(data.organization || null);
    if (data.organization) localStorage.setItem('organization', JSON.stringify(data.organization));
    setSites(data.sites || []);
    setPortalMemberships(data.portalMemberships || []);

    // Auto-select first site
    if (data.sites?.length > 0) {
      setCurrentSite(data.sites[0]);
    }

    return data.user;
  };

  // SaaS self-signup: creates the company + its super_admin and signs in immediately.
  const signup = async (payload) => {
    try {
      setError(null);
      setLoading(true);
      const { data } = await api.post('/auth/signup', payload);
      return applyLoginData(data);
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Signup failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      setLoading(true);

      const { data } = await api.post('/auth/login', { email, password });
      return applyLoginData(data);
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Login failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Sign in with Google — `credential` is the Firebase ID token from the popup.
  const loginWithGoogle = async (credential) => {
    try {
      setError(null);
      setLoading(true);
      const { data } = await api.post('/auth/google', { credential });
      return applyLoginData(data);
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Google sign-in failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      const sessionId = localStorage.getItem('sessionId');
      if (sessionId) {
        await api.post('/auth/logout', { sessionId });
      } else {
        await api.post('/auth/logout');
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('sessionId');
      localStorage.removeItem('user');
      localStorage.removeItem('sites');
      localStorage.removeItem('currentSite');
      localStorage.removeItem('currentSiteId');
      localStorage.removeItem('permissions');
      localStorage.removeItem('portalMemberships');
      resetThemeToWhite();

      delete api.defaults.headers.common['Authorization'];
      delete api.defaults.headers.common['X-Session-ID']; // Remove sessionId header
      setUser(null);
      setSites([]);
      setCurrentSiteState(null);
      setPermissions([]);
      setPortalMemberships([]);
      setSiteAuthorization({ siteId: null, mode: null, modules: null, modulesDeclared: false });
      setLoading(false);
    }
  };

  // Match the maximum refresh-session lifetime.
  const lastActivityRef = useRef(Date.now());
  const resetInactivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!user) return;
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const handler = () => resetInactivityTimer();
    events.forEach((e) => window.addEventListener(e, handler));
    resetInactivityTimer();

    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= INACTIVITY_TIMEOUT) {
        logout();
      }
    }, INACTIVITY_CHECK_INTERVAL);

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      clearInterval(interval);
    };
  }, [user, resetInactivityTimer]);

  const updateProfile = async (formData) => {
    try {
      setError(null);
      setLoading(true);

      // Let Axios/browser add the multipart boundary for FormData.
      const response = await api.put('/auth/profile', formData);

      const updatedUser = response.data.user;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      return updatedUser;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Profile update failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Refresh sites list (after creating/updating sites)
  const refreshSites = async () => {
    try {
      const response = await api.get('/sites');
      const newSites = response.data.sites || [];
      setSites(newSites);
      localStorage.setItem('sites', JSON.stringify(newSites));

      // If current site was deleted, reset
      if (currentSite && !newSites.find(s => s.id === currentSite.id)) {
        if (newSites.length > 0) {
          setCurrentSite(newSites[0]);
        } else {
          setCurrentSite(null);
        }
      } else if (currentSite) {
        // Keep names/status/profile hints fresh without changing selection.
        const refreshed = newSites.find((site) => site.id === currentSite.id);
        if (refreshed) setCurrentSite(refreshed);
      }

      return newSites;
    } catch (err) {
      console.error('Failed to refresh sites:', err);
    }
  };

  // SitePolicyProvider publishes its normalized gate here. Keeping the final
  // permission intersection in this existing helper means every current
  // consumer (sidebar, launcher, quick entry, dashboard and action buttons)
  // receives the same profile-aware result without parallel permission APIs.
  const applySiteAuthorization = useCallback((policy) => {
    setSiteAuthorization({
      siteId: policy?.siteId ? String(policy.siteId) : null,
      mode: policy?.mode || null,
      modules: policy?.modules || null,
      modulesDeclared: policy?.modulesDeclared === true,
    });
  }, []);

  // Permission helper: user grant AND selected Site policy must both allow it.
  const hasPermission = useCallback((module, action) => {
    const selectedSiteId = currentSite?.id ? String(currentSite.id) : null;
    const gateMatchesSite = selectedSiteId && siteAuthorization.siteId === selectedSiteId;
    // The profile control plane must remain reachable so an administrator can
    // configure a legacy Site that does not yet have a published profile.
    const isProfileControlPlane = module === 'operating_profile';
    let siteAllows = isProfileControlPlane || !isPolicyOnlyKey(module);
    if (gateMatchesSite && siteAuthorization.mode === SITE_POLICY_MODES.LEGACY) {
      siteAllows = isProfileControlPlane || !isPolicyOnlyKey(module);
    } else if (!isProfileControlPlane && gateMatchesSite && siteAuthorization.mode === SITE_POLICY_MODES.PROFILE) {
      if (Object.prototype.hasOwnProperty.call(siteAuthorization.modules || {}, module)) {
        siteAllows = siteAuthorization.modules[module] === true;
      } else if (siteAuthorization.modulesDeclared) {
        siteAllows = false;
      }
    }
    if (!siteAllows) return false;

    // Admin and super_admin always have full access
    if (user?.role === 'admin' || user?.role === 'super_admin') return true;

    // Find the permission for this module
    const perm = permissions.find(p => p.module === module);
    if (!perm) {
      // Missing or stale permission data must never open a module. The backend
      // seeds every canonical module for sub-admins and applies the same
      // fail-closed rule at the API boundary.
      return false;
    }

    return perm[`can_${action}`] === true;
  }, [currentSite?.id, permissions, siteAuthorization, user]);

  // First-login workspace-domain modal: mark seen server-side so it never
  // returns on another device, and flip the local user immediately.
  const dismissDomainIntro = useCallback(() => {
    setUser((current) => {
      if (current) {
        const next = { ...current, domain_intro_seen: true };
        localStorage.setItem('user', JSON.stringify(next));
        return next;
      }
      return current;
    });
    api.post('/auth/domain-intro-seen').catch(() => {});
  }, []);

  const value = {
    user,
    organization,
    dismissDomainIntro,
    sites,
    currentSite,
    setCurrentSite,
    permissions,
    portalMemberships,
    setPermissions,
    loading,
    error,
    login,
    signup,
    loginWithGoogle,
    logout,
    updateProfile,
    fetchMe,
    refreshSites,
    hasPermission,
    applySiteAuthorization,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin' || user?.role === 'super_admin',
    canManage: user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'sub_admin',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default AuthContext;
