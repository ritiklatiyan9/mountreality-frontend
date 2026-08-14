import { ArrowRight, Check, EyeOff, Plus, TriangleAlert } from 'lucide-react';
import { EmptyBlock, SectionHead } from '../ui/page';

const DiffList = ({ title, rows = [], icon, tone = 'text-mr-text' }) => {
  const Icon = icon;

  return (
    <section className="min-w-0">
    <h3 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-mr-faint">
      <Icon className={`h-3.5 w-3.5 ${tone}`} strokeWidth={1.9} aria-hidden="true" /> {title}
    </h3>
    {rows.length ? (
      <ul className="mt-2 divide-y divide-mr-line border-y border-mr-line">
        {rows.map((row, index) => (
          <li key={`${typeof row === 'string' ? row : row.key || row.label}-${index}`} className="py-2.5 text-[13px] text-mr-text">
            {typeof row === 'string' ? row : row.label || row.key}
          </li>
        ))}
      </ul>
    ) : <p className="mt-2 text-[13px] text-mr-faint">No changes</p>}
    </section>
  );
};

export default function ProfilePreview({ preview }) {
  if (!preview) {
    return (
      <EmptyBlock
        title="Save the draft to generate a preview"
        description="MountReality will compare the published profile with this revision before anything changes."
      />
    );
  }

  const diff = preview.diff || preview;
  const impact = diff.records_requiring_mapping || diff.recordsRequiringMapping || [];
  const warnings = diff.warnings || [];
  const financeMode = diff.finance_mode_change || diff.financeModeChange;

  return (
    <div className="space-y-7">
      <SectionHead
        title="Current → proposed behavior"
        description="Only publishing changes the effective policy. Internal routes and database keys remain stable."
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="rounded-control border border-mr-line bg-mr-surface-2/50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-mr-faint">Current</p>
          <p className="mt-2 text-[15px] font-semibold text-mr-text">
            {diff.current?.label || diff.current?.operating_model || 'Legacy-compatible behavior'}
          </p>
          <p className="mt-1 text-[12px] text-mr-muted">Revision {diff.current?.revision || '—'}</p>
        </div>
        <div className="relative rounded-control border border-mr-blue/25 bg-mr-blue-soft/35 p-4">
          <ArrowRight className="absolute -left-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 rounded-full bg-mr-surface text-mr-blue sm:block" aria-hidden="true" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-mr-blue">Proposed</p>
          <p className="mt-2 text-[15px] font-semibold text-mr-text">
            {diff.proposed?.label || diff.proposed?.operating_model || 'Draft operating profile'}
          </p>
          <p className="mt-1 text-[12px] text-mr-muted">Revision {diff.proposed?.revision || 'Draft'}</p>
        </div>
      </div>

      {financeMode && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-mr-line py-3 text-[13px]">
          <div>
            <p className="font-semibold text-mr-text">Finance payment modes</p>
            <p className="mt-0.5 text-[12px] text-mr-muted">Controls new receipt and refund entry across this Site.</p>
          </div>
          <div className="flex items-center gap-2 font-medium text-mr-text">
            <span>{String(financeMode.from || 'ALL_MODES').replaceAll('_', ' ')}</span>
            <ArrowRight className="h-3.5 w-3.5 text-mr-faint" aria-hidden="true" />
            <span className={financeMode.changed ? 'text-mr-blue' : ''}>{String(financeMode.to || 'ALL_MODES').replaceAll('_', ' ')}</span>
          </div>
        </div>
      )}

      <div className="grid gap-x-8 gap-y-7 md:grid-cols-2">
        <DiffList title="Modules added" rows={diff.modules_added || []} icon={Plus} tone="text-mr-lime-ink" />
        <DiffList title="Modules hidden" rows={diff.modules_hidden || []} icon={EyeOff} tone="text-mr-coral-ink" />
        <DiffList title="Labels changed" rows={diff.labels_changed || []} icon={Check} tone="text-mr-blue" />
        <DiffList title="New required fields" rows={diff.required_fields_added || []} icon={TriangleAlert} tone="text-mr-amber-ink" />
        <DiffList title="Rules activated" rows={(diff.rules_activated || []).map((row) => ({ ...row, label: row.title || row.requirement_code }))} icon={Plus} tone="text-mr-lime-ink" />
        <DiffList title="Rules deactivated" rows={(diff.rules_deactivated || []).map((row) => ({ ...row, label: row.title || row.requirement_code }))} icon={EyeOff} tone="text-mr-coral-ink" />
      </div>

      {(impact.length > 0 || warnings.length > 0) && (
        <div className="rounded-control border border-mr-amber/25 bg-mr-amber-soft/55 p-4">
          <p className="text-[13px] font-semibold text-mr-amber-ink">Workflow impact to review</p>
          <ul className="mt-2 space-y-1.5 text-[13px] text-mr-muted">
            {[...warnings, ...impact].map((item, index) => (
              <li key={index}>• {typeof item === 'string' ? item : item.message || item.label}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
