export interface CsvColumn<T> {
  title: string;
  value: (row: T) => unknown;
}

const escapeCell = (value: unknown): string => {
  const text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value as string);
  // Neutralise spreadsheet formula injection (=, +, -, @ at the start of a cell).
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** CSV with a UTF-8 BOM so Excel opens accented names correctly. */
export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const header = columns.map((c) => c.title);
  const body = rows.map((row) => columns.map((c) => c.value(row)));
  return '﻿' + [header, ...body].map((line) => line.map(escapeCell).join(',')).join('\r\n');
}
