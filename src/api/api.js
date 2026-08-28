import axios from 'axios';
import { toast } from 'sonner';
import eventBus from '../utils/eventBus';
import { resetThemeToWhite } from '../lib/appearance';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
});

let refreshPromise = null;

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    const sessionId = localStorage.getItem('sessionId');
    // The selected Site is part of every site-scoped authorization decision.
    // Keep this as an ID (rather than trusting a cached Site object) so the
    // backend can intersect RBAC with the currently published site policy.
    let currentSiteId = localStorage.getItem('currentSiteId');
    if (!currentSiteId) {
      try {
        currentSiteId = JSON.parse(localStorage.getItem('currentSite') || 'null')?.id;
      } catch {
        currentSiteId = null;
      }
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (sessionId) {
      config.headers['X-Session-ID'] = sessionId;
    }
    if (currentSiteId && !config.headers['X-Site-ID']) {
      config.headers['X-Site-ID'] = String(currentSiteId);
    }
    const method = String(config.method || 'get').toLowerCase();
    if (['post', 'put', 'patch'].includes(method) && !config.headers['X-Idempotency-Key']) {
      config.headers['X-Idempotency-Key'] = crypto.randomUUID();
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Emit data-mutated event on any successful non-GET request (skip auth/upload-only/search)
api.interceptors.response.use(
  (response) => {
    const method = (response.config.method || '').toLowerCase();
    if (method !== 'get') {
      const url = response.config.url || '';
      const skip = /\/auth\/|\/upload\/|\/search|\/push-tokens/i.test(url);
      if (!skip) {
        eventBus.emit('data-mutated', { method, url });
      }
    }
    return response;
  },
);

// Add response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('sessionId');
          resetThemeToWhite();
          window.location.href = '/login';
          return Promise.reject(error);
        }

        // Avoid parallel refresh calls (race condition can invalidate tokens unexpectedly).
        if (!refreshPromise) {
          refreshPromise = axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken })
            .finally(() => {
              refreshPromise = null;
            });
        }

        const response = await refreshPromise;

        const { accessToken, refreshToken: newRefreshToken, sessionId } = response.data;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);
        if (sessionId) localStorage.setItem('sessionId', String(sessionId));

        api.defaults.headers.Authorization = `Bearer ${accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        if (sessionId) originalRequest.headers['X-Session-ID'] = String(sessionId);

        return api(originalRequest);
      } catch (err) {
        // A refresh request can fail because the API/database is temporarily
        // unavailable. That is not proof that the session is invalid, so keep
        // the tokens and let the next request retry. Only an explicit auth
        // rejection is allowed to sign the user out.
        const refreshStatus = err?.response?.status;
        if ([400, 401, 403].includes(refreshStatus)) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('sessionId');
          resetThemeToWhite();
          window.location.href = '/login';
        } else {
          toast.error('The server is temporarily unavailable. Your session has been kept.');
        }
        return Promise.reject(err);
      }
    }

    if (error.response?.status === 403) {
      const denial = error.response?.data;
      if (denial?.code === 'SITE_POLICY_DENIED') {
        eventBus.emit('site-policy-denied', {
          message: denial.message,
          requestUrl: originalRequest?.url,
        });
      } else {
        toast.error(denial?.message || 'You do not have permission for this action.');
      }
    }

    // SaaS: no active subscription — send the user to the plan/payment page.
    if (error.response?.status === 402) {
      const path = window.location.pathname;
      if (!path.startsWith('/subscription') && !path.startsWith('/signup')) {
        window.location.href = '/subscription';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
