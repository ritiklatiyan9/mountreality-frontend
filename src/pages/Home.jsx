import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion as Motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  DndContext, PointerSensor, useSensor, useSensors, useDroppable, DragOverlay, closestCenter,
} from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { ALL_APPS, useVisibleApps } from '../lib/launcherModules';
import { MAC_APP_ICONS, DefaultAppIcon } from '../components/macAppIcons';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';

/* Desktop-style launcher — drag to reorder, drop-to-group, folder modal:
   menu bar + wallpaper + app grid + magnifying dock. All artwork is
   hand-crafted inline SVG (macAppIcons.jsx + the glyphs below): no icon
   library on this page and no Apple logo / Finder-face imagery.
   ponytail: layout persists in localStorage (per user, per device) — move to a
   backend user-settings endpoint if cross-device sync is ever needed. */

/* ── Muted aurora wallpaper: layered SVG ridges over soft color-field glows.
   Pure inline data-URI — no image assets, no external requests. ── */
const RIDGES = encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 900' preserveAspectRatio='xMidYMax slice'>" +
  "<defs>" +
  "<linearGradient id='w1' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#2a4f75' stop-opacity='0.42'/><stop offset='1' stop-color='#1b3153' stop-opacity='0.56'/></linearGradient>" +
  "<linearGradient id='w2' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#2f6ba6' stop-opacity='0.32'/><stop offset='1' stop-color='#0d2a45' stop-opacity='0.46'/></linearGradient>" +
  "<linearGradient id='w3' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#1f365a' stop-opacity='0.24'/><stop offset='1' stop-color='#10203b' stop-opacity='0.24'/></linearGradient>" +
  "</defs>" +
  "<path d='M0 620 C 240 540 430 710 720 630 C 1010 550 1210 690 1440 600 L1440 900 0 900 Z' fill='url(#w1)'/>" +
  "<path d='M0 715 C 300 630 570 800 860 705 C 1120 625 1300 755 1440 695 L1440 900 0 900 Z' fill='url(#w2)'/>" +
  "<path d='M0 800 C 320 725 640 865 960 790 C 1200 735 1345 815 1440 780 L1440 900 0 900 Z' fill='url(#w3)'/>" +
  "</svg>"
);
const WALLPAPER = {
  backgroundImage: [
    `url("data:image/svg+xml,${RIDGES}")`,
    'radial-gradient(1300px 840px at 82% -12%, rgba(74,133,206,0.08), transparent 64%)',
    'radial-gradient(980px 700px at 15% 8%, rgba(74,122,198,0.08), transparent 66%)',
    'radial-gradient(860px 860px at 86% 60%, rgba(106,162,232,0.05), transparent 60%)',
    'radial-gradient(120% 100% at 50% 110%, rgba(255,255,255,0.03), transparent 52%)',
    'linear-gradient(155deg, #0d1623 0%, #122138 45%, #070f1a 100%)',
  ].join(','),
  backgroundSize: 'cover, auto, auto, auto, auto, auto',
  backgroundPosition: 'center bottom, center, center, center, center, center',
  backgroundBlendMode: 'soft-light, normal, normal, normal, normal, normal',
};

/* ── Tiny hand-drawn UI glyphs (×, ✓, ✎, search, wifi, battery) — no icon
   library on this page. Stroke follows currentColor. ── */
