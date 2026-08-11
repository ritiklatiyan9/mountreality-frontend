const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Prevent exported text from being interpreted as a formula by spreadsheet apps. */
export const neutralizeSpreadsheetCell = (value) => {
  if (typeof value !== 'string') return value;
  return FORMULA_PREFIX.test(value) ? `'${value}` : value;
};

export const sanitizeSpreadsheetRows = (rows) => rows.map((row) => (
  Array.isArray(row)
    ? row.map(neutralizeSpreadsheetCell)
    : Object.fromEntries(Object.entries(row).map(([key, value]) => [key, neutralizeSpreadsheetCell(value)]))
));

export const encodeCsvCell = (value) => {
  const safe = neutralizeSpreadsheetCell(value == null ? '' : String(value));
  return `"${safe.replaceAll('"', '""')}"`;
};
