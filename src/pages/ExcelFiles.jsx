import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import {
    DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
    useDraggable, useDroppable, pointerWithin,
} from '@dnd-kit/core';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
    FileSpreadsheet, Plus, Search, Trash2, Copy, Pencil,
    Download, MoreHorizontal, Loader2, FileX2, Clock,
    SortAsc, SortDesc, ArrowUpDown, Upload,
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
    DropdownMenuTrigger, DropdownMenuSeparator,
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
import { AnimatedFolder } from '../components/ui/animated-folder';
import DocumentPreview from '../components/DocumentPreview';
import { cn } from '@/lib/utils';

const FILE_ACCEPT = '.xlsx,.xls,.csv,.pdf,.doc,.docx';
const ALLOWED_EXT = ['xlsx', 'xls', 'csv', 'pdf', 'doc', 'docx'];

// Preview thumbnails shown peeking out of the animated 3D folder on hover.
const folderPreviewImages = {
    excel: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="112" fill="none"><rect width="80" height="112" rx="8" fill="#ecfdf5"/><rect x="12" y="20" width="56" height="72" rx="4" fill="#d1fae5"/><g fill="#6ee7b7"><rect x="16" y="28" width="22" height="8" rx="2"/><rect x="42" y="28" width="22" height="8" rx="2"/><rect x="16" y="40" width="22" height="8" rx="2"/><rect x="42" y="40" width="22" height="8" rx="2"/><rect x="16" y="52" width="22" height="8" rx="2"/><rect x="42" y="52" width="22" height="8" rx="2"/></g><text x="40" y="104" text-anchor="middle" font-size="10" fill="#059669" font-family="sans-serif">XLS</text></svg>')}`,
    pdf: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="112" fill="none"><rect width="80" height="112" rx="8" fill="#fef2f2"/><rect x="16" y="16" width="48" height="64" rx="4" fill="#fecaca"/><path d="M16 16h30l18 18v46a4 4 0 01-4 4H20a4 4 0 01-4-4V20a4 4 0 014-4z" fill="#fca5a5"/><text x="40" y="104" text-anchor="middle" font-size="10" fill="#dc2626" font-family="sans-serif">PDF</text></svg>')}`,
    doc: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="112" fill="none"><rect width="80" height="112" rx="8" fill="#eff6ff"/><rect x="16" y="16" width="48" height="64" rx="4" fill="#bfdbfe"/><g fill="#93c5fd"><rect x="22" y="30" width="36" height="4" rx="2"/><rect x="22" y="38" width="28" height="4" rx="2"/><rect x="22" y="46" width="32" height="4" rx="2"/></g><text x="40" y="104" text-anchor="middle" font-size="10" fill="#2563eb" font-family="sans-serif">DOC</text></svg>')}`,
};
const getFolderProjects = (folder) => [
    { id: `${folder.id}-1`, image: folderPreviewImages.excel, title: 'Spreadsheets' },
    { id: `${folder.id}-2`, image: folderPreviewImages.pdf, title: 'Documents' },
    { id: `${folder.id}-3`, image: folderPreviewImages.doc, title: 'Files' },
];

// ── file-type theming ────────────────────────────────────────────────
const typeStyle = (t) => {
    switch (t) {
        case 'pdf': return { icon: FileText, tint: 'text-rose-600', chip: 'bg-rose-50 text-rose-600 ring-rose-100', grad: 'from-rose-50 to-white', label: 'PDF' };
        case 'doc': return { icon: FileText, tint: 'text-blue-600', chip: 'bg-blue-50 text-blue-600 ring-blue-100', grad: 'from-blue-50 to-white', label: 'DOC' };
        default: return { icon: FileSpreadsheet, tint: 'text-emerald-600', chip: 'bg-emerald-50 text-emerald-600 ring-emerald-100', grad: 'from-emerald-50 to-white', label: 'XLS' };
    }
};

