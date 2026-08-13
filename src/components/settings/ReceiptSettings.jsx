import { useEffect, useMemo, useState } from 'react';
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  BadgeCheck, Building2, Check, CircleDollarSign, FileText, GripVertical,
  LayoutList, Loader2, Maximize2, MessageSquareText, Palette, PenLine, Plus,
  RotateCcw, Save, Trash2, Type,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import UnifiedReceiptPreview from '@/components/receipts/UnifiedReceiptPreview';
import {
  getReceiptConfiguration,
  normalizeReceiptConfiguration,
  RECEIPT_CONFIGURATION_DEFAULTS,
  RECEIPT_FONT_OPTIONS,
  updateReceiptConfiguration,
} from '@/lib/receiptConfiguration';

const TEMPLATES = [
  { id: 'classic', name: 'Classic', description: 'Double frame with formal serif headings.', tone: '#334155' },
  { id: 'modern', name: 'Modern', description: 'Clean structure with a bold accent line.', tone: '#2563eb' },
  { id: 'executive', name: 'Executive', description: 'Premium dark masthead for official receipts.', tone: '#0f172a' },
  { id: 'minimal', name: 'Minimal', description: 'Open whitespace and a refined side accent.', tone: '#64748b' },
  { id: 'heritage', name: 'Heritage', description: 'Warm paper and traditional fine-line frame.', tone: '#9a7b4f' },
  { id: 'compact', name: 'Compact', description: 'Dense professional layout for short receipts.', tone: '#475569' },
];

const COLOURS = ['#166534', '#2563eb', '#0f172a', '#7c3aed', '#b45309', '#be123c'];

const DATA_FIELDS = [
  ['show_party', 'Customer / payee', 'Who paid or received the money.'],
  ['show_payment_mode', 'Payment mode', 'Cash, bank, cheque or split.'],
  ['show_reference', 'Payment reference', 'UTR, cheque or voucher reference.'],
  ['show_bank_details', 'Bank details', 'Bank and masked account information.'],
  ['show_allocation', 'Allocation', 'Installment or commitment receiving the payment.'],
  ['show_remarks', 'Remarks', 'Operator notes recorded with the transaction.'],
  ['show_status', 'Approval status', 'Posted, pending, reversed or rejected state.'],
  ['show_recorded_by', 'Recorded by', 'The workspace user who entered the payment.'],
];

const RECEIPT_BLOCKS = [
  { id: 'header', name: 'Site header', description: 'Company name and address', icon: Building2 },
  { id: 'document', name: 'Receipt information', description: 'Title, number and date', icon: FileText },
  { id: 'amount', name: 'Amount', description: 'Payment figure and amount in words', icon: CircleDollarSign },
  { id: 'details', name: 'Transaction details', description: 'Party, mode, references and status', icon: LayoutList },
  { id: 'note', name: 'Transaction note', description: 'Module-specific receipt proviso', icon: MessageSquareText },
  { id: 'signatures', name: 'Signatures & QR', description: 'Payee, authority and verification', icon: PenLine },
  { id: 'footer', name: 'Footer', description: 'Legal note and print timestamp', icon: BadgeCheck },
];

const BLOCK_BY_ID = Object.fromEntries(RECEIPT_BLOCKS.map((block) => [block.id, block]));

