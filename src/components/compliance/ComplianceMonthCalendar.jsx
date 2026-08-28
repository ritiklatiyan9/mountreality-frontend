import { useMemo } from 'react';
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { calendarEventTime, calendarIsoDate, COMPLIANCE_EVENT_META, complianceEventDate } from './complianceCalendarMeta';

const readable = (value, fallback = 'Scheduled') => String(value || fallback)
  .toLowerCase()
  .replaceAll('_', ' ')
  .replace(/\b\w/g, (character) => character.toUpperCase());

export function CalendarEventPreview({ event, children }) {
  const meta = COMPLIANCE_EVENT_META[event.event_type] || COMPLIANCE_EVENT_META.COMPLIANCE;
  const EventIcon = meta.Icon;
  const eventTime = calendarEventTime(event);
  return (
    <HoverCard openDelay={160} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent align="start" side="top" className="w-80 overflow-hidden rounded-2xl border-mr-line bg-mr-surface p-0 text-mr-text shadow-2xl shadow-black/20">
        <div className="flex items-start gap-3 border-b border-mr-line bg-mr-surface-2/70 px-4 py-3.5">
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm', meta.icon)}><EventIcon className="h-4 w-4" /></span>
          <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-mr-muted">{meta.label}</p><p className="mt-1 text-[13px] font-bold leading-5 text-mr-text">{event.title}</p></div>
        </div>
        <div className="grid grid-cols-[82px_1fr] gap-x-3 gap-y-2.5 px-4 py-3.5 text-[11px]">
          <span className="text-mr-faint">Scheduled</span><span className="font-semibold text-mr-text">{format(complianceEventDate(event.event_date), 'dd MMMM yyyy')}</span>
          {eventTime && <><span className="text-mr-faint">Time</span><span className="inline-flex items-center gap-1 font-semibold text-mr-text"><Clock3 className="h-3 w-3 text-mr-faint" />{eventTime}</span></>}
          <span className="text-mr-faint">Site</span><span className="truncate font-semibold text-mr-text">{event.site_name || 'Organisation-wide'}</span>
          <span className="text-mr-faint">Status</span><span className="font-semibold text-mr-text">{readable(event.status)}</span>
          {event.risk_level && <><span className="text-mr-faint">{event.event_type === 'SCHEDULED_EVENT' ? 'Priority' : 'Risk'}</span><span className="font-semibold text-mr-text">{readable(event.risk_level)}</span></>}
        </div>
        <p className="border-t border-mr-line px-4 py-2.5 text-[10px] font-semibold text-mr-blue">{event.event_type === 'SCHEDULED_EVENT' ? 'Scheduled from the dashboard' : 'Click to open this record'}</p>
      </HoverCardContent>
    </HoverCard>
  );
}

