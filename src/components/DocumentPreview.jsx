import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Workbook } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import LuckyExcel from 'luckyexcel';
import { toast } from 'sonner';
import {
  Download, Loader2, Maximize2, FileSpreadsheet, FileText, ExternalLink,
} from 'lucide-react';
import api from '../api/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

/**
 * Unified document previewer for the Documents module. The dialog opens
 * IMMEDIATELY on click — the signed S3 URL and content load inside it —
 * so every document type feels instant:
 *   excel     → read-only FortuneSheet grid (await LuckyExcel parse before
 *               mounting Workbook; mounting against empty data is the
 *               blank-preview bug FortuneSheet won't recover from)
 *   pdf       → native <iframe> render
 *   doc/docx  → browsers can't render Word docs; graceful download card
 *
 *   <DocumentPreview file={file} open={open} onOpenChange={setOpen} />
 */
export default function DocumentPreview({ file, open, onOpenChange }) {
  const navigate = useNavigate();
  const [sheets, setSheets] = useState(null);
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  const kind = !file?.file_type || file?.file_type === 'excel' ? 'excel' : file.file_type;

  useEffect(() => {
    if (!open || !file) return;
    let cancelled = false;
    setSheets(null);
    setUrl(null);
    setLoading(true);

    (async () => {
      try {
        const { data } = await api.get(`/excel/${file.id}`);
        const { file: meta, downloadUrl } = data;
        if (cancelled) return;
        setUrl(downloadUrl || null);

        if (kind === 'excel') {
          if (downloadUrl) {
            const res = await fetch(downloadUrl);
            const blob = await res.blob();
            const fileObj = new File([blob], `${meta.name}.xlsx`);
            await new Promise((resolve) => {
              LuckyExcel.transformExcelToLucky(fileObj, (exportJson) => {
                if (!cancelled) setSheets(exportJson?.sheets?.length ? exportJson.sheets : []);
                resolve();
              });
            });
          } else if (meta.sheet_data?.length) {
            setSheets(meta.sheet_data);
          } else {
            setSheets([]);
          }
        }
      } catch (e) {
        console.error('Preview load error:', e);
        if (!cancelled) {
          setSheets([]);
          toast.error('Could not load document');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, file]); // eslint-disable-line

  const handleDownload = () => {
    if (url) window.location.href = url;
    else toast.error('No downloadable file');
  };

  const Icon = kind === 'excel' ? FileSpreadsheet : FileText;
  const tint = kind === 'excel' ? 'text-emerald-600' : kind === 'pdf' ? 'text-rose-600' : 'text-blue-600';
  const badge = kind === 'excel' ? 'XLS' : kind.toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[96vw] max-w-[1400px] h-[90vh] p-0 gap-0 overflow-hidden flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-4 py-3 border-b border-slate-100 flex-row items-center justify-between space-y-0 shrink-0">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2 min-w-0">
            <Icon className={`w-4 h-4 shrink-0 ${tint}`} />
            <span className="truncate">{file?.name || 'Document'}</span>
            <Badge variant="secondary" className="text-[10px] shrink-0">{badge}</Badge>
          </DialogTitle>
          <div className="flex items-center gap-2 pr-8">
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open in tab
                </Button>
              </a>
            )}
            <Button variant="outline" size="sm" onClick={handleDownload} className="h-8 text-xs">
              <Download className="w-3.5 h-3.5 mr-1.5" /> Download
            </Button>
            {kind === 'excel' && (
              <Button
                size="sm"
                onClick={() => { onOpenChange(false); navigate(`/excel/edit/${file.id}`); }}
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Maximize2 className="w-3.5 h-3.5 mr-1.5" /> Edit
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 relative bg-slate-50 overflow-hidden">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin" />
              <span className="text-sm">Loading preview…</span>
            </div>
          ) : kind === 'excel' ? (
            sheets === null || sheets.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
                <FileSpreadsheet className="w-10 h-10" />
                <span className="text-sm">This spreadsheet is empty or could not be read</span>
              </div>
            ) : (
              <div className="absolute inset-0 bg-white">
                <Workbook
                  key={`preview-${file?.id}`}
                  data={sheets}
                  allowEdit={false}
                  showToolbar={false}
                  showFormulaBar={false}
                  showSheetTabs
                />
              </div>
            )
          ) : kind === 'pdf' && url ? (
            <iframe src={url} title={file?.name || 'PDF'} className="absolute inset-0 w-full h-full border-0 bg-white" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-10 py-8 flex flex-col items-center gap-3 max-w-sm text-center">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
                  <FileText className="w-7 h-7 text-blue-500" />
                </div>
                <p className="text-sm font-semibold text-slate-700">{file?.name}</p>
                <p className="text-xs text-slate-400">
                  {url ? 'Word documents can’t be previewed in the browser. Download to view.' : 'No previewable file found.'}
                </p>
                {url && (
                  <Button size="sm" onClick={handleDownload} className="mt-1 bg-slate-900 hover:bg-slate-800 text-white">
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Download
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
