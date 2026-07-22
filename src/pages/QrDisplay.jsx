import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import QRCode from 'qrcode';
import { buildUpiUri, fmtINR } from '../lib/upi';
import UpiBrandStrip, { QrUpiBadge } from '../components/UpiBrandStrip';
import { QrCode, CheckCircle2, Wifi } from 'lucide-react';

const POLL_MS = 4000;

/**
 * Fullscreen "connected screen" page — open this on the display/TV outside
 * the office (or drag the tab to that monitor and press F11). It polls for
 * the latest pending QR and updates itself: generate a QR at the desk and
 * it appears here within seconds; mark it received and a success screen
 * flashes before returning to idle.
 */
const QrDisplay = () => {
  const { currentSite } = useAuth();
  const siteId = currentSite?.id;

  const [qr, setQr] = useState(null);
  const [qrImage, setQrImage] = useState(null);
  const [justReceived, setJustReceived] = useState(null); // brief success flash
  const prevQrRef = useRef(null);
  const flashTimer = useRef(null);

  useEffect(() => {
    if (!siteId) return;
    let alive = true;

    const poll = async () => {
      try {
        const res = await api.get('/upi/qrs/display', { params: { site_id: siteId } });
        if (!alive) return;
        const next = res.data.qr;
        const prev = prevQrRef.current;

        // QR vanished (marked received at the desk) → flash success
        if (prev && !next) {
          setJustReceived(prev);
          clearTimeout(flashTimer.current);
          flashTimer.current = setTimeout(() => setJustReceived(null), 6000);
        }
        if (next) setJustReceived(null);

        prevQrRef.current = next;
        setQr(next);
      } catch { /* keep last state; retry next tick */ }
    };

    poll();
    const t = setInterval(poll, POLL_MS);
    return () => { alive = false; clearInterval(t); clearTimeout(flashTimer.current); };
  }, [siteId]);

  // Re-render the QR image only when the payload actually changes
  useEffect(() => {
    if (!qr) { setQrImage(null); return; }
    let alive = true;
    // 'H' error correction — the UPI badge overlaid on the centre stays scannable
    QRCode.toDataURL(buildUpiUri(qr), { width: 880, margin: 2, errorCorrectionLevel: 'H' })
      .then((img) => { if (alive) setQrImage(img); })
      .catch(() => { if (alive) setQrImage(null); });
    return () => { alive = false; };
  }, [qr?.id, qr?.amount, qr?.note]); // eslint-disable-line react-hooks/exhaustive-deps

  const siteName = (currentSite?.name || 'DEFENCE GARDEN').toUpperCase();

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 text-white flex flex-col relative">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60rem] h-[60rem] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-8 py-5">
        <div>
          <p className="text-[11px] tracking-[0.3em] text-emerald-400/80 font-semibold">SCAN & PAY</p>
          <h1 className="text-lg font-bold tracking-wide">{siteName}</h1>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-soft-pulse" /> Live
        </div>
      </div>

      {/* Body */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6 pb-10">
        {justReceived ? (
          /* ── Payment received flash ── */
          <div className="text-center animate-qr-fade-up" key={`rx-${justReceived.id}`}>
            <CheckCircle2 className="w-28 h-28 text-emerald-400 mx-auto mb-6" />
            <p className="text-5xl font-bold text-emerald-400 tabular-nums mb-2">₹{fmtINR(justReceived.amount)}</p>
            <p className="text-2xl font-semibold text-white">Payment Received</p>
            <p className="text-sm text-slate-400 mt-2">Thank you!</p>
          </div>
        ) : qr && qrImage ? (
          /* ── Active QR ── */
          <div className="bg-white text-slate-900 rounded-3xl shadow-2xl px-10 pt-8 pb-6 text-center animate-qr-fade-up max-h-full" key={`qr-${qr.id}-${qr.amount}`}>
            <p className="text-[11px] tracking-[0.25em] text-slate-400 font-semibold mb-1">AMOUNT TO PAY</p>
            <p className="text-5xl font-bold text-emerald-600 tabular-nums">₹{fmtINR(qr.amount)}</p>
            {qr.note && <p className="text-sm text-slate-500 mt-1.5">{qr.note}</p>}
            <div className="relative w-[22rem] max-w-[54vh] mx-auto my-4">
              <img
                src={qrImage}
                alt="UPI payment QR"
                className="w-full h-auto rounded-xl border border-slate-200"
              />
              <QrUpiBadge />
            </div>
            <p className="text-sm font-semibold">{qr.payee_name}</p>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <UpiBrandStrip />
              <p className="font-mono mt-2 text-[9px] text-slate-300">Ref: {qr.txn_ref}</p>
            </div>
          </div>
        ) : (
          /* ── Idle ── */
          <div className="text-center animate-qr-fade-up">
            <QrCode className="w-24 h-24 text-slate-700 mx-auto mb-6 animate-soft-pulse" />
            <p className="text-2xl font-semibold text-slate-300">Ready to receive payments</p>
            <p className="text-sm text-slate-500 mt-2">A payment QR will appear here automatically</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QrDisplay;
