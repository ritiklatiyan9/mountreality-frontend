import { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SitePolicyContext } from '../context/SitePolicyContext';
import { getPropertyTerminology } from '../lib/propertyTerminology';
import { toast } from 'sonner';
import api from '../api/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  ArrowLeft, Bell, Eye, IndianRupee, Clock, Calendar, ChevronLeft, ChevronRight,
  AlertTriangle, CheckCircle2, CalendarClock, UserX, TrendingDown, TimerOff, Activity, FileWarning, Loader2,
  MessageSquare, Settings2,
} from 'lucide-react';

const SEVERITY_CONFIG = {
  critical: { color: 'bg-red-50 border-red-200 text-red-800',       badge: 'bg-red-100 text-red-700 border-red-300' },
  high:     { color: 'bg-orange-50 border-orange-200 text-orange-800', badge: 'bg-orange-100 text-orange-700 border-orange-300' },
  medium:   { color: 'bg-amber-50 border-amber-200 text-amber-800',   badge: 'bg-amber-100 text-amber-600 border-amber-300' },
  low:      { color: 'bg-slate-50 border-slate-200 text-slate-700',    badge: 'bg-slate-100 text-slate-600 border-slate-300' },
};

const REMINDER_ICON = {
  overdue:      { icon: AlertTriangle,  cls: 'text-red-500' },
  upcoming:     { icon: CalendarClock,   cls: 'text-amber-500' },
  inactive:     { icon: UserX,           cls: 'text-orange-500' },
  low_progress: { icon: TrendingDown,    cls: 'text-rose-500' },
  slow_payer:   { icon: TimerOff,        cls: 'text-purple-500' },
  irregular:    { icon: Activity,        cls: 'text-indigo-500' },
  no_plan:      { icon: FileWarning,     cls: 'text-slate-500' },
};

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const LIMIT = 10;

