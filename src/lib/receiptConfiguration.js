import api from '@/api/api';

export const RECEIPT_COMPONENTS = Object.freeze([
  'header',
  'document',
  'amount',
  'details',
  'note',
  'signatures',
  'footer',
]);

export const RECEIPT_CONFIGURATION_DEFAULTS = Object.freeze({
  template: 'classic',
  paper_size: 'A4',
  accent_color: '#166534',
  body_font: 'inter',
  heading_font: 'georgia',
  text_scale: 100,
  header_title: '',
  header_subtitle: '',
  document_title: '',
  amount_label: '',
  footer_note: 'This is a computer-generated receipt and does not require a revenue stamp.',
  component_order: RECEIPT_COMPONENTS,
  custom_fields: [],
  show_border: true,
  show_amount_words: true,
  show_party: true,
  show_payment_mode: true,
  show_reference: true,
  show_bank_details: true,
  show_allocation: true,
  show_remarks: true,
  show_status: true,
  show_recorded_by: true,
  show_extra_note: true,
  show_signatures: true,
  show_verification_qr: true,
  show_printed_at: true,
});

export const RECEIPT_TEMPLATE_IDS = Object.freeze([
  'classic', 'modern', 'executive', 'minimal', 'heritage', 'compact',
]);

export const RECEIPT_FONT_OPTIONS = Object.freeze([
  { id: 'inter', name: 'Inter / Segoe UI', group: 'Sans serif' },
  { id: 'humanist', name: 'Trebuchet', group: 'Humanist sans' },
  { id: 'system', name: 'Arial', group: 'Neutral sans' },
  { id: 'georgia', name: 'Georgia', group: 'Classic serif' },
  { id: 'garamond', name: 'Garamond', group: 'Editorial serif' },
]);

export const RECEIPT_FONT_STACKS = Object.freeze({
  inter: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  humanist: "'Trebuchet MS', 'Segoe UI', Arial, sans-serif",
  system: "Arial, 'Helvetica Neue', sans-serif",
  georgia: "Georgia, 'Times New Roman', serif",
  garamond: "Garamond, 'Times New Roman', serif",
});

const TEMPLATES = new Set(RECEIPT_TEMPLATE_IDS);
const PAPER_SIZES = new Set(['A4', 'A5']);
const FONTS = new Set(RECEIPT_FONT_OPTIONS.map((font) => font.id));
const BOOLEAN_KEYS = Object.keys(RECEIPT_CONFIGURATION_DEFAULTS)
  .filter((key) => key.startsWith('show_'));
const editableText = (value, maxLength) => String(value ?? '').slice(0, maxLength);

const normalizeCustomFields = (raw) => {
  const fields = Array.isArray(raw) ? raw.slice(0, 12) : [];
  const usedIds = new Set();
  return fields.map((field, index) => {
    const input = field && typeof field === 'object' && !Array.isArray(field) ? field : {};
    const baseId = String(input.id ?? '').trim().slice(0, 64).replace(/[^a-z0-9_-]/gi, '') || `field-${index + 1}`;
    let id = baseId;
    let duplicate = 2;
    while (usedIds.has(id)) {
      id = `${baseId}-${duplicate}`;
      duplicate += 1;
    }
    usedIds.add(id);
    return {
      id,
      label: editableText(input.label, 60),
      value: editableText(input.value, 160),
      enabled: input.enabled !== false,
    };
  });
};

export function normalizeReceiptConfiguration(raw) {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const template = String(input.template || '').toLowerCase();
  const paperSize = String(input.paper_size || '').toUpperCase();
  const accentColor = String(input.accent_color || '').trim();
  const bodyFont = String(input.body_font || '').toLowerCase();
  const headingFont = String(input.heading_font || '').toLowerCase();
  const textScale = Number(input.text_scale);
  const config = {
    ...RECEIPT_CONFIGURATION_DEFAULTS,
    template: TEMPLATES.has(template) ? template : RECEIPT_CONFIGURATION_DEFAULTS.template,
    paper_size: PAPER_SIZES.has(paperSize) ? paperSize : RECEIPT_CONFIGURATION_DEFAULTS.paper_size,
    accent_color: /^#[0-9a-f]{6}$/i.test(accentColor)
      ? accentColor.toLowerCase()
      : RECEIPT_CONFIGURATION_DEFAULTS.accent_color,
    body_font: FONTS.has(bodyFont) ? bodyFont : RECEIPT_CONFIGURATION_DEFAULTS.body_font,
    heading_font: FONTS.has(headingFont) ? headingFont : RECEIPT_CONFIGURATION_DEFAULTS.heading_font,
    text_scale: Number.isFinite(textScale)
      ? Math.min(130, Math.max(80, Math.round(textScale)))
      : RECEIPT_CONFIGURATION_DEFAULTS.text_scale,
    header_title: editableText(input.header_title, 100),
    header_subtitle: editableText(input.header_subtitle, 220),
    document_title: editableText(input.document_title, 100),
    amount_label: editableText(input.amount_label, 80),
    footer_note: editableText(input.footer_note, 320).trim()
      ? editableText(input.footer_note, 320)
      : RECEIPT_CONFIGURATION_DEFAULTS.footer_note,
    component_order: (() => {
      const posted = Array.isArray(input.component_order) ? input.component_order : [];
      const valid = [...new Set(posted.map((value) => String(value)).filter((value) => RECEIPT_COMPONENTS.includes(value)))];
      return [...valid, ...RECEIPT_COMPONENTS.filter((value) => !valid.includes(value))];
    })(),
    custom_fields: normalizeCustomFields(input.custom_fields),
  };

  BOOLEAN_KEYS.forEach((key) => {
    if (typeof input[key] === 'boolean') config[key] = input[key];
  });
  return config;
}

export async function getReceiptConfiguration(siteId) {
  if (!siteId) return { ...RECEIPT_CONFIGURATION_DEFAULTS };
  const { data } = await api.get('/settings/receipt', { params: { site_id: siteId } });
  return normalizeReceiptConfiguration(data.configuration);
}

export async function updateReceiptConfiguration(siteId, configuration) {
  const { data } = await api.put('/settings/receipt', {
    site_id: siteId,
    configuration: normalizeReceiptConfiguration(configuration),
  });
  return {
    ...data,
    configuration: normalizeReceiptConfiguration(data.configuration),
  };
}