const Glyph = ({ d, extra = null, className, sw = 2 }) => (
  <svg
    viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor"
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
  >
    <path d={d} />
    {extra}
  </svg>
);
const XGlyph = (p) => <Glyph d="M6 6l12 12M18 6L6 18" {...p} />;
const CheckGlyph = (p) => <Glyph d="M4.5 12.5l5.5 5.5L20 7" {...p} />;
const PencilGlyph = (p) => <Glyph d="M17 3.5a2.6 2.6 0 1 1 3.7 3.7L8 20 3 21.2 4.2 16.3Z" {...p} />;
const SearchGlyph = (p) => <Glyph d="m20.5 20.5-4.8-4.8" extra={<circle cx="10.5" cy="10.5" r="6.5" />} {...p} />;
const WifiGlyph = (p) => (
  <Glyph
    d="M4.5 12.2a11 11 0 0 1 15 0M8 15.6a6 6 0 0 1 8 0"
    extra={<circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" />}
    sw={1.8}
    {...p}
  />
);
const BatteryGlyph = (p) => (
  <Glyph
    d="M22 10.5v3"
    extra={(
      <>
        <rect x="2" y="7" width="17" height="10" rx="2.5" />
        <rect x="4" y="9" width="13" height="6" rx="1" fill="currentColor" stroke="none" />
      </>
    )}
    sw={1.6}
    {...p}
  />
);
/* Leaf mark for the menu bar — Defence Garden's own brand glyph. */
const LeafMark = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M20 4C11.2 4 5.6 9 5 15.9c-.07.86 0 1.7.22 2.5C10.2 19.2 20 16.2 20 4Z" />
    <path d="M4 20.5c2.8-6.2 7.8-9.9 13-11.7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/* ── One app icon: crafted SVG artwork per module (macAppIcons.jsx), grey
   squircle fallback for unmapped/future modules. ── */
function MacIcon({ app, className }) {
  const Art = MAC_APP_ICONS[app.key];
  const cls = cn('block drop-shadow-[0_6px_14px_rgba(0,0,0,0.35)]', className);
  return Art ? <Art className={cls} /> : <DefaultAppIcon icon={app.icon} className={cls} />;
}

const APP_BY_KEY = Object.fromEntries(ALL_APPS.map((a) => [a.key, a]));
const isGroup = (item) => item?.type === 'group';
const newGroupId = () => `group:${crypto.randomUUID()}`;

const LS_KEY = (uid) => `rg_home_layout_${uid || 'anon'}`;
const loadLayout = (uid) => {
  try { return JSON.parse(localStorage.getItem(LS_KEY(uid))) || null; } catch { return null; }
};
const saveLayout = (uid, layout) => {
  try { localStorage.setItem(LS_KEY(uid), JSON.stringify(layout)); } catch { /* storage full/blocked */ }
};

/* ── Reconcile the saved layout against what this user can currently see:
   newly-visible apps get appended; apps that lost visibility are dropped
   (from top level or from inside a group — dissolving groups left empty). ── */
function reconcile(savedLayout, visibleApps) {
  const visibleKeys = new Set(visibleApps.map((a) => a.key));
  const placed = new Set();
  const items = [];

  const source = Array.isArray(savedLayout) ? savedLayout : [];
  for (const entry of source) {
    if (entry?.type === 'group') {
      const kept = (entry.items || []).filter((it) => visibleKeys.has(it.key) && !placed.has(it.key));
      kept.forEach((it) => placed.add(it.key));
      if (kept.length >= 2) items.push({ id: entry.id, type: 'group', name: entry.name || 'Group', items: kept });
      else kept.forEach((it) => items.push({ id: it.key, type: 'app', key: it.key })); // dissolve 0/1-item groups
    } else if (entry?.type === 'app' && visibleKeys.has(entry.key) && !placed.has(entry.key)) {
      placed.add(entry.key);
      items.push({ id: entry.key, type: 'app', key: entry.key });
    }
  }
  // Newly-visible apps not yet anywhere in the saved layout — append in canonical order.
  for (const app of visibleApps) {
    if (!placed.has(app.key)) { placed.add(app.key); items.push({ id: app.key, type: 'app', key: app.key }); }
  }
  return items;
}

/* ── Menu bar — frosted, with live clock, like the real thing. ── */
function MenuBar({ siteName }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative z-30 flex h-7 shrink-0 items-center gap-4 border-b border-white/8 bg-white/8 px-3 text-[12px] text-white/90 backdrop-blur-2xl">
      <LeafMark className="h-3.5 w-3.5 text-white" />
      <span className="font-semibold tracking-tight">Defence Garden</span>
      <div className="hidden items-center gap-4 text-white/75 md:flex">
        {['File', 'Edit', 'View', 'Go', 'Window', 'Help'].map((m) => (
          <span key={m} className="cursor-default rounded px-1 hover:bg-white/8">{m}</span>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-3 text-white/85">
        {siteName && <span className="hidden max-w-40 truncate text-white/60 sm:block">{siteName}</span>}
        <BatteryGlyph className="hidden h-4 w-4 sm:block" />
        <WifiGlyph className="hidden h-3.5 w-3.5 sm:block" />
        <SearchGlyph className="hidden h-3.5 w-3.5 sm:block" />
        <span className="tabular-nums">{format(now, 'EEE d MMM h:mm a')}</span>
      </div>
    </div>
  );
}

/* ── One launchable icon — draggable/sortable, clickable (a tap that doesn't cross
   the drag activation distance fires as a normal click, so both just work). ── */
function AppTile({ app, mergeTarget }) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: app.key });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <Motion.button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => navigate(app.path)}
      layout
      className={cn(
        'group flex touch-none select-none flex-col items-center gap-1.5 rounded-2xl p-2 text-center',
        isDragging && 'opacity-30',
        mergeTarget && 'scale-105 rounded-[26px] ring-4 ring-white/35'
      )}
    >
      <MacIcon
        app={app}
        className={cn(
          'h-16 w-16 transition-transform duration-150 group-hover:scale-105 group-active:scale-95',
          mergeTarget && 'scale-95'
        )}
      />
      <span className="max-w-20 truncate text-[11px] font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
        {app.label}
      </span>
    </Motion.button>
  );
}

