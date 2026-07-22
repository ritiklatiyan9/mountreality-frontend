import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList,
} from 'recharts';
import {
  ArrowLeft, ArrowUpDown, Search, Users, Wallet, HandCoins, Scale, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';

/* Ledger Analytics — compares every person ledger of the current site.
   Data: GET /cashflow/months (per-person aggregates are already computed
   server-side); selection in the table drives the comparison chart. */

// Validated palette (dataviz method): Given = blue, Returned = aqua.
// Aqua is <3:1 on white — relief via legend labels, tooltips and the table.
const C_GIVEN = '#2a78d6';
const C_RETURNED = '#1baf7a';
const INK_MUTED = '#898781';
const GRID = '#e2e8f0';

const fmt = (v) => (parseFloat(v) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
const fmtCompact = (v) => `₹${compact.format(parseFloat(v) || 0)}`;

const tooltipStyle = {
  borderRadius: 8, border: `1px solid ${GRID}`, fontSize: 12,
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
};

const SortHead = ({ label, k, className, style, onSort }) => (
  <th className={className} style={style}>
    <Button variant="ghost" size="sm" onClick={() => onSort(k)} className="h-6 px-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
      {label} <ArrowUpDown className="w-3 h-3 ml-1" />
    </Button>
  </th>
);

const CashFlowAnalytics = () => {
  const navigate = useNavigate();
  const { currentSite } = useAuth();
  const siteId = currentSite?.id;

  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [sortKey, setSortKey] = useState('pending');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    if (!siteId) return;
    setLoading(true);
    setSelected(new Set());
    api.get(`/cashflow/months?site_id=${siteId}`)
      .then(({ data }) => {
        setPersons((data.months || [])
          .filter((m) => m.ledger_type === 'person')
          .map((m) => ({
            ...m,
            given: parseFloat(m.total_debit) || 0,
            returned: parseFloat(m.total_credit) || 0,
            pending: (parseFloat(m.total_debit) || 0) - (parseFloat(m.total_credit) || 0),
          })));
      })
      .catch(() => setPersons([]))
      .finally(() => setLoading(false));
  }, [siteId]);

  const totals = useMemo(() => persons.reduce((acc, p) => ({
    given: acc.given + p.given,
    returned: acc.returned + p.returned,
    pending: acc.pending + p.pending,
  }), { given: 0, returned: 0, pending: 0 }), [persons]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? persons.filter((p) => (p.ledger_name || '').toLowerCase().includes(q)) : [...persons];
    const dir = sortDir === 'asc' ? 1 : -1;
    return list.sort((a, b) => sortKey === 'name'
      ? dir * (a.ledger_name || '').localeCompare(b.ledger_name || '')
      : dir * ((a[sortKey] || 0) - (b[sortKey] || 0)));
  }, [persons, search, sortKey, sortDir]);

  const filteredTotals = useMemo(() => filtered.reduce((acc, p) => ({
    entries: acc.entries + (parseInt(p.entry_count) || 0),
    given: acc.given + p.given,
    returned: acc.returned + p.returned,
    pending: acc.pending + p.pending,
    cash_given: acc.cash_given + (parseFloat(p.cash_given) || 0),
    cash_received: acc.cash_received + (parseFloat(p.cash_received) || 0),
    bank_given: acc.bank_given + (parseFloat(p.bank_given) || 0),
    bank_received: acc.bank_received + (parseFloat(p.bank_received) || 0),
  }), { entries: 0, given: 0, returned: 0, pending: 0, cash_given: 0, cash_received: 0, bank_given: 0, bank_received: 0 }), [filtered]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'name' ? 'asc' : 'desc'); }
  };

  const toggleSelect = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const someSelected = filtered.some((p) => selected.has(p.id));
  const toggleSelectAll = () => setSelected((prev) => {
    const next = new Set(prev);
    if (allFilteredSelected) filtered.forEach((p) => next.delete(p.id));
    else filtered.forEach((p) => next.add(p.id));
    return next;
  });

  // ── Chart data ──
  const topPending = useMemo(() => [...persons]
    .sort((a, b) => b.pending - a.pending)
    .slice(0, 10)
    .map((p) => ({ name: p.ledger_name, pending: Math.max(0, p.pending) })), [persons]);

  const selectedPersons = useMemo(() => persons.filter((p) => selected.has(p.id)), [persons, selected]);
  const comparing = selectedPersons.length > 0
    ? selectedPersons.slice(0, 12)
    : [...persons].sort((a, b) => b.pending - a.pending).slice(0, 5);
  const compareData = comparing.map((p) => ({ name: p.ledger_name, Given: p.given, Returned: p.returned }));

  const kpis = [
    { label: 'Members', value: fmt(persons.length), icon: Users, sub: `${persons.filter((p) => Math.abs(p.pending) < 0.5).length} fully settled` },
    { label: 'Total Given', value: `₹${fmt(totals.given)}`, icon: Wallet, sub: 'money out, all members' },
    { label: 'Total Returned', value: `₹${fmt(totals.returned)}`, icon: HandCoins, sub: 'money back, all members' },
    { label: 'Net Pending', value: `₹${fmt(totals.pending)}`, icon: Scale, sub: totals.given > 0 ? `${((totals.returned / totals.given) * 100).toFixed(1)}% recovered` : '—' },
  ];

  const numTh = 'text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right px-3 py-2 whitespace-nowrap';
  const numTd = 'px-3 py-2 text-right tabular-nums whitespace-nowrap';

  return (
    <div className="max-w-350 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate('/cashflow')} className="h-8 w-8 p-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-slate-900">Ledger Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Compare all person ledgers{currentSite?.name ? ` · ${currentSite.name}` : ''}
          </p>
        </div>
        {selected.size > 0 && (
          <Button variant="outline" size="sm" onClick={() => setSelected(new Set())} className="ml-auto h-8 text-xs">
            <X className="w-3 h-3 mr-1" /> Clear selection ({selected.size})
          </Button>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, sub }) => (
          <Card key={label} className="shadow-none border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                <Icon className="w-3.5 h-3.5" /> {label}
              </div>
              <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
              <p className="mt-0.5 text-[11px] text-slate-400 truncate">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid xl:grid-cols-2 gap-5 items-start">
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold text-slate-800">Top pending balances</h2>
            <p className="text-[11px] text-slate-400 mb-3">Highest money still to be returned, top {topPending.length}</p>
            {topPending.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={topPending.length * 32 + 40}>
                <BarChart data={topPending} layout="vertical" margin={{ left: 8, right: 56, top: 0, bottom: 0 }}>
                  <CartesianGrid horizontal={false} stroke={GRID} />
                  <XAxis type="number" tickFormatter={fmtCompact} tick={{ fontSize: 11, fill: INK_MUTED }} axisLine={{ stroke: GRID }} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: '#52514e' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => [`₹${fmt(v)}`, 'Pending']} contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Bar dataKey="pending" fill={C_GIVEN} barSize={14} radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="pending" position="right" formatter={fmtCompact} style={{ fontSize: 10, fill: INK_MUTED }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none border-slate-200">
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold text-slate-800">Given vs Returned</h2>
            <p className="text-[11px] text-slate-400 mb-3">
              {selectedPersons.length > 0
                ? `Comparing ${comparing.length} selected member${comparing.length === 1 ? '' : 's'}${selectedPersons.length > 12 ? ' (first 12)' : ''}`
                : 'Select members in the table to compare — showing top 5 by pending'}
            </p>
            {compareData.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={compareData.length * 52 + 60}>
                <BarChart data={compareData} layout="vertical" margin={{ left: 8, right: 16, top: 0, bottom: 0 }} barGap={2}>
                  <CartesianGrid horizontal={false} stroke={GRID} />
                  <XAxis type="number" tickFormatter={fmtCompact} tick={{ fontSize: 11, fill: INK_MUTED }} axisLine={{ stroke: GRID }} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: '#52514e' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v, n) => [`₹${fmt(v)}`, n]} contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} iconSize={10} />
                  <Bar dataKey="Given" fill={C_GIVEN} barSize={12} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Returned" fill={C_RETURNED} barSize={12} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Members table — sticky head + sticky person column + select/select-all */}
      <Card className="shadow-none border-slate-200 overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center gap-2 flex-wrap px-4 py-3 border-b border-slate-100 bg-slate-50/60">
            <Users className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-800">All Members</h2>
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-slate-500">{filtered.length}</Badge>
            {selected.size > 0 && (
              <Badge className="text-[10px] h-5 px-1.5 bg-slate-900">{selected.size} selected</Badge>
            )}
            <div className="relative flex-1 min-w-40 max-w-64 ml-auto">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input placeholder="Search member..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-xs bg-white" />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500">No person ledgers{search ? ' match your search' : ' yet'}</p>
          ) : (
            <div className="overflow-auto relative z-0 will-change-scroll" style={{ maxHeight: 'calc(100vh - 280px)', WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-30 bg-slate-50" style={{ boxShadow: '0 1px 0 0 #e2e8f0' }}>
                  <tr>
                    <th className="w-8 text-center sticky left-0 z-40 bg-slate-50 px-3 py-2">
                      <Checkbox
                        checked={allFilteredSelected ? true : someSelected ? 'indeterminate' : false}
                        onCheckedChange={toggleSelectAll}
                        className="align-middle bg-white"
                        aria-label="Select all"
                      />
                    </th>
                    <SortHead
                      label="Person / Entity" k="name"
                      className="text-left sticky left-8 z-40 bg-slate-50 px-3 py-2 min-w-40"
                      style={{ boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)' }}
                    />
                    <th className={numTh}>Entries</th>
                    <SortHead label="Given (₹)" k="given" className={numTh} />
                    <SortHead label="Returned (₹)" k="returned" className={numTh} />
                    <SortHead label="Pending (₹)" k="pending" className={numTh} />
                    <th className={numTh}>Cash Given</th>
                    <th className={numTh}>Cash Recv</th>
                    <th className={numTh}>Bank Given</th>
                    <th className={numTh}>Bank Recv</th>
                    <th className={numTh}>Recovery</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const isSel = selected.has(p.id);
                    return (
                      <tr
                        key={p.id}
                        onClick={() => toggleSelect(p.id)}
                        className={`border-b border-slate-50 cursor-pointer transition-colors ${isSel ? 'bg-blue-50/60 hover:bg-blue-50' : 'hover:bg-slate-50/70'}`}
                      >
                        <td className={`w-8 text-center sticky left-0 z-10 px-3 py-2 ${isSel ? 'bg-blue-50' : 'bg-white'}`} onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={isSel} onCheckedChange={() => toggleSelect(p.id)} className="align-middle bg-white/80" aria-label={`Select ${p.ledger_name}`} />
                        </td>
                        <td
                          className={`sticky left-8 z-10 px-3 py-2 font-medium text-slate-800 whitespace-nowrap ${isSel ? 'bg-blue-50' : 'bg-white'}`}
                          style={{ boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)' }}
                        >
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); navigate(`/cashflow/${p.id}`); }}
                            className="hover:text-blue-600 hover:underline text-left"
                            title="Open ledger"
                          >
                            {p.ledger_name || '—'}
                          </button>
                        </td>
                        <td className={`${numTd} text-slate-500`}>{p.entry_count || 0}</td>
                        <td className={numTd}>₹{fmt(p.given)}</td>
                        <td className={numTd}>₹{fmt(p.returned)}</td>
                        <td className={`${numTd} font-semibold ${p.pending > 0.5 ? 'text-slate-900' : 'text-emerald-600'}`}>₹{fmt(p.pending)}</td>
                        <td className={`${numTd} text-slate-500`}>₹{fmt(p.cash_given)}</td>
                        <td className={`${numTd} text-slate-500`}>₹{fmt(p.cash_received)}</td>
                        <td className={`${numTd} text-slate-500`}>₹{fmt(p.bank_given)}</td>
                        <td className={`${numTd} text-slate-500`}>₹{fmt(p.bank_received)}</td>
                        <td className={`${numTd} text-slate-500`}>{p.given > 0 ? `${Math.min(100, (p.returned / p.given) * 100).toFixed(0)}%` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 z-30 bg-slate-100" style={{ boxShadow: '0 -1px 0 0 #e2e8f0' }}>
                  <tr className="font-semibold text-slate-800">
                    <td className="sticky left-0 z-40 bg-slate-100 px-3 py-2" />
                    <td className="sticky left-8 z-40 bg-slate-100 px-3 py-2" style={{ boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)' }}>
                      Total ({filtered.length})
                    </td>
                    <td className={numTd}>{filteredTotals.entries}</td>
                    <td className={numTd}>₹{fmt(filteredTotals.given)}</td>
                    <td className={numTd}>₹{fmt(filteredTotals.returned)}</td>
                    <td className={numTd}>₹{fmt(filteredTotals.pending)}</td>
                    <td className={numTd}>₹{fmt(filteredTotals.cash_given)}</td>
                    <td className={numTd}>₹{fmt(filteredTotals.cash_received)}</td>
                    <td className={numTd}>₹{fmt(filteredTotals.bank_given)}</td>
                    <td className={numTd}>₹{fmt(filteredTotals.bank_received)}</td>
                    <td className={numTd}>{filteredTotals.given > 0 ? `${((filteredTotals.returned / filteredTotals.given) * 100).toFixed(0)}%` : '—'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CashFlowAnalytics;
