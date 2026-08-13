import { ArrowUpDown, MapPin, Phone } from 'lucide-react';
import { Checkbox } from '../ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { KycChip, MemberAvatar, StatusChip, TypeBadge } from './memberDisplay';
import MemberRowActions from './MemberRowActions';

/* The shadcn table owns the only scroll container; sticky lives on cells
   because a sticky <thead> is unreliable with collapsed table borders. */
const HEAD = 'sticky top-0 z-10 whitespace-nowrap border-b border-mr-line bg-mr-surface-2/80 px-3 py-3 text-left text-[12px] font-medium text-mr-muted';
const CELL = 'px-3 py-3 align-middle';

/* ── Members table (desktop) ─────────────────────────────────────────
   Presentational only — rows, selection and permissions are handed in.
   The mobile presentation lives in MembersMobileList. ── */
export default function MembersTable({
  members, selection, visibleIds, sortOrder, onToggleSort, permissions, actions,
}) {
  return (
    <div className="hidden md:block">
      <Table
        wrapperClassName="max-h-[calc(100vh-300px)] border-b border-mr-line"
        className="mr-dark-table min-w-[850px] border-separate border-spacing-0 text-[13px]"
      >
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={`${HEAD} w-10`}>
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
            </TableHead>
            <TableHead className={`${HEAD} w-14`}>
              <button
                type="button"
                onClick={onToggleSort}
                className="inline-flex items-center gap-1 rounded-control px-1 py-0.5 transition-colors hover:text-mr-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
                title={sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
              >
                # <ArrowUpDown className="h-3 w-3" strokeWidth={1.9} aria-hidden="true" />
              </button>
            </TableHead>
            <TableHead className={`${HEAD} min-w-[220px]`}>Member</TableHead>
            <TableHead className={`${HEAD} w-32`}>Type</TableHead>
            <TableHead className={`${HEAD} min-w-[140px]`}>Phone</TableHead>
            <TableHead className={`${HEAD} min-w-[110px]`}>City</TableHead>
            <TableHead className={`${HEAD} w-24`}>Team</TableHead>
            <TableHead className={`${HEAD} w-28`}>Status</TableHead>
            <TableHead className={`${HEAD} w-36 text-right`}>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m, idx) => (
            <TableRow
              key={m.id}
              className="cursor-pointer border-b border-mr-line transition-colors duration-150 hover:bg-mr-surface-2/70"
              onClick={() => actions.onView(m)}
            >
              <TableCell className={CELL} onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selection.isSelected(m.id)}
                  onCheckedChange={() => selection.toggle(m.id)}
                  aria-label={`Select ${m.full_name}`}
                />
              </TableCell>
              <TableCell className={`${CELL} text-[12px] tabular-nums text-mr-faint`}>{idx + 1}</TableCell>
              <TableCell className={CELL}>
                <span className="flex items-center gap-2.5">
                  <MemberAvatar src={m.photo} name={m.full_name} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-mr-text">{m.full_name}</span>
                    {m.email && <span className="block truncate text-[12px] text-mr-faint">{m.email}</span>}
                    <span className="mt-1 block"><KycChip member={m} /></span>
                  </span>
                </span>
              </TableCell>
              <TableCell className={CELL}><TypeBadge type={m.member_type} /></TableCell>
              <TableCell className={CELL}>
                {m.phone ? (
                  <a
                    href={`tel:${m.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 text-mr-muted transition-colors hover:text-mr-blue"
                  >
                    <Phone className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" /> {m.phone}
                  </a>
                ) : <span className="text-mr-faint">—</span>}
              </TableCell>
              <TableCell className={CELL}>
                {m.city ? (
                  <span className="inline-flex items-center gap-1.5 text-mr-muted">
                    <MapPin className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" /> {m.city}
                  </span>
                ) : <span className="text-mr-faint">—</span>}
              </TableCell>
              <TableCell className={CELL}>
                {m.team ? (
                  <span className="inline-flex items-center rounded-full bg-mr-surface-2 px-2.5 py-0.5 text-[12px] font-medium text-mr-muted">
                    {m.team}
                  </span>
                ) : <span className="text-mr-faint">—</span>}
              </TableCell>
              <TableCell className={CELL}><StatusChip status={m.status} /></TableCell>
              <TableCell className={`${CELL} text-right`}>
                <MemberRowActions member={m} {...permissions} {...actions} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