function ToggleRow({ checked, disabled, label, description, onChange }) {
  return (
    <div className="flex items-center justify-between gap-5 border-b border-mr-line py-3 last:border-b-0">
      <span className="min-w-0"><span className="block text-[12px] font-semibold text-mr-text">{label}</span>{description && <span className="mt-0.5 block text-[11px] leading-relaxed text-mr-muted">{description}</span>}</span>
      <Switch className="shrink-0 data-[state=checked]:bg-mr-ink" checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

function TemplateCard({ template, active, disabled, accent, onSelect }) {
  const tone = template.id === 'modern' || template.id === 'minimal' ? accent : template.tone;
  return (
    <button type="button" disabled={disabled} onClick={onSelect} className={`group min-h-[132px] rounded-xl border p-3 text-left transition-all disabled:cursor-default ${active ? 'border-mr-blue bg-mr-blue-soft shadow-sm' : 'border-mr-line bg-white hover:-translate-y-0.5 hover:border-mr-blue/40 hover:shadow-sm'}`}>
      <span className="mb-3 block h-14 overflow-hidden rounded-md border border-slate-200 bg-white p-1.5 shadow-inner">
        {template.id === 'executive' && <span className="block h-4 rounded-sm" style={{ background: tone }} />}
        {template.id === 'modern' && <span className="mb-1 block h-1 rounded-full" style={{ background: tone }} />}
        {template.id === 'heritage' && <span className="block h-full border border-[#c9b38b] bg-[#fffdf5] p-1"><span className="mx-auto block h-1 w-1/2 bg-[#9a7b4f]" /></span>}
        {template.id === 'minimal' && <span className="float-left mr-1 block h-full w-1 rounded-full" style={{ background: tone }} />}
        {template.id === 'classic' && <span className="block h-full border-2 border-double border-slate-500 p-1"><span className="mx-auto block h-1 w-1/2 bg-slate-600" /></span>}
        {!['classic', 'heritage'].includes(template.id) && <><span className="mx-auto mt-1 block h-1 w-2/5 rounded-full bg-slate-500" /><span className="mx-auto mt-1 block h-0.5 w-3/5 rounded-full bg-slate-200" /><span className="mt-2 block h-3 rounded-sm" style={{ background: `${tone}18` }} /></>}
      </span>
      <span className="flex items-center justify-between gap-2 text-[12px] font-semibold text-mr-text">{template.name}{active && <span className="grid h-5 w-5 place-items-center rounded-full bg-mr-blue text-white"><Check className="h-3 w-3" /></span>}</span>
      <span className="mt-1 block text-[10px] leading-relaxed text-mr-muted">{template.description}</span>
    </button>
  );
}

function SortableReceiptBlock({ id, selected, disabled, onSelect }) {
  const block = BLOCK_BY_ID[id];
  const Icon = block.icon;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={() => onSelect(id)}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(id); } }}
      className={`group flex min-h-[68px] items-center gap-3 rounded-xl border px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-mr-blue ${selected ? 'border-mr-blue bg-mr-blue-soft/70' : 'border-mr-line bg-mr-surface hover:bg-mr-surface-2'} ${isDragging ? 'z-20 opacity-60 shadow-xl' : ''}`}
    >
      <button type="button" disabled={disabled} className="grid h-9 w-7 shrink-0 cursor-grab place-items-center rounded-lg text-mr-faint hover:bg-white hover:text-mr-text active:cursor-grabbing disabled:cursor-default" aria-label={`Drag ${block.name}`} {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${selected ? 'bg-mr-blue text-white' : 'bg-mr-surface-2 text-mr-muted'}`}><Icon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1"><span className="block text-[12px] font-semibold text-mr-text">{block.name}</span><span className="mt-0.5 block truncate text-[11px] text-mr-muted">{block.description}</span></span>
      <span className="rounded-full border border-mr-line bg-white px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-mr-faint">Edit</span>
    </div>
  );
}

function EditorPanel({ selected, configuration, disabled, nameSign, onNameSign, patch, site }) {
  const block = BLOCK_BY_ID[selected];
  if (!block) return null;
  const fieldClass = 'mt-1.5 h-10';
  const updateCustomField = (id, updates) => patch({
    custom_fields: configuration.custom_fields.map((field) => (field.id === id ? { ...field, ...updates } : field)),
  });
  const addCustomField = () => {
    if (configuration.custom_fields.length >= 12) return;
    patch({
      custom_fields: [
        ...configuration.custom_fields,
        { id: `field-${Date.now().toString(36)}`, label: '', value: '', enabled: true },
      ],
    });
  };
  const removeCustomField = (id) => patch({
    custom_fields: configuration.custom_fields.filter((field) => field.id !== id),
  });

  return (
    <section className="rounded-2xl border border-mr-line bg-mr-surface p-4 shadow-sm shadow-mr-ink/[0.025] sm:p-5">
      <div className="flex items-start justify-between gap-4 border-b border-mr-line pb-4">
        <div><p className="text-[14px] font-semibold text-mr-text">Edit {block.name}</p><p className="mt-1 text-[11px] leading-relaxed text-mr-muted">Changes appear immediately in the preview.</p></div>
        {disabled && <span className="rounded-full bg-mr-surface-2 px-2.5 py-1 text-[10px] font-semibold text-mr-muted">Admin only</span>}
      </div>

      {selected === 'header' && <div className="mt-4 space-y-4"><div><Label htmlFor="receipt-header-title" className="text-[12px]">Company / Site name</Label><Input id="receipt-header-title" className={fieldClass} disabled={disabled} value={configuration.header_title} onChange={(event) => patch({ header_title: event.target.value })} placeholder={site?.name || 'Uses the Site name when blank'} maxLength={100} /></div><div><Label htmlFor="receipt-header-subtitle" className="text-[12px]">Address or subtitle</Label><Input id="receipt-header-subtitle" className={fieldClass} disabled={disabled} value={configuration.header_subtitle} onChange={(event) => patch({ header_subtitle: event.target.value })} placeholder="Uses the Site address when blank" maxLength={220} /></div></div>}

      {selected === 'document' && <div className="mt-4"><Label htmlFor="receipt-document-title" className="text-[12px]">Receipt title override</Label><Input id="receipt-document-title" className={fieldClass} disabled={disabled} value={configuration.document_title} onChange={(event) => patch({ document_title: event.target.value })} placeholder="Blank keeps each module's own title" maxLength={100} /><p className="mt-2 text-[11px] leading-relaxed text-mr-muted">Receipt number and transaction date remain automatic and cannot be replaced with manual text.</p></div>}

      {selected === 'amount' && <div className="mt-4 space-y-2"><div><Label htmlFor="receipt-amount-label" className="text-[12px]">Amount caption override</Label><Input id="receipt-amount-label" className={fieldClass} disabled={disabled} value={configuration.amount_label} onChange={(event) => patch({ amount_label: event.target.value })} placeholder="Example: Amount paid" maxLength={80} /></div><ToggleRow checked={configuration.show_amount_words} disabled={disabled} label="Show amount in words" description="Print the numeric amount as Indian currency words." onChange={(value) => patch({ show_amount_words: value })} /></div>}

      {selected === 'details' && (
        <div className="mt-2">
          {DATA_FIELDS.map(([key, label, description]) => <ToggleRow key={key} checked={configuration[key]} disabled={disabled} label={label} description={description} onChange={(value) => patch({ [key]: value })} />)}
          <div className="mt-5 rounded-xl border border-mr-line bg-mr-surface-2/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[12px] font-semibold text-mr-text">Custom receipt fields</p><p className="mt-1 text-[10px] leading-relaxed text-mr-muted">Add a label and fixed value that should appear on every receipt for this Site.</p></div>
              <Button type="button" size="sm" variant="outline" disabled={disabled || configuration.custom_fields.length >= 12} onClick={addCustomField}><Plus className="mr-1 h-3.5 w-3.5" />Add field</Button>
            </div>
            {configuration.custom_fields.length === 0 ? (
              <button type="button" disabled={disabled} onClick={addCustomField} className="mt-3 w-full rounded-lg border border-dashed border-mr-line bg-white px-3 py-5 text-[11px] font-medium text-mr-muted transition-colors hover:border-mr-blue hover:text-mr-blue disabled:cursor-default">+ Add your first custom field</button>
            ) : (
              <div className="mt-3 space-y-3">
                {configuration.custom_fields.map((field, index) => (
                  <div key={field.id} className="rounded-lg border border-mr-line bg-white p-3">
                    <div className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-wide text-mr-faint">Field {index + 1}</span><div className="flex items-center gap-2"><Switch className="data-[state=checked]:bg-mr-ink" checked={field.enabled} disabled={disabled} onCheckedChange={(enabled) => updateCustomField(field.id, { enabled })} aria-label={`Show custom field ${index + 1}`} /><Button type="button" size="icon" variant="ghost" disabled={disabled} onClick={() => removeCustomField(field.id)} aria-label={`Remove custom field ${index + 1}`} className="h-8 w-8 text-mr-muted hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></Button></div></div>
                    <div className="grid gap-2 sm:grid-cols-2"><Input disabled={disabled} value={field.label} onChange={(event) => updateCustomField(field.id, { label: event.target.value })} placeholder="Field label" maxLength={60} aria-label={`Custom field ${index + 1} label`} /><Input disabled={disabled} value={field.value} onChange={(event) => updateCustomField(field.id, { value: event.target.value })} placeholder="Value shown on receipt" maxLength={160} aria-label={`Custom field ${index + 1} value`} /></div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-right text-[9px] text-mr-faint">{configuration.custom_fields.length}/12 fields</p>
          </div>
        </div>
      )}

      {selected === 'note' && <div className="mt-2"><ToggleRow checked={configuration.show_extra_note} disabled={disabled} label="Show transaction note" description="Allows statutory notes, reversal notices and module-specific provisos to print." onChange={(value) => patch({ show_extra_note: value })} /></div>}

      {selected === 'signatures' && <div className="mt-2"><ToggleRow checked={configuration.show_signatures} disabled={disabled} label="Signature lines" description="Show customer/payee and authorized authority signatures." onChange={(value) => patch({ show_signatures: value })} /><ToggleRow checked={configuration.show_verification_qr} disabled={disabled} label="Verification QR" description="Show the signed receipt-verification QR when issued." onChange={(value) => patch({ show_verification_qr: value })} /><ToggleRow checked={nameSign} label="Print my name as authority" description="Personal browser preference used when no drawn authority signature exists." onChange={onNameSign} /></div>}

      {selected === 'footer' && <div className="mt-4 space-y-2"><div><Label htmlFor="receipt-footer-note" className="text-[12px]">Footer note</Label><Textarea id="receipt-footer-note" className="mt-1.5 min-h-24" disabled={disabled} value={configuration.footer_note} onChange={(event) => patch({ footer_note: event.target.value })} maxLength={320} /></div><ToggleRow checked={configuration.show_printed_at} disabled={disabled} label="Print timestamp" description="Adds the date and time when the receipt was produced." onChange={(value) => patch({ show_printed_at: value })} /></div>}
    </section>
  );
}

export default function ReceiptSettings() {
  const { currentSite, isAdmin } = useAuth();
  const [configuration, setConfiguration] = useState(RECEIPT_CONFIGURATION_DEFAULTS);
  const [saved, setSaved] = useState(RECEIPT_CONFIGURATION_DEFAULTS);
  const [selected, setSelected] = useState('header');
  const [nameSign, setNameSign] = useState(() => localStorage.getItem('nameSign') !== '0');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!currentSite?.id) { setLoading(false); return undefined; }
    let active = true;
    setLoading(true);
    getReceiptConfiguration(currentSite.id)
      .then((next) => { if (active) { setConfiguration(next); setSaved(next); } })
      .catch((error) => { if (active) toast.error(error.response?.data?.message || 'Could not load receipt settings'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [currentSite?.id]);

  const dirty = useMemo(() => JSON.stringify(configuration) !== JSON.stringify(saved), [configuration, saved]);
  const patch = (next) => {
    if (!isAdmin) return;
    setConfiguration((current) => normalizeReceiptConfiguration({ ...current, ...next }));
  };
  const handleDragEnd = ({ active, over }) => {
    if (!isAdmin || !over || active.id === over.id) return;
    const oldIndex = configuration.component_order.indexOf(active.id);
    const newIndex = configuration.component_order.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    patch({ component_order: arrayMove(configuration.component_order, oldIndex, newIndex) });
  };
  const handleNameSign = (checked) => {
    setNameSign(checked);
    localStorage.setItem('nameSign', checked ? '1' : '0');
    toast.success(checked ? 'Your name will print as the authority signatory' : 'Drawn authority signatures will be used');
  };
  const save = async () => {
    if (!isAdmin || !currentSite?.id || saving) return;
    setSaving(true);
    try {
      const result = await updateReceiptConfiguration(currentSite.id, configuration);
      setConfiguration(result.configuration); setSaved(result.configuration);
      toast.success(result.message || 'Receipt design saved');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not save receipt settings');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="grid min-h-[65vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-mr-blue" /></div>;

  return (
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(420px,.82fr)_minmax(500px,1.18fr)]">
      <div className="min-w-0 space-y-5 pb-6">
        {!isAdmin && <div className="rounded-xl border border-mr-amber/30 bg-mr-amber-soft px-4 py-3 text-[12px] leading-relaxed text-mr-amber-ink">You can inspect the Site receipt and change your personal Name Sign option. Only an administrator can change the shared layout.</div>}

        <section className="rounded-2xl border border-mr-line bg-mr-surface p-4 shadow-sm shadow-mr-ink/[0.025] sm:p-5">
          <div className="flex items-center gap-2"><Palette className="h-4 w-4 text-mr-blue" /><p className="text-[14px] font-semibold text-mr-text">Document style</p></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {TEMPLATES.map((template) => {
              const active = configuration.template === template.id;
              return <TemplateCard key={template.id} template={template} active={active} disabled={!isAdmin} accent={configuration.accent_color} onSelect={() => patch({ template: template.id })} />;
            })}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2"><div><Label className="text-[12px]">Paper size</Label><Select disabled={!isAdmin} value={configuration.paper_size} onValueChange={(paper_size) => patch({ paper_size })}><SelectTrigger className="mt-1.5 h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="A4">A4 · full page</SelectItem><SelectItem value="A5">A5 · half page</SelectItem></SelectContent></Select></div><div><Label htmlFor="receipt-accent" className="text-[12px]">Accent colour</Label><div className="mt-1.5 flex h-10 items-center gap-2 rounded-md border border-input px-2"><input id="receipt-accent" type="color" disabled={!isAdmin} value={configuration.accent_color} onChange={(event) => patch({ accent_color: event.target.value })} className="h-7 w-8 cursor-pointer border-0 bg-transparent p-0 disabled:cursor-default" /><span className="text-[11px] font-semibold uppercase text-mr-muted">{configuration.accent_color}</span></div></div></div>
          <div className="mt-3 flex flex-wrap gap-2">{COLOURS.map((colour) => <button key={colour} type="button" disabled={!isAdmin} onClick={() => patch({ accent_color: colour })} aria-label={`Use ${colour}`} className={`h-7 w-7 rounded-full border-2 disabled:cursor-default ${configuration.accent_color === colour ? 'border-mr-text ring-2 ring-mr-line' : 'border-white'}`} style={{ backgroundColor: colour }} />)}</div>
          <div className="mt-3"><ToggleRow checked={configuration.show_border} disabled={!isAdmin} label="Document border" description="Frame the receipt while preserving the selected layout." onChange={(value) => patch({ show_border: value })} /></div>
          <div className="mt-4 border-t border-mr-line pt-4">
            <div className="flex items-center gap-2"><Type className="h-4 w-4 text-mr-blue" /><p className="text-[12px] font-semibold text-mr-text">Typography</p></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div><Label className="text-[11px]">Body font</Label><Select disabled={!isAdmin} value={configuration.body_font} onValueChange={(body_font) => patch({ body_font })}><SelectTrigger className="mt-1.5 h-10"><SelectValue /></SelectTrigger><SelectContent>{RECEIPT_FONT_OPTIONS.map((font) => <SelectItem key={font.id} value={font.id}>{font.name} · {font.group}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-[11px]">Heading font</Label><Select disabled={!isAdmin} value={configuration.heading_font} onValueChange={(heading_font) => patch({ heading_font })}><SelectTrigger className="mt-1.5 h-10"><SelectValue /></SelectTrigger><SelectContent>{RECEIPT_FONT_OPTIONS.map((font) => <SelectItem key={font.id} value={font.id}>{font.name} · {font.group}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="mt-4 rounded-xl border border-mr-line bg-mr-surface-2/60 p-3">
              <div className="flex items-center justify-between gap-3"><Label htmlFor="receipt-text-size" className="text-[11px]">Receipt text size</Label><span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold tabular-nums text-mr-text">{configuration.text_scale}%</span></div>
              <input id="receipt-text-size" type="range" min="80" max="130" step="5" disabled={!isAdmin} value={configuration.text_scale} onChange={(event) => patch({ text_scale: Number(event.target.value) })} className="mt-3 h-2 w-full cursor-pointer accent-mr-blue disabled:cursor-default" />
              <div className="mt-1 flex justify-between text-[9px] text-mr-faint"><span>Smaller</span><span>Standard</span><span>Larger</span></div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-mr-line bg-mr-surface p-4 shadow-sm shadow-mr-ink/[0.025] sm:p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[14px] font-semibold text-mr-text">Receipt blocks</p><p className="mt-1 text-[11px] leading-relaxed text-mr-muted">Drag using the handle to reorder. Select any block to edit it below.</p></div><span className="rounded-full bg-mr-surface-2 px-2.5 py-1 text-[10px] font-semibold text-mr-muted">{configuration.component_order.length} blocks</span></div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={configuration.component_order} strategy={verticalListSortingStrategy}>
              <div className="mt-4 space-y-2">{configuration.component_order.map((id) => <SortableReceiptBlock key={id} id={id} selected={selected === id} disabled={!isAdmin} onSelect={setSelected} />)}</div>
            </SortableContext>
          </DndContext>
        </section>

        <EditorPanel selected={selected} configuration={configuration} disabled={!isAdmin} nameSign={nameSign} onNameSign={handleNameSign} patch={patch} site={currentSite} />

        <div className="sticky bottom-2 z-20 flex flex-wrap justify-end gap-2 rounded-xl border border-mr-line bg-mr-surface/95 p-2 shadow-lg shadow-mr-ink/[0.08] backdrop-blur">
          <Button type="button" variant="ghost" disabled={!dirty || saving || !isAdmin} onClick={() => setConfiguration(saved)}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Discard</Button>
          <Button type="button" variant="outline" disabled={saving || !isAdmin} onClick={() => setConfiguration(normalizeReceiptConfiguration(RECEIPT_CONFIGURATION_DEFAULTS))}>Use defaults</Button>
          <Button type="button" disabled={!dirty || saving || !currentSite?.id || !isAdmin} onClick={save}>{saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}Save Site receipt</Button>
        </div>
      </div>

      <aside className="min-w-0 xl:sticky xl:top-0 xl:h-[calc(100dvh-7.5rem)] xl:self-start">
        <div className="mb-2 flex items-center justify-between gap-3"><div><p className="text-[12px] font-semibold uppercase tracking-[.1em] text-mr-faint">Live preview</p><p className="mt-0.5 text-[10px] text-mr-muted">The complete page scales to remain visible</p></div><div className="flex items-center gap-2"><span className="hidden rounded-full border border-mr-line bg-mr-surface px-2.5 py-1 text-[10px] font-semibold capitalize text-mr-muted sm:inline">{configuration.paper_size} · {configuration.template}</span><Button type="button" size="sm" variant="outline" onClick={() => setPreviewOpen(true)}><Maximize2 className="mr-1.5 h-3.5 w-3.5" />Full view</Button></div></div>
        <div className="h-[720px] min-h-0 xl:h-[calc(100%-46px)]"><UnifiedReceiptPreview configuration={configuration} site={currentSite} fit /></div>
      </aside>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="grid h-[94dvh] max-h-none w-[min(96vw,1100px)] max-w-none grid-rows-[auto_minmax(0,1fr)] overflow-hidden p-4 sm:p-5">
          <DialogHeader className="pr-10"><DialogTitle>Full receipt preview</DialogTitle><DialogDescription>Complete {configuration.paper_size} page · {configuration.text_scale}% text · {TEMPLATES.find((item) => item.id === configuration.template)?.name} design</DialogDescription></DialogHeader>
          <div className="min-h-0"><UnifiedReceiptPreview configuration={configuration} site={currentSite} fit /></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
