import { MAX_FILENAME_LENGTH } from './types';

const ILLEGAL_FILENAME_CHARS = /[\\/:*?"<>|\u0000-\u001F]/g;
const RESERVED_NAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9',
]);

function fallbackName(index: number): string {
  return `icon-${String(Math.max(index + 1, 1)).padStart(2, '0')}`;
}

export function isReservedFileName(name: string): boolean {
  return RESERVED_NAMES.has(name.trim().toLowerCase().split('.')[0] ?? '');
}

export function sanitizeBaseName(input: string, index = 0): string {
  let name = (input ?? '').normalize('NFC').trim();
  name = name.replace(/\.(svg|png)$/i, '');
  name = name.replace(ILLEGAL_FILENAME_CHARS, '-');
  name = name.replace(/\s+/g, ' ');
  name = name.replace(/-+/g, '-');
  name = name.replace(/^[.\s-]+|[.\s-]+$/g, '');
  name = [...name].slice(0, MAX_FILENAME_LENGTH).join('');
  name = name.replace(/[.\s-]+$/g, '');
  if (!name) return fallbackName(index);
  if (isReservedFileName(name)) name = `icon-${name}`;
  return name;
}

export function validateBaseNameInput(input: string): string | null {
  const trimmed = (input ?? '').trim();
  if (!trimmed) return '请填写导出文件名';
  if ([...trimmed].length > MAX_FILENAME_LENGTH) {
    return `文件名不能超过 ${MAX_FILENAME_LENGTH} 个字符`;
  }
  if (trimmed === '.' || trimmed === '..') return '文件名不合法';
  if (isReservedFileName(trimmed.replace(/\.(svg|png)$/i, ''))) {
    return '这是系统保留文件名，请换一个';
  }
  return null;
}

export function uniqueBaseNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((raw, index) => {
    const base = sanitizeBaseName(raw, index);
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate.toLowerCase())) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

export function withExtension(baseName: string, extension: 'svg' | 'png', index = 0): string {
  return `${sanitizeBaseName(baseName, index)}.${extension}`;
}

export function duplicateBaseNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  const duplicates: string[] = [];
  names.forEach((raw, index) => {
    const name = sanitizeBaseName(raw, index).toLowerCase();
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    if (count > 1 && !duplicates.includes(name)) duplicates.push(name);
  });
  return duplicates;
}
