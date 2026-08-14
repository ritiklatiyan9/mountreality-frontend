import { useState, useEffect, useRef, useCallback, useMemo, useDeferredValue, memo, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import {
    DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
    useDraggable, useDroppable, pointerWithin,
} from '@dnd-kit/core';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { toast } from 'sonner';
import { format, formatDistanceToNowStrict, differenceInDays } from 'date-fns';
import {
    FileSpreadsheet, Plus, Search, Trash2, Copy, Pencil,
    Download, MoreHorizontal, Loader2, FileX2, Check,
    ArrowUp, ArrowDown, ArrowUpDown, Upload, X,
    FolderPlus, Folder, ChevronRight, Home,
    FileText, Building2, ChevronLeft, LayoutGrid, List,
    ExternalLink, FolderInput,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from '../components/ui/dropdown-menu';
import {
    ContextMenu, ContextMenuContent, ContextMenuItem,
    ContextMenuSeparator, ContextMenuTrigger,
} from '../components/ui/context-menu';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogFooter, DialogDescription,
} from '../components/ui/dialog';
import { Separator } from '../components/ui/separator';
import { cn } from '@/lib/utils';

// The previewer pulls in FortuneSheet + LuckyExcel (~3.3 MB). Bundling it with
// the file list made every visit pay for a preview most visits never open.
const DocumentPreview = lazy(() => import('../components/DocumentPreview'));
const warmPreview = () => { import('../components/DocumentPreview'); };

const FILE_ACCEPT = '.xlsx,.xls,.csv,.pdf,.doc,.docx';
const ALLOWED_EXT = ['xlsx', 'xls', 'csv', 'pdf', 'doc', 'docx'];
const GRID = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3';
const ROW = 'grid grid-cols-[minmax(0,1fr)_84px_44px] sm:grid-cols-[minmax(0,1fr)_84px_128px_56px_44px] items-center gap-3';

// ponytail: module-level stale-while-revalidate cache, one entry per folder.
// Re-entering a folder repaints from it instantly instead of flashing skeletons.
const cache = new Map();
const keyOf = (siteId, folderId) => `${siteId}:${folderId || 'root'}`;

const SORTS = [
    { key: 'updated_at', label: 'Last modified' },
    { key: 'name', label: 'Name' },
    { key: 'size_bytes', label: 'Size' },
];

const fmtSize = (bytes) => {
    const n = Number(bytes);
    if (!n) return '—';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let value = n;
    while (value >= 1024 && i < units.length - 1) { value /= 1024; i += 1; }
    return `${i && value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
};

// Recent edits read better as "3h ago"; anything older wants a real date.
const fmtDate = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return Math.abs(differenceInDays(d, new Date())) < 7
        ? `${formatDistanceToNowStrict(d)} ago`
        : format(d, 'dd MMM yyyy');
};

// ── file-type theming ────────────────────────────────────────────────
const typeStyle = (t) => {
    switch (t) {
        case 'pdf': return { icon: FileText, tint: 'text-rose-600', chip: 'bg-rose-50 text-rose-700 ring-rose-100', grad: 'from-rose-50 via-rose-50/40 to-white', hover: 'hover:border-rose-200', label: 'PDF' };
        case 'doc': return { icon: FileText, tint: 'text-blue-600', chip: 'bg-blue-50 text-blue-700 ring-blue-100', grad: 'from-blue-50 via-blue-50/40 to-white', hover: 'hover:border-blue-200', label: 'DOC' };
        default: return { icon: FileSpreadsheet, tint: 'text-emerald-600', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-100', grad: 'from-emerald-50 via-emerald-50/40 to-white', hover: 'hover:border-emerald-200', label: 'XLS' };
    }
};

const cardBase = 'group relative rounded-xl border border-slate-200 bg-white cursor-pointer overflow-hidden flex flex-col transition-[box-shadow,border-color,transform] duration-150 hover:shadow-[0_2px_12px_-2px_rgb(15_23_42_/_0.12)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1';
const rowBase = 'group rounded-lg border border-transparent cursor-pointer transition-colors hover:border-slate-200 hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900';

// ── Draggable + droppable folder ─────────────────────────────────────
const FolderItem = memo(function FolderItem({ folder, view, onOpen, onAction }) {
    const drag = useDraggable({ id: `folder-${folder.id}`, data: { type: 'folder', item: folder } });
    const drop = useDroppable({ id: `folderdrop-${folder.id}`, data: { kind: 'folder', folderId: folder.id } });
    const setRef = (node) => { drag.setNodeRef(node); drop.setNodeRef(node); };

    const open = () => onOpen(folder);
    const act = (a) => (a === 'open' ? open() : onAction(a, folder));
    const dropRing = drop.isOver ? 'ring-2 ring-emerald-400 ring-offset-1 border-emerald-300 bg-emerald-50/50' : '';

    const menu = (
        <>
            <ContextMenuItem onClick={open}><FolderInput className="w-3.5 h-3.5 mr-2" /> Open</ContextMenuItem>
            <ContextMenuItem onClick={() => onAction('rename', folder)}><Pencil className="w-3.5 h-3.5 mr-2" /> Rename</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onAction('delete', folder)} className="text-red-600 focus:text-red-600"><Trash2 className="w-3.5 h-3.5 mr-2" /> Delete</ContextMenuItem>
        </>
    );

    const shell = view === 'list' ? (
        <div
            ref={setRef} {...drag.attributes} {...drag.listeners}
            onClick={open} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') open(); }}
            className={cn(rowBase, ROW, 'px-3 py-2', dropRing, drag.isDragging && 'opacity-40')}
        >
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0"><Folder className="w-4 h-4 text-amber-500 fill-amber-200" /></div>
                <span className="text-sm font-medium text-slate-700 truncate">{folder.name}</span>
            </div>
            <span className="text-xs text-slate-400 tabular-nums">—</span>
            <span className="text-xs text-slate-400 hidden sm:block truncate">{fmtDate(folder.updated_at)}</span>
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 ring-1 ring-amber-100 rounded px-1.5 py-0.5 hidden sm:block text-center">DIR</span>
            <RowMenu onClick={act} kind="folder" />
        </div>
    ) : (
        <div
            ref={setRef} {...drag.attributes} {...drag.listeners}
            onClick={open} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') open(); }}
            className={cn(cardBase, 'hover:border-amber-200', dropRing, drag.isDragging && 'opacity-40')}
        >
            <div className="absolute top-1.5 right-1.5 z-10 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <CardMenu onClick={act} kind="folder" />
            </div>
            <div className="w-full aspect-[4/3] flex items-center justify-center bg-linear-to-br from-amber-50 via-amber-50/40 to-white">
                <Folder className="w-10 h-10 text-amber-400 fill-amber-200 transition-transform duration-200 group-hover:scale-105" />
            </div>
            <div className="px-2.5 py-2 border-t border-slate-100">
                <h3 className="text-xs font-medium text-slate-700 leading-tight truncate" title={folder.name}>{folder.name}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Folder</p>
            </div>
        </div>
    );

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>{shell}</ContextMenuTrigger>
            <ContextMenuContent className="w-44">{menu}</ContextMenuContent>
        </ContextMenu>
    );
});

// ── Draggable file ───────────────────────────────────────────────────
const FileItem = memo(function FileItem({ file, view, onOpen, onAction }) {
    const drag = useDraggable({ id: `file-${file.id}`, data: { type: 'file', item: file } });
    const st = typeStyle(file.file_type);
    const Icon = st.icon;
    const open = () => onOpen(file);
    const act = (a) => (a === 'open' ? open() : onAction(a, file));

    const menu = (
        <>
            <ContextMenuItem onClick={open}><ExternalLink className="w-3.5 h-3.5 mr-2" /> Open</ContextMenuItem>
            <ContextMenuItem onClick={() => onAction('rename', file)}><Pencil className="w-3.5 h-3.5 mr-2" /> Rename</ContextMenuItem>
            <ContextMenuItem onClick={() => onAction('duplicate', file)}><Copy className="w-3.5 h-3.5 mr-2" /> Duplicate</ContextMenuItem>
            <ContextMenuItem onClick={() => onAction('download', file)}><Download className="w-3.5 h-3.5 mr-2" /> Download</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onAction('delete', file)} className="text-red-600 focus:text-red-600"><Trash2 className="w-3.5 h-3.5 mr-2" /> Delete</ContextMenuItem>
        </>
    );

    const shell = view === 'list' ? (
        <div
            ref={drag.setNodeRef} {...drag.attributes} {...drag.listeners}
            onClick={open} onMouseEnter={warmPreview} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') open(); }}
            className={cn(rowBase, ROW, 'px-3 py-2', drag.isDragging && 'opacity-40')}
        >
            <div className="flex items-center gap-3 min-w-0">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-linear-to-br', st.grad)}><Icon className={cn('w-4 h-4', st.tint)} /></div>
                <span className="text-sm font-medium text-slate-700 truncate">{file.name}</span>
            </div>
            <span className="text-xs text-slate-400 tabular-nums">{fmtSize(file.size_bytes)}</span>
            <span className="text-xs text-slate-400 hidden sm:block truncate">{fmtDate(file.updated_at)}</span>
            <span className={cn('text-[10px] font-semibold ring-1 rounded px-1.5 py-0.5 hidden sm:block text-center', st.chip)}>{st.label}</span>
            <RowMenu onClick={act} kind="file" />
        </div>
    ) : (
        <div
            ref={drag.setNodeRef} {...drag.attributes} {...drag.listeners}
            onClick={open} onMouseEnter={warmPreview} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') open(); }}
            className={cn(cardBase, st.hover, drag.isDragging && 'opacity-40')}
        >
            <div className="absolute top-1.5 right-1.5 z-10 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <CardMenu onClick={act} kind="file" />
            </div>
            <div className={cn('w-full aspect-[4/3] flex items-center justify-center bg-linear-to-br relative', st.grad)}>
                <Icon className={cn('w-10 h-10 opacity-80 transition-transform duration-200 group-hover:scale-105', st.tint)} />
                <span className={cn('absolute bottom-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded ring-1', st.chip)}>{st.label}</span>
            </div>
            <div className="px-2.5 py-2 border-t border-slate-100">
                <h3 className="text-xs font-medium text-slate-700 leading-tight truncate" title={file.name}>{file.name}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums">{fmtSize(file.size_bytes)} · {fmtDate(file.updated_at)}</p>
            </div>
        </div>
    );

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>{shell}</ContextMenuTrigger>
            <ContextMenuContent className="w-44">{menu}</ContextMenuContent>
        </ContextMenu>
    );
});

// ── shared kebab menus (stop pointer propagation so drag never engages) ──
function stopPointer(e) { e.stopPropagation(); }

function CardMenu({ onClick, kind }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild onPointerDown={stopPointer} onClick={stopPointer}>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 bg-white/90 backdrop-blur-sm shadow-sm border border-slate-100">
                    <MoreHorizontal className="w-3.5 h-3.5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={stopPointer} onPointerDown={stopPointer} className="w-44">
                <MenuItems onClick={onClick} kind={kind} />
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function RowMenu({ onClick, kind }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild onPointerDown={stopPointer} onClick={stopPointer}>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity">
                    <MoreHorizontal className="w-4 h-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={stopPointer} onPointerDown={stopPointer} className="w-44">
                <MenuItems onClick={onClick} kind={kind} />
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function MenuItems({ onClick, kind }) {
    if (kind === 'folder') {
        return (
            <>
                <DropdownMenuItem onClick={() => onClick('open')}><FolderInput className="w-3.5 h-3.5 mr-2" /> Open</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onClick('rename')}><Pencil className="w-3.5 h-3.5 mr-2" /> Rename</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onClick('delete')} className="text-red-600 focus:text-red-600"><Trash2 className="w-3.5 h-3.5 mr-2" /> Delete</DropdownMenuItem>
            </>
        );
    }
    return (
        <>
            <DropdownMenuItem onClick={() => onClick('open')}><ExternalLink className="w-3.5 h-3.5 mr-2" /> Open</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onClick('rename')}><Pencil className="w-3.5 h-3.5 mr-2" /> Rename</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onClick('duplicate')}><Copy className="w-3.5 h-3.5 mr-2" /> Duplicate</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onClick('download')}><Download className="w-3.5 h-3.5 mr-2" /> Download</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onClick('delete')} className="text-red-600 focus:text-red-600"><Trash2 className="w-3.5 h-3.5 mr-2" /> Delete</DropdownMenuItem>
        </>
    );
}

// ── droppable breadcrumb crumb (move an item up the tree by dropping on it) ──
function CrumbDrop({ id, folderId, children, active }) {
    const { setNodeRef, isOver } = useDroppable({ id, data: { kind: 'crumb', folderId } });
    return (
        <span
            ref={setNodeRef}
            className={cn('rounded-md px-1.5 py-0.5 transition-colors shrink-0', isOver && active && 'bg-emerald-100 ring-1 ring-emerald-300')}
        >
            {children}
        </span>
    );
}

function SectionLabel({ children, count }) {
    return (
        <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            {children}
            <Badge variant="secondary" className="bg-slate-100 text-slate-400 text-[10px] font-normal">{count}</Badge>
        </h2>
    );
}

export default function ExcelFiles() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { currentSite } = useAuth();

    const siteId = currentSite?.id;
    const currentFolderId = searchParams.get('folderId') || null;
    const seed = cache.get(keyOf(siteId, currentFolderId));

    const [files, setFiles] = useState(seed?.files || []);
    const [folders, setFolders] = useState(seed?.folders || []);
    const [breadcrumb, setBreadcrumb] = useState(seed?.breadcrumb || []);
    const [loading, setLoading] = useState(!seed);   // nothing to show yet → skeletons
    const [busy, setBusy] = useState(false);         // request in flight → toolbar spinner
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('updated_at');
    const [sortOrder, setSortOrder] = useState('desc');
    const [view, setView] = useState(() => localStorage.getItem('fm_view') || 'grid');
    const [activeDrag, setActiveDrag] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState({ open: false, file: null });

    const [deleteDialog, setDeleteDialog] = useState({ open: false, file: null });
    const [deleteFolderDialog, setDeleteFolderDialog] = useState({ open: false, folder: null });
    const [renameDialog, setRenameDialog] = useState({ open: false, file: null, name: '' });
    const [renameFolderDialog, setRenameFolderDialog] = useState({ open: false, folder: null, name: '' });
    const [createFolderDialog, setCreateFolderDialog] = useState({ open: false, name: '' });
    const fileInputRef = useRef(null);
    const searchRef = useRef(null);
    const inFlight = useRef('');

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
    const setViewPref = (v) => { setView(v); localStorage.setItem('fm_view', v); };

    const fetchData = useCallback(async ({ fresh = false } = {}) => {
        if (!siteId) return;
        const key = keyOf(siteId, currentFolderId);
        if (fresh) cache.delete(key);
        const cached = cache.get(key);
        inFlight.current = key;
        // A cached folder repaints instantly and revalidates behind the scenes;
        // only a never-seen folder is allowed to fall back to skeletons.
        setBusy(true);
        setLoading(!cached);
        if (cached) { setFiles(cached.files); setFolders(cached.folders); setBreadcrumb(cached.breadcrumb); }
        else { setFiles([]); setFolders([]); setBreadcrumb([]); }
        try {
            const [filesRes, foldersRes] = await Promise.all([
                api.get('/excel', { params: { folderId: currentFolderId, site_id: siteId } }),
                api.get('/folders', { params: { parentId: currentFolderId, site_id: siteId } }),
            ]);
            const next = {
                files: filesRes.data.files || [],
                folders: foldersRes.data.folders || [],
                breadcrumb: foldersRes.data.breadcrumb || [],
            };
            cache.set(key, next);
            if (inFlight.current !== key) return; // a newer folder won the race
            setFiles(next.files); setFolders(next.folders); setBreadcrumb(next.breadcrumb);
        } catch {
            if (inFlight.current === key && !cached) toast.error('Failed to load files');
        } finally {
            if (inFlight.current === key) { setLoading(false); setBusy(false); }
        }
    }, [currentFolderId, siteId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Any write can invalidate sibling folders too (moves, cascading deletes).
    const refresh = useCallback(() => { cache.clear(); fetchData({ fresh: true }); }, [fetchData]);

    // Warm the previewer chunk once the list has settled, so the first click on
    // a file still opens instantly. Hovering a file warms it sooner.
    useEffect(() => { const t = setTimeout(warmPreview, 1200); return () => clearTimeout(t); }, []);

    // "/" jumps to search — the shortcut every file manager has.
    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
            e.preventDefault();
            searchRef.current?.focus();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const navigateToFolder = useCallback((folderId) => {
        setSearchParams(folderId ? { folderId: String(folderId) } : {});
    }, [setSearchParams]);

    // ── move (drag end) ──────────────────────────────────────────────
    const handleDragEnd = async ({ active, over }) => {
        setActiveDrag(null);
        if (!over) return;
        const a = active.data.current;               // { type:'file'|'folder', item }
        const o = over.data.current;                 // { kind:'folder'|'crumb'|'root', folderId }
        if (!a || !o) return;

        const targetFolderId = o.folderId ?? null;   // null = root

        // no-op: already here
        const currentParent = currentFolderId ? Number(currentFolderId) : null;
        if ((targetFolderId ?? null) === currentParent) return;
        // folder can't go into itself
        if (a.type === 'folder' && Number(a.item.id) === Number(targetFolderId)) return;

        const label = a.item.name;
        const destName = targetFolderId
            ? (folders.find((f) => f.id === targetFolderId)?.name
                || breadcrumb.find((b) => b.id === targetFolderId)?.name
                || 'folder')
            : 'Root';

        // optimistic: item leaves the current view
        const prevFiles = files, prevFolders = folders;
        if (a.type === 'file') setFiles((s) => s.filter((f) => f.id !== a.item.id));
        else setFolders((s) => s.filter((f) => f.id !== a.item.id));
        cache.clear();  // source and destination folders both changed

        try {
            if (a.type === 'file') {
                await api.put(`/excel/${a.item.id}/move`, { folderId: targetFolderId });
            } else {
                await api.put(`/folders/${a.item.id}/move`, { parentId: targetFolderId });
            }
            toast.success(`Moved “${label}” to ${destName}`);
        } catch (err) {
            setFiles(prevFiles); setFolders(prevFolders);
            toast.error(err?.response?.data?.message || `Couldn't move “${label}”`);
        }
    };

    // ── upload (button + dropzone) ───────────────────────────────────
    const uploadFiles = useCallback(async (fileList) => {
        const list = Array.from(fileList || []).filter((f) => ALLOWED_EXT.includes(f.name.split('.').pop().toLowerCase()));
        if (list.length === 0) { toast.error('Supported: xlsx, xls, csv, pdf, doc, docx'); return; }
        setUploading(true);
        toast.loading(`Uploading ${list.length} file${list.length > 1 ? 's' : ''}…`, { id: 'up' });
        let ok = 0;
        for (const file of list) {
            try {
                const fd = new FormData();
                fd.append('file', file);
                fd.append('name', file.name.replace(/\.[^.]+$/, ''));
                if (currentFolderId) fd.append('folder_id', currentFolderId);
                fd.append('site_id', siteId);
                await api.post('/excel', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                ok++;
            } catch { /* keep going */ }
        }
        setUploading(false);
        if (ok) toast.success(`Uploaded ${ok} file${ok > 1 ? 's' : ''}`, { id: 'up' });
        else toast.error('Upload failed', { id: 'up' });
        refresh();
    }, [currentFolderId, siteId, refresh]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: uploadFiles, noClick: true, noKeyboard: true,
        accept: undefined,
    });

    // ── open — every type opens the previewer INSTANTLY; content loads
    //    inside the already-open modal (no fetch-before-open lag) ──────
    const openFile = useCallback((file) => setPreview({ open: true, file }), []);

    // ── per-item actions ─────────────────────────────────────────────
    const onFileAction = useCallback(async (action, file) => {
        if (action === 'rename') return setRenameDialog({ open: true, file, name: file.name });
        if (action === 'delete') return setDeleteDialog({ open: true, file });
        if (action === 'duplicate') {
            try { await api.post(`/excel/${file.id}/duplicate`); toast.success('File duplicated'); refresh(); }
            catch { toast.error('Failed to duplicate'); }
            return;
        }
        if (action === 'download') {
            try {
                toast.loading('Preparing download…', { id: 'dl' });
                const { data } = await api.get(`/excel/${file.id}`);
                if (data.downloadUrl) { window.location.href = data.downloadUrl; toast.success('Download starting…', { id: 'dl' }); }
                else toast.error('No file to download', { id: 'dl' });
            } catch { toast.error('Download failed', { id: 'dl' }); }
        }
    }, [refresh]);

    const onFolderAction = useCallback((action, folder) => {
        if (action === 'rename') return setRenameFolderDialog({ open: true, folder, name: folder.name });
        if (action === 'delete') return setDeleteFolderDialog({ open: true, folder });
    }, []);

    const openFolder = useCallback((f) => navigateToFolder(f.id), [navigateToFolder]);

    // ── CRUD dialogs ─────────────────────────────────────────────────
    const handleCreateFolder = async () => {
        const name = createFolderDialog.name.trim();
        if (!name) return;
        try { await api.post('/folders', { name, parentId: currentFolderId, site_id: siteId }); toast.success('Folder created'); setCreateFolderDialog({ open: false, name: '' }); refresh(); }
        catch { toast.error('Failed to create folder'); }
    };
    const handleRenameFolder = async () => {
        const name = renameFolderDialog.name.trim();
        if (!name) return;
        try { await api.put(`/folders/${renameFolderDialog.folder.id}/rename`, { name }); toast.success('Folder renamed'); setRenameFolderDialog({ open: false, folder: null, name: '' }); refresh(); }
        catch { toast.error('Failed to rename folder'); }
    };
    const handleDeleteFolder = async () => {
        try { await api.delete(`/folders/${deleteFolderDialog.folder.id}`); toast.success('Folder deleted'); setDeleteFolderDialog({ open: false, folder: null }); refresh(); }
        catch { toast.error('Failed to delete folder'); }
    };
    const handleRename = async () => {
        const name = renameDialog.name.trim();
        if (!name) return;
        try { await api.put(`/excel/${renameDialog.file.id}/rename`, { name }); toast.success('File renamed'); setRenameDialog({ open: false, file: null, name: '' }); refresh(); }
        catch { toast.error('Failed to rename file'); }
    };
    const handleDelete = async () => {
        try { await api.delete(`/excel/${deleteDialog.file.id}`); toast.success('File deleted'); setDeleteDialog({ open: false, file: null }); refresh(); }
        catch { toast.error('Failed to delete file'); }
    };

    // ── filter + sort ────────────────────────────────────────────────
    // Deferred so typing never blocks on re-rendering the whole grid.
    const deferredQuery = useDeferredValue(searchQuery);
    const { filteredFolders, filteredFiles } = useMemo(() => {
        const q = deferredQuery.trim().toLowerCase();
        const dir = sortOrder === 'asc' ? 1 : -1;
        // updated_at arrives as an ISO string, which already sorts lexicographically.
        const cmp = (a, b) => {
            if (sortBy === 'name') return a.name.localeCompare(b.name) * dir;
            if (sortBy === 'size_bytes') return ((Number(a.size_bytes) || 0) - (Number(b.size_bytes) || 0)) * dir;
            return (String(a.updated_at) < String(b.updated_at) ? -1 : 1) * dir;
        };
        const match = (f) => !q || f.name.toLowerCase().includes(q);
        return {
            filteredFolders: folders.filter(match).sort(cmp),
            filteredFiles: files.filter(match).sort(cmp),
        };
    }, [deferredQuery, files, folders, sortBy, sortOrder]);

    const toggleSort = (field) => {
        if (sortBy === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        else { setSortBy(field); setSortOrder(field === 'name' ? 'asc' : 'desc'); }
    };
    const SortArrow = ({ field }) => (sortBy !== field ? null
        : sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />);

    const isEmpty = filteredFolders.length === 0 && filteredFiles.length === 0;

    if (!currentSite) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <Building2 className="w-10 h-10 text-slate-200 mb-3" />
                <p className="text-sm text-slate-500">Select a site to view files</p>
            </div>
        );
    }

    return (
        <div {...getRootProps()} className="relative space-y-4 outline-none">
            <input {...getInputProps()} />
            <input type="file" ref={fileInputRef} onChange={(e) => { uploadFiles(e.target.files); e.target.value = ''; }} accept={FILE_ACCEPT} multiple className="hidden" />

            {/* OS drag-to-upload overlay */}
            {isDragActive && (
                <div className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center pointer-events-none">
                    <div className="bg-white rounded-2xl shadow-2xl border-2 border-dashed border-emerald-400 px-10 py-8 flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center"><Upload className="w-6 h-6 text-emerald-500" /></div>
                        <p className="text-sm font-semibold text-slate-700">Drop to upload {currentFolderId ? 'here' : 'to Root'}</p>
                        <p className="text-xs text-slate-400">xlsx · xls · csv · pdf · doc · docx</p>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <Button variant="ghost" size="sm" onClick={() => navigate(-1)} aria-label="Back" className="h-9 w-9 p-0 rounded-lg border border-slate-200 bg-white shadow-sm hover:bg-slate-50 shrink-0">
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-600 via-emerald-500 to-teal-500 flex items-center justify-center shadow-sm shadow-emerald-500/25 ring-1 ring-inset ring-white/25 shrink-0">
                        <FileSpreadsheet className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Documents</h1>
                            <Badge variant="secondary" className="bg-slate-100 text-slate-500 text-[10px] font-medium hidden sm:inline-flex tabular-nums">
                                {folders.length} folder{folders.length === 1 ? '' : 's'} · {files.length} file{files.length === 1 ? '' : 's'}
                            </Badge>
                        </div>
                        <p className="text-sm text-slate-500 truncate">Drag &amp; drop to organize · <span className="font-medium text-slate-700">{currentSite.name}</span></p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button onClick={() => setCreateFolderDialog({ open: true, name: '' })} variant="outline" className="h-9 border-slate-200"><FolderPlus className="w-4 h-4 mr-1.5 text-amber-500" /> New Folder</Button>
                    <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="h-9 border-slate-200" disabled={uploading}>
                        {uploading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5 text-blue-500" />} Upload
                    </Button>
                    <Button onClick={() => navigate('/excel/new')} className="h-9 bg-slate-900 hover:bg-slate-800 text-white"><Plus className="w-4 h-4 mr-1.5" /> New Spreadsheet</Button>
                </div>
            </div>

            <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={({ active }) => setActiveDrag(active.data.current)} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDrag(null)}>
                {/* Toolbar: breadcrumb + search + sort + view */}
                <div className="sticky top-0 z-20 flex flex-col lg:flex-row lg:items-center gap-2 bg-white/90 backdrop-blur-sm rounded-xl border border-slate-200 px-2.5 py-2 shadow-sm shadow-slate-900/[0.03]">
                    <div className="flex items-center gap-0.5 text-sm flex-1 min-w-0 overflow-x-auto">
                        <CrumbDrop id="crumb-root" folderId={null} active={!!activeDrag && !!currentFolderId}>
                            <button onClick={() => navigateToFolder(null)} className={cn('flex items-center gap-1 px-1 py-0.5 rounded text-slate-500 hover:text-slate-900 transition-colors', !currentFolderId && 'text-slate-900 font-semibold')}>
                                <Home className="w-4 h-4" /> <span>Root</span>
                            </button>
                        </CrumbDrop>
                        {breadcrumb.map((crumb) => {
                            const isCurrent = String(crumb.id) === String(currentFolderId);
                            return (
                                <div key={crumb.id} className="flex items-center gap-0.5 shrink-0">
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                                    <CrumbDrop id={`crumb-${crumb.id}`} folderId={crumb.id} active={!!activeDrag && !isCurrent}>
                                        <button onClick={() => navigateToFolder(crumb.id)} className={cn('block max-w-[160px] truncate text-slate-500 hover:text-slate-900 transition-colors', isCurrent && 'text-slate-900 font-semibold')}>
                                            {crumb.name}
                                        </button>
                                    </CrumbDrop>
                                </div>
                            );
                        })}
                        {busy && !loading && <Loader2 className="w-3.5 h-3.5 ml-1 shrink-0 animate-spin text-slate-300" />}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="relative flex-1 lg:w-64 lg:flex-none">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            <Input ref={searchRef} placeholder="Search files and folders" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 pr-8 h-8 text-sm" />
                            {searchQuery ? (
                                <button onClick={() => { setSearchQuery(''); searchRef.current?.focus(); }} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            ) : (
                                <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden lg:block rounded border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-medium text-slate-400">/</kbd>
                            )}
                        </div>
                        <Separator orientation="vertical" className="h-6 hidden lg:block" />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-slate-600 gap-1">
                                    <ArrowUpDown className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">{SORTS.find((s) => s.key === sortBy)?.label}</span>
                                    <SortArrow field={sortBy} />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-slate-400">Sort by</DropdownMenuLabel>
                                {SORTS.map((s) => (
                                    <DropdownMenuItem key={s.key} onClick={() => toggleSort(s.key)} className="justify-between">
                                        {s.label}
                                        {sortBy === s.key && <span className="flex items-center gap-1 text-slate-400"><SortArrow field={s.key} /><Check className="w-3.5 h-3.5" /></span>}
                                    </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                                    Switch to {sortOrder === 'asc' ? 'descending' : 'ascending'}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <div className="flex items-center rounded-lg border border-slate-200 p-0.5">
                            <button onClick={() => setViewPref('grid')} aria-label="Grid view" aria-pressed={view === 'grid'} className={cn('h-7 w-7 rounded flex items-center justify-center transition-colors', view === 'grid' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600')}><LayoutGrid className="w-4 h-4" /></button>
                            <button onClick={() => setViewPref('list')} aria-label="List view" aria-pressed={view === 'list'} className={cn('h-7 w-7 rounded flex items-center justify-center transition-colors', view === 'list' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600')}><List className="w-4 h-4" /></button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    view === 'grid' ? (
                        <div className={cn(GRID, 'mt-4')}>
                            {Array.from({ length: 12 }).map((_, i) => (
                                <div key={i} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                    <Skeleton className="w-full aspect-[4/3] rounded-none" />
                                    <div className="px-2.5 py-2 space-y-1.5 border-t border-slate-100"><Skeleton className="h-3 w-3/4" /><Skeleton className="h-2 w-1/2" /></div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="mt-4 space-y-1">
                            {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-11 rounded-lg" />)}
                        </div>
                    )
                ) : isEmpty ? (
                    <div className="mt-4 flex flex-col items-center justify-center py-24 bg-white rounded-xl border border-dashed border-slate-200">
                        <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-4"><FileX2 className="w-8 h-8 text-slate-300" /></div>
                        <h3 className="text-sm font-medium text-slate-700 mb-1">{searchQuery ? `No matches for “${searchQuery}”` : 'This folder is empty'}</h3>
                        <p className="text-xs text-slate-400 mb-4">{searchQuery ? 'Try a different search term' : 'Drop files here, upload, or create a folder'}</p>
                        {!searchQuery && (
                            <div className="flex items-center gap-2">
                                <Button onClick={() => setCreateFolderDialog({ open: true, name: '' })} size="sm" variant="outline"><FolderPlus className="w-3.5 h-3.5 mr-1 text-amber-500" /> New Folder</Button>
                                <Button onClick={() => fileInputRef.current?.click()} size="sm" className="bg-slate-900 hover:bg-slate-800 text-white"><Upload className="w-3.5 h-3.5 mr-1" /> Upload</Button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="mt-4 space-y-5">
                        {view === 'list' && (
                            <div className={cn(ROW, 'px-3 pb-1.5 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-400')}>
                                <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-slate-700 justify-self-start">Name <SortArrow field="name" /></button>
                                <button onClick={() => toggleSort('size_bytes')} className="flex items-center gap-1 hover:text-slate-700 justify-self-start">Size <SortArrow field="size_bytes" /></button>
                                <button onClick={() => toggleSort('updated_at')} className="hidden sm:flex items-center gap-1 hover:text-slate-700 justify-self-start">Modified <SortArrow field="updated_at" /></button>
                                <span className="hidden sm:block text-center">Type</span>
                                <span />
                            </div>
                        )}
                        {filteredFolders.length > 0 && (
                            <div>
                                <SectionLabel count={filteredFolders.length}>Folders</SectionLabel>
                                <div className={view === 'grid' ? GRID : 'space-y-0.5'}>
                                    {filteredFolders.map((folder) => (
                                        <FolderItem key={`folder-${folder.id}`} folder={folder} view={view} onOpen={openFolder} onAction={onFolderAction} />
                                    ))}
                                </div>
                            </div>
                        )}
                        {filteredFiles.length > 0 && (
                            <div>
                                <SectionLabel count={filteredFiles.length}>Files</SectionLabel>
                                <div className={view === 'grid' ? GRID : 'space-y-0.5'}>
                                    {filteredFiles.map((file) => (
                                        <FileItem key={`file-${file.id}`} file={file} view={view} onOpen={openFile} onAction={onFileAction} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Drag preview */}
                <DragOverlay dropAnimation={{ duration: 180 }}>
                    {activeDrag ? (
                        <div className="flex items-center gap-2 rounded-lg bg-white shadow-xl border border-slate-200 px-3 py-2 max-w-[220px]">
                            {activeDrag.type === 'folder'
                                ? <Folder className="w-5 h-5 text-amber-500 fill-amber-200 shrink-0" />
                                : (() => { const st = typeStyle(activeDrag.item.file_type); const I = st.icon; return <I className={cn('w-5 h-5 shrink-0', st.tint)} />; })()}
                            <span className="text-xs font-medium text-slate-700 truncate">{activeDrag.item.name}</span>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

            {/* Instant document previewer (all types) — chunk loads on demand */}
            {preview.file && (
                <Suspense fallback={null}>
                    <DocumentPreview file={preview.file} open={preview.open} onOpenChange={(open) => setPreview((p) => ({ ...p, open }))} />
                </Suspense>
            )}

            {/* ─── Dialogs ─── */}
            <Dialog open={createFolderDialog.open} onOpenChange={(open) => setCreateFolderDialog({ open, name: '' })}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle className="text-base">Create New Folder</DialogTitle><DialogDescription className="text-sm text-slate-500">Enter a name for your new folder</DialogDescription></DialogHeader>
                    <Input value={createFolderDialog.name} onChange={(e) => setCreateFolderDialog({ ...createFolderDialog, name: e.target.value })} placeholder="Folder name" className="mt-2" onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); }} autoFocus />
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setCreateFolderDialog({ open: false, name: '' })}>Cancel</Button>
                        <Button size="sm" onClick={handleCreateFolder} className="bg-slate-900 hover:bg-slate-800 text-white">Create Folder</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={renameFolderDialog.open} onOpenChange={(open) => setRenameFolderDialog({ open, folder: null, name: '' })}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle className="text-base">Rename Folder</DialogTitle><DialogDescription className="text-sm text-slate-500">Enter a new name for the folder</DialogDescription></DialogHeader>
                    <Input value={renameFolderDialog.name} onChange={(e) => setRenameFolderDialog({ ...renameFolderDialog, name: e.target.value })} placeholder="Folder name" className="mt-2" onKeyDown={(e) => { if (e.key === 'Enter') handleRenameFolder(); }} autoFocus />
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setRenameFolderDialog({ open: false, folder: null, name: '' })}>Cancel</Button>
                        <Button size="sm" onClick={handleRenameFolder} className="bg-slate-900 hover:bg-slate-800 text-white">Rename</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={deleteFolderDialog.open} onOpenChange={(open) => setDeleteFolderDialog({ open, folder: null })}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle className="text-base">Delete Folder</DialogTitle><DialogDescription className="text-sm text-slate-500">Delete <strong>{deleteFolderDialog.folder?.name}</strong> and all its contents? This cannot be undone.</DialogDescription></DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setDeleteFolderDialog({ open: false, folder: null })}>Cancel</Button>
                        <Button variant="destructive" size="sm" onClick={handleDeleteFolder}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, file: null })}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle className="text-base">Delete File</DialogTitle><DialogDescription className="text-sm text-slate-500">Delete <strong>{deleteDialog.file?.name}</strong>? This cannot be undone.</DialogDescription></DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setDeleteDialog({ open: false, file: null })}>Cancel</Button>
                        <Button variant="destructive" size="sm" onClick={handleDelete}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={renameDialog.open} onOpenChange={(open) => setRenameDialog({ open, file: null, name: '' })}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle className="text-base">Rename File</DialogTitle><DialogDescription className="text-sm text-slate-500">Enter a new name for your file</DialogDescription></DialogHeader>
                    <Input value={renameDialog.name} onChange={(e) => setRenameDialog({ ...renameDialog, name: e.target.value })} placeholder="File name" className="mt-2" onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); }} autoFocus />
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setRenameDialog({ open: false, file: null, name: '' })}>Cancel</Button>
                        <Button size="sm" onClick={handleRename} className="bg-emerald-600 hover:bg-emerald-700 text-white">Rename</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
