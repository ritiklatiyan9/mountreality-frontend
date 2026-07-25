import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH,
} from './navConfig';

const KEY_WIDTH = 'mountreality.sidebar.width';
const KEY_COLLAPSED = 'mountreality.sidebar.collapsed';
const KEY_LAST_WIDTH = 'mountreality.sidebar.lastExpandedWidth';

const clamp = (value) => Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(value)));

/* localStorage is user-writable and survives across app versions, so every
   read is validated: a corrupt or out-of-range value falls back to the
   default rather than producing an unusable 4px sidebar. */
const readWidth = (key) => {
  try {
    const raw = Number(window.localStorage.getItem(key));
    return Number.isFinite(raw) && raw > 0 ? clamp(raw) : SIDEBAR_DEFAULT_WIDTH;
  } catch {
    return SIDEBAR_DEFAULT_WIDTH;
  }
};

const readCollapsed = () => {
  try {
    return window.localStorage.getItem(KEY_COLLAPSED) === 'true';
  } catch {
    return false;
  }
};

/* ── Sidebar preferences + drag resize ───────────────────────────────
   Width lives in a CSS variable on the shell element, not in React state,
   so a drag repaints the grid without re-rendering the dashboard — that
   is what keeps charts from reinitialising and queries from refiring.
   React state holds only the committed value, written once on pointerup. ── */
export function useSidebarPreferences(shellRef) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [width, setWidth] = useState(() => readWidth(KEY_WIDTH));
  const [dragging, setDragging] = useState(false);
  const lastExpandedRef = useRef(readWidth(KEY_LAST_WIDTH));
  const frameRef = useRef(0);
  const liveWidthRef = useRef(width);

  const applyWidth = useCallback((px) => {
    liveWidthRef.current = px;
    shellRef.current?.style.setProperty('--mr-sidebar-width', `${px}px`);
  }, [shellRef]);

  // Paint the restored preference before the first frame the user sees.
  useEffect(() => {
    applyWidth(collapsed ? SIDEBAR_COLLAPSED_WIDTH : width);
  }, [applyWidth, collapsed, width]);

  const persist = useCallback((next) => {
    try {
      window.localStorage.setItem(KEY_WIDTH, String(next));
      window.localStorage.setItem(KEY_LAST_WIDTH, String(next));
    } catch { /* Private mode or a full quota — the session still works. */ }
  }, []);

  const commitWidth = useCallback((next) => {
    const value = clamp(next);
    lastExpandedRef.current = value;
    setWidth(value);
    applyWidth(value);
    persist(value);
  }, [applyWidth, persist]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { window.localStorage.setItem(KEY_COLLAPSED, String(next)); } catch { /* optional */ }
      // Collapsing keeps the expanded width so expanding restores it.
      applyWidth(next ? SIDEBAR_COLLAPSED_WIDTH : lastExpandedRef.current);
      if (!next) setWidth(lastExpandedRef.current);
      return next;
    });
  }, [applyWidth]);

  /* Pointer drag. Movement writes straight to the CSS variable inside a
     rAF; React only hears about it once, on release. */
  const onPointerDown = useCallback((event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);

    const shell = shellRef.current;
    const originLeft = shell ? shell.getBoundingClientRect().left : 0;

    const move = (moveEvent) => {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        applyWidth(clamp(moveEvent.clientX - originLeft));
      });
    };

    const end = () => {
      cancelAnimationFrame(frameRef.current);
      setDragging(false);
      commitWidth(liveWidthRef.current);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }, [applyWidth, commitWidth, shellRef]);

  /* Keyboard resize on the separator: arrows nudge, Shift jumps,
     Home/End snap to the limits, Enter/Space toggles collapse. */
  const onKeyDown = useCallback((event) => {
    const step = event.shiftKey ? 24 : 8;
    const current = collapsed ? lastExpandedRef.current : liveWidthRef.current;
    const actions = {
      ArrowLeft: () => commitWidth(current - step),
      ArrowRight: () => commitWidth(current + step),
      Home: () => commitWidth(SIDEBAR_MIN_WIDTH),
      End: () => commitWidth(SIDEBAR_MAX_WIDTH),
      Enter: toggleCollapsed,
      ' ': toggleCollapsed,
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    if (collapsed && event.key !== 'Enter' && event.key !== ' ') toggleCollapsed();
    action();
  }, [collapsed, commitWidth, toggleCollapsed]);

  // Double-click the edge: expand if collapsed, otherwise reset to default.
  const onDoubleClick = useCallback(() => {
    if (collapsed) { toggleCollapsed(); return; }
    commitWidth(SIDEBAR_DEFAULT_WIDTH);
  }, [collapsed, commitWidth, toggleCollapsed]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  return {
    collapsed, toggleCollapsed, width, dragging,
    onPointerDown, onKeyDown, onDoubleClick,
  };
}
