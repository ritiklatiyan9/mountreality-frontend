import { cn } from '@/lib/utils';
import { MEMBER_TYPES, STATUS_TONE, isKycIncomplete } from './memberMeta';

/* ── Member presentation ─────────────────────────────────────────────
   Shared by the members table, the mobile list and the summary strip so
   a "Farmer" is the same lime everywhere. Tones come from the dashboard
   accent ramp; the labels and values are unchanged. ── */

const AVATAR_SIZES = {
  sm: 'h-9 w-9 text-[12px]',
  md: 'h-12 w-12 text-[14px]',
  lg: 'h-20 w-20 text-[20px]',
  xl: 'h-28 w-28 text-[30px]',
};

export function MemberAvatar({ src, name, size = 'md', className }) {
  const initials = (name || '??').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  if (src) {
    return <img src={src} alt="" className={cn(AVATAR_SIZES[size], 'rounded-full object-cover', className)} />;
  }
  return (
    <span
      className={cn(AVATAR_SIZES[size], 'flex items-center justify-center rounded-full bg-mr-blue font-semibold text-white', className)}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

export function TypeBadge({ type }) {
  const meta = MEMBER_TYPES.find((mt) => mt.value === type) || MEMBER_TYPES[7];
  const Icon = meta.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium', meta.chip)}>
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export function StatusChip({ status }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium', STATUS_TONE[status] || STATUS_TONE.INACTIVE)}>
      {status}
    </span>
  );
}

/* KYC state always carries a word, never colour alone. */
export function KycChip({ member }) {
  if (isKycIncomplete(member)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-mr-amber-ink">
        <span className="h-1.5 w-1.5 rounded-full bg-mr-amber" aria-hidden="true" /> KYC pending
      </span>
    );
  }
  if (member.shared_kyc_status === 'VERIFIED') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-mr-lime-ink">
        <span className="h-1.5 w-1.5 rounded-full bg-mr-lime-ink" aria-hidden="true" /> KYC verified
      </span>
    );
  }
  return null;
}
