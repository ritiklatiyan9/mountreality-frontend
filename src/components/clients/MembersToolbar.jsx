import { ArrowUpDown, Search, X } from 'lucide-react';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { MEMBER_TYPES } from './memberMeta';

const TRIGGER = 'h-10 min-w-[112px] rounded-full border-mr-line bg-mr-surface-2 px-3.5 text-[13px] font-medium text-mr-text shadow-none hover:bg-mr-surface focus:ring-2 focus:ring-mr-blue';

/* ── Members toolbar ─────────────────────────────────────────────────
   Search, type/status/KYC/team filters and the result count. Owns no
   state — every value and setter comes from the page, so the existing
   filtering logic is untouched. ── */
export default function MembersToolbar({
  searchQuery, onSearchChange,
  filterType, onTypeChange,
  filterStatus, onStatusChange, statusOptions,
  filterKyc, onKycChange,
  filterTeam, onTeamChange, teams,
  resultCount, onClear, sortOrder, onToggleSort,
}) {
  const dirty = searchQuery || filterType !== 'ALL' || filterStatus !== 'ALL'
    || filterTeam !== 'ALL' || filterKyc !== 'ALL';

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:min-w-[260px]">
          <label htmlFor="mr-member-search" className="sr-only">Search members</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mr-faint" strokeWidth={1.9} aria-hidden="true" />
          <Input
            id="mr-member-search"
            placeholder="Search name, phone, city…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10 rounded-full border-mr-line bg-mr-surface-2 pl-9 text-[13px] shadow-none focus-visible:border-mr-blue focus-visible:bg-mr-surface focus-visible:ring-2 focus-visible:ring-mr-blue/20"
          />
        </div>

        <div className="mr-rail flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
          <Select value={filterType} onValueChange={onTypeChange}>
            <SelectTrigger className={TRIGGER} aria-label="Filter by member type">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              {MEMBER_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  <span className="flex items-center gap-2">
                    <t.icon className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" /> {t.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={onStatusChange}>
            <SelectTrigger className={TRIGGER} aria-label="Filter by status">
              <SelectValue placeholder="All status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All status</SelectItem>
              {statusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterKyc} onValueChange={onKycChange}>
            <SelectTrigger className={TRIGGER} aria-label="Filter by KYC state">
              <SelectValue placeholder="All KYC" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All KYC</SelectItem>
              <SelectItem value="INCOMPLETE">Incomplete only</SelectItem>
            </SelectContent>
          </Select>

          {teams.length > 0 && (
            <Select value={filterTeam} onValueChange={onTeamChange}>
              <SelectTrigger className={TRIGGER} aria-label="Filter by team">
                <SelectValue placeholder="All teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All teams</SelectItem>
                {teams.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {dirty && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-[12px] font-medium text-mr-muted transition-colors hover:bg-mr-surface-2 hover:text-mr-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> Clear filters
          </button>
        )}
        {onToggleSort && (
          <button
            type="button"
            onClick={onToggleSort}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-mr-line bg-mr-surface-2 text-mr-muted transition-colors hover:bg-mr-surface hover:text-mr-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
            aria-label={`Sort members ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
            title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
          >
            <ArrowUpDown className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
          </button>
        )}
        <span className="whitespace-nowrap text-[12px] text-mr-muted">
          {resultCount} member{resultCount === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  );
}