// ── Draggable + droppable folder ─────────────────────────────────────
function FolderItem({ folder, view, onOpen, onAction }) {
    const drag = useDraggable({ id: `folder-${folder.id}`, data: { type: 'folder', item: folder } });
    const drop = useDroppable({ id: `folderdrop-${folder.id}`, data: { kind: 'folder', folderId: folder.id } });
    const setRef = (node) => { drag.setNodeRef(node); drop.setNodeRef(node); };
    const isTarget = drop.isOver;

    const menu = (
        <>
            <ContextMenuItem onClick={() => onOpen(folder)}><FolderInput className="w-3.5 h-3.5 mr-2" /> Open</ContextMenuItem>
            <ContextMenuItem onClick={() => onAction('rename', folder)}><Pencil className="w-3.5 h-3.5 mr-2" /> Rename</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onAction('delete', folder)} className="text-red-600 focus:text-red-600"><Trash2 className="w-3.5 h-3.5 mr-2" /> Delete</ContextMenuItem>
        </>
    );

    const dropRing = isTarget ? 'ring-2 ring-emerald-400 ring-offset-1 bg-emerald-50/60' : '';

    if (view === 'list') {
        return (
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    <div
                        ref={setRef} {...drag.attributes} {...drag.listeners}
                        onClick={() => onOpen(folder)}
                        className={cn('group flex items-center gap-3 px-3 py-2 rounded-lg border border-transparent hover:border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors', dropRing, drag.isDragging && 'opacity-40')}
                    >
                        <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0"><Folder className="w-5 h-5 text-amber-500 fill-amber-200" /></div>
                        <span className="flex-1 text-sm font-medium text-slate-700 truncate">{folder.name}</span>
                        <Badge variant="secondary" className="text-[10px] font-normal text-slate-400 bg-slate-100">Folder</Badge>
                        <RowMenu onClick={(a) => a === 'open' ? onOpen(folder) : onAction(a, folder)} kind="folder" />
                    </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-44">{menu}</ContextMenuContent>
            </ContextMenu>
        );
    }

    // Grid view keeps the animated 3D folder; the wrapper carries drag/drop.
    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    ref={setRef} {...drag.attributes} {...drag.listeners}
                    className={cn('group/card relative rounded-2xl transition-all', dropRing, drag.isDragging && 'opacity-40')}
                >
                    <div className="absolute top-2 right-2 z-40 opacity-0 group-hover/card:opacity-100 transition-opacity">
                        <CardMenu onClick={(a) => a === 'open' ? onOpen(folder) : onAction(a, folder)} kind="folder" />
                    </div>
                    <AnimatedFolder
                        title={folder.name}
                        projects={getFolderProjects(folder)}
                        onClick={() => onOpen(folder)}
                        isCompact
                        className="w-full"
                    />
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-44">{menu}</ContextMenuContent>
        </ContextMenu>
    );
}

// ── Draggable file ───────────────────────────────────────────────────
function FileItem({ file, view, onOpen, onAction }) {
    const drag = useDraggable({ id: `file-${file.id}`, data: { type: 'file', item: file } });
    const st = typeStyle(file.file_type);
    const Icon = st.icon;
    const dateStr = file.updated_at ? format(new Date(file.updated_at), 'dd MMM yyyy') : '—';

    const menu = (
        <>
            <ContextMenuItem onClick={() => onOpen(file)}><ExternalLink className="w-3.5 h-3.5 mr-2" /> Open</ContextMenuItem>
            <ContextMenuItem onClick={() => onAction('rename', file)}><Pencil className="w-3.5 h-3.5 mr-2" /> Rename</ContextMenuItem>
            <ContextMenuItem onClick={() => onAction('duplicate', file)}><Copy className="w-3.5 h-3.5 mr-2" /> Duplicate</ContextMenuItem>
            <ContextMenuItem onClick={() => onAction('download', file)}><Download className="w-3.5 h-3.5 mr-2" /> Download</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onAction('delete', file)} className="text-red-600 focus:text-red-600"><Trash2 className="w-3.5 h-3.5 mr-2" /> Delete</ContextMenuItem>
        </>
    );

    if (view === 'list') {
        return (
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    <div
                        ref={drag.setNodeRef} {...drag.attributes} {...drag.listeners}
                        onClick={() => onOpen(file)}
                        className={cn('group flex items-center gap-3 px-3 py-2 rounded-lg border border-transparent hover:border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors', drag.isDragging && 'opacity-40')}
                    >
                        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br', st.grad)}><Icon className={cn('w-5 h-5', st.tint)} /></div>
                        <span className="flex-1 text-sm font-medium text-slate-700 truncate">{file.name}</span>
                        <span className="text-xs text-slate-400 hidden sm:block w-28 shrink-0">{dateStr}</span>
                        <Badge className={cn('text-[10px] font-semibold ring-1 border-0', st.chip)}>{st.label}</Badge>
                        <RowMenu onClick={(a) => a === 'open' ? onOpen(file) : onAction(a, file)} kind="file" />
                    </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-44">{menu}</ContextMenuContent>
            </ContextMenu>
        );
    }

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    ref={drag.setNodeRef} {...drag.attributes} {...drag.listeners}
                    onClick={() => onOpen(file)}
                    className={cn('group relative rounded-xl border border-slate-200 bg-white hover:shadow-md hover:border-emerald-200 cursor-pointer transition-all overflow-hidden flex flex-col', drag.isDragging && 'opacity-40')}
                >
                    <div className="absolute top-1.5 right-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <CardMenu onClick={(a) => a === 'open' ? onOpen(file) : onAction(a, file)} kind="file" />
                    </div>
                    <div className={cn('w-full aspect-[4/3] flex items-center justify-center bg-gradient-to-br relative', st.grad)}>
                        <Icon className={cn('w-9 h-9', st.tint, 'opacity-80')} />
                        <span className={cn('absolute bottom-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded ring-1', st.chip)}>{st.label}</span>
                    </div>
                    <div className="p-2 border-t border-slate-100">
                        <h3 className="text-xs font-medium text-slate-700 leading-tight truncate">{file.name}</h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">{dateStr}</p>
                    </div>
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-44">{menu}</ContextMenuContent>
        </ContextMenu>
    );
}

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
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
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
            className={cn('rounded-md px-1.5 py-0.5 transition-colors', isOver && active && 'bg-emerald-100 ring-1 ring-emerald-300')}
        >
            {children}
        </span>
    );
}

