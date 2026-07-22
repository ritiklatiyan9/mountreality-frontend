import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { Switch } from '../components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Plus, Search, ArrowUpDown,
  IndianRupee, LayoutGrid, Users, Loader2, Eye, Edit2, Trash2, AlertCircle, Printer, RefreshCw,
  Banknote, Building2, Download,
} from 'lucide-react';
import { toast } from 'sonner';

const naturalSortPlotNo = (a, b) => {
  const parse = (s) => (s || '').split(/(\d+)/).map((v, i) => i % 2 ? parseInt(v, 10) : v.toLowerCase());
  const pa = parse(a), pb = parse(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] ?? '', vb = pb[i] ?? '';
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
};

const PlotCommissionList = () => {
  const { currentSite } = useAuth();
  const siteId = currentSite?.id;
  const navigate = useNavigate();

  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  // Plot status / commission status / team are multi-select — a Set of
  // active values, empty Set = no filter (matches everything).
  const [statusFilter, setStatusFilter] = useState(() => new Set()); // plot status: BOOKED, REGISTRY, etc.
  const [commissionStatusFilter, setCommissionStatusFilter] = useState(() => new Set()); // Pending, Partial, Completed
  // COMPANY-status plots (bookings cancelled back to company stock whose
  // auto-created commission rows linger) are hidden unless this is ON.
  const [showCompanyPlots, setShowCompanyPlots] = useState(false);
  // Selected plot_no keys — when non-empty, Print outputs only these rows.
  const [selectedPlots, setSelectedPlots] = useState(() => new Set());
  // Agent name (UPPERCASE) → member team, for the Team filter.
  const [memberTeamMap, setMemberTeamMap] = useState({});
  const [teamFilter, setTeamFilter] = useState(() => new Set());
  const [agentFilter, setAgentFilter] = useState('all'); // single agent name, from the dropdown

  // Toggles `value` in/out of a Set-based filter — lets multiple options in
  // the same filter group be active at once.
  const toggleSetFilter = (setter, value) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  };

  const fetchCommissions = useCallback(async () => {
    if (!siteId) return;
    try {
      setLoading(true);
      // Watchdog so the spinner can never hang on a stalled request.
      const watchdog = setTimeout(() => setLoading(false), 15000);
      const res = await api.get(`/plot-commission/list?site_id=${siteId}`);
      clearTimeout(watchdog);
      setCommissions(res.data.commissions || []);
    } catch (err) {
      console.error('Failed to fetch commissions:', err);
      toast.error('Failed to load commissions');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  // Members feed the agent-name → team map; failure just leaves the Team
  // filter hidden, so it must never block the page.
  const fetchMemberTeams = useCallback(async () => {
    if (!siteId) return;
    try {
      const res = await api.get('/members', { params: { site_id: siteId } });
      const map = {};
      (res.data.members || []).forEach(m => {
        if (m.full_name && m.team) map[m.full_name.toUpperCase()] = m.team.toUpperCase();
      });
      setMemberTeamMap(map);
    } catch (err) {
      console.error('Failed to fetch member teams:', err);
      setMemberTeamMap({});
    }
  }, [siteId]);

  useEffect(() => {
    setCommissions([]);
    setSearchQuery('');
    setStatusFilter(new Set());
    setCommissionStatusFilter(new Set());
    setShowCompanyPlots(false);
    setSelectedPlots(new Set());
    setTeamFilter(new Set());
    setAgentFilter('all');
    setMemberTeamMap({});
    fetchCommissions();
    fetchMemberTeams();
  }, [fetchCommissions, fetchMemberTeams]);

  // ── Group by plot_no so every booking/resale of a plot collapses into ONE
  //    row. Built from ALL records first (before filtering) so the rolled-up
  //    numbers and the derived status are whole-plot, then filtered. ──
  const allGroups = useMemo(() => {
    const map = new Map();
    for (const c of commissions) {
      const key = c.plot_no;
      if (!map.has(key)) map.set(key, { plot_no: c.plot_no, entries: [] });
      map.get(key).entries.push(c);
    }
    const groups = [];
    for (const group of map.values()) {
      // newest booking first
      // Newest sale first. A resale always gets a NEW (higher) plot_id, so plot_id
      // is the reliable recency key — using the latest *commission* date is wrong
      // because a commission can be added to an old booking after a resale.
      group.entries.sort((a, b) => (b.plot_id - a.plot_id) || (new Date(b.latest_created_at) - new Date(a.latest_created_at)));
      const latest = group.entries[0];
      // Commission = the single DECIDED commission for the plot (largest seen),
      // NEVER the sum across resale bookings — a 1.3L plot must read 1.3L.
      group.total_commission = Math.max(...group.entries.map(e => parseFloat(e.total_commission) || 0));
      // Paid / cash / bank = summed across EVERY booking & agent of this plot,
      // so the list shows money actually paid out even on previous bookings.
      group.total_paid = group.entries.reduce((s, e) => s + (parseFloat(e.total_paid) || 0), 0);
      group.cash_paid = group.entries.reduce((s, e) => s + (parseFloat(e.cash_paid) || 0), 0);
      group.bank_paid = group.entries.reduce((s, e) => s + (parseFloat(e.bank_paid) || 0), 0);
      // Clamp at 0 so an over-paid plot can't net against other plots' real
      // pending in the page/footer totals (overpayment is surfaced on detail).
      group.balance = Math.max(0, group.total_commission - group.total_paid);
      // Whole-plot status derived from the rolled-up numbers so the badge always
      // agrees with the Paid / Pending columns shown alongside it.
      group.rollup_status = group.total_commission > 0 && group.balance <= 0.5
        ? 'Completed'
        : group.total_paid > 0.5 ? 'Partial' : 'Pending';
      group.plot_id = latest.plot_id;
      group.buyer_name = latest.buyer_name;
      group.plot_size = latest.plot_size;
      group.plot_rate = latest.plot_rate;
      group.commission_rate = latest.commission_rate;
      group.plot_tag = latest.plot_tag;
      group.plot_status = latest.plot_status;
      group.latest_agent_name = latest.latest_agent_name;
      group.latest_agent_phone = latest.latest_agent_phone;
      group.all_agent_names = [...new Set(group.entries.flatMap(e => (e.all_agent_names || '').split(', ').filter(Boolean)))].join(', ');
      // Agents of the CURRENT booking only. Search matches against this, not
      // the historic union, so searching an old (cancelled/resale) booking's
      // agent no longer surfaces rows that display a different agent.
      group.current_agent_names = latest.all_agent_names || latest.latest_agent_name || '';
      // Co-agents on the current booking beyond the displayed one — rendered
      // by name so a search hit on them is visible in the row.
      group.other_current_agents = group.current_agent_names
        .split(', ')
        .filter(n => n && n !== latest.latest_agent_name)
        .join(', ');
      // Teams of the current booking's agents (via members.team).
      group.agent_teams = [...new Set(
        group.current_agent_names.split(', ').map(n => memberTeamMap[n.trim().toUpperCase()]).filter(Boolean)
      )];
      group.booking_count = group.entries.length;            // resale cycles on this plot
      group.agent_count = group.all_agent_names ? group.all_agent_names.split(', ').filter(Boolean).length : 0;
      groups.push(group);
    }
    return groups;
  }, [commissions, memberTeamMap]);

  // COMPANY-status plots hidden unless the toggle is on — everything below
  // (filter chips, table, totals, print) works off this visible set.
  const companyGroupCount = useMemo(
    () => allGroups.filter(g => (g.plot_status || '').toUpperCase() === 'COMPANY').length,
    [allGroups]
  );
  const visibleGroups = useMemo(
    () => (showCompanyPlots ? allGroups : allGroups.filter(g => (g.plot_status || '').toUpperCase() !== 'COMPANY')),
    [allGroups, showCompanyPlots]
  );

  // Available filter options derived from the visible whole-plot groups
  const statusOptions = useMemo(() => {
    const counts = {};
    visibleGroups.forEach(g => {
      const s = (g.plot_status || 'UNKNOWN').toUpperCase();
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visibleGroups]);

  const commissionStatusOptions = useMemo(() => {
    const counts = {};
    visibleGroups.forEach(g => {
      const s = g.rollup_status || 'Unknown';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visibleGroups]);

  // Teams present among the visible groups' current-booking agents.
  const teamOptions = useMemo(() => {
    const counts = {};
    visibleGroups.forEach(g => {
      g.agent_teams.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    });
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visibleGroups]);

  // Agents present among the visible groups' current-booking agents, for the Agent dropdown.
  const agentOptions = useMemo(() => {
    const counts = {};
    visibleGroups.forEach(g => {
      g.current_agent_names.split(', ').filter(Boolean).forEach(name => {
        counts[name] = (counts[name] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visibleGroups]);

  // Filter + sort the groups — search across plot_no, buyer and the CURRENT
  // booking's agents only (past-booking agents caused "search akash → shows
  // sonu" rows); plot-status and whole-plot commission-status filters.
  const groupedCommissions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = visibleGroups.filter((g) => {
      const matchesSearch = !q ||
        g.plot_no?.toLowerCase().includes(q) ||
        g.buyer_name?.toLowerCase().includes(q) ||
        g.latest_agent_name?.toLowerCase().includes(q) ||
        g.current_agent_names?.toLowerCase().includes(q);
      const matchesStatus = statusFilter.size === 0 || statusFilter.has((g.plot_status || '').toUpperCase());
      const matchesCommissionStatus = commissionStatusFilter.size === 0 || commissionStatusFilter.has(g.rollup_status);
      const matchesTeam = teamFilter.size === 0 || g.agent_teams.some(t => teamFilter.has(t));
      const matchesAgent = agentFilter === 'all' || g.current_agent_names.split(', ').includes(agentFilter);
      return matchesSearch && matchesStatus && matchesCommissionStatus && matchesTeam && matchesAgent;
    });
    return [...list].sort((a, b) => {
      const order = naturalSortPlotNo(a.plot_no, b.plot_no);
      return sortOrder === 'asc' ? order : -order;
    });
  }, [visibleGroups, searchQuery, sortOrder, statusFilter, commissionStatusFilter, teamFilter, agentFilter]);

  // Flattened records of the visible groups — used for the record count + agent tally.
  const filteredCommissions = useMemo(
    () => groupedCommissions.flatMap(g => g.entries),
    [groupedCommissions]
  );

  // ── Row selection (selection ∩ current filters is what actually prints) ──
  const selectedVisibleGroups = useMemo(
    () => groupedCommissions.filter(g => selectedPlots.has(g.plot_no)),
    [groupedCommissions, selectedPlots]
  );
  const allFilteredSelected = groupedCommissions.length > 0 && selectedVisibleGroups.length === groupedCommissions.length;

  const toggleSelectPlot = (plotNo) => {
    setSelectedPlots(prev => {
      const next = new Set(prev);
      if (next.has(plotNo)) next.delete(plotNo); else next.add(plotNo);
      return next;
    });
  };

  // Header checkbox — selects/clears every row matching the current filters.
  const toggleSelectAll = () => {
    setSelectedPlots(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) groupedCommissions.forEach(g => next.delete(g.plot_no));
      else groupedCommissions.forEach(g => next.add(g.plot_no));
      return next;
    });
  };

  // Aggregated Stats — use grouped values which already use fixed commission
  const totals = useMemo(() => {
    return groupedCommissions.reduce(
      (acc, g) => {
        acc.total_commission += g.total_commission;
        acc.total_paid += g.total_paid;
        acc.cash_paid += g.cash_paid;
        acc.bank_paid += g.bank_paid;
        acc.balance += g.balance;
        return acc;
      },
      { total_commission: 0, total_paid: 0, cash_paid: 0, bank_paid: 0, balance: 0 }
    );
  }, [groupedCommissions]);

  const uniqueAgentsCount = useMemo(() => {
    const names = new Set();
    filteredCommissions.forEach(c => {
      if (c.all_agent_names) c.all_agent_names.split(', ').forEach(n => names.add(n));
    });
    return names.size;
  }, [filteredCommissions]);

  // Footer totals — use grouped values for correct fixed commission
  const footerTotals = useMemo(() => {
    let totalArea = 0;
    let totalCommission = 0;
    let totalPaid = 0;
    let totalBalance = 0;
    for (const g of groupedCommissions) {
      totalCommission += g.total_commission;
      totalPaid += g.total_paid;
      totalBalance += g.balance;
      totalArea += parseFloat(g.plot_size) || 0;
    }
    return { totalArea, totalCommission, totalPaid, totalBalance };
  }, [groupedCommissions]);

  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  // The same selected-or-filtered scope used by print is exported so the
  // spreadsheet always reconciles with what the user sees in the register.
  const handleExportExcel = () => {
    const exportGroups = selectedVisibleGroups.length > 0 ? selectedVisibleGroups : groupedCommissions;
    if (exportGroups.length === 0) {
      toast.error('No plots to export for the current filters');
      return;
    }

    const exportTotals = exportGroups.reduce(
      (acc, g) => {
        acc.commission += Number(g.total_commission) || 0;
        acc.paid += Number(g.total_paid) || 0;
        acc.cash += Number(g.cash_paid) || 0;
        acc.bank += Number(g.bank_paid) || 0;
        acc.balance += Number(g.balance) || 0;
        return acc;
      },
      { commission: 0, paid: 0, cash: 0, bank: 0, balance: 0 },
    );
    const scope = selectedVisibleGroups.length > 0
      ? `${exportGroups.length} selected plot${exportGroups.length === 1 ? '' : 's'}`
      : `${exportGroups.length} filtered plot${exportGroups.length === 1 ? '' : 's'}`;
    const headers = ['#', 'Plot no.', 'Buyer', 'Plot status', 'Plot size', 'Agent(s)', 'Team', 'Commission rate (₹)', 'Total commission (₹)', 'Paid (₹)', 'Cash paid (₹)', 'Bank paid (₹)', 'Pending (₹)', 'Commission status', 'Bookings'];
    const data = exportGroups.map((g, index) => [
      index + 1,
      g.plot_no || '',
      g.buyer_name || '',
      g.plot_status || '',
      g.plot_size || '',
      g.current_agent_names || g.latest_agent_name || '',
      g.agent_teams.join(', '),
      Number(g.commission_rate) || 0,
      Number(g.total_commission) || 0,
      Number(g.total_paid) || 0,
      Number(g.cash_paid) || 0,
      Number(g.bank_paid) || 0,
      Number(g.balance) || 0,
      g.rollup_status || '',
      Number(g.booking_count) || 1,
    ]);
    const sheetRows = [
      [currentSite?.name || 'Plot Commission'],
      ['Plot Commission Settlement Register'],
      [`Scope: ${scope}`],
      [`Generated: ${new Date().toLocaleString('en-IN')}`],
      [],
      ['Summary', '', '', '', '', '', '', '', 'Total commission', 'Total paid', 'Cash paid', 'Bank paid', 'Pending'],
      ['', '', '', '', '', '', '', '', exportTotals.commission, exportTotals.paid, exportTotals.cash, exportTotals.bank, exportTotals.balance],
      [],
      headers,
      ...data,
      [],
      ['Totals', '', '', '', '', '', '', '', exportTotals.commission, exportTotals.paid, exportTotals.cash, exportTotals.bank, exportTotals.balance, '', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    ws['!merges'] = [
      XLSX.utils.decode_range('A1:O1'),
      XLSX.utils.decode_range('A2:O2'),
      XLSX.utils.decode_range('A3:O3'),
      XLSX.utils.decode_range('A4:O4'),
    ];
    ws['!cols'] = [
      { wch: 6 }, { wch: 13 }, { wch: 25 }, { wch: 15 }, { wch: 13 }, { wch: 28 }, { wch: 16 },
      { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 11 },
    ];
    ws['!rows'] = sheetRows.map((_, index) => ({ hpt: index === 0 ? 26 : index === 1 ? 21 : index === 8 ? 22 : 18 }));
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 8, c: 0 }, e: { r: 8 + data.length, c: headers.length - 1 } }) };
    for (let rowIndex = 6; rowIndex <= 10 + data.length; rowIndex += 1) {
      ['H', 'I', 'J', 'K', 'L', 'M'].forEach((col) => {
        const cell = ws[`${col}${rowIndex + 1}`];
        if (cell && typeof cell.v === 'number') cell.z = '[$₹-en-IN] #,##0';
      });
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plot Commission');
    const safeSite = (currentSite?.name || 'Site').replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(wb, `PlotCommission_${safeSite}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ── Print — outputs ONLY the selected rows (∩ current filters); with no
  //    selection it falls back to everything the filtered table shows. ──
  const handlePrint = () => {
    const printGroups = selectedVisibleGroups.length > 0 ? selectedVisibleGroups : groupedCommissions;
    if (printGroups.length === 0) {
      toast.error('No plots to print for the current filters');
      return;
    }
    const printTotals = printGroups.reduce(
      (acc, g) => {
        acc.commission += g.total_commission;
        acc.paid += g.total_paid;
        acc.balance += g.balance;
        return acc;
      },
      { commission: 0, paid: 0, balance: 0 }
    );

    // Filter context line so the paper says exactly what subset it covers.
    const contextBits = [];
    contextBits.push(selectedVisibleGroups.length > 0
      ? `${printGroups.length} SELECTED PLOT${printGroups.length !== 1 ? 'S' : ''}`
      : `${printGroups.length} PLOT${printGroups.length !== 1 ? 'S' : ''}`);
    if (searchQuery.trim()) contextBits.push(`SEARCH: "${searchQuery.trim().toUpperCase()}"`);
    if (statusFilter.size > 0) contextBits.push(`PLOT STATUS: ${[...statusFilter].join(', ')}`);
    if (commissionStatusFilter.size > 0) contextBits.push(`COMMISSION: ${[...commissionStatusFilter].join(', ').toUpperCase()}`);
    if (teamFilter.size > 0) contextBits.push(`TEAM: ${[...teamFilter].join(', ')}`);
    if (agentFilter !== 'all') contextBits.push(`AGENT: ${agentFilter}`);
    if (showCompanyPlots) contextBits.push('INCL. COMPANY PLOTS');
    contextBits.push(`GENERATED: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`);

    const siteName = (currentSite?.name || '').toUpperCase();
    const siteAddr = [currentSite?.address, currentSite?.city, currentSite?.state].filter(Boolean).join(', ').toUpperCase();
    const fmtINR = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>MASTER COMMISSION STATEMENT - ${currentSite.name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');
    @page { size: A4 landscape; margin: 10mm; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Inter', sans-serif; color: #1e293b; background: #fff; padding: 10mm; }
    .header { text-align: center; border-bottom: 3px double #0f172a; padding-bottom: 5mm; margin-bottom: 8mm; }
    .header h1 { font-family: 'Cinzel', serif; font-size: 24px; color: #0f172a; text-transform: uppercase; }
    .header p { font-size: 9px; color: #64748b; font-weight: 600; margin-top: 3px; }
    .title { text-align: center; font-family: 'Cinzel', serif; font-size: 14px; margin-bottom: 3mm; letter-spacing: 2px; text-decoration: underline; }
    .context { text-align: center; font-size: 9px; color: #64748b; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 5mm; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { background: #f1f5f9; padding: 3mm 2mm; text-align: left; text-transform: uppercase; font-weight: 800; border: 1px solid #cbd5e1; }
    td { padding: 3mm 2mm; border: 1px solid #e2e8f0; }
    .total-row { font-weight: 800; background: #f8fafc; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${siteName}</h1>
    <p>${siteAddr || 'MASTER COMMISSION DISBURSEMENT LEDGER'}</p>
  </div>
  <div class="title">Master Commission Settlement Register</div>
  <div class="context">${contextBits.join(' &nbsp;·&nbsp; ')}</div>
  <table>
    <thead>
      <tr>
        <th>Plot</th>
        <th>Buyer</th>
        <th>Agent(s)</th>
        <th style="text-align:right">Total Comm.</th>
        <th style="text-align:right">Paid</th>
        <th style="text-align:right">Pending</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${printGroups.map(g => `
        <tr>
          <td>${g.plot_no}${g.booking_count > 1 ? ' <small style="color:#b45309">(RESALE)</small>' : ''}</td>
          <td>${g.buyer_name || '—'}</td>
          <td>${g.current_agent_names || g.latest_agent_name || '—'}</td>
          <td style="text-align:right">₹${fmtINR(g.total_commission)}</td>
          <td style="text-align:right; color:#059669">₹${fmtINR(g.total_paid)}</td>
          <td style="text-align:right; color:#dc2626">₹${fmtINR(g.balance)}</td>
          <td>${g.rollup_status}</td>
        </tr>
      `).join('')}
      <tr class="total-row">
        <td colspan="3" style="text-align:right">GRAND TOTALS</td>
        <td style="text-align:right">₹${fmtINR(printTotals.commission)}</td>
        <td style="text-align:right; color:#059669">₹${fmtINR(printTotals.paid)}</td>
        <td style="text-align:right; color:#dc2626">₹${fmtINR(printTotals.balance)}</td>
        <td></td>
      </tr>
    </tbody>
  </table>
  <div class="no-print" style="margin-top:20px; text-align:center;">
    <button onclick="window.print()" style="padding:10px 40px; background:#0f172a; color:#fff; border:none; border-radius:6px; cursor:pointer;">PRINT REGISTER</button>
  </div>
</body>
</html>`;
    const w = window.open('', '_blank');
    if (!w) {
      toast.error('Popup blocked — allow popups for this site to print');
      return;
    }
    w.document.write(html);
    w.document.close();
  };

  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <LayoutGrid className="w-10 h-10 text-slate-200 mb-3" />
        <p className="text-sm text-slate-500">Select a site to view commissions</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl space-y-6">
      {/* ── Header ── */}
      <header className="relative overflow-hidden border-b border-slate-200 pb-5">
        <div className="pointer-events-none absolute -left-14 -top-20 h-48 w-48 rounded-full bg-blue-100/70 blur-3xl" />
        <div className="pointer-events-none absolute right-12 top-0 h-24 w-24 rounded-full bg-sky-100/60 blur-2xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <IndianRupee className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-950">Plot Commission</h1>
                <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                  Payout ledger
                </span>
              </div>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
                Track agent payouts, outstanding commissions, and plot-level settlements for{' '}
                <span className="font-semibold text-slate-700">{currentSite.name}</span>.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {selectedVisibleGroups.length > 0 && (
              <span className="flex h-9 items-center gap-1 rounded-full border border-sky-200 bg-sky-50 pl-3 pr-1 py-0.5">
                <span className="text-[11px] font-semibold text-sky-700">{selectedVisibleGroups.length} selected</span>
                <button
                  onClick={() => setSelectedPlots(new Set())}
                  className="rounded-full px-1.5 py-0.5 text-[11px] font-medium text-sky-600 hover:bg-sky-100"
                >
                  Clear
                </button>
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={loading || groupedCommissions.length === 0}
              className="h-9 rounded-full border-slate-200 bg-white px-4 text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
            >
              <Download className="mr-2 h-4 w-4" />
              {selectedVisibleGroups.length > 0 ? `Excel (${selectedVisibleGroups.length})` : 'Excel'}
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="h-9 rounded-full border-blue-200 px-4 text-blue-700 hover:bg-blue-50 hover:text-blue-800">
              <Printer className="mr-2 h-4 w-4" />
              {selectedVisibleGroups.length > 0 ? `Print Selected (${selectedVisibleGroups.length})` : 'Print Statement'}
            </Button>
          </div>
        </div>
      </header>

      {/* ── Summary ── */}
      <section className="grid overflow-hidden border-y border-slate-200 bg-white sm:grid-cols-2 lg:grid-cols-4">
        <div className="border-b border-slate-200 p-4 sm:border-r lg:border-b-0">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total commission</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50"><IndianRupee className="h-4 w-4 text-emerald-600" /></div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950 tabular-nums">₹{formatCurrency(totals.total_commission)}</p>
          <p className="mt-1 text-[11px] text-slate-400">{groupedCommissions.length} plot{groupedCommissions.length !== 1 ? 's' : ''} · {filteredCommissions.length} records</p>
        </div>
        <div className="border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total paid</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50"><IndianRupee className="h-4 w-4 text-blue-600" /></div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950 tabular-nums">₹{formatCurrency(totals.total_paid)}</p>
          <p className="mt-1 text-[11px] text-slate-400">Approved payouts</p>
        </div>
        <div className="border-b border-slate-200 p-4 sm:border-b-0 sm:border-r">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pending commission</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50"><IndianRupee className="h-4 w-4 text-amber-600" /></div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950 tabular-nums">₹{formatCurrency(totals.balance)}</p>
          <p className="mt-1 text-[11px] text-slate-400">Outstanding balance</p>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active agents</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50"><Users className="h-4 w-4 text-sky-600" /></div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950 tabular-nums">{uniqueAgentsCount}</p>
          <p className="mt-1 text-[11px] text-slate-400">Commission receivers</p>
        </div>
      </section>

      {/* ── Payment split ── Cash + bank reconcile with the paid total. */}
      <section className="grid border-y border-slate-200 bg-white sm:grid-cols-2">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-4 sm:border-b-0 sm:border-r">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Cash paid to agents</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950 tabular-nums">₹{formatCurrency(totals.cash_paid)}</p>
            <p className="mt-1 text-[11px] text-slate-400">
              {totals.total_paid > 0 ? `${Math.round((totals.cash_paid / totals.total_paid) * 100)}% of total paid` : 'No payouts yet'} · Cash
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Banknote className="h-5 w-5" />
          </div>
        </div>
        <div className="flex items-start justify-between gap-4 p-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Bank paid to agents</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950 tabular-nums">₹{formatCurrency(totals.bank_paid)}</p>
            <p className="mt-1 text-[11px] text-slate-400">
              {totals.total_paid > 0 ? `${Math.round((totals.bank_paid / totals.total_paid) * 100)}% of total paid` : 'No payouts yet'} · RTGS, NEFT, IMPS, UPI, cheque
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Building2 className="h-5 w-5" />
          </div>
        </div>
      </section>

      {/* ── Filters ── */}
      <section className="border-y border-slate-200 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">Refine register</p>
            <p className="mt-0.5 text-[11px] text-slate-400">Search, filter, then export exactly the settlements you need.</p>
          </div>
          <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500 sm:inline-flex">
            {groupedCommissions.length} visible
          </span>
        </div>
        <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search plot, buyer, agent..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          {/* Agent Filter — dropdown, single agent by name */}
          {agentOptions.length > 0 && (
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="h-9 w-48 text-xs">
                <SelectValue placeholder="All Agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {agentOptions.map(([name, count]) => (
                  <SelectItem key={name} value={name}>{name} ({count})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {/* Plot Status Filter — multi-select, click toggles membership */}
          {statusOptions.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] uppercase text-slate-400 font-semibold tracking-wider mr-1">Plot:</span>
              <button
                onClick={() => setStatusFilter(new Set())}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  statusFilter.size === 0
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                All ({visibleGroups.length})
              </button>
              {statusOptions.map(([status, count]) => (
                <button
                  key={status}
                  onClick={() => toggleSetFilter(setStatusFilter, status)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                    statusFilter.has(status)
                      ? status === 'BOOKED' ? 'bg-blue-600 text-white border-blue-600'
                        : status === 'REGISTRY' ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {status} ({count})
                </button>
              ))}
            </div>
          )}
          {/* COMPANY plots = cancelled bookings returned to company stock that
              still carry auto-created commission rows — hidden by default. */}
          {companyGroupCount > 0 && (
            <label
              className="flex items-center gap-2 ml-auto cursor-pointer select-none"
              title="Plots with status COMPANY (booking cancelled / returned to company) that still have commission entries"
            >
              <Switch
                checked={showCompanyPlots}
                onCheckedChange={(v) => {
                  setShowCompanyPlots(v);
                  if (!v) setStatusFilter(prev => {
                    if (!prev.has('COMPANY')) return prev;
                    const next = new Set(prev);
                    next.delete('COMPANY');
                    return next;
                  });
                }}
              />
              <span className="text-[11px] font-medium text-slate-500">
                COMPANY plots ({companyGroupCount})
              </span>
            </label>
          )}
        </div>
        {/* Team Filter — teams of the current booking's agents, multi-select */}
        {teamOptions.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase text-slate-400 font-semibold tracking-wider mr-1">Team:</span>
            <button
              onClick={() => setTeamFilter(new Set())}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                teamFilter.size === 0
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              All
            </button>
            {teamOptions.map(([team, count]) => (
              <button
                key={team}
                onClick={() => toggleSetFilter(setTeamFilter, team)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  teamFilter.has(team)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {team} ({count})
              </button>
            ))}
          </div>
        )}
        {/* Commission Payment Status Filter — multi-select */}
        {commissionStatusOptions.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase text-slate-400 font-semibold tracking-wider mr-1">Commission:</span>
            <button
              onClick={() => setCommissionStatusFilter(new Set())}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                commissionStatusFilter.size === 0
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              All
            </button>
            {commissionStatusOptions.map(([status, count]) => (
              <button
                key={status}
                onClick={() => toggleSetFilter(setCommissionStatusFilter, status)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  commissionStatusFilter.has(status)
                    ? status === 'Completed' ? 'bg-emerald-600 text-white border-emerald-600'
                      : status === 'Partial' ? 'bg-amber-600 text-white border-amber-600'
                      : status === 'Pending' ? 'bg-slate-600 text-white border-slate-600'
                      : 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {status} ({count})
              </button>
            ))}
            <span className="text-xs text-slate-400 ml-auto">
              {groupedCommissions.length} plot{groupedCommissions.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
        </div>
      </section>

      {/* ── Master Commission Table ── */}
      <section className="overflow-hidden border-y border-slate-200 bg-white">
        {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
        ) : groupedCommissions.length === 0 ? (
            <div className="text-center py-16">
              <LayoutGrid className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No commission assignments found</p>
              <p className="text-xs text-slate-400 mt-0.5">Assign commission to a plot agent to get started</p>
            </div>
        ) : (
            <div className="overflow-auto relative z-0 will-change-scroll" style={{ maxHeight: 'calc(100vh - 300px)', WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-30 bg-slate-50" style={{ boxShadow: '0 1px 0 0 #e2e8f0' }}>
                  <tr>
                    <th className="sticky left-0 z-40 bg-slate-50 px-3 py-2 w-10">
                      <Checkbox
                        checked={allFilteredSelected ? true : selectedVisibleGroups.length > 0 ? 'indeterminate' : false}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all filtered plots"
                        className="align-middle"
                      />
                    </th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 sticky left-10 z-40 bg-slate-50 px-3 py-2 text-left w-20">
                      <Button variant="ghost" size="sm" onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="h-6 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 -ml-1">
                        Plot No <ArrowUpDown className="w-3 h-3 ml-1" />
                      </Button>
                    </th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 sticky left-30 z-40 bg-slate-50 px-3 py-2 text-left" style={{boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)'}}>Buyer Name</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Plot Size</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Agent</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Comm. Rate</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Total Comm.</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Paid</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Pending</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Status</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedCommissions.map((g) => {
                    const latest = g.entries[0];
                    const isSelected = selectedPlots.has(g.plot_no);
                    // Sticky cells need a SOLID bg (rows scroll beneath them).
                    const stickyBg = isSelected ? 'bg-sky-50' : 'bg-white';
                    return (
                      <tr
                        key={g.plot_no}
                        className={`group border-b cursor-pointer transition-colors ${isSelected ? 'bg-sky-50/60' : 'hover:bg-slate-50/50'}`}
                        onClick={() => navigate(`/plot-commission/plot/${latest.plot_id}?site_id=${siteId}`)}
                        style={{ contentVisibility: 'auto', containIntrinsicSize: '0 44px' }}
                      >
                        <td className={`sticky left-0 z-10 ${stickyBg} px-3 py-2 w-10 cursor-default`} onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelectPlot(g.plot_no)}
                            aria-label={`Select plot ${g.plot_no}`}
                            className="align-middle"
                          />
                        </td>
                        <td className={`sticky left-10 z-10 ${stickyBg} px-3 py-2`}>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[11px] font-mono bg-slate-50 text-slate-700 border-slate-200">
                              {g.plot_no}
                            </Badge>
                            {g.booking_count > 1 && (
                              <Badge className="text-[9px] px-1.5 py-0 font-semibold bg-amber-50 text-amber-700 border-amber-200" variant="outline">
                                <RefreshCw className="w-2.5 h-2.5 mr-0.5" />
                                RESALE
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className={`sticky left-30 z-10 ${stickyBg} px-3 py-2`} style={{boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)'}}>
                          <span className="text-sm text-slate-700">{g.buyer_name || '—'}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-sm text-slate-700">{g.plot_size || '—'}</span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-800">
                              {g.latest_agent_name}
                              {g.agent_teams.length > 0 && (
                                <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 font-semibold bg-blue-50 text-blue-700 border-blue-200 align-middle">
                                  {g.agent_teams.join(', ')}
                                </Badge>
                              )}
                            </span>
                            {g.latest_agent_phone && <span className="text-[10px] text-slate-400">{g.latest_agent_phone}</span>}
                            {g.other_current_agents && (
                              <span className="text-[10px] text-amber-600 font-medium mt-0.5">+ {g.other_current_agents}</span>
                            )}
                            {g.booking_count > 1 && (
                              <span className="text-[10px] text-slate-400 mt-0.5">{g.booking_count} bookings</span>
                            )}
                          </div>
                        </td>
                        <td className="text-right px-3 py-2">
                          <span className="text-sm font-medium text-slate-700 tabular-nums">
                            {g.commission_rate ? `₹${parseFloat(g.commission_rate).toLocaleString('en-IN')}` : '—'}
                          </span>
                        </td>
                        <td className="text-right px-3 py-2">
                          <span className="text-sm font-semibold text-slate-900 tabular-nums">
                            {formatCurrency(g.total_commission)}
                          </span>
                        </td>
                        <td className="text-right px-3 py-2">
                          <span className="text-sm font-medium text-emerald-600 tabular-nums">
                            {formatCurrency(g.total_paid)}
                          </span>
                        </td>
                        <td className="text-right px-3 py-2">
                          <span className="text-sm font-medium text-amber-600 tabular-nums">
                            {formatCurrency(g.balance)}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                             className={`text-[10px] uppercase font-semibold ${
                               g.rollup_status === 'Completed' ? 'bg-emerald-100/50 text-emerald-700 border-emerald-200 outline-emerald-300' :
                               g.rollup_status === 'Partial' ? 'bg-amber-100/50 text-amber-700 border-amber-200 outline-amber-300' :
                               'bg-slate-100/50 text-slate-700 border-slate-200 outline-slate-300'
                             }`}
                             variant="outline"
                          >
                            {g.rollup_status}
                          </Badge>
                        </td>
                        <td className="text-center px-3 py-2">
                          <div className="flex items-center justify-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/plot-commission/plot/${latest.plot_id}?site_id=${siteId}`);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {groupedCommissions.length > 0 && (
                  <tfoot className="sticky bottom-0 z-20 bg-slate-50 border-t-2 border-slate-300">
                    <tr className="font-semibold text-xs">
                      <td className="sticky left-0 z-30 bg-slate-50 px-3 py-2.5 text-slate-700" colSpan={3}>
                        TOTALS
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{footerTotals.totalArea ? footerTotals.totalArea.toLocaleString('en-IN') : '—'}</td>
                      <td className="px-3 py-2.5"></td>
                      <td className="px-3 py-2.5"></td>
                      <td className="text-right px-3 py-2.5 text-slate-900 tabular-nums">₹{formatCurrency(footerTotals.totalCommission)}</td>
                      <td className="text-right px-3 py-2.5 text-emerald-700 tabular-nums">₹{formatCurrency(footerTotals.totalPaid)}</td>
                      <td className="text-right px-3 py-2.5 text-amber-700 tabular-nums">₹{formatCurrency(footerTotals.totalBalance)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
      </section>
    </div>
  );
};

export default PlotCommissionList;
