import JSZip from 'jszip';
import { sanitizeBaseName, uniqueBaseNames } from '@aiicon/shared';
import { sanitizeSvg } from './safeSvg';

export interface ExportEntry {
  baseName: string;
  svg: string;
}

export interface ExportOptions {
  svg: boolean;
  png: boolean;
  pngSize: number;
}

function timestamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadSvg(svg: string, baseName: string, index = 0): void {
  const clean = sanitizeSvg(svg);
  downloadBlob(
    new Blob([clean], { type: 'image/svg+xml;charset=utf-8' }),
    `${sanitizeBaseName(baseName, index)}.svg`,
  );
}

async function loadSvgImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = 'async';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('SVG 渲染失败'));
    image.src = url;
  });
  return image;
}

export async function rasterizeSvg(svg: string, size: number): Promise<Blob> {
  const clean = sanitizeSvg(svg);
  const url = URL.createObjectURL(new Blob([clean], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = await loadSvgImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('当前浏览器不支持 Canvas');
    context.clearRect(0, 0, size, size);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, size, size);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((value) => resolve(value), 'image/png');
    });
    if (!blob) throw new Error('PNG 生成失败');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function downloadPng(
  svg: string,
  baseName: string,
  size: number,
  index = 0,
): Promise<void> {
  const blob = await rasterizeSvg(svg, size);
  downloadBlob(blob, `${sanitizeBaseName(baseName, index)}.png`);
}

export async function buildExportZip(
  entries: ExportEntry[],
  options: ExportOptions,
  onProgress?: (completed: number, total: number) => void,
): Promise<Blob> {
  if (!options.svg && !options.png) throw new Error('请至少选择一种导出格式');
  const zip = new JSZip();
  const uniqueNames = uniqueBaseNames(entries.map((entry) => entry.baseName));
  const both = options.svg && options.png;
  const totalSteps = entries.length * ((options.svg ? 1 : 0) + (options.png ? 1 : 0));
  let completed = 0;

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const baseName = uniqueNames[index];
    if (!entry || !baseName) continue;
    if (options.svg) {
      const clean = sanitizeSvg(entry.svg);
      const path = both ? `svg/${baseName}.svg` : `${baseName}.svg`;
      zip.file(path, clean);
      completed += 1;
      onProgress?.(completed, totalSteps);
    }
    if (options.png) {
      const png = await rasterizeSvg(entry.svg, options.pngSize);
      const path = both ? `png/${baseName}.png` : `${baseName}.png`;
      zip.file(path, png);
      completed += 1;
      onProgress?.(completed, totalSteps);
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
  }

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

export async function exportAll(
  entries: ExportEntry[],
  options: ExportOptions,
  onProgress?: (completed: number, total: number) => void,
): Promise<void> {
  if (entries.length === 0) throw new Error('没有可导出的图标');
  if (!options.svg && !options.png) throw new Error('请至少选择一种导出格式');

  if (entries.length === 1 && options.svg !== options.png) {
    const entry = entries[0];
    if (!entry) throw new Error('没有可导出的图标');
    if (options.svg) downloadSvg(entry.svg, entry.baseName);
    if (options.png) await downloadPng(entry.svg, entry.baseName, options.pngSize);
    return;
  }

  const zipBlob = await buildExportZip(entries, options, onProgress);
  downloadBlob(zipBlob, `aiicon-export-${timestamp()}.zip`);
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}
