import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Check, ChevronsUpDown, CircleHelp, LogOut,
  Plus, Search, SearchX, Settings, UserRound, X,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import SidebarItem from './SidebarItem';
import { buildNavigation, flattenNavigation } from './navConfig';
import BrandMark from '../BrandMark';
import { cn } from '@/lib/utils';

const FOOTER_ROW = 'group flex w-full items-center gap-2.5 rounded-control px-2.5 h-10 text-[13px] font-medium text-[#5b6270] transition-colors duration-150 hover:bg-[#f5f6f4] hover:text-[#1b1d22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-inset';

/* ── Site switcher ───────────────────────────────────────────────────
   Wraps the existing site-selection callback; it never fetches or filters
   sites itself, so a user only ever sees the sites already granted to
   them by useAuth. ── */
function SiteSwitcher({ sites, currentSite, onChange, isAdmin, collapsed }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sites;
    return sites.filter((s) => `${s.name} ${s.city || ''}`.toLowerCase().includes(q));
  }, [sites, query]);


  const trigger = collapsed ? (
    <button
      type="button"
      aria-label={currentSite ? `Current site: ${currentSite.name}` : 'Select a site'}
      className="flex h-10 w-10 items-center justify-center rounded-control transition-transform duration-150 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
    >
      <BrandMark size="md" />
    </button>
  ) : (
    /* Identity row: brand mark leads, active site is the headline, so the
       sidebar spends one row on "where am I" instead of two. */
    <button
      type="button"
      className="flex w-full items-center gap-2.5 rounded-control px-2.5 py-1.5 text-left transition-colors duration-150 hover:bg-mr-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
    >
      <BrandMark size="lg" />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[13.5px] font-semibold tracking-[-0.01em] text-[#1b1d22]">
          {currentSite?.name || 'Select site'}
        </span>
        <span className="block truncate text-[11.5px] text-mr-faint">MountReality</span>
      </span>
      <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-mr-faint" strokeWidth={2} aria-hidden="true" />
    </button>
  );

  const body = (
    <PopoverContent side={collapsed ? 'right' : 'bottom'} align="start" sideOffset={8} className="w-64 rounded-panel-sm border-mr-line p-0">
      <div className="border-b border-mr-line p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mr-faint" strokeWidth={1.9} aria-hidden="true" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sites…"
            aria-label="Search sites"
            className="h-9 w-full rounded-full border border-mr-line bg-mr-surface-2 pl-8 pr-3 text-[13px] outline-none transition-colors focus:border-mr-blue focus:bg-mr-surface"
          />
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto p-1.5">
        {matches.length === 0 ? (
          <p className="px-2.5 py-6 text-center text-[12px] text-mr-muted">No sites match “{query.trim()}”.</p>
        ) : matches.map((site) => {
          const selected = String(site.id) === String(currentSite?.id);
          return (
            <button
              key={site.id}
              type="button"
              onClick={() => { onChange(String(site.id)); setOpen(false); setQuery(''); }}
              aria-current={selected ? 'true' : undefined}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue',
                selected ? 'bg-mr-blue-soft' : 'hover:bg-[#f5f6f4]',
              )}
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #2f6bff 0%, #50ddeb 100%)' }}
              >
                {site.name?.charAt(0)?.toUpperCase() || 'S'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-[#1b1d22]">{site.name}</span>
                {site.city && <span className="block truncate text-[12px] text-mr-faint">{site.city}</span>}
              </span>
              {site.status && (
                <span className="shrink-0 text-[11px] text-mr-faint">{site.status}</span>
              )}
              {selected && <Check className="h-4 w-4 shrink-0 text-mr-blue" strokeWidth={2.2} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      {isAdmin && (
        <div className="border-t border-mr-line p-1.5">
          <button
            type="button"
            onClick={() => { onChange('__add_site__'); setOpen(false); }}
            className="flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-[13px] font-medium text-mr-muted transition-colors hover:bg-[#f5f6f4] hover:text-[#1b1d22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
          >
            <Plus className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" /> Manage sites
          </button>
        </div>
      )}
    </PopoverContent>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {collapsed ? (
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild><PopoverTrigger asChild>{trigger}</PopoverTrigger></TooltipTrigger>
          <TooltipContent side="right" className="bg-mr-ink text-white">{currentSite?.name || 'Select site'}</TooltipContent>
        </Tooltip>
      ) : <PopoverTrigger asChild>{trigger}</PopoverTrigger>}
      {body}
    </Popover>
  );
}

/* ── Navigation search ───────────────────────────────────────────────
   Reads the same permission-filtered structure the nav renders, so a
   route the user cannot open can never appear as a result. */
function SearchResults({ items, query, onPick }) {
  if (!query.trim()) return null;
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-3 py-8">
        <SearchX className="h-5 w-5 text-mr-faint" strokeWidth={1.75} aria-hidden="true" />
        <p className="text-center text-[12px] text-mr-muted">No modules match “{query.trim()}”.</p>
      </div>
    );
  }
  return (
    <div className="space-y-0.5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.path}
            type="button"
            onClick={() => onPick(item.path)}
            className="flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left transition-colors duration-150 hover:bg-[#f5f6f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
          >
            <Icon className="h-4 w-4 shrink-0 text-mr-muted" strokeWidth={1.9} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-[#1b1d22]">{item.label}</span>
              <span className="block truncate text-[12px] text-mr-faint">{item.group}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Sidebar ─────────────────────────────────────────────────────────
   One component serving three presentations: expanded, collapsed rail
   and mobile drawer. `collapsed` is forced false inside the drawer, so a
   stored desktop width never leaks into the mobile experience. ── */
export default function AppSidebar({
  collapsed, user, sites, currentSite, onSiteChange, isAdmin,
  hasPermission, approvalsBadge = 0, onLogout, onNavigate, variant = 'desktop', resizeHandle,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');

  const groups = useMemo(() => buildNavigation({ hasPermission, isAdmin }), [hasPermission, isAdmin]);
  const flat = useMemo(() => flattenNavigation(groups), [groups]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return flat.filter((i) => `${i.label} ${i.group} ${i.path}`.toLowerCase().includes(q));
  }, [flat, query]);

  const canReadSettings = hasPermission('settings', 'read');
  const searching = query.trim().length > 0;

  const go = (path) => {
    navigate(path);
    setQuery('');
    onNavigate?.();
  };

  const badgeFor = (item) => (item.badge === 'approvals' ? approvalsBadge : 0);

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-mr-surface', variant === 'desktop' && 'relative')}>
      {/* ── Identity + collapse ─────────────────────────────────────────
         Brand and active site share one row; when no site is granted the
         brand mark stands in, so the row never renders empty. ── */}
      <div className={cn('flex shrink-0 items-center gap-1 px-3 pt-3 pb-2', collapsed && 'flex-col justify-center gap-2')}>
        {sites.length > 0 ? (
          <div className="min-w-0 flex-1">
            <SiteSwitcher
              sites={sites}
              currentSite={currentSite}
              onChange={onSiteChange}
              isAdmin={isAdmin}
              collapsed={collapsed}
            />
          </div>
        ) : (
          <div className={cn('flex min-w-0 flex-1 items-center gap-2.5 py-1.5', collapsed ? 'justify-center' : 'px-2.5')}>
            <BrandMark size={collapsed ? 'md' : 'lg'} />
            {!collapsed && (
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[13.5px] font-semibold tracking-[-0.01em] text-[#1b1d22]">MountReality</span>
                <span className="block truncate text-[11.5px] text-mr-faint">Management suite</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Search ── */}
      <div className={cn('shrink-0 pb-3', collapsed ? 'flex justify-center px-3' : 'px-3')}>
        {collapsed ? (
          <Popover>
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Search navigation"
                    className="flex h-10 w-10 items-center justify-center rounded-control text-[#5b6270] transition-colors duration-150 hover:bg-mr-surface-2 hover:text-[#1b1d22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
                  >
                    <Search className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-mr-ink text-white">Search navigation</TooltipContent>
            </Tooltip>
            <PopoverContent side="right" align="start" sideOffset={10} className="w-72 rounded-panel-sm border-mr-line p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mr-faint" strokeWidth={1.9} aria-hidden="true" />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Jump to a module…"
                  aria-label="Search navigation"
                  className="h-9 w-full rounded-full border border-mr-line bg-mr-surface-2 pl-8 pr-3 text-[13px] outline-none transition-colors focus:border-mr-blue focus:bg-mr-surface"
                />
              </div>
              <div className="mt-2 max-h-72 overflow-y-auto">
                <SearchResults items={results} query={query} onPick={go} />
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mr-faint" strokeWidth={1.9} aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
              placeholder="Search menu…"
              aria-label="Search navigation"
              className="h-9 w-full rounded-control bg-mr-surface-2 pl-8.5 pr-8 text-[13px] text-[#1b1d22] outline-none transition-colors placeholder:text-mr-faint focus:bg-mr-surface focus:ring-2 focus:ring-mr-blue/30"
            />
            {searching && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-mr-faint transition-colors hover:bg-mr-line hover:text-[#1b1d22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Hairline separating the identity/search header from navigation. */}
      <div className={cn('mb-2 h-px shrink-0 bg-mr-line', collapsed ? 'mx-4' : 'mx-3')} aria-hidden="true" />

      {/* ── Navigation ── */}
      <nav
        aria-label="Main navigation"
        className={cn('min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-2', collapsed ? 'flex flex-col items-center gap-1 px-3' : 'space-y-4 px-3')}
      >
        {searching && !collapsed ? (
          <SearchResults items={results} query={query} onPick={go} />
        ) : groups.map((group) => (
          <div key={group.id} className={cn(collapsed ? 'flex w-full flex-col items-center gap-1' : 'space-y-0.5')}>
            {!collapsed && (
              <p className="px-2.5 pb-1 pt-1 text-[12px] font-medium text-mr-faint">{group.label}</p>
            )}
            {collapsed && group.id !== 'core' && (
              <span className="my-1 h-px w-6 bg-mr-line" aria-hidden="true" />
            )}
            {group.items.map((item) => (
              <SidebarItem
                key={`${group.id}-${item.path}`}
                item={item}
                collapsed={collapsed}
                badgeCount={badgeFor(item)}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* ── Footer ── */}
      <div className={cn('shrink-0 border-t border-mr-line pt-2 pb-2', collapsed ? 'flex flex-col items-center gap-1 px-3' : 'space-y-0.5 px-3')}>
        {canReadSettings && (
          collapsed ? (
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => go('/settings')}
                  aria-label="Settings"
                  aria-current={location.pathname === '/settings' ? 'page' : undefined}
                  className="flex h-11 w-11 items-center justify-center rounded-control text-[#5b6270] transition-colors duration-150 hover:bg-[#f5f6f4] hover:text-[#1b1d22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
                >
                  <Settings className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-mr-ink text-white">Settings</TooltipContent>
            </Tooltip>
          ) : (
            <button type="button" onClick={() => go('/settings')} className={FOOTER_ROW}>
              <Settings className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} aria-hidden="true" />
              <span className="truncate">Settings</span>
            </button>
          )
        )}

        {/* Profile */}
        <Popover>
          <PopoverTrigger asChild>
            {collapsed ? (
              <button
                type="button"
                aria-label={`${user?.name || 'Account'} — open profile menu`}
                className="flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
              >
                {user?.photo ? (
                  <img src={user.photo} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg, #2f6bff 0%, #50ddeb 100%)' }}
                  >
                    {user?.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                )}
              </button>
            ) : (
              <button type="button" className={cn(FOOTER_ROW, 'gap-2.5')}>
                {user?.photo ? (
                  <img src={user.photo} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mr-blue-soft text-[12px] font-semibold text-mr-blue">
                    {user?.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                )}
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[13px] font-medium text-[#1b1d22]">{user?.name || 'Account'}</span>
                  <span className="block truncate text-[12px] text-mr-faint">
                    {user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : 'Sub-Admin'}
                  </span>
                </span>
                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-mr-faint" strokeWidth={2} aria-hidden="true" />
              </button>
            )}
          </PopoverTrigger>
          <PopoverContent side={collapsed ? 'right' : 'top'} align="start" sideOffset={8} className="w-60 rounded-panel-sm border-mr-line p-1.5">
            <div className="px-2.5 py-2">
              <p className="truncate text-[13px] font-semibold text-[#1b1d22]">{user?.name}</p>
              <p className="truncate text-[12px] text-mr-faint">{user?.email}</p>
            </div>
            <div className="my-1 h-px bg-mr-line" />
            <button type="button" onClick={() => go('/settings')} className={FOOTER_ROW}>
              <UserRound className="h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden="true" /> Profile
            </button>
            {canReadSettings && (
              <button type="button" onClick={() => go('/settings')} className={FOOTER_ROW}>
                <Settings className="h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden="true" /> Account settings
              </button>
            )}
            <button type="button" onClick={() => go('/terms')} className={FOOTER_ROW}>
              <CircleHelp className="h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden="true" /> Help &amp; policies
            </button>
            <div className="my-1 h-px bg-mr-line" />
            <button
              type="button"
              onClick={onLogout}
              className="group flex h-10 w-full items-center gap-2.5 rounded-control px-2.5 text-[13px] font-medium text-mr-coral-ink transition-colors duration-150 hover:bg-mr-coral-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-inset"
            >
              <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden="true" /> Sign out
            </button>
          </PopoverContent>
        </Popover>
      </div>

      {resizeHandle}
    </div>
  );
}
