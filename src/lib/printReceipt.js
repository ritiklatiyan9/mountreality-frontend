import { writePrintDocument } from './safePrint';
// Unified premium receipt — the ONE receipt design shared by every module.
// A4 portrait, single copy, typography-and-whitespace driven: no nested
// bordered boxes, hairline horizontal rules between zones only, large
// tabular-nums amount as the centerpiece, QR verification + signatures
// anchored in the lower zone. Grayscale-safe.
import QRCode from 'qrcode';
import { amountInWords } from './cashReceipt';
import { CUSTOMER_SIGN_CSS } from './receiptSignature';

const fmtINR = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
const up = (v) => String(v ?? '').toUpperCase();

/**
 * Opens a print window with the unified A4-portrait receipt.
 *
 * @param {object} opts
 * @param {string}  [opts.docTitle='Payment Receipt']  Document title under the masthead.
 * @param {object}  [opts.site]              { name, address, city, state } — issuing organization.
 * @param {string}  [opts.receiptNo]         e.g. 'ACK-31'.
 * @param {string}  [opts.date]              Pre-formatted receipt date string.
 * @param {string}  [opts.leadIn]            Optional line above the meta rows (e.g. settlement wording).
 * @param {Array}   [opts.rows]              Module-specific meta: [{ label, value }] — empty values skipped.
 * @param {number}  opts.amount              Absolute amount (₹).
 * @param {'in'|'out'} [opts.amountDirection='in']  Received vs paid/refunded — drives caption + default color.
 * @param {string}  [opts.amountLabel]       Caption override (e.g. 'Amount Refunded').
 * @param {string}  [opts.amountColor]       Color override for the big figure.
 * @param {string}  [opts.amountInWords]     Words override; defaults to amountInWords(amount).
 * @param {string}  [opts.verifyUrl]         QR is generated from this. Missing/failed → visible fallback + console.warn.
 * @param {object}  [opts.signatures]        { customerImg, authorityHtml, customerLabel, authorityLabel }
 *                                           customerImg/authorityHtml are pre-rendered HTML from
 *                                           customerSigImg(row) / authoritySigHtml(row, signerName).
 * @param {string}  [opts.extraNote]         Statutory/proviso paragraph rendered above the signature zone.
 * @param {string}  [opts.printedAt]         Pre-formatted print timestamp.
 */
