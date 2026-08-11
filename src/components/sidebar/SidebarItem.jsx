import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { isItemActive } from './navConfig';
import { cn } from '@/lib/utils';

const ROW = 'group relative flex w-full items-center gap-2.5 rounded-control px-2.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-inset';
const ROW_HEIGHT = 'h-10';
const ACTIVE = 'bg-mr-blue-soft text-mr-blue-deep';
const IDLE = 'text-mr-muted hover:bg-mr-surface-2 hover:text-mr-text';

/* Labels stay on one line; a tooltip carries the full text only when the
   element is actually clipped, so short labels get no hover noise. */
function TruncatedLabel({ children }) {
  const ref = useRef(null);
  const [clipped, setClipped] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el) setClipped(el.scrollWidth > el.clientWidth);
  }, [children]);

  const label = <span ref={ref} className="min-w-0 flex-1 truncate text-left">{children}</span>;
  if (!clipped) return label;
  return (
    <Tooltip delayDuration={400}>
      <TooltipTrigger asChild>{label}</TooltipTrigger>
      <TooltipContent side="right" className="bg-mr-ink text-white">{children}</TooltipContent>
    </Tooltip>
  );
}

function Badge({ count }) {
  if (!count) return null;
  return (
    <span className="ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-mr-coral px-1 text-[11px] font-semibold leading-none text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

/* Submenu rows — shared by the inline (expanded) and floating (collapsed)
   presentations so a child looks and behaves identically in both. */
function ChildRows({ items, pathname, search, onNavigate, dense }) {
  return items.map((child) => {
    // A child path carrying a query string (e.g. a specific tab) only
    // lights up on that exact tab, not on every other tab of the same route.
    const active = child.path.includes('?') ? `${pathname}${search}` === child.path : pathname === child.path;
    const Icon = child.icon;
    return (
      <button
        key={child.path}
        type="button"
        onClick={() => onNavigate(child.path)}
        aria-current={active ? 'page' : undefined}
        className={cn(ROW, dense ? 'h-9' : ROW_HEIGHT, active ? ACTIVE : IDLE)}
      >
        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
        <TruncatedLabel>{child.label}</TruncatedLabel>
      </button>
    );
  });
}

export default function SidebarItem({ item, collapsed, badgeCount, onNavigate }) {
  const location = useLocation();
  const navigate = useNavigate();
  const active = isItemActive(item, location.pathname);
  const hasChildren = !!item.children?.length;
  const Icon = item.icon;

  /* Open state is derived, not synced: a group containing the current route
     is open by default, and a manual toggle overrides that only until the
     route changes. Avoids a setState-in-effect cascade on every navigation. */
  const [override, setOverride] = useState(null);
  const open = override?.pathname === location.pathname ? override.open : active;

  const go = (path) => {
    navigate(path);
    onNavigate?.();
  };

  /* ── Collapsed rail ── */
  if (collapsed) {
    const trigger = (
      <button
        type="button"
        aria-label={item.label}
        aria-current={active && !hasChildren ? 'page' : undefined}
        onClick={hasChildren ? undefined : () => go(item.path)}
        className={cn(
          'relative flex h-11 w-11 items-center justify-center rounded-control transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue',
          active ? ACTIVE : IDLE,
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
        {badgeCount > 0 && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-mr-coral ring-2 ring-white" aria-hidden="true" />
        )}
      </button>
    );

    // Parents open a floating panel; leaves just get a tooltip.
    if (hasChildren) {
      return (
        <Popover>
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-mr-ink text-white">{item.label}</TooltipContent>
          </Tooltip>
          <PopoverContent
            side="right"
            align="start"
            sideOffset={10}
            className="w-60 rounded-panel-sm border-mr-line p-1.5"
          >
            <p className="px-2.5 py-1.5 text-[12px] font-semibold text-mr-text">{item.label}</p>
            <div className="space-y-0.5">
              <ChildRows items={item.children} pathname={location.pathname} search={location.search} onNavigate={go} dense />
            </div>
          </PopoverContent>
        </Popover>
      );
    }

    return (
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side="right" className="bg-mr-ink text-white">
          {item.label}{badgeCount > 0 ? ` · ${badgeCount} pending` : ''}
        </TooltipContent>
      </Tooltip>
    );
  }

  /* ── Expanded ── */
  if (!hasChildren) {
    return (
      <button
        type="button"
        onClick={() => go(item.path)}
        aria-current={active ? 'page' : undefined}
        className={cn(ROW, ROW_HEIGHT, active ? ACTIVE : IDLE)}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} aria-hidden="true" />
        <TruncatedLabel>{item.label}</TruncatedLabel>
        <Badge count={badgeCount} />
      </button>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOverride({ pathname: location.pathname, open: !open })}
        aria-expanded={open}
        className={cn(ROW, ROW_HEIGHT, active && !open ? ACTIVE : IDLE)}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} aria-hidden="true" />
        <TruncatedLabel>{item.label}</TruncatedLabel>
        <ChevronRight
          className={cn('h-3.5 w-3.5 shrink-0 text-mr-faint transition-transform duration-200', open && 'rotate-90')}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5 border-l border-mr-line pl-2.5 ml-4">
          <ChildRows items={item.children} pathname={location.pathname} search={location.search} onNavigate={go} dense />
        </div>
      )}
    </div>
  );
}