export default function ComplianceMonthCalendar({
  cursor,
  events = [],
  loading = false,
  onCursorChange,
  onEventClick,
  onDayClick,
  onDayDoubleClick,
  onShowMore,
  maxEvents = 3,
  compact = false,
  showToolbar = true,
  className,
}) {
  const range = useMemo(() => ({
    from: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
    to: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
  }), [cursor]);
  const days = useMemo(() => eachDayOfInterval({ start: range.from, end: range.to }), [range]);
  const eventsByDay = useMemo(() => {
    const grouped = new Map();
    events.forEach((event) => {
      const key = calendarIsoDate(complianceEventDate(event.event_date));
      grouped.set(key, [...(grouped.get(key) || []), event]);
    });
    return grouped;
  }, [events]);

  return (
    <section className={cn('min-w-0 overflow-hidden bg-mr-surface text-mr-text', className)}>
      {showToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mr-line bg-mr-surface px-4 py-3 sm:px-5">
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => onCursorChange?.(subMonths(cursor, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-mr-muted transition hover:border-mr-line hover:bg-mr-surface-2 hover:text-mr-text" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" onClick={() => onCursorChange?.(startOfMonth(new Date()))} className="rounded-lg px-3 py-1.5 text-[13px] font-bold text-mr-text transition hover:bg-mr-surface-2">{format(cursor, 'MMMM yyyy')}</button>
            <button type="button" onClick={() => onCursorChange?.(addMonths(cursor, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-mr-muted transition hover:border-mr-line hover:bg-mr-surface-2 hover:text-mr-text" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-mr-blue" /><span className="text-[11px] font-semibold text-mr-muted">{events.length} scheduled</span></div>
        </div>
      )}

      <div className="grid grid-cols-7 border-b border-mr-line bg-mr-surface-2/80">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => <span key={day} className={cn('px-1 py-2.5 text-center text-[9px] font-bold uppercase tracking-[.12em] text-mr-faint', index > 4 && 'bg-mr-surface-2 text-mr-muted')}>{day}</span>)}</div>
      {loading ? (
        <div className="grid grid-cols-7 gap-px bg-mr-line">{Array.from({ length: 42 }).map((_, index) => <Skeleton key={index} className={cn('rounded-none bg-mr-surface', compact ? 'h-28' : 'h-40')} />)}</div>
      ) : (
        <div className="grid grid-cols-7 gap-px bg-mr-line">
          {days.map((day) => {
            const dayEvents = eventsByDay.get(calendarIsoDate(day)) || [];
            const visibleEvents = dayEvents.slice(0, maxEvents);
            const inMonth = isSameMonth(day, cursor);
            const today = isSameDay(day, new Date());
            return (
              <div key={day.toISOString()} onDoubleClick={(event) => {
                if (event.target.closest('[data-calendar-event]')) return;
                onDayDoubleClick?.(day);
              }} className={cn('group relative bg-mr-surface transition-colors hover:bg-mr-surface-2/65', compact ? 'min-h-28 p-1.5 sm:min-h-32 sm:p-2' : 'min-h-[172px] p-2.5 sm:p-3', !inMonth && 'bg-mr-surface-2/75 text-mr-faint', today && 'bg-mr-blue-soft ring-2 ring-inset ring-mr-blue/45 before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-mr-blue')}>
                <div className="flex items-center justify-between gap-2">
                  <button type="button" onClick={() => onDayClick?.(day)} className={cn('flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums transition hover:bg-mr-surface-2', today && 'bg-mr-blue text-white shadow-sm shadow-mr-blue/25 ring-2 ring-mr-blue/20 hover:bg-mr-blue-deep', !inMonth && !today && 'text-mr-faint')} aria-current={today ? 'date' : undefined} aria-label={`${today ? 'Today, ' : ''}Open ${format(day, 'dd MMMM yyyy')}`}>{format(day, 'd')}</button>
                  <div className="flex items-center gap-1">
                    {today && <span className="rounded-full bg-mr-blue px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[.08em] text-white shadow-sm">Today</span>}
                    {dayEvents.length > 0 && <span className="rounded-full border border-mr-line bg-mr-surface px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-mr-muted shadow-sm">{dayEvents.length}</span>}
                  </div>
                </div>
                <div className={cn('mt-2 space-y-1.5', compact && 'mt-1.5 space-y-1')}>
                  {visibleEvents.map((event) => {
                    const meta = COMPLIANCE_EVENT_META[event.event_type] || COMPLIANCE_EVENT_META.COMPLIANCE;
                    const EventIcon = meta.Icon;
                    const eventTime = calendarEventTime(event);
                    return (
                      <CalendarEventPreview key={`${event.event_type}-${event.id}`} event={event}>
                        <button type="button" data-calendar-event onClick={() => onEventClick?.(event)} className={cn('flex w-full items-center gap-1.5 overflow-hidden rounded-lg border text-left font-bold shadow-[0_1px_0_rgba(15,23,42,.03)] transition hover:-translate-y-px hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500', compact ? 'px-1 py-1 text-[8px] sm:px-1.5 sm:text-[9px]' : 'px-1.5 py-1.5 text-[9px]', meta.chip)}>
                          <span className={cn('flex shrink-0 items-center justify-center rounded-md', compact ? 'h-4 w-4' : 'h-5 w-5', meta.icon)}><EventIcon className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} /></span>
                          <span className="truncate">{event.title}</span>
                          {eventTime && <span className={cn('ml-auto inline-flex shrink-0 items-center gap-0.5 font-semibold opacity-75', compact ? 'text-[7px]' : 'text-[8px]')}><Clock3 className={compact ? 'h-2 w-2' : 'h-2.5 w-2.5'} />{eventTime}</span>}
                        </button>
                      </CalendarEventPreview>
                    );
                  })}
                  {dayEvents.length > maxEvents && <button type="button" onClick={() => onShowMore?.(day, dayEvents)} className="inline-flex rounded-md px-1.5 py-1 text-[9px] font-bold text-mr-blue transition hover:bg-mr-blue-soft hover:text-mr-blue-deep">+{dayEvents.length - maxEvents} more</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
