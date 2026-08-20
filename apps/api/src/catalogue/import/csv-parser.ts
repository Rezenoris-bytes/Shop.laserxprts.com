/**
 * Minimal RFC 4180 CSV parser.
 *
 * Hand-written rather than pulled from npm because the requirement is small and
 * fixed (quoted fields, embedded commas/newlines, escaped quotes) and this is
 * the code path that loads LEI's entire catalogue — a dependency here is a
 * supply-chain surface on the most sensitive import in the system.
 */

export interface ParsedCsv {
  headers: string[];
  rows: CsvRow[];
}

export interface CsvRow {
  /** 1-based line number in the source file, for error reporting. */
  line: number;
  values: Record<string, string>;
}

export function parseCsv(input: string): ParsedCsv {
  // Strip a UTF-8 BOM — Excel writes one, and it silently corrupts the first
  // header name, which then fails to match and produces a baffling error.
  const text = input.replace(/^﻿/, '');

  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      // Treat CRLF as one terminator.
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else {
      field += char;
    }
  }

  // Trailing record without a newline.
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const nonEmpty = records.filter((r) => r.some((cell) => cell.trim() !== ''));
  if (nonEmpty.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = nonEmpty[0]!.map((h) => h.trim());
  const rows: CsvRow[] = [];

  for (let index = 1; index < nonEmpty.length; index += 1) {
    const cells = nonEmpty[index]!;
    const values: Record<string, string> = {};
    headers.forEach((header, column) => {
      values[header] = (cells[column] ?? '').trim();
    });
    rows.push({ line: index + 1, values });
  }

  return { headers, rows };
}

/** Reads `attr:<slug>` columns into a slug -> value map, dropping blanks. */
export function extractAttributes(values: Record<string, string>): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!key.startsWith('attr:')) continue;
    const slug = key.slice('attr:'.length).trim();
    if (slug && value !== '') attributes[slug] = value;
  }
  return attributes;
}

export function requireHeaders(parsed: ParsedCsv, required: string[]): string[] {
  return required.filter((header) => !parsed.headers.includes(header));
}

export function asBoolean(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === '') return fallback;
  return ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
}

export function asNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function asInt(value: string | undefined, fallback: number): number {
  const parsed = asNumber(value);
  return parsed === null ? fallback : Math.trunc(parsed);
}