export default function PaymentReminders() {
  const { currentSite, isAdmin } = useAuth();
  const sitePolicy = useContext(SitePolicyContext);
  const propertyTerms = useMemo(() => getPropertyTerminology(sitePolicy), [sitePolicy]);
  const siteId = currentSite?.id;
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);

  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: LIMIT });
  const [summary, setSummary] = useState({ total: 0, overdue: 0, inactive: 0, upcoming: 0, low_progress: 0, slow_payer: 0, irregular: 0, no_plan: 0 });

  const fetchReminders = useCallback(async (p = 1) => {
    if (!siteId) return;
    setLoading(true);
    try {
      const res = await api.get(`/plots/payment-reminders?site_id=${siteId}&page=${p}&limit=${LIMIT}`);
      setReminders(res.data.reminders || []);
      setPagination(res.data.pagination || { totalItems: 0, totalPages: 1, currentPage: p, itemsPerPage: LIMIT });
      setSummary(res.data.summary || { total: 0, overdue: 0, inactive: 0, upcoming: 0, low_progress: 0, slow_payer: 0, irregular: 0, no_plan: 0 });
      setPage(p);
    } catch {
      setReminders([]);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { fetchReminders(1); }, [fetchReminders]);

  const sendSms = async () => {
    if (!siteId || sending) return;
    if (!window.confirm('Queue reminder SMS to every buyer due on the days configured in Settings?')) return;
    setSending(true);
    try {
      const res = await api.post('/plots/payment-reminders/sms', { site_id: siteId });
      toast[res.data.queued ? 'success' : 'info'](res.data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not queue reminder SMS');
    } finally {
      setSending(false);
    }
  };

  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-slate-400 gap-3">
        <Bell className="w-10 h-10" />
        <p className="text-sm">Select a site to view payment reminders</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/payment-management')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-slate-900">Payment Reminders</h1>
          <p className="text-xs text-slate-500">
            Overdue, upcoming &amp; at-risk {propertyTerms.plural.toLowerCase()}{currentSite?.name ? ` · ${currentSite.name}` : ''}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => navigate('/settings')} title="Configure automatic SMS schedule">
              <Settings2 className="w-3.5 h-3.5" /> SMS Schedule
            </Button>
            <Button size="sm" className="h-8 gap-1.5 bg-emerald-600 text-xs hover:bg-emerald-700" onClick={sendSms} disabled={sending}>
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />} Send SMS Now
            </Button>
          </div>
        )}
      </div>

      {/* ── Severity chips ── */}
      <div className="flex flex-wrap gap-1.5">
        {summary.overdue > 0 && (
          <Badge variant="outline" className="text-[10px] font-semibold bg-red-100 text-red-700 border-red-300 gap-1">
            <AlertTriangle className="w-3 h-3" /> {summary.overdue} Overdue
          </Badge>
        )}
        {summary.inactive > 0 && (
          <Badge variant="outline" className="text-[10px] font-semibold bg-orange-100 text-orange-700 border-orange-300 gap-1">
            <UserX className="w-3 h-3" /> {summary.inactive} Inactive
          </Badge>
        )}
        {summary.upcoming > 0 && (
          <Badge variant="outline" className="text-[10px] font-semibold bg-amber-100 text-amber-700 border-amber-300 gap-1">
            <CalendarClock className="w-3 h-3" /> {summary.upcoming} Upcoming
          </Badge>
        )}
        {summary.low_progress > 0 && (
          <Badge variant="outline" className="text-[10px] font-semibold bg-rose-100 text-rose-700 border-rose-300 gap-1">
            <TrendingDown className="w-3 h-3" /> {summary.low_progress} Low Progress
          </Badge>
        )}
        {summary.slow_payer > 0 && (
          <Badge variant="outline" className="text-[10px] font-semibold bg-purple-100 text-purple-700 border-purple-300 gap-1">
            <TimerOff className="w-3 h-3" /> {summary.slow_payer} Slow Payer
          </Badge>
        )}
      </div>

      <Card className="shadow-none border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          ) : reminders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-2" />
              <p className="text-sm font-medium text-slate-600">All Clear!</p>
              <p className="text-xs text-slate-400 mt-0.5">No payment reminders right now</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {reminders.map((r, idx) => {
                const sev = SEVERITY_CONFIG[r.severity] || SEVERITY_CONFIG.low;
                const typeInfo = REMINDER_ICON[r.type] || REMINDER_ICON.overdue;
                const Icon = typeInfo.icon;
                return (
                  <div key={`${r.type}-${r.plot_id}-${idx}`} className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${sev.color}`}>
                      <Icon className={`w-4 h-4 ${typeInfo.cls}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800">{propertyTerms.singular} {r.plot_no}</span>
                        {r.block && <span className="text-xs text-slate-400">{propertyTerms.blockLabel} {r.block}</span>}
                        <Badge variant="outline" className={`text-[9px] font-bold uppercase ${sev.badge}`}>
                          {r.severity}
                        </Badge>
                        <Badge variant="outline" className="text-[9px] font-medium bg-slate-50 text-slate-500 border-slate-200 capitalize">
                          {r.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{r.message}</p>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <IndianRupee className="w-3 h-3" /> Due: ₹{fmt(r.amount_due || r.total_remaining)}
                        </span>
                        {r.last_payment_date && (
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Last: {fmtDate(r.last_payment_date)}
                          </span>
                        )}
                        {r.due_date && (
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Due: {fmtDate(r.due_date)}
                          </span>
                        )}
                        {r.buyer_name && (
                          <span className="text-[11px] font-medium text-slate-500">{r.buyer_name}</span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs shrink-0 gap-1"
                      onClick={() => navigate(
                        `/payment-management/plots?plot=${r.plot_id}&plot_no=${encodeURIComponent(r.plot_no || '')}` +
                        `&block=${encodeURIComponent(r.block || '')}&buyer_name=${encodeURIComponent(r.buyer_name || '')}`
                      )}
                    >
                      <Eye className="w-3 h-3" /> View
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-2.5 border-t border-slate-100 bg-slate-50/50">
              <p className="text-[11px] text-slate-400">
                {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, pagination.totalItems)} of {pagination.totalItems}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1 || loading}
                  onClick={() => fetchReminders(page - 1)}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === pagination.totalPages || Math.abs(p - page) <= 1)
                  .reduce((acc, p, i, arr) => { if (i > 0 && p - arr[i - 1] > 1) acc.push('...'); acc.push(p); return acc; }, [])
                  .map((p, i) =>
                    p === '...'
                      ? <span key={`d-${i}`} className="text-xs text-slate-400 px-1">…</span>
                      : <Button key={p} variant={p === page ? 'default' : 'outline'} size="icon" className="h-7 w-7 text-xs"
                          onClick={() => fetchReminders(p)} disabled={loading}>{p}</Button>
                  )}
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= pagination.totalPages || loading}
                  onClick={() => fetchReminders(page + 1)}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