/* ── A folder bubble — frosted Launchpad folder with a mini 2×2 preview. ── */
function GroupTile({ group, mergeTarget, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const preview = group.items.slice(0, 4);

  return (
    <Motion.button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(group)}
      layout
      className={cn(
        'group flex touch-none select-none flex-col items-center gap-1.5 rounded-2xl p-2 text-center',
        isDragging && 'opacity-30',
        mergeTarget && 'scale-105 rounded-[26px] ring-4 ring-white/60'
      )}
    >
      <span className={cn(
        'grid h-16 w-16 grid-cols-2 grid-rows-2 gap-1 rounded-[22.5%] border border-white/12 bg-white/10 p-2.5',
        'shadow-[0_6px_14px_rgba(0,0,0,0.30)] backdrop-blur-md transition-transform duration-150 group-hover:scale-105',
        mergeTarget && 'scale-95'
      )}>
        {preview.map((it) => {
          const a = APP_BY_KEY[it.key];
          if (!a) return null;
          return <MacIcon key={it.key} app={a} className="h-full w-full drop-shadow-none" />;
        })}
        {Array.from({ length: Math.max(0, 4 - preview.length) }).map((_, i) => (
          <span key={`empty-${i}`} className="rounded-[26%] bg-white/10" />
        ))}
      </span>
      <span className="max-w-20 truncate text-[11px] font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
        {group.name}
      </span>
    </Motion.button>
  );
}

/* ── Drag overlay ghost — a floating copy of whatever's being dragged. ── */
function TileGhost({ item }) {
  if (!item) return null;
  if (isGroup(item)) {
    const preview = item.items.slice(0, 4);
    return (
      <div className="flex flex-col items-center gap-1.5 rounded-2xl p-2 text-center">
        <span className="grid h-16 w-16 scale-110 grid-cols-2 grid-rows-2 gap-1 rounded-[22.5%] border border-white/12 bg-white/12 p-2.5 shadow-2xl backdrop-blur-md">
          {preview.map((it) => {
            const a = APP_BY_KEY[it.key];
            return a ? <MacIcon key={it.key} app={a} className="h-full w-full drop-shadow-none" /> : null;
          })}
        </span>
        <span className="max-w-20 truncate text-[11px] font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{item.name}</span>
      </div>
    );
  }
  const app = APP_BY_KEY[item.key];
  if (!app) return null;
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl p-2 text-center">
      <MacIcon app={app} className="h-16 w-16 scale-110 drop-shadow-2xl" />
      <span className="max-w-20 truncate text-[11px] font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{app.label}</span>
    </div>
  );
}

/* ── Dock icon with genuine macOS magnification (distance-from-cursor spring). ── */
function DockIcon({ mouseX, app, onClick }) {
  const ref = useRef(null);
  const distance = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });
  const widthSync = useTransform(distance, [-140, 0, 140], [48, 78, 48]);
  const width = useSpring(widthSync, { mass: 0.1, stiffness: 170, damping: 12 });

  return (
    <Motion.button
      ref={ref}
      style={{ width }}
      onClick={onClick}
      className="group relative aspect-square shrink-0"
      aria-label={app.label}
    >
      <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-slate-900/80 px-2 py-1 text-[11px] text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
        {app.label}
      </span>
      <MacIcon app={app} className="h-full w-full" />
    </Motion.button>
  );
}

