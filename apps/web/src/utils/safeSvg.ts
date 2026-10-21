import DOMPurify from 'dompurify';

export function sanitizeSvg(svg: string): string {
  const clean = DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: false },
    FORBID_TAGS: ['script', 'style', 'foreignObject', 'image', 'use'],
    FORBID_ATTR: ['href', 'xlink:href', 'style'],
  });
  if (!clean.trim().startsWith('<svg')) {
    throw new Error('图标内容无法安全预览');
  }
  return clean;
}

