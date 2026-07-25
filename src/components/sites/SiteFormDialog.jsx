import { AlertCircle, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const FIELD = 'h-10 rounded-control border-mr-line text-[13px]';

/* ── Site form ───────────────────────────────────────────────────────
   Create and edit share one dialog. All state lives in the page; this
   component only renders it, so the existing submit logic is untouched. */
export default function SiteFormDialog({
  open, onOpenChange, editing, form, onChange, onSubmit, submitting, message,
}) {
  const set = (patch) => onChange((current) => ({ ...current, ...patch }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-panel border-mr-line sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-semibold tracking-[-0.02em] text-mr-text">
            {editing ? 'Edit site' : 'Create a site'}
          </DialogTitle>
          <DialogDescription className="text-[13px] text-mr-muted">
            {editing
              ? 'Update the workspace details for this property.'
              : 'Add a project site for its plots, accounting records and team activity.'}
          </DialogDescription>
        </DialogHeader>

        {message?.text && (
          <div
            role="alert"
            className={`flex items-center gap-2 rounded-control border px-3.5 py-2.5 text-[13px] ${
              message.type === 'error'
                ? 'border-mr-coral-ink/15 bg-mr-coral-soft text-mr-coral-ink'
                : 'border-mr-lime-ink/15 bg-mr-lime-soft text-mr-lime-ink'
            }`}
          >
            {message.type === 'error'
              ? <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
              : <Check className="h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />}
            {message.text}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="site-name" className="text-[12px] font-medium text-mr-muted">Name *</Label>
              <Input id="site-name" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Green Valley Residency" required className={FIELD} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="site-code" className="text-[12px] font-medium text-mr-muted">Code</Label>
              <Input id="site-code" value={form.code} onChange={(e) => set({ code: e.target.value })} placeholder="GVR-001" className={FIELD} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="site-address" className="text-[12px] font-medium text-mr-muted">Address</Label>
            <Input id="site-address" value={form.address} onChange={(e) => set({ address: e.target.value })} placeholder="Full street address" className={FIELD} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="site-city" className="text-[12px] font-medium text-mr-muted">City</Label>
              <Input id="site-city" value={form.city} onChange={(e) => set({ city: e.target.value })} placeholder="Mumbai" className={FIELD} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="site-state" className="text-[12px] font-medium text-mr-muted">State</Label>
              <Input id="site-state" value={form.state} onChange={(e) => set({ state: e.target.value })} placeholder="Maharashtra" className={FIELD} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="site-description" className="text-[12px] font-medium text-mr-muted">Description</Label>
            <Textarea
              id="site-description"
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="A short description for the team"
              rows={3}
              className="resize-none rounded-control border-mr-line text-[13px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="site-status" className="text-[12px] font-medium text-mr-muted">Status</Label>
            <Select value={form.status} onValueChange={(status) => set({ status })}>
              <SelectTrigger id="site-status" className={FIELD}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-10 rounded-full border-mr-line text-[13px]">
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="h-10 rounded-full bg-mr-ink px-5 text-[13px] font-semibold text-white hover:bg-mr-ink-2">
              {submitting ? 'Saving…' : editing ? 'Save changes' : 'Create site'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
