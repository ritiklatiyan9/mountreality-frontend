import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDocViewer } from '../components/DocViewer';
import api from '../api/api';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { CheckCircle2, XCircle, Clock, Loader2, RefreshCw, Printer, ExternalLink } from 'lucide-react';

const MODULE_LABELS = {
  farmer_payment:     { label: 'Farmer Payment',   cls: 'bg-green-50 text-green-700 border-green-200' },
  plot_commission:    { label: 'Plot Commission',   cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  plot_commission_payment: { label: 'Plot Commission', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  cash_flow_entry:    { label: 'Personal Ledger',   cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  firm_transaction:   { label: 'Firm Transaction',  cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  plot_payment:       { label: 'Plot Payment',      cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  expense:            { label: 'Expense',           cls: 'bg-red-50 text-red-700 border-red-200' },
  daybook_farmer:     { label: 'Farmer Payment',    cls: 'bg-green-50 text-green-700 border-green-200' },
  daybook_commission: { label: 'Plot Commission',   cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  daybook_expense:    { label: 'Expense',           cls: 'bg-red-50 text-red-700 border-red-200' },
  imprest_request:    { label: 'Imprest Request',   cls: 'bg-violet-50 text-violet-700 border-violet-200' },
};

// A payment may be entered directly in its module or directly in Day Book.
// The approver only needs one clear category, not the accounting source.
const APPROVAL_GROUPS = {
  farmer_payment: 'farmer_payment',
  daybook_farmer: 'farmer_payment',
  plot_commission: 'plot_commission',
  plot_commission_payment: 'plot_commission',
  daybook_commission: 'plot_commission',
  expense: 'expense',
  daybook_expense: 'expense',
};

const getApprovalGroup = (source) => APPROVAL_GROUPS[source] || source;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[char]));

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getApiSource = (source) => {
  if (!source) return source;
  if (source.startsWith('daybook_') || source === 'daybook') return 'daybook';
  return source;
};

const getEntryAmount = (entry) => {
  const amount = Number(entry.amount);
  if (Number.isFinite(amount) && amount !== 0) return Math.abs(amount);
  return Math.abs(Number(entry.debit) || Number(entry.credit) || 0);
};

const getEntryLedger = (entry) => {
  const debit = Math.abs(Number(entry.debit) || 0);
  const credit = Math.abs(Number(entry.credit) || 0);
  if (debit || credit) return { debit, credit, side: credit > 0 && debit === 0 ? 'credit' : 'debit' };

  const amount = Number(entry.amount) || 0;
  const source = getApprovalGroup(entry.source);
  // Plot payments represent money received. Most other payment requests are
  // money going out; a negative commission payment represents a receipt.
  const isCredit = source === 'plot_payment'
    || (source === 'plot_commission' && amount < 0);
  return isCredit
    ? { debit: 0, credit: Math.abs(amount), side: 'credit' }
    : { debit: Math.abs(amount), credit: 0, side: 'debit' };
};

const getRequestDetails = (entry) => {
  const source = getApprovalGroup(entry.source);
  const module = MODULE_LABELS[source] || MODULE_LABELS[entry.source] || { label: 'Approval' };
  const entityName = entry.entity_name
    || entry.farmer_name
    || entry.agent_name
    || entry.linked_user_name
    || entry.buyer_name
    || entry.to_entity
    || entry.from_entity
    || entry.to_name
    || entry.name
    || entry.firm_name
    || entry.ledger_name
    || entry.payment_from
    || entry.created_by_name
    || 'Recorded entity unavailable';
  const entityType = entry.entity_type
    || (entry.farmer_name ? 'Farmer / land owner' : null)
    || (entry.agent_name ? 'Commission agent' : null)
    || (entry.linked_user_name ? 'Mapped ledger user' : null)
    || (entry.buyer_name ? 'Plot buyer / payer' : null)
    || (entry.firm_name ? 'Firm / account' : null)
    || (entry.ledger_name ? 'Personal ledger' : null)
    || 'Recorded party';
  const plotNo = entry.entity_plot_no || entry.plot_no;
  const entityDetails = [
    plotNo ? `Plot ${plotNo}` : null,
    entry.entity_secondary && entry.entity_secondary !== entityName ? entry.entity_secondary : null,
    entry.buyer_name && entry.buyer_name !== entityName ? `Buyer: ${entry.buyer_name}` : null,
    entry.firm_name && entry.firm_name !== entityName ? `Firm: ${entry.firm_name}` : null,
    entry.ledger_name && entry.ledger_name !== entityName ? `Ledger: ${entry.ledger_name}` : null,
    entry.payment_from && entry.payment_from !== entityName ? `From: ${entry.payment_from}` : null,
    entry.entity_phone ? `Phone: ${entry.entity_phone}` : null,
    entry.entity_address ? `Address: ${entry.entity_address}` : null,
  ].filter((value, index, values) => value && values.indexOf(value) === index);
  const purpose = entry.particular || entry.description || entry.reason || entry.remarks || entry.remark || entry.entry_label || '—';

  return {
    module,
    entityName,
    entityType,
    entityDetails,
    purpose,
    amount: getEntryAmount(entry),
  };
};

const PendingApprovals = () => {
  const { currentSite, isAdmin } = useAuth();
  const openDoc = useDocViewer();
  const siteId = currentSite?.id;

  const [entries, setEntries] = useState([]);
  const [imprestEntries, setImprestEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [counts, setCounts] = useState({ total: 0 });
  const [filter, setFilter] = useState('all');
  const [ledgerTab, setLedgerTab] = useState('all');
  const [selectedItems, setSelectedItems] = useState([]);

  const fetch = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const [pendingRes, countsRes, imprestRes] = await Promise.all([
        api.get(`/approvals/pending?site_id=${siteId}`),
        api.get(`/approvals/counts?site_id=${siteId}`),
        api.get(`/imprest/expense-requests?site_id=${siteId}&status=PENDING`),
      ]);
      setEntries(pendingRes.data.entries || []);
      setCounts(countsRes.data || { total: 0 });
      const raw = (imprestRes.data.requests || []).filter(r => r.status === 'PENDING');
      setImprestEntries(raw.map(r => ({
        id: r.id,
        source: 'imprest_request',
        amount: r.amount,
        voucher_url: r.voucher_url || null,
        entity_name: r.sub_admin_name || r.created_by_name || null,
        entity_type: 'Imprest requester',
        entity_secondary: r.reason || null,
        entry_label: `Imprest Request — ₹${Number(r.amount).toLocaleString('en-IN')}${r.reason ? ` · ${r.reason}` : ''}`,
        date: r.created_at,
        created_by_name: r.sub_admin_name || r.created_by_name || null,
        site_name: r.site_name || null,
        _raw: r,
      })));
    } catch {
      setEntries([]);
      setImprestEntries([]);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleApprove = async (entry) => {
    const key = `${entry.source}-${entry.id}`;
    setActionId(key);
    try {
      if (entry.source === 'imprest_request') {
        await api.put(`/imprest/expense-requests/${entry.id}/approve`);
      } else {
        await api.put(`/approvals/${entry.id}/approve?source=${getApiSource(entry.source)}`);
      }
      await fetch();
    } catch (err) {
      alert(err?.response?.data?.message || 'Approve failed');
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (entry) => {
    const key = `${entry.source}-${entry.id}`;
    setActionId(key);
    try {
      if (entry.source === 'imprest_request') {
        await api.put(`/imprest/expense-requests/${entry.id}/reject`);
      } else {
        await api.put(`/approvals/${entry.id}/reject?source=${getApiSource(entry.source)}`);
      }
      await fetch();
    } catch (err) {
      alert(err?.response?.data?.message || 'Reject failed');
    } finally {
      setActionId(null);
    }
  };

  const isSelected = (entry) => selectedItems.some((item) => item.id === entry.id && item.source === entry.source);

  const handleSelectOne = (entry, checked) => {
    const isChecked = checked === true;
    if (isChecked) {
      setSelectedItems((prev) => {
        if (prev.some((item) => item.id === entry.id && item.source === entry.source)) return prev;
        return [...prev, { id: entry.id, source: entry.source }];
      });
      return;
    }
    setSelectedItems((prev) => prev.filter((item) => !(item.id === entry.id && item.source === entry.source)));
  };

  const handleBulkAction = async (type) => {
    if (selectedItems.length === 0) return;
    setActionId(`bulk-${type}`);
    try {
      const regularItems = selectedItems.filter((item) => item.source !== 'imprest_request');
      const imprestItems = selectedItems.filter((item) => item.source === 'imprest_request');

      if (regularItems.length > 0) {
        const payloadItems = regularItems.map((item) => ({
          id: item.id,
          source: getApiSource(item.source),
        }));

        if (type === 'approve') {
          await api.post('/approvals/bulk-approve', { items: payloadItems });
        } else {
          await api.post('/approvals/bulk-reject', { items: payloadItems });
        }
      }

      if (imprestItems.length > 0) {
        const actionPath = type === 'approve' ? 'approve' : 'reject';
        for (const item of imprestItems) {
          await api.put(`/imprest/expense-requests/${item.id}/${actionPath}`);
        }
      }

      setSelectedItems([]);
      await fetch();
    } catch (err) {
      alert(err?.response?.data?.message || `${type === 'approve' ? 'Bulk approve' : 'Bulk reject'} failed`);
    } finally {
      setActionId(null);
    }
  };

  // Combine equivalent accounting sources in a single, business-friendly filter.
  const sources = [...new Set(entries.map(e => getApprovalGroup(e.source)).filter(Boolean))];

  const moduleFilteredEntries = useMemo(() => (
    filter === 'all'
      ? [...entries, ...imprestEntries]
      : entries.filter(e => getApprovalGroup(e.source) === filter)
  ), [entries, imprestEntries, filter]);
  const filtered = useMemo(() => (
    ledgerTab === 'all'
      ? moduleFilteredEntries
      : moduleFilteredEntries.filter((entry) => getEntryLedger(entry)[ledgerTab] > 0)
  ), [moduleFilteredEntries, ledgerTab]);
  const totalCount = (counts.total || entries.length) + imprestEntries.length;
  const moneyTotals = filtered.reduce((totals, entry) => {
    const ledger = getEntryLedger(entry);
    totals.debit += ledger.debit;
    totals.credit += ledger.credit;
    return totals;
  }, { debit: 0, credit: 0 });
  // Select-all covers every item in the current module and ledger tab.
  const allFilteredEntries = filtered;
  const allVisibleSelected = allFilteredEntries.length > 0 && allFilteredEntries.every((entry) => isSelected(entry));

  const handleSelectAll = (checked) => {
    const isChecked = checked === true;
    if (isChecked) {
      setSelectedItems(allFilteredEntries.map((entry) => ({ id: entry.id, source: entry.source })));
      return;
    }
    setSelectedItems([]);
  };

  useEffect(() => {
    const validKeys = new Set(filtered.map((entry) => `${entry.source}-${entry.id}`));
    setSelectedItems((prev) => {
      const next = prev.filter((item) => validKeys.has(`${item.source}-${item.id}`));
      return next.length === prev.length ? prev : next;
    });
  }, [filtered]);

  const handlePrint = () => {
    const printEntries = filtered;
    if (printEntries.length === 0) {
      alert('There are no approval requests to print in this view.');
      return;
    }

    const rows = printEntries.map((entry, index) => {
      const detail = getRequestDetails(entry);
      return `<tr>
        <td>${index + 1}</td>
        <td><strong>${escapeHtml(detail.module.label)}</strong><br><span>${escapeHtml(detail.purpose)}</span></td>
        <td><strong>${escapeHtml(detail.entityName)}</strong><br><span>${escapeHtml(detail.entityType)}${detail.entityDetails.length ? ` · ${escapeHtml(detail.entityDetails.join(' · '))}` : ''}</span></td>
        <td>${escapeHtml(entry.payment_mode || entry.cash_type || '—')}</td>
        <td>${escapeHtml(fmtDate(entry.date))}</td>
        <td class="amount">₹${detail.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
      </tr>`;
    }).join('');
    const printedAt = new Date().toLocaleString('en-IN');
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Pending Approvals</title>
<style>
  * { box-sizing: border-box; } body { margin: 0; background: #f1f5f9; color: #0f172a; font: 13px/1.45 Arial, sans-serif; }
  .toolbar { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 24px; background: #0f172a; position: sticky; top: 0; }
  button { border: 0; border-radius: 7px; padding: 9px 16px; font-weight: 700; cursor: pointer; } .print { background: #fff; color: #0f172a; } .close { background: #334155; color: #fff; }
  main { max-width: 1120px; margin: 24px auto; padding: 28px; background: #fff; box-shadow: 0 8px 28px rgba(15,23,42,.12); }
  h1 { margin: 0; font-size: 23px; } .sub { margin: 5px 0 24px; color: #64748b; }
  table { width: 100%; border-collapse: collapse; } th { padding: 10px; background: #e2e8f0; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; } td { padding: 11px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; } td span { color: #64748b; font-size: 11px; } .amount { text-align: right; white-space: nowrap; font-weight: 700; } .footer { margin-top: 18px; color: #64748b; font-size: 11px; }
  @media print { body { background: #fff; } .toolbar { display: none; } main { max-width: none; margin: 0; padding: 0; box-shadow: none; } @page { size: A4 landscape; margin: 12mm; } }
</style></head><body>
  <div class="toolbar"><button class="close" onclick="window.close()">Close</button><button class="print" onclick="window.print()">Print</button></div>
  <main><h1>Pending Approval Requests</h1><p class="sub">${escapeHtml(currentSite?.name || 'All sites')} · ${printEntries.length} request${printEntries.length === 1 ? '' : 's'} · Printed ${escapeHtml(printedAt)}</p>
  <table><thead><tr><th>#</th><th>Request / purpose</th><th>Entity / linked details</th><th>Payment mode</th><th>Date</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
  <p class="footer">This is an approval review sheet. Status: pending at the time of printing.</p></main>
</body></html>`;
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) {
      alert('Allow pop-ups for this site to open the print viewer.');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <XCircle className="w-10 h-10 text-red-300 mb-3" />
        <p className="text-sm text-slate-500">Admin access required</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1500px] mx-auto space-y-5 py-6 px-4 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Pending Approvals</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {currentSite?.name || '—'} &middot; {totalCount} pending
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={loading || allFilteredEntries.length === 0}>
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={fetch} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* Module filter chips */}
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              filter === 'all'
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}
          >
            All ({entries.length + imprestEntries.length})
          </button>
          {sources.map(src => {
            const mod = MODULE_LABELS[src] || { label: src, cls: 'bg-slate-50 text-slate-600 border-slate-200' };
            const cnt = entries.filter(e => getApprovalGroup(e.source) === src).length;
            return (
              <button
                key={src}
                onClick={() => setFilter(src)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  filter === src ? 'bg-slate-800 text-white border-slate-800' : `${mod.cls} hover:opacity-80`
                }`}
              >
                {mod.label} ({cnt})
              </button>
            );
          })}
        </div>
      )}

      {/* Ledger tabs keep inflows and outflows separate without hiding context. */}
      <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 w-fit">
        {[
          { key: 'all', label: 'All requests', count: moduleFilteredEntries.length, cls: 'text-slate-700' },
          { key: 'debit', label: 'Debit', count: moduleFilteredEntries.filter((entry) => getEntryLedger(entry).debit > 0).length, cls: 'text-rose-700' },
          { key: 'credit', label: 'Credit', count: moduleFilteredEntries.filter((entry) => getEntryLedger(entry).credit > 0).length, cls: 'text-emerald-700' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setLedgerTab(tab.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${ledgerTab === tab.key ? 'bg-slate-900 text-white shadow-sm' : `${tab.cls} hover:bg-white`}`}
          >
            {tab.label} <span className="ml-1 opacity-75">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Selection & bulk actions */}
      {allFilteredEntries.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <Checkbox checked={allVisibleSelected} onCheckedChange={handleSelectAll} />
          <span className="text-xs font-medium text-slate-700">Select all in this tab ({allFilteredEntries.length})</span>
          <span className="text-xs text-slate-500">{selectedItems.length} selected</span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={selectedItems.length === 0 || !!actionId}
              onClick={() => handleBulkAction('approve')}
              className="h-8 text-xs bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-800"
            >
              {actionId === 'bulk-approve' ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
              Approve Selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={selectedItems.length === 0 || !!actionId}
              onClick={() => handleBulkAction('reject')}
              className="h-8 text-xs bg-slate-800 text-white border-slate-800 hover:bg-slate-950"
            >
              {actionId === 'bulk-reject' ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5 mr-1.5" />}
              Reject Selected
            </Button>
          </div>
        </div>
      )}

      {/* Money totals for the current view */}
      {(moneyTotals.debit > 0 || moneyTotals.credit > 0) && (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Pending totals{filter !== 'all' ? ' (filtered)' : ''}
          </span>
          <span className="ml-auto inline-flex items-center rounded-full bg-red-50 border border-red-200 text-red-700 px-2.5 py-1 text-xs font-semibold tabular-nums">
            Dr ₹{moneyTotals.debit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </span>
          <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 text-xs font-semibold tabular-nums">
            Cr ₹{moneyTotals.credit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </span>
          <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-1 text-xs font-semibold tabular-nums">
            Total ₹{(moneyTotals.debit + moneyTotals.credit).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* Approval table — every matching request is shown; there is no pagination. */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin" />
          <p className="text-xs text-slate-400">Loading approvals…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center"><CheckCircle2 className="w-7 h-7 text-emerald-500" /></div>
          <div className="text-center"><p className="text-sm font-semibold text-slate-700">All clear!</p><p className="text-xs text-slate-400 mt-0.5">No pending {ledgerTab === 'all' ? '' : ledgerTab} approvals for {currentSite?.name || 'this site'}</p></div>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
          <table className="w-full table-fixed text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                <th className="w-[4%] px-4 py-3"><Checkbox checked={allVisibleSelected} onCheckedChange={handleSelectAll} /></th>
                <th className="w-[23%] px-3 py-3">Request</th><th className="w-[17%] px-3 py-3">Entity</th><th className="w-[9%] px-3 py-3">Voucher</th><th className="w-[9%] px-3 py-3">Mode / date</th><th className="w-[10%] px-3 py-3 text-right">Debit</th><th className="w-[10%] px-3 py-3 text-right">Credit</th><th className="w-[18%] px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((entry) => {
                const detail = getRequestDetails(entry);
                const ledger = getEntryLedger(entry);
                const actionKey = `${entry.source}-${entry.id}`;
                const isActing = actionId === actionKey;
                const itemSelected = isSelected(entry);
                return (
                  <tr key={actionKey} className={`transition-colors ${itemSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50/80'}`}>
                    <td className="px-4 py-4 align-top"><Checkbox checked={itemSelected} onCheckedChange={(checked) => handleSelectOne(entry, checked)} disabled={!!actionId} /></td>
                    <td className="px-3 py-4 align-top"><div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" /><span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold ${detail.module.cls}`}>{detail.module.label}</span></div><p className="mt-2 text-sm font-semibold text-slate-800 line-clamp-2">{detail.purpose}</p><p className="mt-1 text-[11px] text-slate-400 truncate">Requested by {entry.created_by_name || 'Not specified'}</p></td>
                    <td className="px-3 py-4 align-top"><p className="text-sm font-semibold text-slate-800 break-words">{detail.entityName}</p><p className="mt-0.5 text-[11px] font-medium text-slate-500">{detail.entityType}</p>{detail.entityDetails.map((linkedDetail) => <p key={linkedDetail} className="mt-1 text-[11px] text-indigo-700 break-words">{linkedDetail}</p>)}</td>
                    <td className="px-3 py-4 align-top">{entry.voucher_url ? <button type="button" onClick={() => openDoc({ url: entry.voucher_url, title: 'Voucher', subtitle: detail.purpose })} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"><ExternalLink className="w-3 h-3" /> View voucher</button> : <span className="text-xs text-slate-300">No voucher</span>}</td>
                    <td className="px-3 py-4 align-top"><span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">{(entry.payment_mode || entry.cash_type || '—').toUpperCase()}</span><p className="mt-2 text-xs text-slate-500">{fmtDate(entry.date)}</p></td>
                    <td className="px-3 py-4 text-right align-top text-sm font-bold tabular-nums text-rose-700">{ledger.debit ? `₹${ledger.debit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}</td>
                    <td className="px-3 py-4 text-right align-top text-sm font-bold tabular-nums text-emerald-700">{ledger.credit ? `₹${ledger.credit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}</td>
                    <td className="px-4 py-4 align-top"><div className="flex justify-end gap-1.5"><button disabled={!!actionId} onClick={() => handleApprove(entry)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50">{isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}Approve</button><button disabled={!!actionId} onClick={() => handleReject(entry)} className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-950 disabled:opacity-50">{isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}Reject</button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PendingApprovals;
