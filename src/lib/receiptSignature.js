// Shared receipt-signature helpers — used by every module's print-receipt HTML.
// Rows carry customer_signature_url / authority_signature_url (drawn on the
// signature pad); "Name Sign" localStorage setting decides whether the
// authorized signatory falls back to the cursive printed name.

export const nameSignOn = () => localStorage.getItem('nameSign') !== '0';

// Inner HTML for the customer/payee sig-box (img above the line, or nothing)
export const customerSigImg = (row) =>
  row?.customer_signature_url
    ? `<img class="customer-sign" src="${row.customer_signature_url}" alt="" />`
    : '';

// Inner HTML for the authorized-signatory sig-box: drawn signature wins;
// else cursive name when Name Sign is on; else blank line.
export const authoritySigHtml = (row, signerName) =>
  row?.authority_signature_url
    ? `<img class="customer-sign" src="${row.authority_signature_url}" alt="" />`
    : (nameSignOn() && signerName ? `<div class="digital-signature">${signerName}</div>` : '');

// Drop this next to the receipt's other CSS rules.
export const CUSTOMER_SIGN_CSS =
  '.customer-sign { display: block; max-height: 11mm; max-width: 48mm; margin: 0 auto 1px; object-fit: contain; } ' +
  '@media print { .customer-sign { max-height: 9mm !important; } }';
