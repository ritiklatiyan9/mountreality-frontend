import {
  House, LayoutDashboard, UsersRound, Tags, Store, ShoppingBag, Tractor,
  Landmark, FolderArchive, CalendarClock, ChartColumn, Percent, HandCoins,
  Files, Library, FolderOpen, FileSearch, NotebookTabs, BookOpen, Wallet,
  Banknote, Scale, CircleDollarSign, BookOpenCheck, ReceiptIndianRupee,
  Receipt, ListChecks, QrCode, KeyRound, HardHat, Boxes, FileBox, Sheet,
  FilePlus2, MessageSquare, TrendingUp, Crown, MapPin, UserCog, CheckCircle2,
  ShieldCheck, Shield,
  CalendarDays, Gavel, ScrollText, Building, FileText,
} from 'lucide-react';

/* ── Navigation model ────────────────────────────────────────────────
   Every route, label and permission condition here is carried over from
   the previous inline sidebar unchanged — this file only reorganises
   them into named groups so the rail, the drawer and the search can all
   read one structure instead of duplicating the JSX three times.

   A group with `children` renders as a submenu (inline when expanded,
   floating when collapsed). `module` is the permission key checked with
   hasPermission(module, 'read'); groups that need a different condition
   carry an explicit `visible` boolean instead. ── */

export const SIDEBAR_MIN_WIDTH = 220;
export const SIDEBAR_DEFAULT_WIDTH = 252;
export const SIDEBAR_MAX_WIDTH = 360;
export const SIDEBAR_COLLAPSED_WIDTH = 72;