const DOCK_PINNED = ['dashboard', 'daybook', 'plot_payments', 'expenses', 'clients', 'pending_approvals', 'chat'];

function Dock({ apps, showSettings }) {
  const navigate = useNavigate();
  const mouseX = useMotionValue(Infinity);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 hidden justify-center pb-2.5 md:flex">
      <Motion.div
        onMouseMove={(e) => mouseX.set(e.clientX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        className="pointer-events-auto flex items-end gap-2 rounded-[24px] border border-white/12 bg-white/12 px-3 pb-2 pt-2 shadow-[0_18px_36px_rgba(0,0,0,0.38)] backdrop-blur-2xl"
      >
        {apps.map((app) => (
          <DockIcon key={app.key} mouseX={mouseX} app={app} onClick={() => navigate(app.path)} />
        ))}
        {showSettings && (
          <>
            <span className="mx-1 h-10 w-px self-center rounded bg-white/16" />
            <DockIcon
              mouseX={mouseX}
              app={{ key: 'permissions', label: 'Settings' }}
              onClick={() => navigate('/settings')}
            />
          </>
        )}
      </Motion.div>
    </div>
  );
}

/* ── Folder contents — its own small, independent drag context (the main grid isn't
   interactable while this dialog is open, so a separate context is simplest & robust). ── */
function FolderModal({ group, onClose, onChange }) {
  const [name, setName] = useState(group?.name || '');
  const [editingName, setEditingName] = useState(false);
  const navigate = useNavigate();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  if (!group) return null;

  const commitName = () => {
    setEditingName(false);
    const trimmed = name.trim() || 'Group';
    if (trimmed !== group.name) onChange({ ...group, name: trimmed });
  };

  const removeItem = (key) => {
    const items = group.items.filter((it) => it.key !== key);
    onChange({ ...group, items }, key); // second arg: key removed → caller re-adds it top-level
  };

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = group.items.findIndex((it) => it.key === active.id);
    const newIndex = group.items.findIndex((it) => it.key === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange({ ...group, items: arrayMove(group.items, oldIndex, newIndex) });
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="border-white/12 bg-slate-900/68 text-white backdrop-blur-2xl sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {editingName ? (
              <div className="flex flex-1 items-center gap-2">
                <Input
                  autoFocus value={name} onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && commitName()}
                  className="h-8 border-white/14 bg-white/8 text-sm text-white placeholder:text-white/40"
                />
                <button onClick={commitName} className="rounded-md p-1.5 text-emerald-400 hover:bg-white/8">
                  <CheckGlyph className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <DialogTitle className="flex flex-1 items-center justify-center gap-2 text-base font-semibold text-white">
                {group.name}
                <button onClick={() => setEditingName(true)} className="rounded-md p-1 text-white/50 hover:bg-white/8 hover:text-white">
                  <PencilGlyph className="h-3.5 w-3.5" />
                </button>
              </DialogTitle>
            )}
          </div>
        </DialogHeader>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={group.items.map((it) => it.key)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-4 gap-3 py-2">
              {group.items.map((it) => {
                const app = APP_BY_KEY[it.key];
                if (!app) return null;
                return (
                  <FolderAppTile key={it.key} app={app} onNavigate={() => navigate(app.path)} onRemove={() => removeItem(it.key)} />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
        <p className="text-center text-[11px] text-white/45">Drag to reorder · × removes from this group</p>
      </DialogContent>
    </Dialog>
  );
}

function FolderAppTile({ app, onNavigate, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: app.key });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef} style={style} {...attributes} {...listeners}
      className={cn('group/tile relative flex touch-none select-none flex-col items-center gap-1.5 rounded-xl p-1.5 text-center', isDragging && 'opacity-30')}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute -right-1 -top-1 z-10 hidden h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-white shadow-sm hover:bg-red-600 group-hover/tile:flex"
        aria-label={`Remove ${app.label} from group`}
      >
        <XGlyph className="h-3 w-3" />
      </button>
      <button type="button" onClick={onNavigate}>
        <MacIcon app={app} className="h-14 w-14" />
      </button>
      <span className="max-w-16 truncate text-[10px] font-medium text-white/90">{app.label}</span>
    </div>
  );
}

