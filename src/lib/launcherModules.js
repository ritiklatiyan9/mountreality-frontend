import {
  Home, Sprout, BookOpen, NotebookPen, Briefcase, Library, FolderOpen, Wallet,
  FileBox, LayoutGrid, FolderArchive, CalendarClock, BarChart3, HandCoins,
  CreditCard, ShoppingBag, UsersRound, MessageSquare, Sheet, MapPin, UserCog,
  CheckCircle2, Shield, Banknote, LayoutDashboard, QrCode, FileSearch,
  FileText, HardHat, Boxes,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * The full set of "apps" a user could ever launch from the Home page — same
 * destinations as the sidebar (Layout.jsx navItems + collapsible groups).
 * Kept as a separate flat list so the launcher and the sidebar can evolve
 * independently, but `path`/`perm`/`roles` MUST stay in sync with Layout.jsx.
 * `key` is a stable id used only for saved launcher layouts — never rename.
 */
export const ALL_APPS = [
  { key: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: Home, perm: 'dashboard' },
  { key: 'farmers', path: '/farmers', label: 'Farmer Payments', icon: Sprout, perm: 'farmers' },
  { key: 'daybook', path: '/daybook', label: 'Day Book', icon: BookOpen, perm: 'daybook' },
  { key: 'cashflow', path: '/cashflow', label: 'Personal Ledgers', icon: NotebookPen, perm: 'cashflow' },
  { key: 'firm_transactions', path: '/firm-transactions', label: 'Firm Transactions', icon: Briefcase, perm: 'firm_transactions' },
  { key: 'plot_registry', path: '/plot-registry', label: 'Plot Registry', icon: Library, perm: 'plot_registry' },
  { key: 'registry_documents', path: '/plot-registry/documents', label: 'Registry Documents', icon: FolderOpen, perm: 'plot_registry' },
  { key: 'document_search', path: '/documents', label: 'Document Search', icon: FileSearch, perm: 'document_search' },
  { key: 'imprest', path: '/imprest', label: 'Imprest', icon: Wallet, perm: 'imprest' },
  { key: 'document_imprest', path: '/document-imprest', label: 'Document Imprest', icon: FileBox, perm: 'document_imprest' },
  { key: 'upi_collect', path: '/receive-payments', label: 'Receive Payment', icon: QrCode, perm: 'upi_collect' },
  { key: 'plot_payments', path: '/plot-payments', label: 'Plot Payments', icon: LayoutGrid, perm: 'plot_payments' },
  { key: 'plot_documents', path: '/plot-documents', label: 'Plot Documents', icon: FolderArchive, perm: 'plot_payments' },
  { key: 'payment_management', path: '/payment-management', label: 'Payment Tracker', icon: CalendarClock, perm: 'plot_payments' },
  { key: 'payment_analytics', path: '/payment-analytics', label: 'Payment Analytics', icon: BarChart3, perm: 'plot_payments' },
  { key: 'plot_commission', path: '/plot-commission', label: 'Plot Commission', icon: HandCoins, perm: 'commissions' },
  { key: 'expenses', path: '/expenses', label: 'Expenses', icon: CreditCard, perm: 'expenses' },
  { key: 'construction', path: '/construction', label: 'Construction', icon: HardHat, perm: 'construction' },
  { key: 'inventory', path: '/inventory', label: 'Inventory', icon: Boxes, perm: 'inventory' },
  { key: 'vendors', path: '/vendors', label: 'Vendors', icon: ShoppingBag, perm: 'vendors' },
  { key: 'clients', path: '/clients', label: 'Members', icon: UsersRound, perm: 'clients' },
  { key: 'chat', path: '/chat', label: 'Internal Chat', icon: MessageSquare, perm: 'chat' },
  { key: 'excel', path: '/excel/files', label: 'Native Excel', icon: Sheet, perm: 'excel' },
  { key: 'reports', path: '/reports', label: 'Reports', icon: FileText, perm: 'reports' },
  // ── Admin-only ──
  { key: 'sites', path: '/sites', label: 'Sites', icon: MapPin, roles: ['admin', 'super_admin'] },
  { key: 'sub_admins', path: '/sub-admins', label: 'Admin Management', icon: UserCog, roles: ['admin', 'super_admin'] },
  { key: 'pending_approvals', path: '/pending-approvals', label: 'Approvals', icon: CheckCircle2, roles: ['admin', 'super_admin'] },
  { key: 'imprest_management', path: '/imprest-management', label: 'Imprest Management', icon: Banknote, roles: ['admin', 'super_admin'] },
  { key: 'permissions', path: '/permissions', label: 'Permissions', icon: Shield, roles: ['admin', 'super_admin'] },
  { key: 'dashboard_management', path: '/dashboard-management', label: 'Dashboard Management', icon: LayoutDashboard, roles: ['admin', 'super_admin'] },
];

/** Apps this user may actually launch — same role + permission gating as the sidebar. */
export function useVisibleApps() {
  const { user, hasPermission } = useAuth();
  return ALL_APPS.filter((app) => {
    if (app.roles && !app.roles.includes(user?.role)) return false;
    if (app.perm && !hasPermission(app.perm, 'read')) return false;
    return true;
  });
}
