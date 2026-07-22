// ── Shared helpers for the NOC (No Objection Certificate) pages ──

export const fmtINR = (v) =>
  (parseFloat(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const fmtDateIN = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Indian numbering system (lakh/crore) amount-in-words for "Rupees … Only".
const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const twoDigits = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`);
const threeDigits = (n) => {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', rest ? twoDigits(rest) : ''].filter(Boolean).join(' ');
};

export const amountInWordsINR = (value) => {
  let n = Math.round(parseFloat(value) || 0);
  if (n === 0) return 'Rupees Zero Only';
  const sign = n < 0 ? 'Minus ' : '';
  n = Math.abs(n);
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const parts = [];
  if (crore) parts.push(`${threeDigits(crore) || twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return `${sign}Rupees ${parts.join(' ')} Only`;
};

// Resolve the letterhead used on official prints: booking module's
// project_settings wins, then the auth-context site, then safe fallbacks.
export const buildCompany = ({ letterhead, site }) => {
  const s = letterhead || {};
  const location = [site?.city, site?.state].filter(Boolean).join(', ') || s.company_city || '';
  return {
    legalName: site?.name || s.company_legal_name || 'COMPANY',
    brandName: s.company_brand_name || site?.name || 'COMPANY',
    address: [site?.address, site?.city, site?.state].filter(Boolean).join(', ') || s.company_address || '',
    location,
    phone: s.company_phone || '',
    email: s.company_email || '',
    gstin: s.company_gstin || '',
    website: s.company_website || '',
    logoUrl: s.logo_url || '',
  };
};

export const paymentModeOf = (p) =>
  String(p.payment_from || p.payment_mode || p.payment_type || '').toUpperCase() || '—';

export const isBadCheque = (p) => ['BOUNCED', 'RETURNED'].includes(String(p.cheque_status || '').toUpperCase());
