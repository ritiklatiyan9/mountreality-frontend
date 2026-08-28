import { useEffect, useState } from 'react';
import {
  AlarmClock, BellRing, CalendarPlus, Clock3, MailCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../api/api';
import { enableWebPushNotifications } from '../../lib/pushNotifications';
import { calendarIsoDate } from './complianceCalendarMeta';
import { Button } from '../ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';

const scheduleDraft = (date) => ({
  title: '',
  event_date: calendarIsoDate(date || new Date()),
  event_time: '',
  priority: 'MEDIUM',
  description: '',
  push_notification: true,
});

export default function ScheduleCalendarEventDialog({
  date, open, onOpenChange, onSaved, siteId,
}) {
  const [form, setForm] = useState(() => scheduleDraft(date));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(scheduleDraft(date));
  }, [date, open]);

  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async (submitEvent) => {
    submitEvent.preventDefault();
    if (!form.title.trim()) return toast.error('Enter an event title');
    setSaving(true);
    let pushRegistration = { status: 'disabled' };
    try {
      if (form.push_notification) {
        pushRegistration = await enableWebPushNotifications().catch((error) => ({
          status: 'error', message: error.message,
        }));
      }
      const { push_notification: ignoredPushPreference, ...payload } = form;
      void ignoredPushPreference;
      const { data } = await api.post('/compliance/calendar/events', {
        ...payload,
        site_id: siteId,
        event_time: form.event_time || null,
      });
      const notifications = data.notification_summary || {};
      const fcmSent = Number(notifications.fcm?.sent) || 0;
      const inviteCount = notifications.calendar_connected ? Number(notifications.connected_emails) || 0 : 0;
      let successMessage = 'Event scheduled · Team notified in the app';
      if (fcmSent > 0) successMessage = `Event scheduled · ${fcmSent} push notification${fcmSent === 1 ? '' : 's'} sent`;
      else if (inviteCount > 0) successMessage = `Event scheduled · ${inviteCount} email invite${inviteCount === 1 ? '' : 's'} queued`;
      else if (notifications.calendar_connected) successMessage = 'Event scheduled · Google Calendar sync queued';
      toast.success(successMessage);
      if (form.push_notification && ['denied', 'default'].includes(pushRegistration.status)) {
        toast.info('Browser push is blocked. Allow notifications in your browser settings to receive FCM alerts.');
      } else if (form.push_notification && ['error', 'unsupported', 'unavailable'].includes(pushRegistration.status)) {
        toast.info('Event saved, but this browser could not register for push notifications.');
      }
      onSaved?.(data.event);
      onOpenChange(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not schedule event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-panel border-mr-line bg-mr-surface p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-mr-line bg-mr-surface-2/60 px-5 py-5 sm:px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-cyan-950/70 dark:text-cyan-300"><CalendarPlus className="h-5 w-5" /></div>
          <DialogTitle className="pt-3 text-lg text-mr-text">Schedule an event</DialogTitle>
          <DialogDescription className="text-mr-muted">Add a dated activity and notify your connected calendar channels.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 px-5 py-5 sm:px-6">
          <div>
            <Label htmlFor="calendar-event-title" className="text-mr-text">Event title</Label>
            <Input id="calendar-event-title" autoFocus className="mt-1.5 h-10 rounded-xl border-mr-line bg-mr-surface" value={form.title} onChange={(event) => set('title', event.target.value)} placeholder="Site review with contractor" maxLength={300} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="calendar-event-date" className="text-mr-text">Date</Label>
              <Input id="calendar-event-date" className="mt-1.5 h-10 rounded-xl border-mr-line bg-mr-surface" type="date" value={form.event_date} onChange={(event) => set('event_date', event.target.value)} required />
            </div>
            <div>
              <Label htmlFor="calendar-event-time" className="text-mr-text">Time <span className="font-normal text-mr-faint">(optional)</span></Label>
              <div className="relative mt-1.5"><Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mr-faint" /><Input id="calendar-event-time" className="h-10 rounded-xl border-mr-line bg-mr-surface pl-9" type="time" value={form.event_time} onChange={(event) => set('event_time', event.target.value)} /></div>
            </div>
            <div>
              <Label htmlFor="calendar-event-priority" className="text-mr-text">Priority</Label>
              <select id="calendar-event-priority" className="mt-1.5 flex h-10 w-full rounded-xl border border-mr-line bg-mr-surface px-3 text-sm text-mr-text outline-none transition focus-visible:ring-2 focus-visible:ring-mr-blue" value={form.priority} onChange={(event) => set('priority', event.target.value)}>
                <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="calendar-event-description" className="text-mr-text">Notes <span className="font-normal text-mr-faint">(optional)</span></Label>
            <Textarea id="calendar-event-description" className="mt-1.5 min-h-24 rounded-xl border-mr-line bg-mr-surface" value={form.description} onChange={(event) => set('description', event.target.value)} placeholder="Agenda, attendee, meeting link or any context…" maxLength={10000} />
          </div>
          <div className="rounded-xl border border-mr-line bg-mr-surface-2/60 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mr-blue-soft text-mr-blue"><BellRing className="h-4 w-4" /></span>
                <div><Label htmlFor="calendar-push-notification" className="text-sm font-semibold text-mr-text">Browser push <span className="font-normal text-mr-faint">(optional extra)</span></Label><p className="mt-0.5 text-xs leading-5 text-mr-muted">Register this browser for an additional FCM alert. Phone delivery through email and Google Calendar works separately.</p></div>
              </div>
              <Switch id="calendar-push-notification" checked={form.push_notification} onCheckedChange={(checked) => set('push_notification', checked)} aria-label="Enable FCM browser push" />
            </div>
            <div className="mt-3 flex items-start gap-2 border-t border-mr-line pt-3 text-xs leading-5 text-mr-muted"><MailCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /><span>Authorized users and connected recipients receive reminder emails that can notify their signed-in phone mail apps.</span></div>
            <div className="mt-2 flex items-start gap-2 text-xs leading-5 text-mr-muted"><AlarmClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-600" /><span>Automatic reminders are sent 1 day before and again on the event day. Timed events also receive a 30-minute reminder.</span></div>
          </div>
          <DialogFooter className="gap-2 border-t border-mr-line pt-4 sm:gap-2"><Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Cancel</Button><Button className="rounded-xl" disabled={saving}>{saving ? 'Scheduling…' : 'Schedule event'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
