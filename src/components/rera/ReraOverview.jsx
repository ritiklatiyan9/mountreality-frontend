import { AlertTriangle, ArrowRight, CalendarClock, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionHead } from '@/components/ui/page';
import {
  CompactEmpty,
  ReadinessCount,
  ReraStatus,
} from './ReraUi';
import {
  asList,
  firstValue,
  formatDate,
  readable,
  recordId,
} from './reraUtils';

const resolutionTab = (item) => {
  const explicit = firstValue(item, ['target_tab', 'tab', 'area']);
  if (explicit) {
    const normalized = String(explicit).toLowerCase();
    if (normalized.includes('stakeholder') || normalized.includes('participant')) return 'stakeholders';
    if (normalized.includes('approval') || normalized.includes('evidence') || normalized.includes('document')) return 'approvals-evidence';
    if (normalized.includes('project') || normalized.includes('phase')) return 'projects-phases';
    if (normalized.includes('activity') || normalized.includes('history')) return 'activity';
  }

  const entityType = String(firstValue(item, ['entity_type', 'type'], '')).toLowerCase();
  if (entityType.includes('stakeholder') || entityType.includes('participant')) return 'stakeholders';
  if (entityType.includes('approval') || entityType.includes('evidence') || entityType.includes('document')) return 'approvals-evidence';
  if (entityType.includes('project') || entityType.includes('phase')) return 'projects-phases';
  return null;
};

export default function ReraOverview({ data, project, onNavigate }) {
  const summary = data?.summary ?? {};
  const attention = asList(data?.attention);
  const requirements = asList(data?.requirements);
  const upcoming = asList(data?.upcoming);

  const counts = [
    {
      label: 'Requirements documented',
      value: firstValue(summary, ['requirements_documented', 'documented_requirements', 'requirements_with_evidence']),
      total: firstValue(summary, ['requirements_total', 'total_requirements']),
    },
    {
      label: 'Evidence reviewed',
      value: firstValue(summary, ['evidence_reviewed', 'reviewed_evidence']),
      total: firstValue(summary, ['evidence_total', 'total_evidence']),
      detail: 'Internal review status',
    },
    {
      label: 'Approvals recorded',
      value: firstValue(summary, ['approvals_recorded', 'approvals_current', 'current_approvals']),
      total: firstValue(summary, ['approvals_total', 'total_approvals']),
    },
    {
      label: 'Stakeholders linked',
      value: firstValue(summary, ['stakeholders_linked', 'stakeholders_total', 'participants_total']),
      total: null,
    },
  ];
  const hasCounts = counts.some((item) => item.value !== null || item.total !== null);

  if (!project) {
    return (
      <CompactEmpty
        icon={ClipboardCheck}
        title="No RERA project selected"
        description="Create or select a RERA Project to view its recorded readiness, requirements, and deadlines."
        action={<Button type="button" variant="outline" onClick={() => onNavigate?.('projects-phases')}>Open Projects &amp; Phases</Button>}
        tall
      />
    );
  }

  return (
    <div className="space-y-8 py-2">
      <section>
        <SectionHead
          title="Documentation readiness"
          description="Counts reflect records and internal review state returned for this project."
        />
        {hasCounts ? (
          <div className="grid gap-5 py-5 sm:grid-cols-2 xl:grid-cols-4">
            {counts.map((item) => <ReadinessCount key={item.label} {...item} />)}
          </div>
        ) : (
          <CompactEmpty title="Readiness counts are not available" description="Add project requirements and evidence to begin recording readiness." />
        )}
      </section>

      <section>
        <SectionHead
          title="Needs attention"
          meta={attention.length ? String(attention.length) : null}
          description="Exceptions and missing records that have been identified for this project."
        />
        {attention.length ? (
          <div className="divide-y divide-mr-line">
            {attention.map((item, index) => {
              const targetTab = resolutionTab(item);
              return (
                <div key={`${recordId(item) ?? 'attention'}-${index}`} className="flex items-start gap-3 py-4">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-mr-amber-ink" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-mr-text">
                      {firstValue(item, ['title', 'message', 'label'], 'Attention required')}
                    </p>
                    {firstValue(item, ['description', 'detail', 'reason']) && (
                      <p className="mt-1 text-[12px] leading-relaxed text-mr-muted">
                        {firstValue(item, ['description', 'detail', 'reason'])}
                      </p>
                    )}
                  </div>
                  {targetTab && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => onNavigate?.(targetTab)}>
                      Resolve <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <CompactEmpty title="No recorded exceptions" description="No attention items were returned for the selected project." />
        )}
      </section>

      <div className="grid gap-8 xl:grid-cols-2">
        <section>
          <SectionHead title="Requirement register" meta={requirements.length ? String(requirements.length) : null} />
          {requirements.length ? (
            <div className="divide-y divide-mr-line">
              {requirements.slice(0, 8).map((item, index) => (
                <div key={`${recordId(item) ?? 'requirement'}-${index}`} className="flex items-start justify-between gap-4 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-mr-text">
                      {firstValue(item, ['title', 'name', 'requirement'], 'Untitled requirement')}
                    </p>
                    <p className="mt-1 text-[11px] text-mr-muted">
                      {firstValue(item, ['reference', 'section_reference', 'category'], 'No reference recorded')}
                    </p>
                  </div>
                  <ReraStatus value={firstValue(item, ['status', 'readiness_status'], 'NOT_RECORDED')} />
                </div>
              ))}
            </div>
          ) : (
            <CompactEmpty title="No requirements returned" description="Applicable requirements will appear here when assigned by the active ruleset." />
          )}
        </section>

        <section>
          <SectionHead title="Upcoming deadlines" meta={upcoming.length ? String(upcoming.length) : null} />
          {upcoming.length ? (
            <div className="divide-y divide-mr-line">
              {upcoming.slice(0, 8).map((item, index) => (
                <div key={`${recordId(item) ?? 'upcoming'}-${index}`} className="flex items-start gap-3 py-3.5">
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-mr-blue" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-mr-text">
                      {firstValue(item, ['title', 'name', 'label'], 'Upcoming item')}
                    </p>
                    <p className="mt-1 text-[11px] text-mr-muted">
                      {readable(firstValue(item, ['type', 'category']), 'Deadline')} · {formatDate(firstValue(item, ['due_date', 'valid_until', 'date']))}
                    </p>
                  </div>
                  {firstValue(item, ['status']) && <ReraStatus value={item.status} />}
                </div>
              ))}
            </div>
          ) : (
            <CompactEmpty title="No upcoming deadlines" description="No future deadline records were returned for this project." />
          )}
        </section>
      </div>
    </div>
  );
}
