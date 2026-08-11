import UserAvatar from '../UserAvatar';
import { cn } from '../../lib/utils';

export default function VendorCell({ name, photo, secondary, className, onClick }) {
  const sameLabel = String(name || '').trim().toLowerCase() === String(secondary || '').trim().toLowerCase();
  const secondaryLabel = sameLabel ? '' : secondary;
  const content = (
    <div className={cn('flex min-w-0 items-center gap-2.5 text-left', className)}>
      <UserAvatar name={name} src={photo} size="sm" label="Vendor" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium leading-5 text-slate-800">{name || 'Unassigned vendor'}</span>
        {(secondaryLabel || !name) && <span className="block truncate text-[11px] leading-4 text-slate-400">{secondaryLabel || 'Supplier'}</span>}
      </span>
    </div>
  );
  return onClick ? <button type="button" className="rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500" onClick={onClick}>{content}</button> : content;
}
