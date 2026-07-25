import {
  HelpCircle, Handshake, Store, Tractor, UserCheck, UserCog, Users,
} from 'lucide-react';

/* ── Member metadata ─────────────────────────────────────────────────
   Type/status vocabulary and the KYC rule, kept out of the component
   file so fast refresh keeps working. Values are unchanged; only the
   colour classes moved onto the dashboard accent ramp. ── */

export const MEMBER_TYPES = [
  { value: 'CLIENT', label: 'Client', icon: UserCheck, chip: 'bg-mr-blue-soft text-mr-blue' },
  { value: 'FARMER', label: 'Farmer', icon: Tractor, chip: 'bg-mr-lime-soft text-mr-lime-ink' },
  { value: 'MEMBER', label: 'Member', icon: Users, chip: 'bg-mr-aqua-soft text-mr-aqua-ink' },
  { value: 'BROKER', label: 'Broker', icon: Handshake, chip: 'bg-mr-amber-soft text-mr-amber-ink' },
  { value: 'PARTNER', label: 'Partner', icon: Users, chip: 'bg-mr-aqua-soft text-mr-aqua-ink' },
  { value: 'VENDOR', label: 'Vendor', icon: Store, chip: 'bg-mr-coral-soft text-mr-coral-ink' },
  { value: 'EMPLOYEE', label: 'Employee', icon: UserCog, chip: 'bg-mr-blue-soft text-mr-blue' },
  { value: 'OTHER', label: 'Other', icon: HelpCircle, chip: 'bg-mr-surface-2 text-mr-muted' },
];

export const STATUS_TONE = {
  ACTIVE: 'bg-mr-lime-soft text-mr-lime-ink',
  INACTIVE: 'bg-mr-surface-2 text-mr-muted',
  BLOCKED: 'bg-mr-coral-soft text-mr-coral-ink',
};

/** A member counts as KYC-incomplete until contact, address, an identity
 *  number and at least one document image all exist — unchanged rule. */
export const isKycIncomplete = (m) => {
  if (m.shared_kyc_status === 'VERIFIED') return false;
  const hasContact = m.phone || m.email;
  const hasAddress = m.address || m.city;
  const hasIdentity = m.aadhar_no || m.pan_no || m.voter_id || m.passport_no || m.driving_license_no;
  const hasKycPhoto = m.aadhar_front_url || m.aadhar_back_url || m.pan_card_url || m.voter_id_url
    || m.passport_url || m.driving_license_url || m.cheque_url || m.other_kyc_url;
  return !hasContact || !hasAddress || !hasIdentity || !hasKycPhoto;
};
