import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Printer, ArrowLeft, Loader2 } from 'lucide-react';
import QRCode from 'qrcode';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { fmtINR, fmtDateIN, amountInWordsINR, buildCompany, paymentModeOf } from '../lib/nocUtils';

/**
 * NOC Print (route: /plot-registry/:id/noc/print) — :id is the registry id.
 *
 * Official bilingual (English + Hindi) "No Objection Certificate" for plot
 * registry, mirroring the booking module's Agreement print: A4 sheet,
 * repeating header/footer via @page margin boxes, letterhead resolved from
 * project_settings → auth-context site, watermark, browser print / Save-as-PDF.
 */

const Clause = ({ n, en, hi }) => (
  <div className="clause">
    <p className="cl-en">{n && <strong className="cl-n">{n}.</strong>} {en}</p>
    {hi && <p className="cl-hi hi">{hi}</p>}
  </div>
);

const PlotRegistryNocPrint = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, organization } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qr, setQr] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: payload } = await api.get(`/registries/${id}/noc`);
        if (alive) setData(payload);
      } catch {
        if (alive) setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const registry = data?.registry;
  const plot = data?.plot;
  const company = useMemo(
    () =>
      buildCompany({
        letterhead: data?.letterhead,
        site: data?.site,
        organization: data?.organization || organization,
      }),
    [data, organization],
  );
  const companyInitials = company.brandName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'CO';

  const nocNo = registry?.noc_no || data?.suggested_noc_no || '—';
  const nocDate = registry?.noc_date || registry?.noc_generated_at || null;
  const nocPlace = registry?.noc_place || data?.site?.city || '';
  const buyer = registry?.customer_name || plot?.buyer_name || '';

  // Included payments = toggled plot payments + included manual rows, by date.
  const rows = useMemo(() => {
    if (!data) return [];
    const fromPlot = (data.plotPayments || []).filter((p) => p.included).map((p) => ({
      date: p.date,
      mode: paymentModeOf(p),
      amount: parseFloat(p.amount) || 0,
    }));
    const fromInline = (data.inlinePayments || []).filter((p) => p.include_in_noc).map((p) => ({
      date: p.payment_date,
      mode: String(p.payment_mode || '—').toUpperCase(),
      amount: parseFloat(p.amount) || 0,
    }));
    return [...fromPlot, ...fromInline].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  }, [data]);
  const total = rows.reduce((s, r) => s + r.amount, 0);

  useEffect(() => {
    if (registry) document.title = `NOC ${nocNo} — Plot ${registry.plot_no}`;
  }, [registry, nocNo]);

  // Signed verification QR uses the same tenant-safe receipt verification
  // scheme as the rest of the platform.
  useEffect(() => {
    if (!data?.verifyUrl) { setQr(null); return; }
    QRCode.toDataURL(data.verifyUrl, { width: 320, margin: 1, errorCorrectionLevel: 'M' })
      .then(setQr).catch(() => setQr(null));
  }, [data?.verifyUrl]);

  // ?autoprint=1 → open the print dialog once everything is rendered.
  useEffect(() => {
    if (!loading && registry && searchParams.get('autoprint') === '1') {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [loading, registry, searchParams]);

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (!registry) {
    return <div className="p-10 text-center text-slate-400">NOC data not found</div>;
  }

  const sizeText = [
    registry.size_sqyard ? `${fmtINR(registry.size_sqyard)} sq. yd.` : '',
    registry.size_meter ? `${fmtINR(registry.size_meter)} m²` : '',
  ].filter(Boolean).join(' / ') || (plot?.plot_size ? `${plot.plot_size} sq. yd.` : '—');

  return (
    <div className="noc-root min-h-screen bg-slate-200">
      <StyleBlock
        brand={company.legalName.replace(/"/g, '')}
        footer={`${company.legalName}${company.projectName ? ` · ${company.projectName}` : ''}`.toUpperCase().replace(/"/g, '')}
      />

      {/* Toolbar (never prints) */}
      <div className="no-print sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-white/10 bg-slate-950 px-4 py-3 text-white shadow-lg">
        <button onClick={() => navigate(`/plot-registry/${id}/noc`)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 px-3 text-sm text-slate-200 transition-colors hover:bg-white/10 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> NOC workspace
        </button>
        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-semibold">{company.legalName}</p>
          <p className="text-[10px] uppercase tracking-[0.15em] text-white/45">NOC {nocNo} · Plot {registry.plot_no}</p>
        </div>
        <button onClick={() => window.print()} className="inline-flex h-9 items-center gap-2 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-500">
          <Printer className="h-4 w-4" /> Print / Save PDF
        </button>
      </div>

      <div className="noc-pages mx-auto flex max-w-[210mm] flex-col items-center py-6">
        <div className="noc-doc">
          {/* Tenant-aware watermark; never falls back to another company's brand. */}
          {company.logoUrl ? (
            <img className="noc-watermark" src={company.logoUrl} alt="" aria-hidden="true" />
          ) : (
            <div className="noc-watermark noc-watermark-text" aria-hidden="true">{company.brandName}</div>
          )}

          <div className="noc-body">
            {/* ── Letterhead ── */}
            <header className="noc-titlewrap">
              {qr && (
                <div className="noc-verify">
                  <img src={qr} alt="Scan to verify" />
                  <span>Scan to verify</span>
                </div>
              )}
              <div className="noc-brandline">
                {company.logoUrl ? (
                  <img className="noc-logo" src={company.logoUrl} alt={company.brandName} />
                ) : (
                  <div className="noc-monogram" aria-hidden="true">{companyInitials}</div>
                )}
                <div className="noc-brandcopy">
                  <div className="noc-brand">{company.legalName}</div>
                  <div className="noc-brandsub">
                    {[company.projectName && `Project: ${company.projectName}`, company.address].filter(Boolean).join(' · ')}
                  </div>
                  <div className="noc-brandsub">
                    {[company.phone && `Ph: ${company.phone}`, company.email, company.gstin && `GSTIN: ${company.gstin}`].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>
              <p className="noc-kicker">Official property document</p>
              <h1 className="noc-title">NO OBJECTION CERTIFICATE</h1>
              <p className="noc-subtitle hi">अनापत्ति प्रमाण-पत्र <em>(For Registration of Sale Deed · विक्रय-विलेख के पंजीकरण हेतु)</em></p>
              <div className="noc-refbar">
                <span>NOC No.: <strong>{nocNo}</strong></span>
                <span>Date: <strong>{fmtDateIN(nocDate)}</strong></span>
                <span>Place: <strong>{nocPlace || '—'}</strong></span>
              </div>
            </header>

            <p className="noc-towhom">TO WHOM IT MAY CONCERN <span className="hi">· सर्वसाधारण को सूचित किया जाता है</span></p>

            {/* ── 1. Certification of allotment ── */}
            <Clause
              n="1"
              en={<>This is to certify that <strong>{company.legalName}</strong> (hereinafter the <strong>“Company”</strong>) is the developer/marketer of the project situated at <u>{company.address || company.location || '____'}</u>, and that the plot described hereunder has been booked/allotted in favour of <strong>{buyer || '____'}</strong> (hereinafter the <strong>“Purchaser”</strong>):</>}
              hi={<>प्रमाणित किया जाता है कि <strong>{company.legalName}</strong> (इसके पश्चात् <strong>“कंपनी”</strong>) उक्त परियोजना की विकासकर्ता/विपणनकर्ता है, तथा नीचे वर्णित भूखंड <strong>{buyer || '____'}</strong> (इसके पश्चात् <strong>“क्रेता”</strong>) के पक्ष में बुक/आवंटित किया गया है:</>}
            />
            <table className="kv"><tbody>
              <tr><th>Plot No. · भूखंड सं.</th><td><strong>{registry.plot_no}</strong>{plot?.block ? ` (Block ${plot.block})` : ''}</td>
                  <th>Project / Site · परियोजना</th><td>{data.site?.name || '—'}</td></tr>
              <tr><th>Area · क्षेत्रफल</th><td>{sizeText}</td>
                  <th>Circle Rate · सर्किल दर</th><td>{registry.circle_rate ? `₹${fmtINR(registry.circle_rate)}` : '—'}</td></tr>
              <tr><th>Purchaser · क्रेता</th><td><strong>{buyer || '—'}</strong></td>
                  <th>Registry Date · रजिस्ट्री तिथि</th><td>{fmtDateIN(registry.registry_date)}</td></tr>
              {(registry.seller_name || registry.farmer_name || registry.firm_name) && (
                <tr>
                  <th>Seller / Farmer · विक्रेता</th><td>{[registry.seller_name, registry.farmer_name].filter(Boolean).join(' / ') || '—'}</td>
                  <th>Firm · फर्म</th><td>{registry.firm_name || '—'}</td>
                </tr>
              )}
            </tbody></table>

            {/* ── 2. Payments received ── */}
            <Clause
              n="2"
              en={<>The Company acknowledges receipt of the following payments from the Purchaser against the said plot, duly verified in the Company's books of account:</>}
              hi={<>कंपनी उक्त भूखंड के प्रति क्रेता से निम्नलिखित भुगतानों की प्राप्ति स्वीकार करती है, जिनका कंपनी के लेखा-बहियों में विधिवत् सत्यापन किया गया है:</>}
            />
            <table className="dt">
              <thead><tr><th className="w1">S. No.</th><th>Date · तिथि</th><th>Mode · माध्यम</th><th className="r">Amount (₹) · राशि</th></tr></thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', fontStyle: 'italic' }}>No payments selected for this certificate</td></tr>
                )}
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{fmtDateIN(r.date)}</td>
                    <td>{r.mode}</td>
                    <td className="r">{fmtINR(r.amount)}</td>
                  </tr>
                ))}
                <tr className="tot">
                  <td colSpan={3}>Total Amount Received · कुल प्राप्त राशि</td>
                  <td className="r">₹{fmtINR(total)}</td>
                </tr>
              </tbody>
            </table>
            <p className="words">In words: <strong>{amountInWordsINR(total)}</strong> <span className="hi">(शब्दों में)</span></p>

            {/* ── 3. Declaration of no objection ── */}
            <div className="callout">
              <strong>DECLARATION OF NO OBJECTION.</strong> In view of the above, the Company hereby declares that it has <strong>NO OBJECTION</strong> to the execution and registration of the Sale Deed / Registry of the said Plot No. <strong>{registry.plot_no}</strong> in favour of <strong>{buyer || '____'}</strong> before the office of the Sub-Registrar{nocPlace ? <>, <u>{nocPlace}</u></> : ''}, and to the mutation of the said plot in the Purchaser's name in the revenue records.
              <span className="hi block-hi">उपर्युक्त के दृष्टिगत, कंपनी एतद्द्वारा घोषित करती है कि उसे उक्त भूखंड सं. <strong>{registry.plot_no}</strong> के विक्रय-विलेख / रजिस्ट्री के <strong>{buyer || '____'}</strong> के पक्ष में, उप-निबंधक कार्यालय{nocPlace ? ` ${nocPlace}` : ''} के समक्ष निष्पादन एवं पंजीकरण पर, तथा राजस्व अभिलेखों में क्रेता के नाम दाखिल-खारिज पर <strong>कोई आपत्ति नहीं</strong> है।</span>
            </div>

            {/* ── 4. Remarks (optional) ── */}
            {registry.noc_notes && (
              <Clause
                n="3"
                en={<><strong>Remarks <span className="hi">· टिप्पणी</span>.</strong> {registry.noc_notes}</>}
              />
            )}

            {/* ── 5. Standard proviso ── */}
            <Clause
              n={registry.noc_notes ? '4' : '3'}
              en={<>This certificate is issued at the request of the Purchaser solely for the purpose of registration of the said plot. It does not, by itself, transfer any right, title or interest, and does not absolve the Purchaser of any outstanding dues, taxes, stamp duty, registration fee or other statutory charges, which shall be borne by the Purchaser.</>}
              hi={<>यह प्रमाण-पत्र क्रेता के अनुरोध पर केवल उक्त भूखंड के पंजीकरण के प्रयोजनार्थ जारी किया गया है। यह स्वयं में कोई अधिकार, स्वत्व अथवा हित हस्तांतरित नहीं करता, तथा क्रेता को किसी बकाया राशि, कर, स्टाम्प शुल्क, पंजीकरण शुल्क अथवा अन्य सांविधिक प्रभारों से मुक्त नहीं करता — जो क्रेता द्वारा वहन किए जाएँगे।</>}
            />

            {/* ── Signatures ── */}
            <div className="exec-grid">
              <div className="exec-cell">
                <div className="exec-head">FOR {company.legalName.toUpperCase()}</div>
                <div className="sig-space" /><div className="sig-rule" />
                <strong>Authorised Signatory (with seal)</strong>
                <span>Name: {user?.full_name || user?.name || '____________________'}</span>
                <span>Date: {fmtDateIN(nocDate)} · Place: {nocPlace || '________'}</span>
              </div>
              <div className="exec-cell">
                <div className="exec-head">PURCHASER'S ACKNOWLEDGEMENT</div>
                <div className="sig-space" /><div className="sig-rule" />
                <strong>Signature of Purchaser</strong>
                <span>Name: {buyer || '____________________'}</span>
                <span>Mobile: ____________________</span>
              </div>
            </div>

            <div className="wit-row">
              <span>Witness 1: Name ______________________ Signature ____________</span>
              <span>Witness 2: Name ______________________ Signature ____________</span>
            </div>

            <p className="noc-end">
              This is a system-generated certificate of {company.legalName}{nocPlace ? `, ${nocPlace}` : ''} · Certificate ref. {nocNo}.
              <span className="hi"> यह {company.legalName} द्वारा जारी अनापत्ति प्रमाण-पत्र है।</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

function StyleBlock({ footer = 'CONFIDENTIAL', brand = '' }) {
  return (
    <style>{`
      /* This page lives outside the app Layout — restore scrolling. */
      html, body { overflow: auto !important; height: auto !important; }

      .noc-root { --ink:#172033; --muted:#5f6b7c; --line:#d9e0e8; --g:#2563eb; --g-deep:#172554; --g-tint:#f2f6ff; }
      .noc-doc { position:relative; box-sizing:border-box; width:210mm; min-height:297mm; overflow:hidden; background:#fff; color:var(--ink);
        padding:13mm 15mm; line-height:1.55; box-shadow:0 18px 55px rgba(15,23,42,.18); border:1px solid rgba(148,163,184,.35); }
      /* Beat the global "Neue Montreal on *" rule — official serif document face. */
      .noc-doc, .noc-doc * { font-family:'Georgia','Cambria','Times New Roman',serif !important; font-weight:normal; }
      .noc-doc strong, .noc-doc th, .noc-doc h1 { font-weight:700; }
      .noc-doc .hi, .noc-doc .hi * { font-family:'Noto Sans Devanagari','Nirmala UI','Mangal',sans-serif !important; }

      .noc-watermark { position:absolute; top:54%; left:50%; transform:translate(-50%,-50%);
        width:118mm; max-width:70%; height:auto; opacity:.035; z-index:0; pointer-events:none; user-select:none; object-fit:contain; filter:grayscale(1); }
      .noc-watermark-text { width:auto; max-width:150mm; font-size:34px; font-weight:700; letter-spacing:5px; color:var(--g-deep);
        transform:translate(-50%,-50%) rotate(-25deg); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-transform:uppercase; filter:none; }
      .noc-body { position:relative; z-index:1; }

      .noc-titlewrap { position:relative; text-align:center; border-bottom:1px solid var(--line); padding-bottom:4mm; margin-bottom:4mm; }
      .noc-verify { position:absolute; top:0; right:0; display:flex; flex-direction:column; align-items:center; gap:.5mm; }
      .noc-verify img { width:19mm; height:19mm; display:block; image-rendering:pixelated; border:1px solid var(--line); border-radius:2mm; background:#fff; padding:.8mm; }
      .noc-verify span { font-family:Arial,sans-serif !important; font-size:6.5px; text-transform:uppercase; letter-spacing:.55px; color:var(--muted); font-weight:700; }
      .noc-brandline { display:flex; align-items:center; gap:3.5mm; min-height:20mm; margin-bottom:4mm; padding-right:27mm; text-align:left; }
      .noc-logo { height:16mm; width:auto; max-width:42mm; flex:none; object-fit:contain; }
      .noc-monogram { display:flex; width:15mm; height:15mm; flex:none; align-items:center; justify-content:center; border-radius:3mm;
        background:var(--g-deep); color:#fff; font-family:Arial,sans-serif !important; font-size:15px; font-weight:800; letter-spacing:.6px; }
      .noc-brandcopy { min-width:0; }
      .noc-brand { font-size:18px; font-weight:700; color:var(--ink); letter-spacing:.25px; text-transform:uppercase; }
      .noc-brandsub { margin-top:.6mm; font-family:Arial,sans-serif !important; font-size:8.3px; line-height:1.35; letter-spacing:.25px; color:var(--muted); text-transform:uppercase; }
      .noc-kicker { margin:0; font-family:Arial,sans-serif !important; font-size:7.5px; font-weight:700; letter-spacing:1.5px; color:var(--g); text-transform:uppercase; }
      .noc-title { margin:1mm 0 0; font-size:20px; font-weight:700; letter-spacing:2.2px; color:var(--g-deep); }
      .noc-subtitle { margin:1mm 0 0; font-size:11px; color:var(--muted); }
      .noc-subtitle em { font-size:10px; }
      .noc-refbar { display:grid; grid-template-columns:repeat(3,1fr); gap:1.5mm; margin-top:3.5mm; font-family:Arial,sans-serif !important; font-size:9px; }
      .noc-refbar span { border:1px solid var(--line); border-radius:1.5mm; background:#f8fafc; padding:1.7mm 2mm; color:var(--muted); }
      .noc-refbar strong { display:block; margin-top:.4mm; font-family:Arial,sans-serif !important; font-size:10px; color:var(--ink); }

      .noc-towhom { text-align:center; font-size:12.5px; font-weight:700; letter-spacing:1px; margin:4mm 0 3mm; color:var(--ink); }

      .clause { margin-bottom:3mm; break-inside:avoid; page-break-inside:avoid; }
      .cl-en { margin:0; font-size:11.5px; line-height:1.6; text-align:justify; }
      .cl-n { color:var(--g); margin-right:1mm; }
      .cl-hi { margin:1mm 0 0; font-size:11px; line-height:1.65; color:var(--muted); text-align:justify; }
      .cl-en u { text-decoration:none; border-bottom:1px solid var(--muted); padding:0 1mm; }

      .kv { width:100%; border-collapse:collapse; table-layout:fixed; font-size:10.5px; margin:2mm 0 3mm; }
      .kv th, .kv td { border:1px solid var(--line); padding:2.2mm 2.6mm; vertical-align:middle; overflow-wrap:anywhere; }
      .kv th { width:21%; background:#f6f8fb; color:var(--g-deep); font-weight:700; text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:.2px; }
      .kv td { width:29%; color:var(--ink); font-size:10.5px; }
      .kv tr { break-inside:avoid; }

      .dt { width:100%; border-collapse:collapse; font-size:10.5px; margin:2mm 0 1.5mm; }
      .dt th { background:var(--g-deep); color:#fff; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.2px; text-align:left; padding:2.2mm 2.6mm; }
      .dt td { border:1px solid var(--line); padding:2.2mm 2.6mm; vertical-align:top; }
      .dt tr { break-inside:avoid; page-break-inside:avoid; }
      .dt .r { text-align:right; white-space:nowrap; }
      .dt .w1 { width:12mm; text-align:center; }
      .dt .tot td { background:var(--g-tint); font-weight:700; color:var(--g-deep); border-top:1.5px solid #a9bce6; }

      .words { font-size:10.5px; margin:0 0 3mm; color:var(--ink); }

      .callout { border:1px solid #b9c9ef; border-left:2mm solid var(--g); border-radius:2mm; background:var(--g-tint);
        padding:3mm 3.5mm; font-size:11.5px; line-height:1.6; margin:2mm 0 3mm; break-inside:avoid; text-align:justify; }
      .block-hi { display:block; margin-top:1.5mm; color:var(--muted); font-size:11px; }

      .exec-grid { display:grid; grid-template-columns:1fr 1fr; gap:6mm; margin:8mm 0 3mm; }
      .exec-cell { display:flex; flex-direction:column; font-size:10.5px; line-height:1.55; border:1px solid var(--line); border-radius:2.5mm; padding:3mm 3.5mm; break-inside:avoid; background:rgba(248,250,252,.72); }
      .exec-head { font-size:10.5px; font-weight:700; text-transform:uppercase; color:var(--g-deep); text-align:center; margin-bottom:1mm; }
      .sig-space { height:16mm; }
      .sig-rule { border-top:1px solid var(--ink); margin-bottom:1.4mm; }
      .exec-cell strong { color:var(--g-deep); }

      .wit-row { display:flex; justify-content:space-between; gap:6mm; font-size:10px; color:var(--muted); margin:3mm 0; flex-wrap:wrap; break-inside:avoid; }

      .noc-end { margin-top:5mm; padding-top:2.5mm; border-top:1.5px solid var(--g-deep); font-size:9.5px; line-height:1.55; color:var(--muted); text-align:center; }

      .noc-pages { background:linear-gradient(180deg,#eef2f7 0%,#e4e9f0 100%); padding:28px 20px 48px; }

      @media print {
        @page { size: A4; margin: 18mm 13mm 16mm 13mm;
          @top-left { content: "${brand}"; font-family:'Georgia',serif; font-size:8.5pt; font-weight:700; color:#172554; }
          @top-right { content: "No Objection Certificate"; font-family:'Georgia',serif; font-size:8pt; font-style:italic; color:#5f6b7c; }
          @bottom-left { content: "${footer}"; font-family:'Georgia',serif; font-size:7.5pt; color:#5f6b7c; }
          @bottom-right { content: "Page " counter(page) " of " counter(pages); font-family:'Georgia',serif; font-size:7.5pt; color:#172554; }
        }
        html, body, #root { background:#fff !important; height:auto !important; min-height:0 !important; }
        .noc-root { background:#fff !important; }
        .no-print { display:none !important; }
        .noc-pages { max-width:none !important; margin:0 !important; padding:0 !important; background:#fff !important; }
        .noc-doc { width:auto !important; min-height:0 !important; margin:0 !important; padding:0 !important; box-shadow:none !important; }
        .noc-watermark { position:fixed; top:50%; left:50%; }
        .clause, .dt tr, .kv tr, .callout, .exec-cell, .wit-row { break-inside:avoid; page-break-inside:avoid; }
        * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
      }
    `}</style>
  );
}

export default PlotRegistryNocPrint;
