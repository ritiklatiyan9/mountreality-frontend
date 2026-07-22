// Shared "cash receipt" — a rich, formal, filled A5 layout used for CASH-mode
// payments across every module. Above board: keeps the issuing site/company
// name. No QR verify block, no watermark. Formal acknowledgement wording is
// truthful — the sum is deposited to the bank account and entered in the books.
import { customerSigImg, authoritySigHtml } from './receiptSignature';

// Indian-format number → words (rupees). ponytail: handles up to 99 crore,
// far past any single cash receipt; extend the scale if ever needed.
export function amountInWords(num) {
  const n = Math.floor(Math.abs(Number(num) || 0));
  if (n === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x) => x < 20 ? ones[x] : `${tens[Math.floor(x / 10)]}${x % 10 ? ' ' + ones[x % 10] : ''}`;
  const three = (x) => `${x >= 100 ? ones[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' : '') : ''}${x % 100 ? two(x % 100) : ''}`;
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  let out = '';
  if (crore) out += `${two(crore)} Crore `;
  if (lakh) out += `${two(lakh)} Lakh `;
  if (thousand) out += `${two(thousand)} Thousand `;
  if (rest) out += three(rest);
  return out.trim();
}

const fmtINR = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });

/**
 * Opens a print window with a rich, formal cash receipt (A5). Issuer kept.
 */
