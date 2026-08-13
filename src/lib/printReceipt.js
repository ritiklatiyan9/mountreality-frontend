import QRCode from 'qrcode';
import { amountInWords } from './cashReceipt';
import { CUSTOMER_SIGN_CSS } from './receiptSignature';
import { escapePrintText, writePrintDocument } from './safePrint';
import { normalizeReceiptConfiguration, RECEIPT_FONT_STACKS } from './receiptConfiguration';

const fmtINR = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const up = (value) => String(value ?? '').toUpperCase();

const printableRows = (rows, configuration) => rows
  .filter((row) => row && (!row.field || configuration[`show_${row.field}`] !== false))
  .filter((row) => row.value != null && String(row.value).trim() !== '' && String(row.value).trim() !== '—');

/**
 * Shared receipt engine for Plot Payments, Land Acquisition, and future modules.
 * Module callers supply transaction facts; the selected Site supplies the
 * stored layout, design, wording, and data-visibility rules.
 */
export async function printUnifiedReceipt({
  popup: suppliedPopup,
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
  configuration: rawConfiguration,
} = {}) {
  // Open synchronously from the click event; waiting for QR generation first
  // causes modern browsers to treat the receipt as an unsolicited popup.
  const popup = suppliedPopup || window.open('', '_blank', 'width=1000,height=820');
  if (!popup) throw new Error('Pop-up blocked. Allow pop-ups to print this receipt.');
  writePrintDocument(popup, '<!doctype html><title>Preparing receipt…</title><body style="margin:0;display:grid;min-height:100vh;place-items:center;background:#0f172a;color:#fff;font:600 15px Arial,sans-serif">Preparing your receipt…</body>');

  try {
    const configuration = normalizeReceiptConfiguration(rawConfiguration);
    const isA5 = configuration.paper_size === 'A5';
    const compact = configuration.template === 'compact';
    const modern = configuration.template === 'modern';
    const executive = configuration.template === 'executive';
    const pageWidth = isA5 ? 148 : 210;
    const pageHeight = isA5 ? 210 : 297;
    const textRatio = configuration.text_scale / 100;
    const scaledPx = (size) => `${Math.round(size * textRatio * 100) / 100}px`;
    const bodyFont = RECEIPT_FONT_STACKS[configuration.body_font] || RECEIPT_FONT_STACKS.inter;
    const headingFont = RECEIPT_FONT_STACKS[configuration.heading_font] || RECEIPT_FONT_STACKS.georgia;
    const orgName = up(configuration.header_title || site.name || 'ALLOTMENT DIVISION');
    const orgAddress = up(
      configuration.header_subtitle
      || [site.address, site.city, site.state].filter(Boolean).join(', ')
      || 'ESTABLISHED REAL PROPERTY DIVISION',
    );
    const caption = amountLabel || (amountDirection === 'out' ? 'Amount Paid' : 'Amount Received');
    const receiptTitle = configuration.document_title || docTitle;
    const receiptAmountLabel = configuration.amount_label || caption;
    const accent = configuration.accent_color;
    const figureColor = amountColor || accent;
    const words = wordsOverride || amountInWords(amount);
    const {
      customerImg = '',
      authorityHtml = '',
      customerLabel = 'Signature of the Remitter',
      authorityLabel = 'Authorized Signatory & Seal',
    } = signatures;
    const e = escapePrintText;

    let qrDataUrl = '';
    if (configuration.show_verification_qr && verifyUrl) {
      try {
        qrDataUrl = await QRCode.toDataURL(verifyUrl, {
          width: 640,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#ffffff' },
        });
      } catch (error) {
        console.warn('Unified receipt QR generation failed:', receiptNo, error);
      }
    }

    const customRows = configuration.custom_fields
      .filter((field) => field.enabled && (field.label || field.value))
      .map((field) => ({ label: field.label || 'Custom field', value: field.value || '—' }));
    const metaRows = printableRows([...rows, ...customRows], configuration)
      .map((row) => `<tr><th>${e(row.label)}</th><td>${e(up(row.value))}</td></tr>`)
      .join('');
    const qrBlock = configuration.show_verification_qr
      ? qrDataUrl
        ? `<div class="qr"><img src="${qrDataUrl}" alt="Verification QR" /><div class="qr-cap">Scan to verify</div></div>`
        : '<div class="qr"><div class="qr-void">Verification<br>not available</div><div class="qr-cap">QR not issued</div></div>'
      : '';
    const signatureBlock = configuration.show_signatures
      ? `<div class="sig-box">${customerImg}<div class="sig-line">${e(customerLabel)}</div></div>
         ${qrBlock}
         <div class="sig-box">${authorityHtml}<div class="sig-line">${e(authorityLabel)}</div></div>`
      : qrBlock;
    const footerZone = signatureBlock ? `<div class="footer-zone">${signatureBlock}</div>` : '';
    const printMeta = configuration.show_printed_at
      ? `<div class="print-meta">${e(configuration.footer_note)}${printedAt ? ` &nbsp;&middot;&nbsp; Printed on <b>${e(printedAt)}</b>` : ''}</div>`
      : `<div class="print-meta">${e(configuration.footer_note)}</div>`;
    const receiptBlocks = {
      header: `<header class="masthead"><h1>${e(orgName)}</h1><div class="addr">${e(orgAddress)}</div></header><hr class="rule-strong">`,
      document: `<section class="title-strip"><div class="doc-title">${e(receiptTitle)}</div><div class="doc-meta"><div><span>Receipt no.</span><b>${e(receiptNo || '—')}</b></div><div><span>Date</span><b>${e(date || '—')}</b></div></div></section><hr class="rule-hair">`,
      amount: `<section class="amount-zone"><div class="amount-cap">${e(receiptAmountLabel)}</div><div class="amount-big" style="color:${figureColor}">₹ ${e(fmtINR(Math.abs(Number(amount) || 0)))}/-</div>${configuration.show_amount_words ? `<div class="amount-words">Rupees ${e(words)} Only</div>` : ''}</section>`,
      details: `<section class="meta-zone">${leadIn ? `<div class="lead-in">${e(leadIn)}</div>` : ''}${metaRows ? `<table class="details"><tbody>${metaRows}</tbody></table>` : ''}</section>`,
      note: configuration.show_extra_note && extraNote ? `<hr class="rule-hair"><div class="extra-note">${e(extraNote)}</div>` : '',
      signatures: footerZone,
      footer: printMeta,
    };
    const receiptBody = configuration.component_order
      .map((component) => receiptBlocks[component] || '')
      .join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>${e(docTitle)} — ${e(receiptNo)}</title>
  <style>
    @page { size: ${configuration.paper_size} portrait; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${bodyFont};
      color: #111827;
      background: #dfe4ea;
      display: flex;
      justify-content: center;
      padding: 8mm 0 24mm;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .paper {
      --accent: ${accent};
      position: relative;
      display: flex;
      flex-direction: column;
      width: ${pageWidth}mm;
      min-height: ${pageHeight}mm;
      padding: ${compact ? (isA5 ? '11mm 10mm 9mm' : '14mm 15mm 12mm') : (isA5 ? '14mm 12mm 11mm' : '20mm 19mm 17mm')};
      background: #fff;
      box-shadow: 0 16px 34px -12px rgba(15, 23, 42, .3);
      overflow: hidden;
    }
    .frame { position: absolute; inset: ${isA5 ? '5mm' : '7mm'}; pointer-events: none; }
    .with-border .frame { border: 1.5px solid #111827; }
    .template-classic.with-border .frame::after {
      content: '';
      position: absolute;
      inset: ${isA5 ? '1.8mm' : '2.8mm'};
      border: .5px solid #64748b;
    }
    .template-modern::before {
      content: '';
      position: absolute;
      inset: 0 0 auto;
      height: ${isA5 ? '4mm' : '5mm'};
      background: var(--accent);
    }
    .template-modern.with-border .frame { border-color: #cbd5e1; }
    .template-compact.with-border .frame { border: .7px solid #94a3b8; }
    .template-executive .masthead {
      padding: ${compact ? '5mm' : (isA5 ? '6mm' : '8mm')};
      border-bottom: ${isA5 ? '2mm' : '3mm'} solid var(--accent);
      background: #0f172a;
    }
    .template-executive .masthead h1 { color: #fff; }
    .template-executive .masthead .addr { color: #cbd5e1; }
    .template-executive .rule-strong { display: none; }
    .template-executive.with-border .frame { border-color: #334155; }
    .template-minimal::before {
      content: '';
      position: absolute;
      inset: 0 auto 0 0;
      width: ${isA5 ? '2.5mm' : '3.5mm'};
      background: var(--accent);
    }
    .template-minimal .masthead { text-align: left; }
    .template-minimal .amount-zone { border: 1px solid var(--accent); border-left-width: 1px; background: #fff; }
    .template-minimal.with-border .frame { border-color: #e2e8f0; }
    .template-heritage { color: #2f2923; background: #fffdf5; }
    .template-heritage.with-border .frame { border: 1.5px solid #9a7b4f; }
    .template-heritage.with-border .frame::after { content: ''; position: absolute; inset: ${isA5 ? '1.8mm' : '2.8mm'}; border: .5px solid #c9b38b; }
    .template-heritage .rule-strong { border-color: #9a7b4f; }
    .template-heritage .amount-zone { border-color: #d8c7a8; background: #fffaf0; }
    .masthead { position: relative; text-align: center; padding-bottom: ${compact ? '3mm' : '6mm'}; }
    .masthead h1 {
      font-family: ${headingFont};
      font-size: ${isA5 ? (compact ? scaledPx(18) : scaledPx(21)) : (compact ? scaledPx(23) : scaledPx(30))};
      font-weight: ${modern || executive ? '750' : '600'};
      letter-spacing: ${compact ? '2px' : '4px'};
      text-transform: uppercase;
      color: ${modern ? 'var(--accent)' : '#111827'};
    }
    .masthead .addr {
      margin-top: 2mm;
      color: #64748b;
      font-size: ${isA5 ? scaledPx(7) : scaledPx(9)};
      font-weight: 650;
      letter-spacing: ${compact ? '.7px' : '1.6px'};
      text-transform: uppercase;
    }
    .rule-strong { border: 0; border-top: ${modern ? '1.5px solid var(--accent)' : '2px solid #111827'}; }
    .rule-hair { border: 0; border-top: .5px solid #cbd5e1; }
    .title-strip {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 4mm;
      padding: ${compact ? '3mm 0' : '5mm 0'};
    }
    .doc-title {
      font-family: ${headingFont};
      color: #334155;
      font-size: ${isA5 ? scaledPx(10) : scaledPx(15)};
      font-weight: ${modern || executive ? '750' : '500'};
      letter-spacing: ${compact ? '1.3px' : '3px'};
      text-transform: uppercase;
    }
    .doc-meta { display: flex; gap: ${isA5 ? '4mm' : '10mm'}; white-space: nowrap; }
    .doc-meta span { margin-right: 1mm; color: #64748b; font-size: ${isA5 ? scaledPx(6) : scaledPx(8)}; font-weight: 700; letter-spacing: .6px; text-transform: uppercase; }
    .doc-meta b { color: #111827; font-size: ${isA5 ? scaledPx(8) : scaledPx(12)}; font-variant-numeric: tabular-nums; }
    .amount-zone {
      margin-top: ${compact ? '4mm' : '8mm'};
      padding: ${compact ? '4mm' : '7mm'} 5mm;
      border: ${modern ? '0' : '.5px solid #94a3b8'};
      border-left: ${modern ? '3px solid var(--accent)' : ''};
      background: color-mix(in srgb, var(--accent) 7%, white);
      text-align: center;
    }
    .amount-cap { color: #64748b; font-size: ${isA5 ? scaledPx(7) : scaledPx(9)}; font-weight: 750; letter-spacing: 2px; text-transform: uppercase; }
    .amount-big { margin-top: ${compact ? '1.5mm' : '3mm'}; font-family: ${headingFont}; font-size: ${isA5 ? (compact ? scaledPx(28) : scaledPx(34)) : (compact ? scaledPx(40) : scaledPx(53))}; font-weight: 750; line-height: 1.1; font-variant-numeric: tabular-nums; }
    .amount-words { margin-top: 2mm; color: #475569; font: italic ${isA5 ? scaledPx(9) : scaledPx(13)} ${headingFont}; }
    .meta-zone { padding: ${compact ? '4mm 0' : '7mm 0 5mm'}; }
    .lead-in { margin-bottom: 3mm; color: #475569; font: ${isA5 ? scaledPx(8) : scaledPx(11)} ${headingFont}; }
    table.details { width: 100%; border-collapse: collapse; }
    table.details th, table.details td { border: .5px solid #cbd5e1; padding: ${compact ? '1.7mm 2.7mm' : (isA5 ? '2mm 3mm' : '2.8mm 4.5mm')}; text-align: left; line-height: 1.3; }
    table.details th { width: 34%; background: #f8fafc; color: #64748b; font-size: ${isA5 ? scaledPx(6.5) : scaledPx(8.5)}; font-weight: 650; letter-spacing: .65px; text-transform: uppercase; }
    table.details td { color: #111827; font-size: ${isA5 ? scaledPx(8) : scaledPx(11)}; font-weight: 650; word-break: break-word; font-variant-numeric: tabular-nums; }
    .extra-note { padding: 4mm 7mm 0; color: #64748b; font: italic ${isA5 ? scaledPx(7) : scaledPx(9)}/1.55 ${headingFont}; text-align: center; }
    .footer-zone { display: flex; justify-content: space-between; align-items: flex-end; gap: ${isA5 ? '4mm' : '9mm'}; padding-top: ${compact ? '4mm' : '7mm'}; }
    .sig-box { display: flex; flex: 1; min-width: 0; min-height: ${isA5 ? '13mm' : '19mm'}; flex-direction: column; justify-content: flex-end; text-align: center; }
    .sig-line { border-top: .5px solid #111827; padding-top: 1.5mm; color: #475569; font-size: ${isA5 ? scaledPx(6) : scaledPx(8)}; font-weight: 750; letter-spacing: .55px; text-transform: uppercase; }
    .qr { display: flex; shrink: 0; flex-direction: column; align-items: center; }
    .qr img, .qr-void { width: ${isA5 ? '19mm' : '27mm'}; height: ${isA5 ? '19mm' : '27mm'}; }
    .qr img { display: block; image-rendering: pixelated; }
    .qr-void { display: grid; place-items: center; border: .5px dashed #cbd5e1; color: #94a3b8; font-size: ${isA5 ? scaledPx(5.5) : scaledPx(7.5)}; font-weight: 650; line-height: 1.5; text-align: center; text-transform: uppercase; }
    .qr-cap { margin-top: 1.2mm; color: #475569; font-size: ${isA5 ? scaledPx(5) : scaledPx(7)}; font-weight: 700; letter-spacing: .7px; text-transform: uppercase; }
    ${CUSTOMER_SIGN_CSS}
    .digital-signature { display: flex; height: ${isA5 ? '7mm' : '10mm'}; align-items: flex-end; justify-content: center; margin-bottom: 1px; color: #1e3a8a; font: 700 ${isA5 ? scaledPx(17) : scaledPx(23)}/1 'Segoe Script', 'Brush Script MT', cursive; }
    .print-meta { margin-top: ${compact ? '3mm' : '5mm'}; padding-top: 2mm; border-top: .5px dashed #d1d5db; color: #94a3b8; font-size: ${isA5 ? scaledPx(5.5) : scaledPx(7.5)}; letter-spacing: .25px; line-height: 1.4; text-align: center; }
    .print-meta b { color: #475569; }
    .print-actions { position: fixed; right: 0; bottom: 22px; left: 0; z-index: 10; text-align: center; }
    .print-actions button { margin: 0 4px; border-radius: 9px; padding: 11px 30px; border: 1px solid #cbd5e1; background: #fff; color: #334155; font-size: 13px; font-weight: 750; cursor: pointer; box-shadow: 0 8px 18px rgba(15, 23, 42, .14); }
    .print-actions .print { border-color: ${accent}; background: ${accent}; color: #fff; }
    @media print {
      body { background: #fff; padding: 0; }
      .paper { width: ${pageWidth}mm; height: ${pageHeight}mm; min-height: 0; box-shadow: none; page-break-after: avoid; page-break-inside: avoid; }
      .print-actions { display: none !important; }
    }
  </style>
</head>
<body>
  <main class="paper template-${configuration.template}${configuration.show_border ? ' with-border' : ''}">
    <div class="frame"></div>
    ${receiptBody}
  </main>
  <div class="print-actions"><button class="print" type="button">Print (${configuration.paper_size})</button><button class="close" type="button">Close</button></div>
</body>
</html>`;

    writePrintDocument(popup, html);
    return popup;
  } catch (error) {
    writePrintDocument(popup, `<!doctype html><title>Receipt error</title><body style="padding:40px;font:15px Arial,sans-serif;color:#991b1b"><h1 style="font-size:22px">Receipt could not be prepared</h1><p>${escapePrintText(error?.message || 'Unknown receipt error')}</p><button type="button">Close</button></body>`);
    throw error;
  }
}
