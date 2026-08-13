import { MapPin, Phone } from 'lucide-react';
import { Checkbox } from '../ui/checkbox';
import { KycChip, MemberAvatar, StatusChip, TypeBadge } from './memberDisplay';
import MemberRowActions from './MemberRowActions';

/* ── Members list (mobile) ───────────────────────────────────────────
   The same rows as the table, stacked. Never a compressed desktop table
   on a phone. ── */
export default function MembersMobileList({ members, selection, permissions, actions }) {
  return (
    <ul className="divide-y divide-mr-line md:hidden">
      {members.map((m) => (
        <li key={`m-${m.id}`} className="px-4 py-4">
          <div className="flex items-start gap-3">
            <Checkbox
              checked={selection.isSelected(m.id)}
              onCheckedChange={() => selection.toggle(m.id)}
              aria-label={`Select ${m.full_name}`}
              className="mt-1 shrink-0"
            />
            <button
              type="button"
              onClick={() => actions.onView(m)}
              className="min-w-0 flex-1 text-left"
            >
              <span className="flex items-start gap-3">
                <MemberAvatar src={m.photo} name={m.full_name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-mr-text">{m.full_name}</span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <TypeBadge type={m.member_type} />
                    <StatusChip status={m.status} />
                    <KycChip member={m} />
                  </span>
                </span>
              </span>

              <span className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-mr-muted">
                {m.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" /> {m.phone}
                  </span>
                )}
                {m.city && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" /> {m.city}
                  </span>
                )}
                {m.team && <span className="text-mr-faint">{m.team}</span>}
              </span>
            </button>
          </div>

          <div className="mt-2">
            <MemberRowActions member={m} {...permissions} {...actions} />
          </div>
        </li>
      ))}
    </ul>
  );
}