export function printCashReceipt({
  siteName = 'COMPANY',
  siteAddr = '',
  docTitle = 'Cash Receipt',
  voucherNo = '',
  dateStr = '',
  printedAt = '',
  partyLabel = '',
  partyName = '',
  plotNo = '',
  amount = 0,
  amountColor = '#047857',
  rows = [],
  signerName = '',
  customerSigLabel = 'Signature',
  row = {},
}) {
  // Promote a "Plot No" row into the header if the caller didn't pass one.
  let detail = rows.filter((r) => r && r.value != null && String(r.value).trim() !== '' && String(r.value).trim() !== '—');
  if (!plotNo) {
    const pr = detail.find((r) => /plot\s*no/i.test(r.label));
    if (pr) { plotNo = pr.value; detail = detail.filter((r) => r !== pr); }
  }

  // Always render at least a couple of particular rows so the page reads "full".
  const detailRows = (detail.length ? detail : [{ label: 'Being', value: 'Cash payment as per account' }])
    .map((r) => `<tr><th>${r.label}</th><td>${r.value}</td></tr>`)
    .join('');

  const words = amountInWords(amount);
  const isReceipt = /receipt/i.test(docTitle);
  const receivedVerb = isReceipt ? 'Received with thanks from' : 'Paid to';

  const html = `<!DOCTYPE html>
<html><head>
  <title>${docTitle.toUpperCase()} — ${voucherNo}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=EB+Garamond:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500;600;700&family=Dancing+Script:wght@600;700&display=swap');
    @page { size: A5 portrait; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; color: #1a1a1a; background: #e7ebf0; display: flex; justify-content: center; padding: 7mm 0; }
    .sheet {
      background: #fffdf8;
      width: 148mm; min-height: 210mm; padding: 8mm; position: relative;
      box-shadow: 0 10px 30px -8px rgba(0,0,0,0.22);
      display: flex; flex-direction: column;
    }
    .frame-outer { position: absolute; inset: 4mm; border: 2.5px double #0f172a; border-radius: 4px; pointer-events: none; }
    .frame-inner { position: absolute; inset: 5.6mm; border: 0.6px solid #b08d57; border-radius: 3px; pointer-events: none; }
    .corner { position: absolute; font-size: 14px; color: #b08d57; z-index: 3; }
    .corner.tl { top: 5.2mm; left: 5.2mm; } .corner.tr { top: 5.2mm; right: 5.2mm; }
    .corner.bl { bottom: 5.2mm; left: 5.2mm; } .corner.br { bottom: 5.2mm; right: 5.2mm; }
    .inner { position: relative; z-index: 2; display: flex; flex-direction: column; flex: 1; padding: 4mm 5mm; }

    .header { text-align: center; }
    .header .est { font-size: 7.5px; letter-spacing: 3px; color: #b08d57; font-weight: 700; text-transform: uppercase; }
    .header h1 { font-family: 'Cinzel', serif; font-size: 21px; letter-spacing: 1.5px; color: #0f172a; text-transform: uppercase; margin-top: 1px; }
    .header .addr { font-size: 8px; color: #475569; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600; margin-top: 2px; }
    .rule { height: 0; border-top: 1.5px solid #0f172a; margin: 2.5mm 0 0; position: relative; }
    .rule::after { content: '❖'; position: absolute; top: -8px; left: 50%; transform: translateX(-50%); background: #fffdf8; padding: 0 6px; color: #b08d57; font-size: 11px; }
    .ribbon { text-align: center; margin: 3mm auto 0; }
    .ribbon span { display: inline-block; background: #0f172a; color: #fff; font-family: 'Cinzel', serif; font-size: 11px; letter-spacing: 4px; text-transform: uppercase; padding: 2.5px 22px; border-radius: 2px; box-shadow: 0 2px 0 #b08d57; }

    .infogrid { display: flex; gap: 6px; margin-top: 4mm; }
    .infocell { flex: 1; border: 1px solid #cbd5e1; border-radius: 3px; padding: 1.6mm 2.5mm; background: rgba(255,255,255,0.6); }
    .infocell b { display: block; font-size: 7px; text-transform: uppercase; letter-spacing: 0.6px; color: #64748b; }
    .infocell span { font-size: 12px; font-weight: 800; color: #0f172a; letter-spacing: 0.3px; }

    .party-line { margin-top: 4mm; font-family: 'EB Garamond', serif; font-size: 12.5px; color: #1f2937; }
    .party-line .lbl { color: #64748b; }
    .party-line .fill { font-weight: 700; color: #0f172a; text-transform: uppercase; border-bottom: 1px dotted #94a3b8; padding: 0 4px; }
    .sum-line { margin-top: 2mm; font-family: 'EB Garamond', serif; font-size: 11.5px; font-style: italic; color: #334155; line-height: 1.5; }
    .sum-line b { font-style: normal; color: #0f172a; }

    .amount-box { margin-top: 3.5mm; display: flex; align-items: center; justify-content: space-between; padding: 2.5mm 4mm; background: linear-gradient(90deg, #f8fafc, #eef7f2); border: 1.4px solid #0f172a; border-radius: 4px; }
    .amount-box .cap { font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 700; }
    .amount-box .big { font-size: 24px; font-weight: 800; color: ${amountColor}; letter-spacing: 0.5px; }

    table.details { width: 100%; border-collapse: collapse; margin-top: 4mm; }
    table.details th, table.details td { border: 1px solid #d5dbe3; padding: 1.5mm 3mm; text-align: left; font-size: 10px; line-height: 1.3; }
    table.details th { background: #f1f5f9; color: #475569; font-size: 8px; text-transform: uppercase; letter-spacing: 0.4px; width: 36%; font-weight: 700; }
    table.details td { color: #0f172a; font-weight: 600; }

    .ack { margin-top: 4mm; padding: 2.6mm 3.2mm; background: rgba(176,141,87,0.06); border: 1px solid #e2d3ba; border-left: 3px solid #b08d57; border-radius: 3px; }
    .ack h4 { font-family: 'Cinzel', serif; font-size: 8.5px; letter-spacing: 1.5px; color: #7c5e2a; text-transform: uppercase; margin-bottom: 1.5mm; }
    .ack p { font-family: 'EB Garamond', serif; font-size: 8.6px; color: #3f3a30; line-height: 1.5; text-align: justify; }

    .footer { margin-top: auto; padding-top: 10mm; display: flex; justify-content: space-between; align-items: flex-end; gap: 12mm; }
    .sig-box { flex: 1; text-align: center; min-height: 16mm; display: flex; flex-direction: column; justify-content: flex-end; }
    .sig-for { font-size: 7.5px; color: #475569; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 1mm; }
    .sig-line { border-top: 1.4px solid #0f172a; padding-top: 3px; font-size: 8px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
    .digital-signature { font-family: 'Dancing Script', cursive; font-size: 20px; font-weight: 700; color: #1a237e; line-height: 1; height: 8mm; display: flex; align-items: flex-end; justify-content: center; }
    .customer-sign { display: block; max-height: 11mm; max-width: 46mm; margin: 0 auto 1px; object-fit: contain; }

    .footmeta { text-align: center; font-size: 6.8px; color: #94a3b8; margin-top: 3mm; padding-top: 1.5mm; border-top: 1px dashed #d5dbe3; letter-spacing: 0.4px; }
    .footmeta b { color: #64748b; }
    @media print { body { background: #fff; padding: 0; } .sheet { box-shadow: none; width: 148mm; height: 210mm; } .no-print { display: none !important; } .customer-sign { max-height: 9mm; } }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="frame-outer"></div>
    <div class="frame-inner"></div>
    <span class="corner tl">❖</span><span class="corner tr">❖</span>
    <span class="corner bl">❖</span><span class="corner br">❖</span>
    <div class="inner">
      <div class="header">
        <div class="est">◆ Estd. Real Estate & Development ◆</div>
        <h1>${siteName}</h1>
        <div class="addr">${siteAddr || 'ACCOUNTS &amp; FINANCE DIVISION'}</div>
        <div class="rule"></div>
      </div>
      <div class="ribbon"><span>${docTitle}</span></div>

      <div class="infogrid">
        <div class="infocell"><b>Voucher No.</b><span>${voucherNo || '—'}</span></div>
        <div class="infocell"><b>Date</b><span>${dateStr || '—'}</span></div>
        ${plotNo ? `<div class="infocell"><b>Plot No.</b><span>${String(plotNo).toUpperCase()}</span></div>` : ''}
      </div>

      ${partyName ? `<div class="party-line"><span class="lbl">${receivedVerb}</span> <span class="fill">${partyName}</span></div>` : ''}
      <div class="sum-line">the sum of <b>Rupees ${words} Only</b> in cash, towards the account and particulars set out herein below.</div>

      <div class="amount-box">
        <div class="cap">Amount<br/>Received</div>
        <div class="big">₹ ${fmtINR(amount)}/-</div>
      </div>

      <table class="details">${detailRows}</table>

      <div class="ack">
        <h4>Declaration &amp; Acknowledgement</h4>
        <p>Received the above-noted sum in cash towards the account and plot/particulars stated herein. The tender is accepted <b>subject to realization</b> and shall be deposited into the designated bank account of the establishment and duly entered in its books of account. This acknowledgement takes effect on behalf of the establishment&rsquo;s banking arrangement and shall be valid only upon reconciliation; any tender dishonoured, short-paid or found deficient shall render this receipt void <i>ab initio</i>. <b>E. &amp; O.E.</b></p>
      </div>

      <div class="footer">
        <div class="sig-box">${customerSigImg(row)}<div class="sig-line">${customerSigLabel}</div></div>
        <div class="sig-box"><div class="sig-for">For ${siteName}</div>${authoritySigHtml(row, signerName)}<div class="sig-line">Authorized Signatory</div></div>
      </div>

      <div class="footmeta">Computer-generated cash receipt &nbsp;·&nbsp; Printed on <b>${printedAt}</b> &nbsp;·&nbsp; Valid subject to encashment &amp; reconciliation</div>
    </div>
  </div>
  <div class="no-print" style="position:fixed; bottom:22px; left:0; right:0; text-align:center;">
    <button onclick="(async()=>{try{if(document.fonts&&document.fonts.ready)await document.fonts.ready;}catch(e){}window.print();})()" style="padding:11px 40px; font-size:14px; font-weight:700; background:#0f172a; color:#fff; border:none; border-radius:9px; cursor:pointer; box-shadow:0 8px 14px -3px rgba(0,0,0,0.25);">PRINT (A5)</button>
    <button onclick="window.close()" style="padding:11px 40px; font-size:14px; font-weight:700; background:#fff; color:#475569; border:1px solid #e2e8f0; border-radius:9px; cursor:pointer; margin-left:12px;">CLOSE</button>
  </div>
</body></html>`;

  const w = window.open('', '_blank', 'width=780,height=800');
  w.document.write(html);
  w.document.close();
}
