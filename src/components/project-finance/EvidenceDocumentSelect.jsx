import { ArrowUpRight, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const readable = (value) => String(value || '')
  .replaceAll('_', ' ')
  .toLowerCase()
  .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());

const documentDate = (document) => {
  const value = document.doc_date || document.created_at;
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(parsed);
};

const documentLabel = (document) => [
  document.title || document.original_name || 'Untitled document',
  readable(document.category),
  documentDate(document),
].filter(Boolean).join(' · ');

export default function EvidenceDocumentSelect({
  label,
  value,
  onChange,
  documents = [],
  required = false,
  hint,
  placeholder = 'Choose an evidence document',
}) {
  const usableDocuments = documents.filter((document) => document?.id);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-700">
        {label}{required && <span className="ml-1 text-red-500">*</span>}
      </Label>
      <Select value={value ? String(value) : 'none'} onValueChange={(next) => onChange(next === 'none' ? '' : next)}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{placeholder}</SelectItem>
          {usableDocuments.map((document) => (
            <SelectItem key={document.id} value={String(document.id)}>
              {documentLabel(document)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint && <p className="text-[10px] leading-relaxed text-slate-400">{hint}</p>}
      {!usableDocuments.length && (
        <div className="flex items-start gap-2 border-l-2 border-amber-300 bg-amber-50/60 px-3 py-2 text-[10px] leading-relaxed text-amber-800">
          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            No DMS evidence is available.{' '}
            <Link to="/documents" className="inline-flex items-center font-semibold underline underline-offset-2">
              Upload or select in Document Search<ArrowUpRight className="ml-1 h-3 w-3" />
            </Link>
          </span>
        </div>
      )}
    </div>
  );
}
