/**
 * Encode an untrusted value as a spreadsheet-safe CSV cell.
 * Quoting alone only protects CSV structure, not formula interpretation.
 * Keep stored values unchanged; neutralize formulas at the export boundary.
 */
export function csvCell(value: unknown): string {
  const text = String(value ?? '');
  // Some importers ignore leading whitespace/control characters. Also protect
  // leading tab/CR/LF, which spreadsheet importers may interpret specially.
  const unsafe = /^[\s\u0000-\u001f\u007f]*[=+\-@]/u.test(text)
    || /^[\s\u0000-\u001f\u007f]*[\t\r\n]/u.test(text);
  const safe = unsafe ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}
