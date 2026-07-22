// NPCI UPI deep-link — any UPI app scans this; amount comes pre-filled & locked.
export const buildUpiUri = ({ vpa, payee_name, amount, note, txn_ref }) => {
  const params = {
    pa: vpa,
    pn: payee_name,
    am: Number(amount).toFixed(2),
    cu: 'INR',
    ...(note ? { tn: note.slice(0, 80) } : {}),
    ...(txn_ref ? { tr: txn_ref } : {}),
  };
  return 'upi://pay?' + Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
};

export const fmtINR = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
