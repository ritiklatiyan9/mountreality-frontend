import { useState } from 'react';
import { Upload, X, Image, Loader2, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import CameraCapture from '@/components/CameraCapture';
import { useDocViewer } from '@/components/DocViewer';
import api from '@/api/api';

/**
 * Reusable voucher/receipt upload component.
 * Uploads the file to S3 via /upload/single and returns the URL.
 * Proof can be a file OR a live camera photo (taken at the moment money
 * changes hands) — both go through the same upload.
 *
 * Props:
 * - value: string|null (current voucher URL)
 * - onChange: (url: string|null) => void
 * - disabled: boolean
 */
export default function VoucherUpload({ value, onChange, disabled = false }) {
  const openDoc = useDocViewer();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [photo, setPhoto] = useState(null);

  const uploadFile = async (file) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/upload/single?provider=s3', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange(res.data.url || res.data.fileUrl);
    } catch {
      onChange(null);
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e) => {
    uploadFile(e.target.files?.[0]);
    e.target.value = '';
  };

  const usePhoto = async () => {
    const f = photo;
    setCameraOpen(false);
    setPhoto(null);
    await uploadFile(f);
  };

  const handleRemove = () => {
    onChange(null);
    setPreview(null);
  };

  const displayUrl = value || preview;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Voucher / Receipt</label>
      {displayUrl ? (
        <div className="relative inline-block">
          <button type="button" onClick={() => openDoc({ url: displayUrl, title: 'Voucher / Receipt' })}>
            <img
              src={displayUrl}
              alt="Voucher"
              className="h-24 w-24 rounded-lg border object-cover hover:opacity-80 transition"
            />
          </button>
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/60">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            </div>
          )}
          {!disabled && !uploading && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <label
            className={`flex flex-1 items-center gap-2 border-2 border-dashed rounded-lg p-3 transition
              ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-pointer hover:border-blue-400 hover:bg-blue-50'}`}
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            ) : (
              <Upload className="h-5 w-5 text-gray-400" />
            )}
            <span className="text-sm text-gray-500">
              {uploading ? 'Uploading...' : 'Upload voucher photo'}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={handleFileChange}
              disabled={disabled || uploading}
            />
          </label>
          <Button
            type="button"
            variant="outline"
            className="h-auto shrink-0 gap-1.5 border-dashed border-2 text-gray-500 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"
            disabled={disabled || uploading}
            onClick={() => { setPhoto(null); setCameraOpen(true); }}
            title="Take a live photo as proof"
          >
            <Camera className="h-4 w-4" /> Camera
          </Button>
        </div>
      )}

      {/* Live camera proof */}
      <Dialog open={cameraOpen} onOpenChange={(v) => { if (!v) { setCameraOpen(false); setPhoto(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-blue-600" /> Photo Proof
            </DialogTitle>
            <DialogDescription>
              Take a live photo as proof of this transaction — it is saved as the voucher.
            </DialogDescription>
          </DialogHeader>
          <CameraCapture photo={photo} onCapture={setPhoto} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setCameraOpen(false); setPhoto(null); }}>Cancel</Button>
            <Button type="button" onClick={usePhoto} disabled={!photo} className="gap-1.5">
              <Camera className="h-4 w-4" /> Use This Photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Small inline voucher thumbnail for table rows.
 * Props:
 * - url: string|null
 */
export function VoucherThumbnail({ url }) {
  const openDoc = useDocViewer();
  if (!url) return <span className="text-gray-400 text-xs">No voucher</span>;
  return (
    <button
      type="button"
      onClick={() => openDoc({ url, title: 'Voucher / Receipt' })}
      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
    >
      <Image className="h-4 w-4" />
      <span className="text-xs underline">View</span>
    </button>
  );
}
