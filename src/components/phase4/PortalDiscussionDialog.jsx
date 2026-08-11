import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, FileText, Loader2, MessageSquare, Send } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../api/api';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';

const dateTime = (value) => value
  ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—';

export default function PortalDiscussionDialog({ thread, onOpenChange, headers, documents = [] }) {
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState('');
  const [attachment, setAttachment] = useState('none');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!thread) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ target_type: thread.type, target_id: String(thread.id) });
      const response = await api.get(`/phase4/portal/comments?${params}`, { headers });
      setComments(response.data.comments || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Discussion could not be loaded.');
    } finally { setLoading(false); }
  }, [headers, thread]);

  useEffect(() => { void load(); }, [load]);

  const submit = async (event) => {
    event.preventDefault();
    if (!body.trim() || !thread) return;
    setSaving(true);
    try {
      await api.post('/phase4/portal/comments', {
        target_type: thread.type, target_id: thread.id, body: body.trim(),
        attachment_document_grant_id: attachment === 'none' ? null : Number(attachment),
      }, { headers });
      setBody(''); setAttachment('none'); await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Comment could not be posted.');
    } finally { setSaving(false); }
  };

  const resolve = async (comment) => {
    const notes = window.prompt('Resolution notes');
    if (!notes?.trim()) return;
    try {
      await api.patch(`/phase4/portal/comments/${comment.id}/resolve`, { resolution_notes: notes.trim() }, { headers });
      toast.success('Comment resolved'); await load();
    } catch (error) { toast.error(error.response?.data?.message || 'Comment could not be resolved.'); }
  };

  const openAttachment = async (comment) => {
    try {
      const response = await api.get(comment.attachment.content_path, { headers, responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) { toast.error(error.response?.data?.message || 'Attachment could not be opened.'); }
  };

  return (
    <Dialog open={Boolean(thread)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-[26px] border-mr-line bg-mr-surface p-0">
        <DialogHeader className="border-b border-mr-line px-6 py-5 text-left">
          <DialogTitle className="flex items-center gap-2 text-[16px]"><MessageSquare className="h-4 w-4 text-mr-blue" />Discussion</DialogTitle>
          <DialogDescription className="text-[11px]">{thread?.label} · only this assigned record and its explicitly released attachments are visible.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[46vh] divide-y divide-mr-line overflow-y-auto">
          {loading && <div className="flex min-h-40 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-mr-faint" /></div>}
          {!loading && comments.map((comment) => <article key={comment.id} className="px-6 py-4"><div className="flex items-center gap-2"><p className="text-[11px] font-semibold">{comment.author_label}</p><span className="text-[9px] text-mr-faint">{dateTime(comment.created_at)}</span>{comment.resolved_at && <Badge variant="outline" className="ml-auto rounded-full text-[9px]">Resolved</Badge>}</div><p className="mt-2 whitespace-pre-wrap text-[12px] leading-5 text-mr-muted">{comment.body}</p>{comment.attachment && <Button variant="ghost" size="sm" className="mt-2 h-8 rounded-full px-2 text-[10px]" onClick={() => openAttachment(comment)}><FileText className="mr-1.5 h-3.5 w-3.5" />{comment.attachment.title}</Button>}{comment.resolved_at ? <p className="mt-2 text-[10px] text-mr-lime-ink"><CheckCircle2 className="mr-1 inline h-3 w-3" />{comment.resolution_notes}</p> : <Button variant="ghost" size="sm" className="mt-2 h-7 rounded-full px-2 text-[10px] text-mr-muted" onClick={() => resolve(comment)}>Mark resolved</Button>}</article>)}
          {!loading && !comments.length && <div className="px-6 py-12 text-center"><MessageSquare className="mx-auto h-5 w-5 text-mr-faint" /><p className="mt-2 text-[12px] font-semibold">No comments yet</p><p className="mt-1 text-[10px] text-mr-muted">Start a scoped conversation about this record.</p></div>}
        </div>
        <form onSubmit={submit} className="space-y-3 border-t border-mr-line bg-mr-surface-2/50 px-6 py-5">
          <Textarea maxLength={10000} value={body} onChange={(event) => setBody(event.target.value)} className="min-h-24 rounded-control bg-mr-surface" placeholder="Add a factual question or review note…" />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><Select value={attachment} onValueChange={setAttachment}><SelectTrigger className="h-9 rounded-full bg-mr-surface text-[11px] sm:w-64"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No attachment</SelectItem>{documents.map((document) => <SelectItem key={document.grant_id} value={String(document.grant_id)}>{document.title}</SelectItem>)}</SelectContent></Select><Button disabled={saving || !body.trim()} className="h-9 rounded-full bg-mr-ink"><Send className="mr-2 h-3.5 w-3.5" />Post comment</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
