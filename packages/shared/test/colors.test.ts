import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  hasLowContrast,
  isSameHueFamily,
  normalizeHex,
  readableTextColor,
  relativeLuminance,
} from '../src/colors';

describe('colors', () => {
  it('normalizes 3 and 6 digit HEX values', () => {
    expect(normalizeHex('#abc')).toBe('#AABBCC');
    expect(normalizeHex('2563eb')).toBe('#2563EB');
    expect(normalizeHex('#2563EB')).toBe('#2563EB');
    expect(normalizeHex('not-a-color')).toBeNull();
  });

  it('computes accessible contrast', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 1);
    expect(hasLowContrast('#777777', '#888888')).toBe(true);
    expect(hasLowContrast('#FFFFFF', '#1E5B47')).toBe(false);
  });

  it('chooses readable text color', () => {
    expect(readableTextColor('#FFFFFF')).toBe('#17201B');
    expect(readableTextColor('#111111')).toBe('#FFFFFF');
  });

  it('computes relative luminance monotonically', () => {
    expect(relativeLuminance('#FFFFFF')).toBeGreaterThan(relativeLuminance('#888888'));
    expect(relativeLuminance('#888888')).toBeGreaterThan(relativeLuminance('#000000'));
  });

  it('accepts tonal shades and neutrals but rejects unrelated hues', () => {
    expect(isSameHueFamily('#2563EB', '#60A5FA')).toBe(true);
    expect(isSameHueFamily('#2563EB', '#FFFFFF')).toBe(true);
    expect(isSameHueFamily('#2563EB', '#EF4444')).toBe(false);
    expect(isSameHueFamily('#FFFFFF', '#2563EB')).toBe(false);
    expect(isSameHueFamily('#FFFFFF', '#D1D5DB')).toBe(true);
  });
});
