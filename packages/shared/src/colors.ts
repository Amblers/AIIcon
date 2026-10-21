const HEX6 = /^#?([0-9a-f]{6})$/i;
const HEX3 = /^#?([0-9a-f]{3})$/i;

export function normalizeHex(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  const six = HEX6.exec(input);
  if (six?.[1]) return `#${six[1].toUpperCase()}`;
  const three = HEX3.exec(input);
  if (three?.[1]) {
    const expanded = [...three[1]].map((char) => char + char).join('');
    return `#${expanded.toUpperCase()}`;
  }
  return null;
}

export function isHexColor(value: string | null | undefined): boolean {
  return normalizeHex(value) !== null;
}

export function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ];
}

function channelToLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(channelToLinear) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export function hasLowContrast(foreground: string, background: string): boolean {
  return contrastRatio(foreground, background) < 3;
}

export function readableTextColor(background: string): string {
  return relativeLuminance(background) > 0.45 ? '#17201B' : '#FFFFFF';
}

export function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const safeAlpha = Math.min(1, Math.max(0, alpha));
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${safeAlpha})`;
}

export function isNeutralColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  return Math.max(...rgb) - Math.min(...rgb) <= 8;
}

export interface HslColor {
  h: number;
  s: number;
  l: number;
}

export function hexToHsl(hex: string): HslColor | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [red, green, blue] = rgb.map((channel) => channel / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const l = (max + min) / 2;
  if (delta === 0) return { h: 0, s: 0, l };
  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === red) h = 60 * (((green - blue) / delta) % 6);
  else if (max === green) h = 60 * ((blue - red) / delta + 2);
  else h = 60 * ((red - green) / delta + 4);
  if (h < 0) h += 360;
  return { h, s, l };
}

/**
 * Accepts lighter/darker shades of the same hue, plus neutral white/gray/black
 * tones. Used by the "面性" template to allow controlled tonal layering.
 */
export function isSameHueFamily(base: string, candidate: string): boolean {
  const a = hexToHsl(base);
  const b = hexToHsl(candidate);
  if (!a || !b) return false;
  if (a.s < 0.12) return b.s < 0.16;
  if (b.s < 0.16) return true;
  const rawDiff = Math.abs(a.h - b.h);
  return Math.min(rawDiff, 360 - rawDiff) <= 30;
}