/** Invisible full-grid droppable so a drag released over empty space still resolves. */
function GridDropZone({ children }) {
  const { setNodeRef } = useDroppable({ id: '__grid__' });
  return <div ref={setNodeRef} className="min-h-[50vh]">{children}</div>;
}

export default function Home() {
  const { user, hasPermission } = useAuth();
  const visibleApps = useVisibleApps();
  const [items, setItems] = useState(null); // null = not yet reconciled
  const [openGroupId, setOpenGroupId] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [mergeCandidate, setMergeCandidate] = useState(null);
  const [q, setQ] = useState('');
  const hoverRef = useRef({ id: null, timer: null });
  const itemsRef = useRef(null);

  const visibleKeysSig = useMemo(() => visibleApps.map((a) => a.key).sort().join(','), [visibleApps]);

  useEffect(() => {
    if (!visibleApps.length) return;
    setItems((prev) => prev ?? reconcile(loadLayout(user?.id), visibleApps));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKeysSig]);

  // Re-reconcile if the visible app set changes after the initial load (permissions
  // arriving async) — never clobbers manual arrangement, only adds/removes keys.
  useEffect(() => {
    if (!items) return;
    const flatKeys = new Set(items.flatMap((it) => (isGroup(it) ? it.items.map((x) => x.key) : [it.key])));
    const visibleKeys = visibleApps.map((a) => a.key);
    const changed = visibleKeys.some((k) => !flatKeys.has(k)) || [...flatKeys].some((k) => !APP_BY_KEY[k] || !visibleKeys.includes(k));
    if (changed) setItems(reconcile(items, visibleApps));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKeysSig]);

  useEffect(() => { itemsRef.current = items; }, [items]);

  const update = useCallback((next) => {
    setItems(next);
    saveLayout(user?.id, next);
  }, [user?.id]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const clearHoverTimer = () => { clearTimeout(hoverRef.current.timer); hoverRef.current = { id: null, timer: null }; };

  const onDragStart = ({ active }) => setActiveId(active.id);

  const onDragOver = ({ over }) => {
    const overId = over?.id ?? null;
    if (overId === hoverRef.current.id) return;
    clearHoverTimer();
    if (overId && overId !== '__grid__' && overId !== activeId) {
      const timer = setTimeout(() => setMergeCandidate(overId), 450);
      hoverRef.current = { id: overId, timer };
    } else {
      setMergeCandidate(null);
    }
  };

  const onDragEnd = ({ active, over }) => {
    clearHoverTimer();
    const candidate = mergeCandidate;
    setMergeCandidate(null);
    setActiveId(null);
    if (!items) return;

    if (!over || active.id === over.id) return;

    if (candidate && over.id === candidate) {
      const activeIdx = items.findIndex((it) => it.id === active.id);
      const overIdx = items.findIndex((it) => it.id === over.id);
      if (activeIdx === -1 || overIdx === -1) return;
      const activeItem = items[activeIdx];
      const overItem = items[overIdx];

      let next;
      if (isGroup(overItem) && !isGroup(activeItem)) {
        // Drop an app onto an existing folder → add to it.
        next = items.filter((_, i) => i !== activeIdx);
        next = next.map((it) => (it.id === overItem.id ? { ...it, items: [...it.items, { key: activeItem.key }] } : it));
      } else if (!isGroup(activeItem) && !isGroup(overItem)) {
        // Drop an app onto another app → bundle both into a new folder, taking the
        // over-tile's slot (remove active, then swap over's slot for the new group).
        const group = { id: newGroupId(), type: 'group', name: 'Group', items: [{ key: overItem.key }, { key: activeItem.key }] };
        next = items.filter((_, i) => i !== activeIdx).map((it) => (it.id === overItem.id ? group : it));
      } else {
        // Group dropped onto an app, or group onto group — just reorder instead.
        next = arrayMove(items, activeIdx, overIdx);
      }
      update(next);
      return;
    }

    // Plain reorder.
    const oldIndex = items.findIndex((it) => it.id === active.id);
    const newIndex = items.findIndex((it) => it.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    update(arrayMove(items, oldIndex, newIndex));
  };

  const openGroup = useMemo(() => items?.find((it) => it.id === openGroupId) || null, [items, openGroupId]);

  const handleGroupChange = (updatedGroup, removedKey) => {
    setItems((prev) => {
      let next = prev.map((it) => (it.id === updatedGroup.id ? updatedGroup : it));
      if (removedKey) {
        // Dissolve if only one item remains, and always re-surface the removed app.
        next = next.flatMap((it) => {
          if (it.id !== updatedGroup.id) return [it];
          if (it.items.length <= 1) {
            return it.items.map((x) => ({ id: x.key, type: 'app', key: x.key }));
          }
          return [it];
        });
        next.push({ id: removedKey, type: 'app', key: removedKey });
      }
      saveLayout(user?.id, next);
      return next;
    });
  };

  const activeItem = activeId ? items?.find((it) => it.id === activeId) : null;

  /* Launchpad search — filters apps by label and folders by name or contents. */
  const shownItems = useMemo(() => {
    if (!items) return null;
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((it) => {
      if (isGroup(it)) {
        return it.name.toLowerCase().includes(needle)
          || it.items.some((x) => APP_BY_KEY[x.key]?.label.toLowerCase().includes(needle));
      }
      return APP_BY_KEY[it.key]?.label.toLowerCase().includes(needle);
    });
  }, [items, q]);

  const dockApps = useMemo(() => {
    const byKey = Object.fromEntries(visibleApps.map((a) => [a.key, a]));
    const pinned = DOCK_PINNED.map((k) => byKey[k]).filter(Boolean);
    return pinned.length >= 3 ? pinned : visibleApps.slice(0, 7);
  }, [visibleApps]);

  /* Full-bleed mac desktop: escape Layout's <main> padding, own the viewport below
     the app header (h-14), keep menu bar + dock fixed while the grid scrolls. */
  return (
    <div
      className="relative -mx-3 -mt-3 -mb-20 flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden md:-m-6"
      style={WALLPAPER}
    >
      
      <div className="flex-1 overflow-y-auto px-4 pb-32 pt-5 sm:px-8 md:pb-36">
        {!shownItems ? (
          <div className="mx-auto grid max-w-5xl grid-cols-4 gap-5 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 p-2">
                <div className="h-16 w-16 animate-pulse rounded-[22.5%] bg-white/10" />
                <div className="h-2.5 w-12 animate-pulse rounded bg-white/10" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Launchpad-style search */}
            <div className="mx-auto mb-6 flex max-w-xs items-center gap-2 rounded-lg border border-white/12 bg-white/10 px-3 py-1.5 backdrop-blur-xl focus-within:bg-white/16">
              <SearchGlyph className="h-3.5 w-3.5 shrink-0 text-white/60" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search"
                className="w-full bg-transparent text-sm text-white placeholder:text-white/50 focus:outline-none"
              />
              {q && (
                <button onClick={() => setQ('')} className="text-white/50 hover:text-white" aria-label="Clear search">
                  <XGlyph className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
            >
              <GridDropZone>
                <SortableContext items={shownItems.map((it) => it.id)} strategy={rectSortingStrategy}>
                  <div className="mx-auto grid max-w-5xl grid-cols-4 gap-x-3 gap-y-6 sm:grid-cols-5 sm:gap-x-5 md:grid-cols-6 lg:grid-cols-7">
                    {shownItems.map((it) => isGroup(it) ? (
                      <GroupTile key={it.id} group={it} mergeTarget={mergeCandidate === it.id} onOpen={(g) => setOpenGroupId(g.id)} />
                    ) : (
                      <AppTile key={it.id} app={APP_BY_KEY[it.key]} mergeTarget={mergeCandidate === it.id} />
                    ))}
                  </div>
                </SortableContext>
                {shownItems.length === 0 && (
                  <p className="mt-16 text-center text-sm text-white/60">No apps match “{q}”</p>
                )}
              </GridDropZone>

              <DragOverlay>
                <AnimatePresence>{activeItem && <TileGhost item={activeItem} />}</AnimatePresence>
              </DragOverlay>
            </DndContext>

            <p className="mt-8 text-center text-[11px] text-white/45">
              Drag to reorder · drop one app onto another to group them
            </p>
          </>
        )}
      </div>

      <Dock apps={dockApps} showSettings={hasPermission('settings', 'read')} />

      <FolderModal
        key={openGroup?.id || 'closed'}
        group={openGroup}
        onClose={() => setOpenGroupId(null)}
        onChange={handleGroupChange}
      />
    </div>
  );
}
