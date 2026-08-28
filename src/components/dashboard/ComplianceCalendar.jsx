import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  endOfMonth, endOfWeek, format, startOfMonth, startOfWeek,
} from 'date-fns';
import {
  AlertTriangle, ArrowUpRight, CalendarDays, CalendarPlus, ShieldCheck,
} from 'lucide-react';
import api from '../../api/api';
import eventBus from '../../utils/eventBus';
import { SkeletonBlock } from './primitives';
import ComplianceMonthCalendar from '../compliance/ComplianceMonthCalendar';
import ScheduleCalendarEventDialog from '../compliance/ScheduleCalendarEventDialog';
import { Button } from '../ui/button';
import {
  calendarEventTime, calendarIsoDate, COMPLIANCE_EVENT_META, complianceEventDate, complianceEventRoute,
} from '../compliance/complianceCalendarMeta';

const DateTile = ({ event }) => {
  const date = complianceEventDate(event.event_date);
  return (
    <span className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg border border-mr-line bg-mr-surface text-mr-text">
      <span className="text-[8px] font-bold uppercase tracking-[0.08em] text-mr-faint">{format(date, 'MMM')}</span>
      <span className="-mt-0.5 text-[13px] font-semibold tabular-nums">{format(date, 'd')}</span>
    </span>
  );
};

export default function ComplianceCalendar({ siteId }) {
  const navigate = useNavigate();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scheduleDate, setScheduleDate] = useState(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const range = useMemo(() => ({
    from: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
    to: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
  }), [cursor]);
  const load = useCallback(async ({ silent = false } = {}) => {
    if (!siteId) return;
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get('/compliance/calendar', {
        params: { site_id: siteId, from: calendarIsoDate(range.from), to: calendarIsoDate(range.to) },
      });
      setEvents(data.events || []);
    } catch {
      setEvents([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [range, siteId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const refresh = () => load({ silent: true });
    eventBus.on('data-mutated', refresh);
    return () => eventBus.off('data-mutated', refresh);
  }, [load]);

  const upcoming = useMemo(() => events
    .filter((event) => complianceEventDate(event.event_date) >= new Date(new Date().setHours(0, 0, 0, 0)))
    .sort((a, b) => complianceEventDate(a.event_date) - complianceEventDate(b.event_date))
    .slice(0, 4), [events]);
  const attentionCount = useMemo(() => events.filter((event) => (
    event.status === 'OVERDUE' || event.risk_level === 'CRITICAL' || event.risk_level === 'HIGH'
  )).length, [events]);
  const openSchedule = (day) => {
    setScheduleDate(day);
    setScheduleOpen(true);
  };
  const addScheduledEvent = (event) => {
    setEvents((current) => [...current, event].sort((a, b) => `${a.event_date} ${a.event_time || ''}`.localeCompare(`${b.event_date} ${b.event_time || ''}`)));
  };

  return (
    <section aria-labelledby="dashboard-compliance-calendar-title" className="overflow-hidden rounded-panel border border-mr-line bg-mr-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mr-line px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mr-blue-soft text-mr-blue">
            <CalendarDays className="h-4.5 w-4.5" strokeWidth={1.9} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="dashboard-compliance-calendar-title" className="text-[15px] font-semibold tracking-[-0.01em] text-mr-text">Compliance calendar</h2>
            <p className="mt-0.5 text-[12px] text-mr-muted">Key deadlines, hearings, inspections and licence activity · Double-click an open area to schedule</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" variant="outline" className="h-9 rounded-full border-mr-line px-3 text-[12px] text-mr-text" onClick={() => openSchedule(new Date())}><CalendarPlus className="mr-1.5 h-3.5 w-3.5" />Schedule</Button>
          <Link to="/compliance/calendar" className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-[12px] font-semibold text-mr-blue transition-colors hover:bg-mr-blue-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue">
            Open calendar <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_18rem]">
        <ComplianceMonthCalendar cursor={cursor} events={events} loading={loading} onCursorChange={setCursor} onDayClick={(day) => navigate(`/compliance/calendar?date=${calendarIsoDate(day)}`)} onDayDoubleClick={openSchedule} onEventClick={(event) => navigate(complianceEventRoute(event))} onShowMore={(day) => navigate(`/compliance/calendar?date=${calendarIsoDate(day)}`)} maxEvents={2} compact />

        <aside className="border-t border-mr-line lg:border-l lg:border-t-0">
          <div className="grid grid-cols-2 divide-x divide-mr-line border-b border-mr-line lg:grid-cols-1 lg:divide-x-0 lg:divide-y">
            <div className="px-4 py-3.5"><p className="text-[10px] font-medium uppercase tracking-[0.1em] text-mr-faint">In view</p><p className="mt-1 text-xl font-semibold tabular-nums text-mr-text">{events.length}</p></div>
            <div className="px-4 py-3.5"><p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.1em] text-mr-faint"><AlertTriangle className="h-3 w-3 text-mr-coral" />Attention</p><p className="mt-1 text-xl font-semibold tabular-nums text-mr-coral-ink">{attentionCount}</p></div>
          </div>
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-[12px] font-semibold text-mr-text">Coming up</h3><Link to="/compliance/register" className="text-[11px] font-semibold text-mr-blue hover:underline">Register</Link></div>
            {loading ? <div className="space-y-2"><SkeletonBlock className="h-12" /><SkeletonBlock className="h-12" /><SkeletonBlock className="h-12" /></div> : upcoming.length ? <div className="relative space-y-2">
              {/* Connector rail: sits behind the (opaque) date tiles, so each tile
                  reads as punching through the line rather than a drawn dot. */}
              {upcoming.length > 1 && <span className="absolute bottom-5 left-[21px] top-5 z-0 w-px bg-mr-line" aria-hidden="true" />}
              {upcoming.map((event, i) => {
                const meta = COMPLIANCE_EVENT_META[event.event_type] || COMPLIANCE_EVENT_META.COMPLIANCE;
                const Icon = meta.Icon;
                const eventTime = calendarEventTime(event);
                return <button key={`${event.event_type}-${event.id}`} type="button" onClick={() => navigate(complianceEventRoute(event))} className="mr-rise relative z-10 flex w-full items-center gap-2.5 rounded-lg p-1 text-left transition hover:bg-mr-surface-2" style={{ animationDelay: `${i * 80}ms` }}><DateTile event={event} /><span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 text-[10px] font-medium text-mr-faint"><span className={`flex h-4 w-4 items-center justify-center rounded ${meta.icon}`}><Icon className="h-2.5 w-2.5" /></span>{meta.label}{eventTime && <span className="tabular-nums text-mr-muted">· {eventTime}</span>}</span><span className="mt-0.5 block truncate text-[12px] font-medium text-mr-text">{event.title}</span></span></button>;
              })}
            </div> : <div className="rounded-lg bg-mr-surface-2 px-3 py-5 text-center"><ShieldCheck className="mx-auto h-4 w-4 text-mr-faint" /><p className="mt-2 text-[11px] text-mr-muted">No upcoming activity in this view.</p></div>}
          </div>
        </aside>
      </div>
      <ScheduleCalendarEventDialog date={scheduleDate} open={scheduleOpen} onOpenChange={setScheduleOpen} onSaved={addScheduledEvent} siteId={siteId} />
    </section>
  );
}
