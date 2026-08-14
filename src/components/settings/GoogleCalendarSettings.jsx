import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarCheck2, Loader2, Mail, Plus, RefreshCw, Trash2, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/api';
import { Input } from '../ui/input';
import {
  DANGER_BTN, EmptyBlock, FIELD_LG, GHOST_BTN, PRIMARY_BTN, SectionHead, StatusDot,
} from '../ui/page';

const errMessage = (err) => err?.response?.data?.message || 'Something went wrong';

export default function GoogleCalendarSettings({ onStatusChange }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ configured: false, connection: null, emails: [] });
  const [newEmail, setNewEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const announcedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const { data: status } = await api.get('/settings/google-calendar/status');
      setData(status);
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    onStatusChange?.({ loading, connected: Boolean(data.connection) });
  }, [data.connection, loading, onStatusChange]);

  /* One-shot toast for the OAuth redirect landing (?google=connected|error). */
  useEffect(() => {
    const outcome = searchParams.get('google');
    if (!outcome || announcedRef.current) return;
    announcedRef.current = true;
    if (outcome === 'connected') toast.success('Google Calendar connected');
    else toast.error(`Google connection failed${searchParams.get('reason') ? ` (${searchParams.get('reason')})` : ''}`);
    const next = new URLSearchParams(searchParams);
    next.delete('google');
    next.delete('reason');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const connect = async () => {
    setBusy(true);
    try {
      const { data: res } = await api.get('/settings/google-calendar/connect');
      window.location.href = res.url;
    } catch (err) {
      toast.error(errMessage(err));
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Disconnect Google Calendar? Synced events stay on the calendar but stop updating.')) return;
    setBusy(true);
    try {
      await api.post('/settings/google-calendar/disconnect');
      toast.success('Google Calendar disconnected');
      await load();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const syncFutureEvents = async () => {
    setBusy(true);
    try {
      const { data: result } = await api.post('/settings/google-calendar/sync');
      toast.success(`${result.synced || 0} future event${result.synced === 1 ? '' : 's'} refreshed`);
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const addEmail = async (e) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setBusy(true);
    try {
      await api.post('/settings/google-calendar/emails', { email: newEmail.trim() });
      setNewEmail('');
      await load();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const removeEmail = async (id) => {
    try {
      await api.delete(`/settings/google-calendar/emails/${id}`);
      await load();
    } catch (err) {
      toast.error(errMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-[14px] text-mr-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading calendar settings…
      </div>
    );
  }

  const connected = Boolean(data.connection);

  return (
    <div className="space-y-10">
      <section>
        <SectionHead
          title="Google account"
          description="Compliance deadlines, hearings, notices, inspections and licence expiries are pushed to this account's calendar as they change."
          actions={connected ? <StatusDot tone="positive">Connected</StatusDot> : <StatusDot tone="neutral">Not connected</StatusDot>}
        />
        {!data.configured && (
          <p className="mt-4 rounded-panel-sm border border-mr-amber/40 bg-mr-amber-soft px-4 py-3 text-[13px] text-mr-amber-ink">
            Google Calendar integration is not configured on the server yet. Set GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI in the backend environment to enable it.
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {connected ? (
            <>
              <span className="inline-flex items-center gap-2 text-[14px] text-mr-text">
                <CalendarCheck2 className="h-4 w-4 text-mr-blue" aria-hidden="true" />
                {data.connection.google_account_email}
              </span>
              <button type="button" className={GHOST_BTN} onClick={syncFutureEvents} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                Refresh future events
              </button>
              <button type="button" className={DANGER_BTN} onClick={disconnect} disabled={busy}>
                <Unplug className="h-4 w-4" aria-hidden="true" /> Disconnect
              </button>
            </>
          ) : (
            <button type="button" className={PRIMARY_BTN} onClick={connect} disabled={busy || !data.configured}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CalendarCheck2 className="h-4 w-4" aria-hidden="true" />}
              Connect Google Calendar
            </button>
          )}
        </div>
      </section>

      <section>
        <SectionHead
          title="Team invitations"
          meta={data.emails.length ? `${data.emails.length} recipient${data.emails.length === 1 ? '' : 's'}` : null}
          description="Each synced event invites these addresses, so it lands on their phone calendars once they accept. Changes apply to events created or updated afterwards."
        />
        <form onSubmit={addEmail} className="mt-4 flex max-w-md items-center gap-2">
          <Input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="teammate@company.com"
            className={FIELD_LG}
            disabled={busy}
          />
          <button type="submit" className={GHOST_BTN} disabled={busy || !newEmail.trim()}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add
          </button>
        </form>
        {data.emails.length === 0 ? (
          <EmptyBlock
            icon={Mail}
            title="No recipients yet"
            description="Add the team emails that should receive these events as Google Calendar invites."
          />
        ) : (
          <ul className="mt-4 max-w-md divide-y divide-mr-line rounded-panel-sm border border-mr-line">
            {data.emails.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="inline-flex min-w-0 items-center gap-2 text-[14px] text-mr-text">
                  <Mail className="h-4 w-4 shrink-0 text-mr-faint" aria-hidden="true" />
                  <span className="truncate">{row.email}</span>
                </span>
                <button
                  type="button"
                  className="rounded-control p-1.5 text-mr-faint transition-colors hover:bg-mr-coral-soft hover:text-mr-coral-ink"
                  onClick={() => removeEmail(row.id)}
                  aria-label={`Remove ${row.email}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
