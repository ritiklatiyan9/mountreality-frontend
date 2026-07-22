import { useEffect, useRef, useState } from 'react';
import api from '../api/api';
import { Button } from './ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogFooter,
} from './ui/dialog';
import { Eraser, Loader2, PenLine, Check } from 'lucide-react';

// Signature capture via Pointer Events — works identically with a USB
// signature/pen tablet, mouse, or touchscreen. Pen pressure (when the
// device reports it) modulates stroke width for a natural ink look.
// With askAuthority, captures two signatures: customer + authorized signatory.
const CANVAS_W = 720;
const CANVAS_H = 220;
const INK = '#1e293b';

export default function SignaturePad({ open, onOpenChange, onSave, signeeLabel, askAuthority = false }) {
  const canvasRefs = useRef({});
  const lastPt = useRef(null);
  const [inked, setInked] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const pads = askAuthority
    ? [{ key: 'customer', label: 'Customer Signature' }, { key: 'authority', label: 'Authorized Signatory' }]
    : [{ key: 'customer', label: 'Customer Signature' }];

  useEffect(() => {
    if (open) {
      setInked({});
      setError('');
      for (const c of Object.values(canvasRefs.current)) {
        if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height);
      }
    }
  }, [open]);

  // Map pointer coords to canvas bitmap space (canvas is CSS-scaled).
  const toCanvas = (e, c) => {
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * c.width) / r.width,
      y: ((e.clientY - r.top) * c.height) / r.height,
    };
  };

  const strokeWidth = (pressure) => 2 + 5 * (pressure || 0.5);

  const handleDown = (key) => (e) => {
    e.preventDefault();
    const c = e.currentTarget;
    c.setPointerCapture(e.pointerId);
    const ctx = c.getContext('2d');
    const p = toCanvas(e, c);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(p.x, p.y, strokeWidth(e.pressure) / 2, 0, Math.PI * 2);
    ctx.fill();
    lastPt.current = p;
    setInked((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  };

  const handleMove = (e) => {
    if (!lastPt.current) return;
    const c = e.currentTarget;
    const ctx = c.getContext('2d');
    ctx.strokeStyle = INK;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Coalesced events: pen tablets emit strokes faster than frames render.
    const events = e.nativeEvent.getCoalescedEvents?.() || [e];
    for (const ev of events) {
      const p = toCanvas(ev, c);
      ctx.lineWidth = strokeWidth(ev.pressure);
      ctx.beginPath();
      ctx.moveTo(lastPt.current.x, lastPt.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastPt.current = p;
    }
  };

  const handleUp = () => { lastPt.current = null; };

  const handleClear = (key) => {
    const c = canvasRefs.current[key];
    if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height);
    setInked((prev) => ({ ...prev, [key]: false }));
    setError('');
  };

  const uploadPad = async (key) => {
    const blob = await new Promise((resolve) => canvasRefs.current[key].toBlob(resolve, 'image/png'));
    const formData = new FormData();
    formData.append('file', new File([blob], `${key}-signature.png`, { type: 'image/png' }));
    const res = await api.post('/upload/single?provider=s3', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.fileUrl || res.data.url;
  };

  const allInked = pads.every((p) => inked[p.key]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const customer = await uploadPad('customer');
      const authority = askAuthority ? await uploadPad('authority') : null;
      await onSave({ customer, authority });
    } catch (err) {
      console.error('Signature save failed:', err);
      setError('Failed to save signature. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden max-h-[92vh] overflow-y-auto">
        <DialogHeader className="px-5 pt-5 pb-3 border-b bg-violet-50/50">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <PenLine className="w-4 h-4 text-violet-600" />
            {askAuthority ? 'Customer & Authority Signatures' : 'Customer Signature'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {signeeLabel ? <span className="font-medium text-slate-700">{signeeLabel}</span> : null}
            {signeeLabel ? ' — ' : ''}
            Sign in the {askAuthority ? 'boxes' : 'box'} below using the signature pad, pen, or finger.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4">
          {pads.map(({ key, label }) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
                <button type="button" onClick={() => handleClear(key)} disabled={!inked[key] || saving}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-red-600 disabled:opacity-40">
                  <Eraser className="w-3 h-3" /> Clear
                </button>
              </div>
              <div className="relative">
                <canvas
                  ref={(el) => { canvasRefs.current[key] = el; }}
                  width={CANVAS_W}
                  height={CANVAS_H}
                  onPointerDown={handleDown(key)}
                  onPointerMove={handleMove}
                  onPointerUp={handleUp}
                  onPointerCancel={handleUp}
                  className="w-full h-auto rounded-lg border-2 border-dashed border-slate-300 bg-white touch-none cursor-crosshair select-none"
                />
                {/* Signing baseline guide */}
                <div className="absolute left-6 right-6 bottom-8 border-b border-slate-200 pointer-events-none" />
                <span className="absolute left-6 bottom-9 text-slate-300 text-lg pointer-events-none select-none">✕</span>
                {!inked[key] && (
                  <span className="absolute inset-0 flex items-center justify-center text-sm text-slate-300 pointer-events-none select-none">
                    Sign here
                  </span>
                )}
              </div>
            </div>
          ))}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <DialogFooter className="px-5 py-3 border-t bg-slate-50 gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!allInked || saving}
            className="bg-violet-600 hover:bg-violet-700 text-white">
            {saving
              ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving…</>
              : <><Check className="w-3.5 h-3.5 mr-1.5" /> Save & Print</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
