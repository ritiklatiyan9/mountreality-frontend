import { ArrowUpDown, MapPin, Phone } from 'lucide-react';
import { Checkbox } from '../ui/checkbox';
import { KycChip, MemberAvatar, StatusChip, TypeBadge } from './memberDisplay';
import MemberRowActions from './MemberRowActions';

/* Sticky lives on the cells, not on <thead> — with border-collapse a
   sticky thead is ignored, and the shadcn <Table> wrapper adds a second
   scroll container that breaks it outright. One scroller, sticky <th>. */
const HEAD = 'sticky top-0 z-10 whitespace-nowrap border-b border-mr-line bg-mr-surface px-3 py-2.5 text-left text-[12px] font-medium text-mr-muted';
const CELL = 'px-3 py-2.5 align-middle';

/* ── Members table (desktop) ─────────────────────────────────────────
   Presentational only — rows, selection and permissions are handed in.
   The mobile presentation lives in MembersMobileList. ── */
export default function MembersTable({
  members, selection, visibleIds, sortOrder, onToggleSort, permissions, actions,
}) {
  return (
    <div className="hidden max-h-[calc(100vh-300px)] overflow-auto md:block">
      <table className="w-full min-w-[1000px] border-collapse text-[13px]">
        <thead>
          <tr>
            <th className={`${HEAD} w-10`}>
              <Checkbox
                checked={
                  selection.isAllSelected(visibleIds)
                    ? true
                    : (selection.count > 0 && visibleIds.some((id) => selection.isSelected(id)))
                      ? 'indeterminate'
                      : false
                }
                onCheckedChange={() => selection.toggleAll(visibleIds)}
                aria-label="Select all members"
              />
            </th>
            <th className={`${HEAD} w-14`}>
              <button
                type="button"
                onClick={onToggleSort}
                className="inline-flex items-center gap-1 rounded-control px-1 py-0.5 transition-colors hover:text-mr-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
                title={sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
              >
                # <ArrowUpDown className="h-3 w-3" strokeWidth={1.9} aria-hidden="true" />
              </button>
            </th>
            <th className={`${HEAD} min-w-[220px]`}>Member</th>
            <th className={`${HEAD} min-w-[150px]`}>Father name</th>
            <th className={`${HEAD} w-32`}>Type</th>
            <th className={`${HEAD} min-w-[140px]`}>Phone</th>
            <th className={`${HEAD} min-w-[110px]`}>City</th>
            <th className={`${HEAD} w-24`}>Team</th>
            <th className={`${HEAD} w-28`}>Status</th>
            <th className={`${HEAD} w-36 text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m, idx) => (
            <tr
              key={m.id}
              className="cursor-pointer border-b border-mr-line transition-colors duration-150 hover:bg-mr-surface-2/70"
              onClick={() => actions.onView(m)}
            >
              <td className={CELL} onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selection.isSelected(m.id)}
                  onCheckedChange={() => selection.toggle(m.id)}
                  aria-label={`Select ${m.full_name}`}
                />
              </td>
              <td className={`${CELL} text-[12px] tabular-nums text-mr-faint`}>{idx + 1}</td>
              <td className={CELL}>
                <span className="flex items-center gap-2.5">
                  <MemberAvatar src={m.photo} name={m.full_name} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-mr-text">{m.full_name}</span>
                    {m.email && <span className="block truncate text-[12px] text-mr-faint">{m.email}</span>}
                    <span className="mt-1 block"><KycChip member={m} /></span>
                  </span>
                </span>
              </td>
              <td className={`${CELL} text-mr-muted`}>{m.father_name || '—'}</td>
              <td className={CELL}><TypeBadge type={m.member_type} /></td>
              <td className={CELL}>
                {m.phone ? (
                  <a
                    href={`tel:${m.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 text-mr-muted transition-colors hover:text-mr-blue"
                  >
                    <Phone className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" /> {m.phone}
                  </a>
                ) : <span className="text-mr-faint">—</span>}
              </td>
              <td className={CELL}>
                {m.city ? (
                  <span className="inline-flex items-center gap-1.5 text-mr-muted">
                    <MapPin className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" /> {m.city}
                  </span>
                ) : <span className="text-mr-faint">—</span>}
              </td>
              <td className={CELL}>
                {m.team ? (
                  <span className="inline-flex items-center rounded-full bg-mr-surface-2 px-2.5 py-0.5 text-[12px] font-medium text-mr-muted">
                    {m.team}
                  </span>
                ) : <span className="text-mr-faint">—</span>}
              </td>
              <td className={CELL}><StatusChip status={m.status} /></td>
              <td className={`${CELL} text-right`}>
                <MemberRowActions member={m} {...permissions} {...actions} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
