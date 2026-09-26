import fs from 'node:fs';

/**
 * Parser CSV (RFC 4180) com delimitador configurável. Suporta campos entre aspas
 * com quebras de linha e aspas escapadas (""), e remove BOM UTF-8.
 */
export function parseCsv(text: string, delimiter = ';'): Record<string, string>[] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...data] = rows.filter((r) => r.length > 1 || r[0] !== '');
  return data.map((r) => Object.fromEntries(header.map((h, idx) => [h, r[idx] ?? ''])));
}

export function readCsv(file: string): Record<string, string>[] {
  return parseCsv(fs.readFileSync(file, 'utf8'));
}

export const num = (v: string | undefined): number | null => {
  if (v === undefined || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const bool = (v: string | undefined): boolean => v === 'True' || v === 'true' || v === '1';
