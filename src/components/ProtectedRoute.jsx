import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSitePolicy } from '../hooks/useSitePolicy';
import { SITE_POLICY_STATUSES } from '../lib/sitePolicy';
import { SitePolicyBlockedRoute } from './SitePolicyDeniedDialog';

export const ProtectedRoute = ({
  children, requiredRole, requiredModule, requiredAnyModule, requiredCapability,
}) => {
  const { isAuthenticated, loading, user, hasPermission, currentSite } = useAuth();
  const sitePolicy = useSitePolicy();

  if (loading || (currentSite && sitePolicy.status === SITE_POLICY_STATUSES.LOADING)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Role-based access check (super_admin has all admin privileges)
  if (requiredRole) {
    const hasRole = user?.role === requiredRole || 
      (requiredRole === 'admin' && user?.role === 'super_admin');
    if (!hasRole) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  const anyModules = Array.isArray(requiredAnyModule) ? requiredAnyModule : [];
  const moduleDenied = (requiredModule && !hasPermission(requiredModule, 'read'))
    || (anyModules.length > 0 && !anyModules.some((module) => hasPermission(module, 'read')));
  const capabilityDenied = requiredCapability && !sitePolicy.canUseCapability(requiredCapability);
  if (moduleDenied || capabilityDenied) {
    const policyDenied = requiredModule
      ? !sitePolicy.canUseModule(requiredModule)
      : anyModules.length > 0 && anyModules.every((module) => !sitePolicy.canUseModule(module));
    const reason = policyDenied
      ? sitePolicy.explainDenial(requiredModule)
      : capabilityDenied
        ? sitePolicy.explainDenial('capability', requiredCapability)
        : 'Your account does not have permission to open this module.';
    if (policyDenied || capabilityDenied) {
      return <SitePolicyBlockedRoute message={reason} />;
    }
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-mr-canvas px-5 py-12">
        <section className="w-full max-w-lg rounded-panel border border-mr-line bg-mr-surface p-7 text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-mr-faint">Unavailable for this workspace</p>
          <h1 className="mt-2 text-[22px] font-semibold tracking-[-0.025em] text-mr-text">
            This module cannot be opened
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-mr-muted">{reason}</p>
          {currentSite?.name && <p className="mt-3 text-[12px] text-mr-faint">Selected site · {currentSite.name}</p>}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link to="/dashboard" className="inline-flex h-10 items-center rounded-full bg-mr-ink px-4 text-[13px] font-semibold text-white">Go to dashboard</Link>
            <Link to="/settings?tab=operating-profile" className="inline-flex h-10 items-center rounded-full border border-mr-line px-4 text-[13px] font-medium text-mr-text">View site profile</Link>
          </div>
        </section>
      </main>
    );
  }

  return children;
};

export default ProtectedRoute;
