import { useMemo, useState } from 'react';
import { History, ShieldCheck } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';
import { SectionHead } from '@/components/ui/page';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  CompactEmpty,
  DetailFact,
  ReraStatus,
} from './ReraUi';
import {
  asList,
  firstValue,
  formatDate,
  readable,
  recordId,
} from './reraUtils';

const statusEventsFrom = (project, activity) => {
  const recorded = asList(project?.status_history ?? project?.status_timeline);
  if (recorded.length) return recorded;

  return activity.filter((item) => {
    const action = String(firstValue(item, ['action', 'event_type', 'type'], '')).toUpperCase();
    return action.includes('STATUS') || firstValue(item, ['new_status', 'to_status']) !== null;
  });
};

export function StatusTimeline({ project, activity }) {
  const events = useMemo(
    () => statusEventsFrom(project, asList(activity)),
    [activity, project],
  );

  if (!events.length) {
    return (
      <CompactEmpty
        icon={ShieldCheck}
        title="No recorded status changes"
        description="Internal project status changes will appear here when they are recorded."
      />
    );
  }

  return (
    <div className="relative space-y-0 before:absolute before:bottom-5 before:left-[7px] before:top-5 before:w-px before:bg-mr-line">
      {events.map((item, index) => {
        const fromStatus = firstValue(item, ['previous_status', 'from_status']);
        const toStatus = firstValue(item, ['new_status', 'to_status', 'status']);
        return (
          <div key={`${recordId(item) ?? 'status'}-${index}`} className="relative flex gap-4 py-3">
            <span className="relative z-10 mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full border-[4px] border-mr-surface bg-mr-blue" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {fromStatus && <span className="text-[12px] text-mr-muted">{readable(fromStatus)}</span>}
                {fromStatus && toStatus && <span className="text-[11px] text-mr-faint">→</span>}
                {toStatus && <ReraStatus value={toStatus} label={toStatus === 'REGISTERED' ? 'Registration recorded' : undefined} />}
              </div>
              <p className="mt-1.5 text-[11px] text-mr-muted">
                {firstValue(item, ['actor_name', 'changed_by_name', 'created_by_name'], 'System record')} · {formatDate(firstValue(item, ['changed_at', 'created_at', 'occurred_at']), { withTime: true })}
              </p>
              {firstValue(item, ['comment', 'reason', 'description']) && (
                <p className="mt-1 text-[12px] leading-relaxed text-mr-text">
                  {firstValue(item, ['comment', 'reason', 'description'])}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ReraActivity({ project, activity }) {
  const rows = asList(activity);
  const [selected, setSelected] = useState(null);

  if (!project) {
    return (
      <CompactEmpty
        icon={History}
        title="Select a RERA project"
        description="Activity is kept in the context of a specific RERA Project."
        tall
      />
    );
  }

  return (
    <div className="grid gap-8 py-2 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.55fr)]">
      <section>
        <SectionHead
          title="Recent activity"
          meta={rows.length ? String(rows.length) : null}
          description="Recorded changes and actions for the selected project."
        />
        {rows.length ? (
          <div className="divide-y divide-mr-line">
            {rows.map((item, index) => {
              const actor = firstValue(item, ['actor_name', 'user_name', 'created_by_name', 'changed_by_name']);
              return (
                <button
                  type="button"
                  key={`${recordId(item) ?? 'activity'}-${index}`}
                  onClick={() => setSelected(item)}
                  className="flex w-full items-start gap-3 py-4 text-left transition-colors hover:bg-mr-surface-2/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
                >
                  <UserAvatar name={actor} label="Recorded by" size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-mr-text">
                      {firstValue(item, ['title', 'action_label', 'description'], readable(firstValue(item, ['action', 'event_type', 'type']), 'Activity recorded'))}
                    </p>
                    <p className="mt-1 text-[11px] text-mr-muted">
                      {actor || 'System record'} · {formatDate(firstValue(item, ['created_at', 'changed_at', 'occurred_at']), { withTime: true })}
                    </p>
                  </div>
                  {firstValue(item, ['status']) && <ReraStatus value={item.status} />}
                </button>
              );
            })}
          </div>
        ) : (
          <CompactEmpty title="No activity recorded" description="Project changes will appear here as they are recorded." />
        )}
      </section>

      <section>
        <SectionHead
          title="Status timeline"
          description="This is the internal workflow record, not proof of an external authority decision."
        />
        <StatusTimeline project={project} activity={rows} />
      </section>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader className="pr-8">
            <SheetTitle>Activity detail</SheetTitle>
            <SheetDescription>Recorded project activity and attribution.</SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="mt-6">
              <DetailFact label="Action" value={readable(firstValue(selected, ['action', 'event_type', 'type']))} />
              <DetailFact label="Recorded by" value={firstValue(selected, ['actor_name', 'user_name', 'created_by_name', 'changed_by_name'])} />
              <DetailFact label="Recorded at" value={formatDate(firstValue(selected, ['created_at', 'changed_at', 'occurred_at']), { withTime: true })} />
              <DetailFact label="Previous status" value={readable(firstValue(selected, ['previous_status', 'from_status']))} />
              <DetailFact label="New status">
                {firstValue(selected, ['new_status', 'to_status', 'status'])
                  ? <ReraStatus value={firstValue(selected, ['new_status', 'to_status', 'status'])} />
                  : 'Not recorded'}
              </DetailFact>
              <DetailFact label="Notes" value={firstValue(selected, ['comment', 'reason', 'description', 'detail'])} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
