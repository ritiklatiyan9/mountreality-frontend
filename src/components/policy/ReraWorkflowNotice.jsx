import { AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getReraOperatingContext } from '../../lib/sitePolicy';

const AREA_COPY = Object.freeze({
  payments: 'Customer receipts stay in the canonical collection ledger. Project and phase reporting is derived in Project Finance.',
  finance: 'Collections, costs, account mappings and source links are shown in the selected RERA project and phase context.',
  registry: 'Registry money must be mapped to customer receipts. Registry-only manual money is unavailable in this workflow.',
});

const readable = (value) => String(value || '')
  .replaceAll('_', ' ')
  .toLowerCase()
  .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());

/**
 * A deliberately compact indicator shared by transactional project modules.
 * It explains the active profile without duplicating statutory claims or
 * turning each screen into another compliance dashboard.
 */
export default function ReraWorkflowNotice({ policy, area, actions = [] }) {
  const context = getReraOperatingContext(policy);
  if (!context.enabled) return null;

  const missing = [];
  if (!context.authority) missing.push('authority');
  if (!context.jurisdiction) missing.push('jurisdiction');
  if (!context.rulesetVersionId) missing.push('reviewed ruleset');

  return (
    <div className="flex flex-col gap-3 border-y border-blue-100 bg-blue-50/45 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[12px] font-semibold text-slate-900">RERA operating workflow</p>
            {context.regulatoryStatus && (
              <span className="text-[10px] font-medium text-blue-700">{readable(context.regulatoryStatus)}</span>
            )}
            {context.authority && <span className="text-[10px] text-slate-500">{context.authority}</span>}
            {context.jurisdiction && <span className="text-[10px] text-slate-400">{context.jurisdiction}</span>}
            {context.rulesetVersionId && <span className="text-[10px] text-slate-400">Ruleset #{context.rulesetVersionId}</span>}
          </div>
          <p className="mt-0.5 max-w-4xl text-[11px] leading-relaxed text-slate-600">
            {AREA_COPY[area] || AREA_COPY.finance}
          </p>
          {missing.length > 0 && (
            <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-amber-700">
              <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
              Complete {missing.join(', ')} in Operating Profile before relying on regulatory automation.
            </p>
          )}
        </div>
      </div>
      {actions.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 pl-10 sm:pl-0">
          {actions.map((action) => (
            <Link
              key={`${action.href}:${action.label}`}
              to={action.href}
              className="inline-flex h-8 items-center rounded-full border border-blue-200 bg-white px-3 text-[11px] font-medium text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-50"
            >
              {action.label}<ArrowRight className="ml-1.5 h-3 w-3" aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
