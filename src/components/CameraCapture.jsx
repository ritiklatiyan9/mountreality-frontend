import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Camera, RefreshCw, Loader2, CheckCircle2, ImageOff } from 'lucide-react';

/**
 * Camera proof capture — shared by Document Imprest and the voucher flows.
 * Desktop/laptop: getUserMedia live preview → canvas snapshot.
 * If the camera is unavailable (no device, denied, non-HTTPS), falls back to a
 * native `capture` file input — on phones that opens the camera app directly.
 *
 * Props:
 * - photo: File|null (captured photo)
 * - onCapture: (file: File|null) => void  (null = retake)
 */
export default function CameraCapture({ photo, onCapture }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const [cameraError, setCameraError] = useState(null);
  const [starting, setStarting] = useState(true);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startStream = useCallback(async () => {
    setStarting(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setCameraError(err?.name === 'NotAllowedError'
        ? 'Camera permission denied — allow camera access or use the button below.'
        : 'No camera available — use the button below to take/select a photo.');
    } finally {
      setStarting(false);
    }
  }, []);

  useEffect(() => {
    if (!photo) startStream();
    return stopStream;
  }, [photo, startStream, stopStream]);

  const snap = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      stopStream();
      onCapture(new File([blob], `proof-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.85);
  };

  if (photo) {
    return (
      <div className="space-y-2">
        <div className="relative overflow-hidden rounded-xl border bg-slate-950">
          <img src={URL.createObjectURL(photo)} alt="Captured proof" className="w-full max-h-64 object-contain" />
          <Badge className="absolute top-2 left-2 bg-emerald-600 text-white border-0 gap-1">
            <CheckCircle2 className="h-3 w-3" /> Proof captured
          </Badge>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => onCapture(null)} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Retake
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-xl border bg-slate-950 aspect-video">
        {cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <ImageOff className="h-8 w-8 text-slate-500" />
            <p className="text-xs text-slate-400">{cameraError}</p>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            {starting && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            )}
            <span className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
            </span>
          </>
        )}
      </div>
      <div className="flex gap-2">
        {!cameraError && (
          <Button type="button" onClick={snap} className="gap-1.5">
            <Camera className="h-4 w-4" /> Capture Photo
          </Button>
        )}
        <Button type="button" variant={cameraError ? 'default' : 'outline'} onClick={() => fileRef.current?.click()} className="gap-1.5">
          <Camera className="h-4 w-4" /> {cameraError ? 'Take Photo' : 'Use device camera'}
        </Button>
        <input
          ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onCapture(f); e.target.value = ''; }}
        />
      </div>
    </div>
  );
}