export default function ExcelFiles() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { currentSite } = useAuth();

    const siteId = currentSite?.id;
    const currentFolderId = searchParams.get('folderId') || null;

    const [files, setFiles] = useState([]);
    const [folders, setFolders] = useState([]);
    const [breadcrumb, setBreadcrumb] = useState([]);
    const [loading, setLoading] = useState(true);
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

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

    const setViewPref = (v) => { setView(v); localStorage.setItem('fm_view', v); };

    useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [currentFolderId, siteId]);

    const fetchData = async () => {
        if (!siteId) return;
        try {
            setLoading(true);
            const [filesRes, foldersRes] = await Promise.all([
                api.get('/excel', { params: { folderId: currentFolderId, site_id: siteId } }),
                api.get('/folders', { params: { parentId: currentFolderId, site_id: siteId } }),
            ]);
            setFiles(filesRes.data.files || []);
            setFolders(foldersRes.data.folders || []);
            setBreadcrumb(foldersRes.data.breadcrumb || []);
        } catch {
            toast.error('Failed to load files');
        } finally {
            setLoading(false);
        }
    };

    const navigateToFolder = (folderId) => {
        setSearchParams(folderId ? { folderId: String(folderId) } : {});
    };

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
        fetchData();
    }, [currentFolderId, siteId]); // eslint-disable-line

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: uploadFiles, noClick: true, noKeyboard: true,
        accept: undefined,
    });

    // ── open — every type opens the previewer INSTANTLY; content loads
    //    inside the already-open modal (no fetch-before-open lag) ──────
    const openFile = (file) => setPreview({ open: true, file });

    // ── per-item actions ─────────────────────────────────────────────
    const onFileAction = async (action, file) => {
        if (action === 'rename') return setRenameDialog({ open: true, file, name: file.name });
        if (action === 'delete') return setDeleteDialog({ open: true, file });
        if (action === 'duplicate') {
            try { await api.post(`/excel/${file.id}/duplicate`); toast.success('File duplicated'); fetchData(); }
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
    };

    const onFolderAction = (action, folder) => {
        if (action === 'rename') return setRenameFolderDialog({ open: true, folder, name: folder.name });
        if (action === 'delete') return setDeleteFolderDialog({ open: true, folder });
    };

    // ── CRUD dialogs ─────────────────────────────────────────────────
    const handleCreateFolder = async () => {
        const name = createFolderDialog.name.trim();
        if (!name) return;
        try { await api.post('/folders', { name, parentId: currentFolderId, site_id: siteId }); toast.success('Folder created'); setCreateFolderDialog({ open: false, name: '' }); fetchData(); }
        catch { toast.error('Failed to create folder'); }
    };
    const handleRenameFolder = async () => {
        const name = renameFolderDialog.name.trim();
        if (!name) return;
        try { await api.put(`/folders/${renameFolderDialog.folder.id}/rename`, { name }); toast.success('Folder renamed'); setRenameFolderDialog({ open: false, folder: null, name: '' }); fetchData(); }
        catch { toast.error('Failed to rename folder'); }
    };
    const handleDeleteFolder = async () => {
        try { await api.delete(`/folders/${deleteFolderDialog.folder.id}`); toast.success('Folder deleted'); setDeleteFolderDialog({ open: false, folder: null }); fetchData(); }
        catch { toast.error('Failed to delete folder'); }
    };
    const handleRename = async () => {
        const name = renameDialog.name.trim();
        if (!name) return;
        try { await api.put(`/excel/${renameDialog.file.id}/rename`, { name }); toast.success('File renamed'); setRenameDialog({ open: false, file: null, name: '' }); fetchData(); }
        catch { toast.error('Failed to rename file'); }
    };
    const handleDelete = async () => {
        try { await api.delete(`/excel/${deleteDialog.file.id}`); toast.success('File deleted'); setDeleteDialog({ open: false, file: null }); fetchData(); }
        catch { toast.error('Failed to delete file'); }
    };

    // ── filter + sort ────────────────────────────────────────────────
    const q = searchQuery.toLowerCase();
    const filteredFolders = folders.filter((f) => f.name.toLowerCase().includes(q));
    const filteredFiles = files
        .filter((f) => f.name.toLowerCase().includes(q))
        .sort((a, b) => {
            const av = sortBy === 'name' ? a.name.toLowerCase() : new Date(a[sortBy]).getTime();
            const bv = sortBy === 'name' ? b.name.toLowerCase() : new Date(b[sortBy]).getTime();
            if (sortOrder === 'asc') return av > bv ? 1 : -1;
            return av < bv ? 1 : -1;
        });
    const toggleSort = (field) => {
        if (sortBy === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        else { setSortBy(field); setSortOrder('desc'); }
    };

    const parentId = breadcrumb.length > 1 ? breadcrumb[breadcrumb.length - 2].id : null;
    const gridCls = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3';

    if (!currentSite) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <Building2 className="w-10 h-10 text-slate-200 mb-3" />
                <p className="text-sm text-slate-500">Select a site to view files</p>
            </div>
        );
    }

    return (
        <div {...getRootProps()} className="relative space-y-5 outline-none">
                <input {...getInputProps()} />
                <input type="file" ref={fileInputRef} onChange={(e) => { uploadFiles(e.target.files); e.target.value = ''; }} accept={FILE_ACCEPT} multiple className="hidden" />

                {/* OS drag-to-upload overlay */}
                {isDragActive && (
                    <div className="fixed inset-0 z-50 bg-emerald-500/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
                        <div className="bg-white rounded-2xl shadow-xl border-2 border-dashed border-emerald-400 px-10 py-8 flex flex-col items-center gap-3">
                            <Upload className="w-10 h-10 text-emerald-500" />
                            <p className="text-sm font-semibold text-slate-700">Drop files to upload</p>
                            <p className="text-xs text-slate-400">xlsx · xls · csv · pdf · doc · docx</p>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="h-9 w-9 p-0 rounded-lg border border-slate-200 bg-white shadow-sm hover:bg-slate-50">
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                        <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-600 via-emerald-500 to-teal-500 flex items-center justify-center shadow-sm shadow-emerald-500/25 ring-1 ring-inset ring-white/25 shrink-0">
                            <FileSpreadsheet className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Documents</h1>
                                <Badge variant="secondary" className="bg-slate-100 text-slate-500 text-[10px] font-medium hidden sm:inline-flex">
                                    {folders.length} folder{folders.length === 1 ? '' : 's'} · {files.length} file{files.length === 1 ? '' : 's'}
                                </Badge>
                            </div>
                            <p className="text-sm text-slate-500">Drag &amp; drop to organize · <span className="font-medium text-slate-700">{currentSite.name}</span></p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button onClick={() => setCreateFolderDialog({ open: true, name: '' })} variant="outline" className="h-9 border-slate-200"><FolderPlus className="w-4 h-4 mr-1.5 text-amber-500" /> New Folder</Button>
                        <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="h-9 border-slate-200" disabled={uploading}>
                            {uploading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5 text-blue-500" />} Upload
                        </Button>
                        <Button onClick={() => navigate('/excel/new')} className="h-9 bg-slate-900 hover:bg-slate-800 text-white"><Plus className="w-4 h-4 mr-1.5" /> New Spreadsheet</Button>
                    </div>
                </div>

                <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={({ active }) => setActiveDrag(active.data.current)} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDrag(null)}>
                    {/* Toolbar: breadcrumb + search + sort + view */}
                    <div className="flex flex-col lg:flex-row lg:items-center gap-3 bg-white rounded-xl border border-slate-200 px-3 py-2">
                        <div className="flex items-center gap-1 text-sm flex-1 min-w-0 overflow-x-auto">
                            <CrumbDrop id="crumb-root" folderId={null} active={!!activeDrag && currentFolderId}>
                                <button onClick={() => navigateToFolder(null)} className={cn('flex items-center gap-1 px-1 text-slate-500 hover:text-emerald-600 transition-colors', !currentFolderId && 'text-emerald-700 font-semibold')}>
                                    <Home className="w-4 h-4" /> <span>Root</span>
                                </button>
                            </CrumbDrop>
                            {breadcrumb.map((crumb) => {
                                const isCurrent = String(crumb.id) === String(currentFolderId);
                                return (
                                    <div key={crumb.id} className="flex items-center gap-1 shrink-0">
                                        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                                        <CrumbDrop id={`crumb-${crumb.id}`} folderId={crumb.id} active={!!activeDrag && !isCurrent}>
                                            <button onClick={() => navigateToFolder(crumb.id)} className={cn('text-slate-500 hover:text-emerald-600 transition-colors truncate max-w-[160px]', isCurrent && 'text-emerald-700 font-semibold')}>
                                                {crumb.name}
                                            </button>
                                        </CrumbDrop>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <div className="relative w-full lg:w-56">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input placeholder="Search…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-8 text-sm" />
                            </div>
                            <Separator orientation="vertical" className="h-6 hidden lg:block" />
                            <Button variant={sortBy === 'updated_at' ? 'secondary' : 'ghost'} size="sm" onClick={() => toggleSort('updated_at')} className="h-8 text-xs px-2">
                                <Clock className="w-3.5 h-3.5 mr-1" /> Date {sortBy === 'updated_at' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3 ml-0.5" /> : <SortDesc className="w-3 h-3 ml-0.5" />)}
                            </Button>
                            <Button variant={sortBy === 'name' ? 'secondary' : 'ghost'} size="sm" onClick={() => toggleSort('name')} className="h-8 text-xs px-2">
                                <ArrowUpDown className="w-3.5 h-3.5 mr-1" /> Name {sortBy === 'name' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3 ml-0.5" /> : <SortDesc className="w-3 h-3 ml-0.5" />)}
                            </Button>
                            <div className="flex items-center rounded-lg border border-slate-200 p-0.5">
                                <button onClick={() => setViewPref('grid')} className={cn('h-7 w-7 rounded flex items-center justify-center transition-colors', view === 'grid' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600')}><LayoutGrid className="w-4 h-4" /></button>
                                <button onClick={() => setViewPref('list')} className={cn('h-7 w-7 rounded flex items-center justify-center transition-colors', view === 'list' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600')}><List className="w-4 h-4" /></button>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    {loading ? (
                        <div className={gridCls}>
                            {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="rounded-xl aspect-[4/5]" />)}
                        </div>
                    ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border border-dashed border-slate-200">
                            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-4"><FileX2 className="w-8 h-8 text-slate-300" /></div>
                            <h3 className="text-sm font-medium text-slate-700 mb-1">{searchQuery ? 'No results found' : 'This folder is empty'}</h3>
                            <p className="text-xs text-slate-400 mb-4">{searchQuery ? 'Try a different search term' : 'Drop files here, upload, or create a folder'}</p>
                            {!searchQuery && (
                                <div className="flex items-center gap-2">
                                    <Button onClick={() => setCreateFolderDialog({ open: true, name: '' })} size="sm" variant="outline"><FolderPlus className="w-3.5 h-3.5 mr-1 text-amber-500" /> New Folder</Button>
                                    <Button onClick={() => fileInputRef.current?.click()} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white"><Upload className="w-3.5 h-3.5 mr-1" /> Upload</Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {filteredFolders.length > 0 && (
                                <div>
                                    <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">Folders <Badge variant="secondary" className="bg-slate-100 text-slate-400 text-[10px] font-normal">{filteredFolders.length}</Badge></h2>
                                    <div className={view === 'grid' ? gridCls : 'space-y-1'}>
                                        {filteredFolders.map((folder) => (
                                            <FolderItem key={`folder-${folder.id}`} folder={folder} view={view} onOpen={(f) => navigateToFolder(f.id)} onAction={onFolderAction} />
                                        ))}
                                    </div>
                                </div>
                            )}
                            {filteredFiles.length > 0 && (
                                <div>
                                    <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">Files <Badge variant="secondary" className="bg-slate-100 text-slate-400 text-[10px] font-normal">{filteredFiles.length}</Badge></h2>
                                    <div className={view === 'grid' ? gridCls : 'space-y-1'}>
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
                                    : (() => { const I = typeStyle(activeDrag.item.file_type).icon; return <I className={cn('w-5 h-5 shrink-0', typeStyle(activeDrag.item.file_type).tint)} />; })()}
                                <span className="text-xs font-medium text-slate-700 truncate">{activeDrag.item.name}</span>
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>

                {/* Instant document previewer (all types) */}
                <DocumentPreview file={preview.file} open={preview.open} onOpenChange={(open) => setPreview((p) => ({ ...p, open }))} />

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