export async function printUnifiedReceipt({
  docTitle = 'Payment Receipt',
  site = {},
  receiptNo = '',
  date = '',
  leadIn = '',
  rows = [],
  amount = 0,
  amountDirection = 'in',
  amountLabel,
  amountColor,
  amountInWords: wordsOverride,
  verifyUrl = '',
  signatures = {},
  extraNote = '',
  printedAt = '',
} = {}) {
  const orgName = up(site.name || 'ALLOTMENT DIVISION');
  const orgAddr = up([site.address, site.city, site.state].filter(Boolean).join(', ')) || 'ESTABLISHED REAL PROPERTY DIVISION';
  const cap = amountLabel || (amountDirection === 'out' ? 'Amount Paid' : 'Amount Received');
  const color = amountColor || (amountDirection === 'out' ? '#b91c1c' : '#047857');
  const words = wordsOverride || amountInWords(amount);
  const {
    customerImg = '',
    authorityHtml = '',
    customerLabel = 'Signature of the Remitter',
    authorityLabel = 'Authorized Signatory & Seal',
  } = signatures;

  // ── QR: required design element; never silently absent ──
  let qrDataUrl = null;
  if (!verifyUrl) {
    console.warn('Unified receipt: verifyUrl missing —', docTitle, receiptNo);
  } else {
    try {
      qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        width: 640, margin: 2, errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
      });
    } catch (err) {
      console.warn('Unified receipt: QR generation failed —', receiptNo, err);
    }
  }
  const qrBlock = qrDataUrl
    ? `<div class="qr"><img src="${qrDataUrl}" alt="Verify QR" /><div class="qr-cap">Scan to verify</div></div>`
    : `<div class="qr"><div class="qr-void">Verification<br/>unavailable</div><div class="qr-cap">QR not issued</div></div>`;

  const metaRows = rows
    .filter((r) => r && r.value != null && String(r.value).trim() !== '' && String(r.value).trim() !== '—')
    .map((r) => `<tr><th>${r.label}</th><td>${up(r.value)}</td></tr>`)
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>${docTitle} — ${receiptNo}</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #111827;
      background: #e8ebef;
      display: flex;
      justify-content: center;
      padding: 8mm 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .paper {
      position: relative;
      background: #fff;
      width: 210mm;
      min-height: 297mm;
      padding: 20mm 19mm 17mm;
      box-shadow: 0 12px 28px -10px rgba(0, 0, 0, 0.25);
      display: flex;
      flex-direction: column;
    }

    /* ── Outer border frame: classic double hairline, grayscale-safe ── */
    .frame {
      position: absolute;
      inset: 7mm;
      border: 2px solid #111827;
      pointer-events: none;
    }
    .frame::after {
      content: '';
      position: absolute;
      inset: 2.8mm;
      border: 0.5px solid #111827;
    }
    /* ── Masthead ── */
    .masthead { text-align: center; padding-bottom: 6mm; }
    .masthead h1 {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 30px;
      font-weight: 600;
      letter-spacing: 5px;
      text-transform: uppercase;
      color: #111827;
    }
    .masthead .addr {
      font-size: 10px;
      color: #4b5563;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-weight: 600;
      margin-top: 2.5mm;
    }
    /* Strong accent rule under the masthead: heavy line + trailing hairline */
    .rule-strong {
      border: none;
      border-top: 2.5px solid #111827;
      border-bottom: 0.5px solid #111827;
      height: 1.4mm;
    }
    .rule-hair { border: none; border-top: 0.5px solid #d1d5db; }

    /* ── Title strip ── */
    .title-strip {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 5mm 0;
    }
    .doc-title {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 16px;
      letter-spacing: 5px;
      text-transform: uppercase;
      color: #374151;
    }
    .doc-meta { display: flex; gap: 12mm; }
    .doc-meta span {
      font-size: 8.5px;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: #6b7280;
      font-weight: 600;
      margin-right: 2.5mm;
    }
    .doc-meta b { font-size: 13px; color: #111827; font-variant-numeric: tabular-nums; }

    /* ── Amount centerpiece: its own bordered panel ── */
    .amount-zone {
      text-align: center;
      margin-top: 9mm;
      padding: 7mm 8mm 6.5mm;
      border: 0.5px solid #9ca3af;
      background: #f9fafb;
    }
    .amount-cap {
      font-size: 10px;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: #6b7280;
      font-weight: 700;
    }
    .amount-big {
      font-size: 54px;
      font-weight: 700;
      letter-spacing: 1px;
      line-height: 1.15;
      margin-top: 3mm;
      font-variant-numeric: tabular-nums;
    }
    .amount-words {
      font-family: Georgia, 'Times New Roman', serif;
      font-style: italic;
      font-size: 14px;
      color: #374151;
      margin-top: 3mm;
    }

    /* ── Meta: formal bordered detail table, hairline cell borders ── */
    .meta-zone { flex: 1; padding: 8mm 0 6mm; }
    .lead-in {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 12px;
      color: #374151;
      margin-bottom: 4mm;
    }
    table.details { width: 100%; border-collapse: collapse; }
    table.details th, table.details td {
      border: 0.5px solid #cbd5e1;
      padding: 2.8mm 4.5mm;
      text-align: left;
      line-height: 1.35;
    }
    table.details th {
      width: 34%;
      background: #f8fafc;
      font-size: 8.5px;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: #6b7280;
      font-weight: 600;
    }
    table.details td {
      font-size: 12px;
      font-weight: 600;
      color: #111827;
      word-break: break-word;
      font-variant-numeric: tabular-nums;
    }

    /* ── Statutory / proviso ── */
    .extra-note {
      font-family: Georgia, 'Times New Roman', serif;
      font-style: italic;
      font-size: 9.5px;
      color: #6b7280;
      text-align: center;
      line-height: 1.7;
      padding: 5mm 12mm 0;
    }

    /* ── Lower zone: signatures flanking the QR ── */
    .footer-zone {
      margin-top: auto;
      padding-top: 9mm;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 10mm;
    }
    .sig-box {
      width: 58mm;
      min-height: 20mm;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
    }
    .sig-line {
      border-top: 0.5px solid #111827;
      padding-top: 2mm;
      font-size: 8.5px;
      font-weight: 700;
      color: #4b5563;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .qr { display: flex; flex-direction: column; align-items: center; }
    .qr img { display: block; width: 28mm; height: 28mm; image-rendering: pixelated; image-rendering: crisp-edges; }
    .qr-void {
      width: 28mm;
      height: 28mm;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-size: 8px;
      font-weight: 600;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #9ca3af;
      line-height: 1.6;
      border: 0.5px dashed #d1d5db;
    }
    .qr-cap {
      font-size: 8px;
      color: #374151;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      font-weight: 700;
      margin-top: 2mm;
    }
    ${CUSTOMER_SIGN_CSS}
    .digital-signature {
      font-family: 'Segoe Script', 'Brush Script MT', cursive;
      font-size: 24px;
      font-weight: 700;
      color: #1a237e;
      line-height: 1;
      height: 10mm;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      margin-bottom: 1px;
    }
    .print-meta {
      text-align: center;
      font-size: 8px;
      color: #9ca3af;
      letter-spacing: 0.5px;
      margin-top: 7mm;
      padding-top: 2.5mm;
      border-top: 0.5px dashed #d1d5db;
    }
    .print-meta b { color: #4b5563; font-weight: 600; }

    @media print {
      body { background: #fff; padding: 0; }
      .paper {
        box-shadow: none;
        width: 210mm;
        height: 297mm;
        min-height: 0;
        overflow: hidden;
        page-break-inside: avoid;
        page-break-after: avoid;
      }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="paper">
    <div class="frame"></div>
    <div class="masthead">
      <h1>${orgName}</h1>
      <div class="addr">${orgAddr}</div>
    </div>
    <hr class="rule-strong" />
    <div class="title-strip">
      <div class="doc-title">${docTitle}</div>
      <div class="doc-meta">
        <div><span>Receipt No.</span><b>${receiptNo || '—'}</b></div>
        <div><span>Date</span><b>${date || '—'}</b></div>
      </div>
    </div>
    <hr class="rule-hair" />

    <div class="amount-zone">
      <div class="amount-cap">${cap}</div>
      <div class="amount-big" style="color:${color}">₹ ${fmtINR(amount)}/-</div>
      <div class="amount-words">Rupees ${words} Only</div>
    </div>

    <div class="meta-zone">
      ${leadIn ? `<div class="lead-in">${leadIn}</div>` : ''}
      <table class="details">${metaRows}</table>
    </div>

    ${extraNote ? `<hr class="rule-hair" /><div class="extra-note">${extraNote}</div>` : ''}

    <div class="footer-zone">
      <div class="sig-box">
        ${customerImg}
        <div class="sig-line">${customerLabel}</div>
      </div>
      ${qrBlock}
      <div class="sig-box">
        ${authorityHtml}
        <div class="sig-line">${authorityLabel}</div>
      </div>
    </div>
    <div class="print-meta">Computer-generated receipt &nbsp;&middot;&nbsp; Printed on <b>${printedAt}</b></div>
  </div>

  <script>
    // Print only after every image (QR + signatures) has decoded, so none print blank.
    async function printWhenReady() {
      try {
        await Promise.all(Array.from(document.images).map(function (img) {
          return img.complete ? Promise.resolve() : img.decode().catch(function () {});
        }));
      } catch (e) {}
      window.print();
    }
  </script>
  <div class="no-print" style="position:fixed; bottom: 30px; left:0; right:0; text-align:center; z-index:1000;">
    <button onclick="printWhenReady()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#0f172a; color:#fff; border:none; border-radius:10px; cursor:pointer; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);">
      PRINT (A4)
    </button>
    <button onclick="window.close()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#fff; color:#475569; border:1px solid #e2e8f0; border-radius:10px; cursor:pointer; margin-left:15px;">
      CLOSE
    </button>
  </div>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=1000,height=750');
  writePrintDocument(w, html);
  w.document.close();
}
