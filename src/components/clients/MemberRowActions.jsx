import { Edit2, Eye, Trash2, UserPlus } from 'lucide-react';
import { Button } from '../ui/button';

const ICON_BUTTON = 'h-8 w-8 rounded-full p-0 text-mr-faint';

/* ── Row actions ─────────────────────────────────────────────────────
   One place deciding which member actions a role may see, so the table
   and the mobile list can never drift apart on permissions. ── */
export default function MemberRowActions({
  member, canWrite, canUpdate, canDelete, onView, onRegisterSite, onEdit, onDelete,
}) {
  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <Button
        variant="ghost"
        onClick={() => onView(member)}
        title="View profile"
        aria-label={`View ${member.full_name}`}
        className={`${ICON_BUTTON} hover:bg-mr-blue-soft hover:text-mr-blue`}
      >
        <Eye className="h-4 w-4" strokeWidth={1.9} />
      </Button>

      {canWrite && (
        <Button
          variant="ghost"
          onClick={() => onRegisterSite(member)}
          title="Register in other sites"
          aria-label={`Register ${member.full_name} in other sites`}
          className={`${ICON_BUTTON} hover:bg-mr-aqua-soft hover:text-mr-aqua-ink`}
        >
          <UserPlus className="h-4 w-4" strokeWidth={1.9} />
        </Button>
      )}

      {canUpdate && (
        <Button
          variant="ghost"
          onClick={() => onEdit(member)}
          title="Edit full details"
          aria-label={`Edit ${member.full_name}`}
          className={`${ICON_BUTTON} hover:bg-mr-surface-2 hover:text-mr-text`}
        >
          <Edit2 className="h-4 w-4" strokeWidth={1.9} />
        </Button>
      )}

      {canDelete && (
        <Button
          variant="ghost"
          onClick={() => onDelete(member)}
          title="Delete"
          aria-label={`Delete ${member.full_name}`}
          className={`${ICON_BUTTON} hover:bg-mr-coral-soft hover:text-mr-coral-ink`}
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.9} />
        </Button>
      )}
    </div>
  );
}
