import DOMPurify from 'dompurify';

/**
 * Write a print document without allowing database/user strings interpolated
 * into a template to become executable markup. Inline event handlers and
 * scripts are removed; common Print/Close buttons are rebound safely.
 */
export function writePrintDocument(targetWindow, html) {
  if (!targetWindow) throw new Error('Pop-up blocked. Allow pop-ups to print this document.');
  const source = String(html || '');
  const autoPrint = /onload\s*=\s*["'][^"']*window\.print|window\.onload\s*=|addEventListener\(\s*["']load/i.test(source);
  targetWindow.opener = null;
  const safeHtml = DOMPurify.sanitize(source, {
    WHOLE_DOCUMENT: true,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'base'],
    FORBID_ATTR: ['srcdoc'],
  });
  targetWindow.document.open();
  targetWindow.document.write(safeHtml);
  targetWindow.document.close();
  targetWindow.document.querySelectorAll('button').forEach((button) => {
    const action = `${button.id || ''} ${button.textContent || ''}`.toLowerCase();
    if (action.includes('print')) button.addEventListener('click', () => targetWindow.print());
    if (action.includes('close')) button.addEventListener('click', () => targetWindow.close());
  });
  if (autoPrint) setTimeout(() => targetWindow.print(), 50);
}

export const escapePrintText = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');
