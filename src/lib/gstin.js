/* GSTIN validation, mirroring src/utils/gstin.js on the API.
   Duplicated on purpose: the server is the authority and re-checks every
   write, but a 15-character code typed by hand deserves feedback before
   a round trip rather than a red toast after one. */

const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SHAPE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const normaliseGstin = (value) => String(value ?? '').replace(/\s+/g, '').toUpperCase();

export function isValidGstin(value) {
  const gstin = normaliseGstin(value);
  if (!SHAPE.test(gstin)) return false;
  const state = Number(gstin.slice(0, 2));
  if (!((state >= 1 && state <= 38) || state === 97)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i += 1) {
    const product = CHARSET.indexOf(gstin[i]) * (i % 2 ? 2 : 1);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHARSET[(36 - (sum % 36)) % 36] === gstin[14];
}

/** Null when there is nothing to say yet — blank is valid, it is optional. */
export function gstinHint(value) {
  const gstin = normaliseGstin(value);
  if (!gstin) return null;
  if (gstin.length < 15) return { tone: 'muted', text: `${gstin.length} of 15 characters` };
  if (gstin.length > 15) return { tone: 'error', text: 'A GSTIN is exactly 15 characters' };
  return isValidGstin(gstin)
    ? { tone: 'ok', text: 'Valid GSTIN' }
    : { tone: 'error', text: 'Those 15 characters do not form a valid GSTIN' };
}
