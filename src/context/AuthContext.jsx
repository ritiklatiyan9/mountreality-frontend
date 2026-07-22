/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/api';

// Keep the same context object during Vite hot updates. Without this, an already
// rendered provider can retain the previous context while a reloaded consumer
// (for example ProtectedRoute) reads a newly-created one.
const AuthContext = import.meta.hot?.data.authContext ?? createContext(null);

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.authContext = AuthContext;
  });
}
const INACTIVITY_TIMEOUT = 49 * 24 * 60 * 60 * 1000; // 7 weeks
const INACTIVITY_CHECK_INTERVAL = 60 * 1000; // poll instead of one long setTimeout (its delay is capped at ~24.8 days)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [sites, setSites] = useState([]);
  const [currentSite, setCurrentSiteState] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch current user + sites from /auth/me
  const fetchMe = useCallback(async () => {
    try {
      const response = await api.get('/auth/me');
      const { user: userData, sites: userSites, permissions: userPerms } = response.data;

      setUser(userData);
      setSites(userSites || []);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('sites', JSON.stringify(userSites || []));

      if (userPerms) {
        setPermissions(userPerms);
        localStorage.setItem('permissions', JSON.stringify(userPerms));
      }

      // If no current site selected but sites exist, pick first
      const stored = localStorage.getItem('currentSite');
      if (!stored && userSites?.length > 0) {
        setCurrentSiteState(userSites[0]);
        localStorage.setItem('currentSite', JSON.stringify(userSites[0]));
      } else if (stored) {
        setCurrentSiteState(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Failed to fetch user data:', err);
      const status = err?.response?.status;
      // Only force logout on explicit auth failures.
      if (status === 401 || status === 403) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('sessionId');
        localStorage.removeItem('user');
        localStorage.removeItem('sites');
        localStorage.removeItem('currentSite');
        localStorage.removeItem('permissions');
        setUser(null);
        setSites([]);
        setCurrentSiteState(null);
        setPermissions([]);
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
      const activeSite = localStorage.getItem('currentSite');
      const permsData = localStorage.getItem('permissions');

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
          if (activeSite) {
            setCurrentSiteState(JSON.parse(activeSite));
          }
          if (permsData) {
            setPermissions(JSON.parse(permsData));
          }
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
    setCurrentSiteState(site);
    if (site) {
      localStorage.setItem('currentSite', JSON.stringify(site));
    } else {
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

    if (data.permissions) {
      localStorage.setItem('permissions', JSON.stringify(data.permissions));
      setPermissions(data.permissions);
    }

    setUser(data.user);
    setSites(data.sites || []);

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
      localStorage.removeItem('permissions');

      delete api.defaults.headers.common['Authorization'];
      delete api.defaults.headers.common['X-Session-ID']; // Remove sessionId header
      setUser(null);
      setSites([]);
      setCurrentSiteState(null);
      setPermissions([]);
      setLoading(false);
    }
  };

  // 7-week inactivity auto-logout
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
      }

      return newSites;
    } catch (err) {
      console.error('Failed to refresh sites:', err);
    }
  };

  // Permission helper: returns true if user has the given action for the given module
  const hasPermission = useCallback((module, action) => {
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
  }, [user, permissions]);

  const value = {
    user,
    sites,
    currentSite,
    setCurrentSite,
    permissions,
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
