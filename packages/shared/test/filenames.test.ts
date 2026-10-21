import { describe, expect, it } from 'vitest';
import {
  duplicateBaseNames,
  sanitizeBaseName,
  uniqueBaseNames,
  validateBaseNameInput,
  withExtension,
} from '../src/filenames';

describe('filenames', () => {
  it('sanitizes illegal characters and extensions', () => {
    expect(sanitizeBaseName('  cart/icon?.svg  ')).toBe('cart-icon');
    expect(sanitizeBaseName('a::b??.png')).toBe('a-b');
    expect(sanitizeBaseName('多  云   同步')).toBe('多 云 同步');
  });

  it('prefixes Windows reserved names', () => {
    expect(sanitizeBaseName('CON')).toBe('icon-CON');
    expect(sanitizeBaseName('lpt9')).toBe('icon-lpt9');
  });

  it('falls back to a numbered icon name', () => {
    expect(sanitizeBaseName('', 2)).toBe('icon-03');
    expect(sanitizeBaseName('...', 0)).toBe('icon-01');
  });

  it('truncates long names by code points', () => {
    expect([...sanitizeBaseName('图'.repeat(100))].length).toBe(80);
  });

  it('validates empty, long and reserved inputs', () => {
    expect(validateBaseNameInput('')).toBeTruthy();
    expect(validateBaseNameInput('CON')).toBeTruthy();
    expect(validateBaseNameInput('a'.repeat(81))).toBeTruthy();
    expect(validateBaseNameInput('valid-name')).toBeNull();
  });

  it('detects duplicate names case-insensitively', () => {
    expect(duplicateBaseNames(['Icon', 'icon', 'other'])).toEqual(['icon']);
  });

  it('deduplicates export names with suffixes', () => {
    expect(uniqueBaseNames(['icon', 'ICON', 'icon', 'other'])).toEqual([
      'icon',
      'ICON-2',
      'icon-3',
      'other',
    ]);
  });

  it('applies the requested extension', () => {
    expect(withExtension('cart.svg', 'png')).toBe('cart.png');
  });
});
