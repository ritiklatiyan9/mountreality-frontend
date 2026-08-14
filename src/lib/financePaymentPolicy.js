import { FINANCE_PAYMENT_MODES } from './sitePolicy';

// The operating-profile choice is intentionally two buckets. Specific rails
// such as Cheque, UPI, NEFT, RTGS and IMPS remain Bank/non-cash details.
export const ALL_PAYMENT_TYPES = Object.freeze(['BANK', 'CASH']);

export function getFinancePaymentPolicy(sitePolicy) {
  const configured = sitePolicy?.finance?.paymentMode
    ?? sitePolicy?.finance?.payment_mode
    ?? sitePolicy?.profile?.finance_payment_mode;
  const paymentMode = String(configured || '').trim().toUpperCase()
    === FINANCE_PAYMENT_MODES.BANK_ONLY
    ? FINANCE_PAYMENT_MODES.BANK_ONLY
    : FINANCE_PAYMENT_MODES.ALL_MODES;
  const bankOnly = paymentMode === FINANCE_PAYMENT_MODES.BANK_ONLY;
  return {
    paymentMode,
    bankOnly,
    cashAllowed: !bankOnly,
    defaultPaymentType: bankOnly ? 'BANK' : 'CASH',
    defaultPaymentFrom: bankOnly ? 'BANK' : 'CASH',
    paymentTypes: bankOnly ? ALL_PAYMENT_TYPES.filter((mode) => mode !== 'CASH') : ALL_PAYMENT_TYPES,
  };
}

export function paymentFromOptionsForPolicy(options, policy) {
  return policy?.bankOnly
    ? options.filter((mode) => String(mode).toUpperCase() !== 'CASH')
    : options;
}