export function buildNavigation({ hasPermission, isAdmin }) {
  const can = (module) => hasPermission(module, 'read');

  /* Registry group is visible when either of its two datasets is. */
  const registryChildren = [
    ...(can('plot_registry') ? [
      { path: '/plot-registry', label: 'Registry list', icon: Library },
      { path: '/plot-registry/documents', label: 'Registry documents', icon: FolderOpen },
    ] : []),
    ...(can('document_search') ? [
      { path: '/documents', label: 'Document search', icon: FileSearch },
    ] : []),
  ];

  const groups = [
    {
      id: 'core',
      label: 'Core',
      items: [
        { path: '/home', label: 'Home', icon: House, visible: can('dashboard') },
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, visible: can('dashboard') },
      ],
    },
    {
      id: 'operations',
      label: 'Operations',
      items: [
        {
          path: '/clients',
          label: 'User management',
          icon: UsersRound,
          visible: can('clients'),
          matches: ['/clients', '/register-user', '/user-categories'],
          children: [
            { path: '/clients', label: 'All members', icon: UsersRound },
            ...(isAdmin ? [{ path: '/user-categories', label: 'User categories', icon: Tags }] : []),
          ],
        },
        {
          path: '/vendors',
          label: 'Vendor management',
          icon: Store,
          visible: can('vendors'),
          matches: ['/vendors'],
          children: [
            { path: '/vendors', label: 'Commitments', icon: ShoppingBag },
            { path: '/vendors/categories', label: 'Categories', icon: Tags },
          ],
        },
        { path: '/farmers', label: 'Farmer payments', icon: Tractor, visible: can('farmers') },
        {
          path: '/plot-payments',
          label: 'Plot payments',
          icon: Landmark,
          visible: can('plot_payments'),
          matches: ['/plot-payments', '/plot-documents', '/payment-management', '/payment-analytics'],
          children: [
            { path: '/plot-payments', label: 'Plot payments', icon: Landmark },
            { path: '/plot-documents', label: 'Plot documents', icon: FolderArchive },
            { path: '/payment-management', label: 'Payment tracker', icon: CalendarClock },
            { path: '/payment-analytics', label: 'Payment analytics', icon: ChartColumn },
          ],
        },
        {
          path: '/plot-commission',
          label: 'Plot commission',
          icon: Percent,
          visible: can('commissions'),
          matches: ['/commissions', '/plot-commission', '/plot-commission/search'],
          children: [
            { path: '/plot-commission', label: 'All commissions', icon: HandCoins },
          ],
        },
        {
          path: '/plot-registry',
          label: 'Registry & documents',
          icon: Files,
          visible: registryChildren.length > 0,
          matches: ['/plot-registry', '/documents'],
          children: registryChildren,
        },
      ],
    },
    {
      id: 'finance',
      label: 'Finance',
      items: [
        {
          path: '/daybook',
          label: 'Day book',
          icon: NotebookTabs,
          visible: can('daybook'),
          matches: ['/daybook', '/daybook/cash', '/daybook/bank'],
          children: [
            { path: '/daybook', label: 'Main day book', icon: BookOpen },
            { path: '/daybook/cash', label: 'Cash day book', icon: Wallet },
            { path: '/daybook/bank', label: 'Bank day book', icon: Banknote },
          ],
        },
        {
          path: '/balance-sheet',
          label: 'Balance sheet',
          icon: Scale,
          visible: can('balance_sheet'),
          matches: ['/balance-sheet', '/balance-sheet/cash', '/balance-sheet/bank'],
          exactMatch: true,
          children: [
            { path: '/balance-sheet', label: 'Main balance sheet', icon: CircleDollarSign },
            { path: '/balance-sheet/bank', label: 'Bank balance sheet', icon: Landmark },
            { path: '/balance-sheet/cash', label: 'Cash balance sheet', icon: Wallet },
          ],
        },
        { path: '/cashflow', label: 'Personal ledgers', icon: BookOpenCheck, visible: can('cashflow') },
        { path: '/firm-transactions', label: 'Bank reconciliation', icon: ReceiptIndianRupee, visible: can('firm_transactions') },
        {
          path: '/expenses',
          label: 'Expenses',
          icon: Receipt,
          visible: can('expenses'),
          matches: ['/expenses', '/expense-categories', '/expense-approvals'],
          children: [
            { path: '/expenses', label: 'All expenses', icon: Receipt },
            { path: '/expense-categories', label: 'Expense categories', icon: Tags },
            ...(isAdmin || can('expense_approval') ? [{ path: '/expense-approvals', label: 'Expense approvals', icon: ListChecks }] : []),
          ],
        },
        { path: '/imprest', label: 'Imprest', icon: Wallet, visible: can('imprest') },
        {
          path: '/receive-payments',
          label: 'Receive payment',
          icon: QrCode,
          visible: can('upi_collect'),
          matches: ['/receive-payments', '/bank-configs'],
          children: [
            { path: '/receive-payments', label: 'Receive money', icon: QrCode },
            { path: '/bank-configs', label: 'Bank configs', icon: KeyRound },
          ],
        },
      ],
    },
    {
      id: 'projects',
      label: 'Projects',
      items: [
        { path: '/construction', label: 'Construction', icon: HardHat, visible: can('construction') },
        { path: '/inventory', label: 'Inventory', icon: Boxes, visible: can('inventory') },
        { path: '/document-imprest', label: 'Document handling', icon: FileBox, visible: can('document_imprest') },
        {
          path: '/excel/files',
          label: 'Native documents',
          icon: Sheet,
          visible: can('excel'),
          matches: ['/excel'],
          children: [
            { path: '/excel/new', label: 'New spreadsheet', icon: FilePlus2 },
            { path: '/excel/files', label: 'All documents', icon: FolderOpen },
          ],
        },
      ],
    },
    {
      id: 'compliance',
      label: 'Compliance',
      items: [
        {
          path: can('compliance') ? '/compliance/dashboard' : '/legal/cases',
          label: 'Compliance & legal',
          icon: ShieldCheck,
          visible: can('compliance') || can('legal'),
          matches: ['/compliance', '/legal'],
          children: [
            ...(can('compliance') ? [
              { path: '/compliance/dashboard', label: 'Control centre', icon: LayoutDashboard },
              { path: '/compliance/my-tasks', label: 'My compliance tasks', icon: ListChecks },
              { path: '/compliance/calendar', label: 'Calendar', icon: CalendarDays },
              { path: '/compliance/register', label: 'Compliance register', icon: ScrollText },
              { path: '/compliance/licences', label: 'Approvals & licences', icon: ShieldCheck },
              { path: '/compliance/documents', label: 'Document expiry', icon: FileText },
              { path: '/legal/inspections', label: 'Inspections & hearings', icon: Building },
              { path: '/compliance/reports', label: 'Compliance reports', icon: ChartColumn },
            ] : []),
            ...(can('legal') ? [
              { path: '/legal/cases', label: 'Legal cases', icon: Gavel },
              { path: '/legal/notices', label: 'Notices & replies', icon: FileText },
              { path: '/legal/hearings', label: 'Hearing calendar', icon: CalendarDays },
            ] : []),
            ...(can('compliance_templates') ? [
              { path: '/compliance/templates', label: 'Templates & filings', icon: Files },
            ] : []),
            ...(can('compliance_settings') ? [
              { path: '/compliance/authorities', label: 'Authorities', icon: Landmark },
              { path: '/compliance/settings', label: 'Settings & audit', icon: Shield },
            ] : []),
          ],
        },
      ],
    },
    {
      id: 'system',
      label: 'System',
      items: [
        { path: '/reports', label: 'Reports', icon: ChartColumn, visible: can('reports') },
        { path: '/finance-forecast', label: 'Finance forecast', icon: TrendingUp, visible: can('finance_forecast') },
        { path: '/chat', label: 'Internal chat', icon: MessageSquare, visible: can('chat') },
      ],
    },
    {
      id: 'admin',
      label: 'Admin',
      items: isAdmin ? [
        { path: '/subscription', label: 'Subscription', icon: Crown, visible: true },
        { path: '/sites', label: 'Sites', icon: MapPin, visible: true },
        { path: '/sub-admins', label: 'Admin management', icon: UserCog, visible: true },
        { path: '/user-id-management', label: 'User ID management', icon: KeyRound, visible: true },
        { path: '/pending-approvals', label: 'Approvals', icon: CheckCircle2, visible: true, badge: 'approvals' },
        { path: '/approval-manager', label: 'Approval manager', icon: ShieldCheck, visible: true },
        { path: '/edit-approvals', label: 'Edit approvals', icon: ShieldCheck, visible: true },
        { path: '/imprest-management', label: 'Imprest management', icon: Banknote, visible: true },
        { path: '/permissions', label: 'Permissions', icon: Shield, visible: true },
        { path: '/dashboard-management', label: 'Dashboard management', icon: LayoutDashboard, visible: true },
      ] : [],
    },
  ];

  // Drop anything the user cannot read, then drop groups left empty.
  return groups
    .map((group) => ({ ...group, items: group.items.filter((item) => item.visible !== false) }))
    .filter((group) => group.items.length > 0);
}

/* Flat, permission-filtered list for the navigation search — includes
   submenu children so "cash" finds the Cash day book. */
export function flattenNavigation(groups) {
  const flat = [];
  groups.forEach((group) => {
    group.items.forEach((item) => {
      flat.push({ path: item.path, label: item.label, icon: item.icon, group: group.label });
      (item.children || []).forEach((child) => {
        flat.push({ path: child.path, label: child.label, icon: child.icon, group: item.label });
      });
    });
  });
  const seen = new Set();
  return flat.filter((item) => {
    if (seen.has(item.path)) return false;
    seen.add(item.path);
    return true;
  });
}

/* Active-route test shared by the rail, the drawer and the search. */
export function isItemActive(item, pathname) {
  const paths = item.matches || [item.path];
  return item.exactMatch
    ? paths.some((p) => pathname === p)
    : paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
