import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, QrCode } from 'lucide-react';
import {
  normalizeReceiptConfiguration,
  RECEIPT_FONT_STACKS,
} from '@/lib/receiptConfiguration';

const SAMPLE_ROWS = [
  { field: 'party', label: 'Paid to', value: 'Sample landowner' },
  { field: 'payment_mode', label: 'Payment mode', value: 'Bank transfer' },
  { field: 'reference', label: 'Reference', value: 'UTR-48290117' },
  { field: 'bank_details', label: 'Bank details', value: 'Account ending 7642' },
  { field: 'allocation', label: 'Allocation', value: 'Agreement advance' },
  { field: 'remarks', label: 'Remarks', value: 'First scheduled payment' },
  { field: 'status', label: 'Status', value: 'Approved' },
  { field: 'recorded_by', label: 'Recorded by', value: 'Site administrator' },
];

const PAPER_DIMENSIONS = {
  A4: { width: 720, height: 1018 },
  A5: { width: 560, height: 795 },
};

export default function UnifiedReceiptPreview({ configuration, site, fit = false }) {
  const config = normalizeReceiptConfiguration(configuration);
  const containerRef = useRef(null);
  const dimensions = PAPER_DIMENSIONS[config.paper_size] || PAPER_DIMENSIONS.A4;
  const [fitScale, setFitScale] = useState(0.6);
  const customRows = config.custom_fields
    .filter((field) => field.enabled && (field.label || field.value))
    .map((field) => ({ field: `custom-${field.id}`, label: field.label || 'Custom field', value: field.value || '—' }));
  const rows = [
    ...SAMPLE_ROWS.filter((row) => config[`show_${row.field}`] !== false),
    ...customRows,
  ];
  const siteName = config.header_title || site?.name || 'Your Site';
  const subtitle = config.header_subtitle
    || [site?.address, site?.city, site?.state].filter(Boolean).join(', ')
    || 'Site office and accounts division';
  const documentTitle = config.document_title || 'Land payment receipt';
  const amountLabel = config.amount_label || 'Amount paid';
  const compact = config.template === 'compact';
  const modern = config.template === 'modern';
  const executive = config.template === 'executive';
  const minimal = config.template === 'minimal';
  const heritage = config.template === 'heritage';
  const bodyFont = RECEIPT_FONT_STACKS[config.body_font] || RECEIPT_FONT_STACKS.inter;
  const headingFont = RECEIPT_FONT_STACKS[config.heading_font] || RECEIPT_FONT_STACKS.georgia;

  useEffect(() => {
    if (!fit || !containerRef.current) return undefined;
    const node = containerRef.current;
    const updateScale = () => {
      const bounds = node.getBoundingClientRect();
      const availableWidth = Math.max(1, bounds.width - 24);
      const availableHeight = Math.max(1, bounds.height - 24);
      setFitScale(Math.min(1, availableWidth / dimensions.width, availableHeight / dimensions.height));
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(node);
    return () => observer.disconnect();
  }, [dimensions.height, dimensions.width, fit]);

  const templateStyle = useMemo(() => {
    if (heritage) return { background: '#fffdf5', color: '#2f2923' };
    if (minimal) return { background: '#ffffff', color: '#0f172a' };
    return { background: '#ffffff', color: '#111827' };
  }, [heritage, minimal]);

  const blocks = {
    header: (
      <header
        key="header"
        className={`relative ${minimal ? 'text-left' : 'text-center'}`}
        style={{
          padding: executive ? (compact ? '2.1em 2.4em' : '2.8em 3em') : compact ? '0 0 1.2em' : '0 0 1.7em',
          margin: executive ? (compact ? '-2.6em -2.6em 1.6em' : '-3.6em -3.6em 2.2em') : 0,
          color: executive ? '#ffffff' : undefined,
          background: executive ? '#0f172a' : undefined,
          borderBottom: executive ? `0.5em solid ${config.accent_color}` : undefined,
        }}
      >
        <h3
          className="font-bold uppercase"
          style={{
            color: modern ? config.accent_color : undefined,
            fontFamily: headingFont,
            fontSize: compact ? '2.05em' : '2.55em',
            letterSpacing: minimal ? '.07em' : '.12em',
            lineHeight: 1.15,
          }}
        >
          {siteName}
        </h3>
        <p
          className="truncate font-medium uppercase"
          style={{
            marginTop: '.7em',
            color: executive ? '#cbd5e1' : '#64748b',
            fontSize: '.78em',
            letterSpacing: '.12em',
          }}
        >
          {subtitle}
        </p>
        {!executive && (
          <div
            style={{
              marginTop: '1.2em',
              height: modern ? 3 : 1,
              backgroundColor: modern ? config.accent_color : heritage ? '#9a7b4f' : '#334155',
            }}
          />
        )}
      </header>
    ),
    document: (
      <section key="document" className="relative flex items-end justify-between gap-3 border-b border-slate-300" style={{ padding: compact ? '.9em 0' : '1.3em 0' }}>
        <div><p className="font-bold uppercase text-slate-500" style={{ fontFamily: headingFont, fontSize: '.92em', letterSpacing: '.16em' }}>{documentTitle}</p><p className="mt-0.5 text-slate-500" style={{ fontSize: '.75em' }}>Receipt no. FPR-0011</p></div>
        <p className="shrink-0 font-semibold" style={{ fontSize: '.8em' }}>11 Aug 2026</p>
      </section>
    ),
    amount: (
      <section
        key="amount"
        className="relative text-center"
        style={{
          margin: compact ? '1.3em 0' : '2em 0',
          padding: compact ? '1.5em' : '2.2em',
          backgroundColor: minimal ? '#fff' : `${config.accent_color}12`,
          border: minimal ? `1px solid ${config.accent_color}` : heritage ? '1px solid #d8c7a8' : 'none',
          borderLeft: modern ? `5px solid ${config.accent_color}` : undefined,
        }}
      >
        <p className="font-bold uppercase text-slate-500" style={{ fontSize: '.78em', letterSpacing: '.2em' }}>{amountLabel}</p>
        <p className="mt-1 font-bold tabular-nums" style={{ color: config.accent_color, fontFamily: headingFont, fontSize: compact ? '3.6em' : '4.35em', lineHeight: 1.12 }}>₹ 2,50,000</p>
        {config.show_amount_words && <p className="mt-1 italic text-slate-600" style={{ fontFamily: headingFont, fontSize: '.95em' }}>Rupees Two Lakh Fifty Thousand Only</p>}
      </section>
    ),
    details: (
      <section key="details" className={`relative ${rows.length > 11 ? 'grid grid-cols-2 gap-x-5' : ''}`} style={{ padding: compact ? '.7em 0' : '1.2em 0' }}>
        {rows.map((row) => (
          <div key={row.field} className="grid grid-cols-[35%_1fr] border-b border-slate-200" style={{ padding: compact ? '.5em 0' : '.72em 0', fontSize: '.78em' }}>
            <span className="font-semibold uppercase text-slate-500" style={{ letterSpacing: '.08em' }}>{row.label}</span>
            <span className="font-semibold uppercase">{row.value}</span>
          </div>
        ))}
      </section>
    ),
    note: config.show_extra_note ? (
      <section key="note" className="relative border-y border-slate-200 px-3 text-center italic leading-relaxed text-slate-500" style={{ fontFamily: headingFont, fontSize: '.72em', paddingTop: '1em', paddingBottom: '1em' }}>
        Payment recorded against the approved agreement and subject to final ledger reconciliation.
      </section>
    ) : null,
    signatures: (config.show_signatures || config.show_verification_qr) ? (
      <section key="signatures" className="relative flex items-end justify-between gap-4" style={{ padding: compact ? '2.3em 0 1.2em' : '3.5em 0 2em' }}>
        {config.show_signatures && <div className="w-[36%] border-t border-slate-700 pt-1 text-center font-bold uppercase text-slate-500" style={{ fontSize: '.72em' }}>Landowner signature</div>}
        {config.show_verification_qr && <div className="grid shrink-0 place-items-center border border-slate-300 text-slate-500" style={{ width: compact ? '4.2em' : '5.5em', height: compact ? '4.2em' : '5.5em' }}><QrCode className="h-3/4 w-3/4" /></div>}
        {config.show_signatures && <div className="w-[36%] border-t border-slate-700 pt-1 text-center font-bold uppercase text-slate-500" style={{ fontSize: '.72em' }}>Authorized signatory</div>}
      </section>
    ) : null,
    footer: (
      <footer key="footer" className="relative border-t border-dashed border-slate-300" style={{ paddingTop: '1em' }}>
        <p className="flex items-center justify-center gap-1 text-center leading-relaxed text-slate-400" style={{ fontSize: '.66em' }}><Check className="h-[1em] w-[1em] shrink-0" /> {config.footer_note}</p>
        {config.show_printed_at && <p className="mt-1 text-center text-slate-400" style={{ fontSize: '.58em' }}>Printed 11 Aug 2026 · 04:30 PM</p>}
      </footer>
    ),
  };

  const paper = (
    <article
      className={`relative flex flex-col overflow-hidden shadow-xl shadow-slate-900/10 ${config.show_border ? 'border border-slate-800' : ''}`}
      style={{
        ...templateStyle,
        width: fit ? dimensions.width : '100%',
        height: fit ? dimensions.height : '100%',
        padding: compact ? '5.5%' : executive ? '7%' : '7.2%',
        fontFamily: bodyFont,
        fontSize: `${10 * (config.text_scale / 100)}px`,
        transform: fit ? `scale(${fitScale})` : undefined,
        transformOrigin: 'top left',
      }}
    >
      {modern && <div className="absolute inset-x-0 top-0 h-2" style={{ backgroundColor: config.accent_color }} />}
      {heritage && <div className="pointer-events-none absolute inset-[2.7%] border border-[#c9b38b]" />}
      {config.show_border && config.template === 'classic' && <div className="pointer-events-none absolute inset-[3%] border border-slate-300" />}
      {minimal && <div className="absolute bottom-0 left-0 top-0 w-2" style={{ backgroundColor: config.accent_color }} />}
      {config.component_order.map((component) => blocks[component])}
    </article>
  );

  return (
    <div ref={containerRef} className={`flex min-h-0 items-center justify-center overflow-hidden rounded-2xl border border-mr-line bg-slate-200/70 ${fit ? 'h-full p-3' : 'p-3 sm:p-5'}`}>
      {fit ? (
        <div style={{ width: dimensions.width * fitScale, height: dimensions.height * fitScale }}>
          {paper}
        </div>
      ) : (
        <div className="w-full" style={{ maxWidth: dimensions.width, aspectRatio: `${dimensions.width} / ${dimensions.height}` }}>
          {paper}
        </div>
      )}
    </div>
  );
}
