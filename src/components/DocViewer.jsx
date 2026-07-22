import { createContext, useCallback, useContext, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Download, ExternalLink } from 'lucide-react';

/**
 * App-wide document/photo viewer modal. Any module that used to open an
 * uploaded file (voucher photo, KYC doc, PDF deed, chat attachment, …) in a
 * new tab calls `openDoc` from `useDocViewer()` instead:
 *
 *   const openDoc = useDocViewer();
 *   openDoc({ url, title: 'Voucher', subtitle: 'Expense #12', mime: 'image/jpeg' });
 *
 * `mime` is optional — falls back to sniffing the URL extension. Images get a
 * click-to-zoom view; PDFs (and anything else the browser can render) go
 * through an iframe; the footer always offers open-in-tab / download escapes.
 * Mounted ONCE in App.jsx via <DocViewerProvider>.
 */
const DocViewerContext = createContext(() => {});

export const useDocViewer = () => useContext(DocViewerContext);

const IMG_RE = /\.(jpe?g|png|webp|gif|bmp|avif|heic)(\?|#|$)/i;
const PDF_RE = /\.pdf(\?|#|$)/i;

const kindOf = (doc) => {
  const mime = (doc.mime || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (mime) return 'other';
  if (IMG_RE.test(doc.url || '')) return 'image';
  if (PDF_RE.test(doc.url || '')) return 'pdf';
  return 'other'; // iframe still renders images/PDFs served without extension
};

export function DocViewerProvider({ children }) {
  const [doc, setDoc] = useState(null);
  const [zoom, setZoom] = useState(false);

  const openDoc = useCallback((d) => {
    if (!d?.url) return;
    setZoom(false);
    setDoc(d);
  }, []);

  const k = doc ? kindOf(doc) : null;

  return (
    <DocViewerContext.Provider value={openDoc}>
      {children}
      <Dialog open={!!doc} onOpenChange={(o) => { if (!o) setDoc(null); }}>
        <DialogContent className="w-[96vw] sm:max-w-5xl p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b border-slate-100 space-y-0.5">
            <DialogTitle className="text-sm font-semibold truncate pr-8">
              {doc?.title || 'Document'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 truncate">
              {doc?.subtitle || (k === 'image' ? 'Click the image to zoom' : 'Preview')}
            </DialogDescription>
          </DialogHeader>

          <div className="h-[74vh] overflow-auto bg-slate-100/80">
            {k === 'image' ? (
              <div className={zoom ? 'min-h-full p-2' : 'flex h-full items-center justify-center p-2'}>
                <img
                  src={doc.url}
                  alt={doc.title || 'Document'}
                  onClick={() => setZoom((z) => !z)}
                  className={zoom
                    ? 'max-w-none cursor-zoom-out rounded'
                    : 'max-h-full max-w-full object-contain cursor-zoom-in rounded shadow-sm'}
                />
              </div>
            ) : doc ? (
              <iframe src={doc.url} title={doc.title || 'Document'} className="h-full w-full border-0 bg-white" />
            ) : null}
          </div>

          <DialogFooter className="px-4 py-2.5 border-t border-slate-100 flex-row sm:justify-end gap-2">
            <a href={doc?.url} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs">
                <ExternalLink className="w-3.5 h-3.5" /> Open in tab
              </Button>
            </a>
            <a href={doc?.url} download>
              <Button type="button" size="sm" className="gap-1.5 text-xs">
                <Download className="w-3.5 h-3.5" /> Download
              </Button>
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DocViewerContext.Provider>
  );
}
