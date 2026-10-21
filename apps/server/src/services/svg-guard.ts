import { SaxesParser, type SaxesTagPlain } from 'saxes';
import {
  CANVAS_SIZE,
  contrastRatio,
  getTemplate,
  isSameHueFamily,
  normalizeHex,
  type IconPalette,
  type TemplateId,
} from '@aiicon/shared';

const ALLOWED_ELEMENTS = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
]);

const COMMON_ATTRIBUTES = new Set([
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'fill-rule',
  'clip-rule',
  'transform',
]);

const ATTRIBUTES_BY_ELEMENT: Record<string, Set<string>> = {
  svg: new Set(['xmlns', 'viewBox', 'width', 'height']),
  g: COMMON_ATTRIBUTES,
  path: new Set([...COMMON_ATTRIBUTES, 'd']),
  rect: new Set([...COMMON_ATTRIBUTES, 'x', 'y', 'width', 'height', 'rx', 'ry']),
  circle: new Set([...COMMON_ATTRIBUTES, 'cx', 'cy', 'r']),
  ellipse: new Set([...COMMON_ATTRIBUTES, 'cx', 'cy', 'rx', 'ry']),
  line: new Set([...COMMON_ATTRIBUTES, 'x1', 'y1', 'x2', 'y2']),
  polyline: new Set([...COMMON_ATTRIBUTES, 'points']),
  polygon: new Set([...COMMON_ATTRIBUTES, 'points']),
};

const GEOMETRY_ATTRIBUTES = new Set([
  'x',
  'y',
  'width',
  'height',
  'rx',
  'ry',
  'cx',
  'cy',
  'r',
  'x1',
  'y1',
  'x2',
  'y2',
]);
const NUMBER_ATTRIBUTES = new Set([
  ...GEOMETRY_ATTRIBUTES,
  'stroke-width',
  'stroke-miterlimit',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
]);
const PAINTED_ELEMENTS = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);
const PATH_DATA = /^[MmZzLlHhVvCcSsQqTtAaEe0-9+\-.,\s]+$/;
const NUMBER = /^-?(?:\d+|\d*\.\d+)(?:e[+-]?\d+)?$/i;
const TRANSFORM = /^[a-zA-Z0-9(),.\s-]+$/;

interface SvgNode {
  tag: string;
  attrs: Record<string, string>;
  children: SvgNode[];
}

interface PaintedNode {
  node: SvgNode;
  fill: string;
  stroke: string;
  order: number;
}

export interface SvgGuardContext {
  templateId: TemplateId;
  primaryColor: string | null;
  backgroundColor: string | null;
  roundedRadiusPx: number;
}

export interface GuardedSvg {
  svg: string;
  palette: IconPalette;
  alt: string;
  warnings: string[];
}

export type SvgErrorKind = 'SVG_REJECTED' | 'COLOR_MISMATCH';

export class SvgGuardError extends Error {
  constructor(
    readonly code: SvgErrorKind,
    readonly details: string[],
  ) {
    super(details[0] || 'SVG validation failed');
    this.name = 'SvgGuardError';
  }
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function serializeNode(node: SvgNode): string {
  const attributes = Object.entries(node.attrs)
    .map(([key, value]) => `${key}="${escapeAttr(value)}"`)
    .join(' ');
  const open = `<${node.tag}${attributes ? ` ${attributes}` : ''}`;
  if (node.children.length === 0) return `${open}/>`;
  return `${open}>${node.children.map(serializeNode).join('')}</${node.tag}>`;
}

function serializeRoot(root: SvgNode): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}">${root.children
    .map(serializeNode)
    .join('')}</svg>`;
}

function normalizePaint(value: string): string | null {
  if (value === 'none' || value === 'transparent') return value;
  return normalizeHex(value);
}

function numeric(attrs: Record<string, string>, key: string, fallback = 0): number {
  const value = attrs[key];
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function validateViewBox(value: string | undefined): boolean {
  if (!value) return false;
  const parts = value
    .trim()
    .split(/[,\s]+/)
    .map(Number);
  return (
    parts.length === 4 &&
    parts.every((part) => Number.isFinite(part)) &&
    parts[0] === 0 &&
    parts[1] === 0 &&
    parts[2] === CANVAS_SIZE &&
    parts[3] === CANVAS_SIZE
  );
}

function normalizeAttributes(
  tag: string,
  rawAttributes: Record<string, string>,
  depth: number,
): { attrs: Record<string, string>; errors: string[] } {
  const attrs: Record<string, string> = {};
  const errors: string[] = [];
  const allowed = ATTRIBUTES_BY_ELEMENT[tag];
  if (!allowed) return { attrs, errors: [`不支持的 SVG 元素 <${tag}>`] };

  if (depth === 0) {
    for (const key of Object.keys(rawAttributes)) {
      if (!allowed.has(key)) errors.push(`根元素包含不允许的属性 ${key}`);
    }
    if (!validateViewBox(rawAttributes.viewBox)) {
      errors.push('根元素 viewBox 必须为 "0 0 512 512"');
    }
    return { attrs, errors };
  }

  for (const [key, rawValue] of Object.entries(rawAttributes)) {
    if (key.includes(':') || !allowed.has(key)) {
      errors.push(`<${tag}> 包含不允许的属性 ${key}`);
      continue;
    }
    const value = rawValue.trim();
    if (key === 'fill' || key === 'stroke') {
      const normalized = normalizePaint(value);
      if (!normalized) {
        errors.push(`<${tag}> 的 ${key} 颜色必须是 #RRGGBB、none 或 transparent`);
      } else {
        attrs[key] = normalized;
      }
      continue;
    }
    if (NUMBER_ATTRIBUTES.has(key)) {
      if (!NUMBER.test(value)) {
        errors.push(`<${tag}> 的 ${key} 必须是数字`);
        continue;
      }
      const numberValue = Number(value);
      if (!Number.isFinite(numberValue)) {
        errors.push(`<${tag}> 的 ${key} 数值超出范围`);
        continue;
      }
      if (GEOMETRY_ATTRIBUTES.has(key) && numberValue < 0) {
        errors.push(`<${tag}> 的 ${key} 不能为负数`);
        continue;
      }
      if ((key === 'opacity' || key === 'fill-opacity' || key === 'stroke-opacity') && (numberValue < 0 || numberValue > 1)) {
        errors.push(`<${tag}> 的 ${key} 必须在 0–1 之间`);
        continue;
      }
      if (key === 'stroke-width' && (numberValue < 0.5 || numberValue > 64)) {
        errors.push(`<${tag}> 的 stroke-width 必须在 0.5–64 之间`);
        continue;
      }
      attrs[key] = value;
      continue;
    }
    if (key === 'stroke-linecap') {
      if (!['butt', 'round', 'square'].includes(value)) {
        errors.push(`<${tag}> 的 stroke-linecap 不合法`);
      } else {
        attrs[key] = value;
      }
      continue;
    }
    if (key === 'stroke-linejoin') {
      if (!['arcs', 'bevel', 'miter', 'miter-clip', 'round'].includes(value)) {
        errors.push(`<${tag}> 的 stroke-linejoin 不合法`);
      } else {
        attrs[key] = value;
      }
      continue;
    }
    if (key === 'fill-rule' || key === 'clip-rule') {
      if (!['nonzero', 'evenodd'].includes(value)) {
        errors.push(`<${tag}> 的 ${key} 不合法`);
      } else {
        attrs[key] = value;
      }
      continue;
    }
    if (key === 'd') {
      if (!value || !PATH_DATA.test(value)) {
        errors.push('path 的 d 属性不合法');
      } else {
        attrs[key] = value.replace(/\s+/g, ' ').trim();
      }
      continue;
    }
    if (key === 'points') {
      if (!value || !/^[\d+\-.,\seE]+$/.test(value)) {
        errors.push(`${tag} 的 points 属性不合法`);
      } else {
        attrs[key] = value;
      }
      continue;
    }
    if (key === 'transform') {
      if (!value || !TRANSFORM.test(value)) {
        errors.push(`${tag} 的 transform 属性不合法`);
      } else {
        attrs[key] = value;
      }
      continue;
    }
    attrs[key] = value;
  }

  if (tag === 'path' && !attrs.d) errors.push('path 缺少 d 属性');
  if (tag === 'rect') {
    if (attrs.width === undefined || attrs.height === undefined) {
      errors.push('rect 必须包含 width 和 height');
    }
  }
  if (tag === 'circle' && attrs.r === undefined) errors.push('circle 缺少 r 属性');
  if (tag === 'ellipse' && (attrs.rx === undefined || attrs.ry === undefined)) {
    errors.push('ellipse 必须包含 rx 和 ry');
  }
  if (tag === 'line' && [attrs.x1, attrs.y1, attrs.x2, attrs.y2].some((value) => value === undefined)) {
    errors.push('line 必须包含 x1、y1、x2、y2');
  }

  return { attrs, errors };
}

function parseSvg(svg: string): { root: SvgNode; errors: string[] } {
  const errors: string[] = [];
  if (svg.length > 100_000) {
    throw new SvgGuardError('SVG_REJECTED', ['SVG 超过 100KB 限制']);
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(svg)) {
    throw new SvgGuardError('SVG_REJECTED', ['SVG 不允许包含 DOCTYPE 或自定义实体']);
  }

  const parser = new SaxesParser({ xmlns: false });
  const stack: SvgNode[] = [];
  let root: SvgNode | null = null;
  let parseError: string | null = null;
  let nodeCount = 0;

  parser.on('opentag', (tag: SaxesTagPlain) => {
    if (parseError) return;
    nodeCount += 1;
    if (nodeCount > 300) {
      parseError = 'SVG 节点数超过 300';
      return;
    }
    const tagName = tag.name.toLowerCase();
    if (!ALLOWED_ELEMENTS.has(tagName)) {
      parseError = `不支持的 SVG 元素 <${tag.name}>`;
      return;
    }
    if (stack.length === 0) {
      if (tagName !== 'svg') {
        parseError = '根元素必须是 <svg>';
        return;
      }
    } else if (tagName === 'svg') {
      parseError = 'SVG 只能有一个根元素';
      return;
    }
    const normalized = normalizeAttributes(
      tagName,
      tag.attributes as Record<string, string>,
      stack.length,
    );
    if (normalized.errors.length) {
      parseError = normalized.errors[0] ?? 'SVG 属性不合法';
      return;
    }
    const node: SvgNode = {
      tag: tagName,
      attrs: normalized.attrs,
      children: [],
    };
    if (stack.length > 0) {
      stack[stack.length - 1]?.children.push(node);
    } else {
      root = node;
    }
    stack.push(node);
  });

  parser.on('closetag', () => {
    stack.pop();
  });

  parser.on('text', (text: string) => {
    if (text.trim()) parseError ??= 'SVG 中不允许出现文本内容';
  });

  parser.on('cdata', (text: string) => {
    if (text.trim()) parseError ??= 'SVG 中不允许出现 CDATA 文本';
  });

  parser.on('doctype', () => {
    parseError ??= 'SVG 不允许 DOCTYPE';
  });

  parser.on('error', (error: Error) => {
    parseError ??= `SVG XML 解析失败：${error.message}`;
  });

  try {
    parser.write(svg).close();
  } catch (error) {
    parseError ??= `SVG XML 解析失败：${error instanceof Error ? error.message : '未知错误'}`;
  }

  if (parseError) errors.push(parseError);
  if (!root) errors.push('缺少 SVG 根元素');
  return { root: root ?? { tag: 'svg', attrs: {}, children: [] }, errors };
}

function walkPainted(
  node: SvgNode,
  inheritedFill: string,
  inheritedStroke: string,
  output: PaintedNode[],
): void {
  const fill = node.attrs.fill ?? inheritedFill;
  const stroke = node.attrs.stroke ?? inheritedStroke;
  if (PAINTED_ELEMENTS.has(node.tag)) {
    const visibleFill = fill !== 'none' && fill !== 'transparent' ? fill : 'none';
    const visibleStroke = stroke !== 'none' && stroke !== 'transparent' ? stroke : 'none';
    if (visibleFill !== 'none' || visibleStroke !== 'none') {
      output.push({ node, fill: visibleFill, stroke: visibleStroke, order: output.length });
    }
  }
  for (const child of node.children) {
    walkPainted(child, fill, stroke, output);
  }
}

function colorCounts(painted: PaintedNode[], exclude: Set<string> = new Set()): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of painted) {
    for (const color of [item.fill, item.stroke]) {
      if (color === 'none' || exclude.has(color)) continue;
      counts.set(color, (counts.get(color) ?? 0) + 1);
    }
  }
  return counts;
}

function mostFrequent(counts: Map<string, number>): string | null {
  let winner: string | null = null;
  let max = -1;
  for (const [color, count] of counts) {
    if (count > max) {
      winner = color;
      max = count;
    }
  }
  return winner;
}

function isFullCanvasShape(item: PaintedNode): boolean {
  const { node } = item;
  if (node.attrs.transform) return false;
  if (node.tag === 'rect') {
    return (
      numeric(node.attrs, 'x') <= 0.5 &&
      numeric(node.attrs, 'y') <= 0.5 &&
      numeric(node.attrs, 'width') >= CANVAS_SIZE - 0.5 &&
      numeric(node.attrs, 'height') >= CANVAS_SIZE - 0.5
    );
  }
  if (node.tag === 'circle') {
    return (
      Math.abs(numeric(node.attrs, 'cx') - CANVAS_SIZE / 2) <= 0.5 &&
      Math.abs(numeric(node.attrs, 'cy') - CANVAS_SIZE / 2) <= 0.5 &&
      numeric(node.attrs, 'r') >= CANVAS_SIZE / 2 - 0.5
    );
  }
  return false;
}

function hasNonFlatOpacity(node: SvgNode): boolean {
  return ['opacity', 'fill-opacity', 'stroke-opacity'].some((key) => {
    const value = node.attrs[key];
    return value !== undefined && value !== '1' && value !== '1.0';
  });
}

function allNodes(node: SvgNode): SvgNode[] {
  return [node, ...node.children.flatMap(allNodes)];
}

export function guardSvg(
  svg: string,
  palette: IconPalette,
  alt: string,
  context: SvgGuardContext,
): GuardedSvg {
  const template = getTemplate(context.templateId);
  const { root, errors } = parseSvg(svg);
  if (errors.length > 0) {
    throw new SvgGuardError('SVG_REJECTED', errors);
  }
  if (root.children.length === 0) {
    throw new SvgGuardError('SVG_REJECTED', ['SVG 中没有任何图形']);
  }

  const painted: PaintedNode[] = [];
  walkPainted(root, '#000000', 'none', painted);
  if (painted.length === 0) {
    throw new SvgGuardError('SVG_REJECTED', ['SVG 中没有可见图形']);
  }
  if (painted.length > 120) {
    throw new SvgGuardError('SVG_REJECTED', ['图形数量超过 120']);
  }

  const errorsOut: string[] = [];
  const warnings: string[] = [];
  const fullCanvasItems = painted.filter(isFullCanvasShape);
  const firstPainted = painted[0] ?? null;
  const firstFullCanvas = firstPainted && isFullCanvasShape(firstPainted) ? firstPainted : null;

  let background: string | null = null;
  if (template.supportsBackground) {
    if (!firstFullCanvas) {
      errorsOut.push('背景模板的第一个绘图元素必须是覆盖画布的底色形状');
    } else {
      const expected = context.backgroundColor ? normalizeHex(context.backgroundColor) : null;
      const actual = normalizePaint(firstFullCanvas.fill);
      if (!actual || actual === 'none' || actual === 'transparent') {
        errorsOut.push('背景形状必须使用纯色填充');
      } else if (expected && actual !== expected) {
        errorsOut.push(`背景色必须严格使用 ${expected}，当前为 ${actual}`);
      } else {
        background = actual;
      }

      if (template.id === 'circle-bg' && firstFullCanvas.node.tag !== 'circle') {
        errorsOut.push('圆底模板必须使用 circle 作为背景');
      }
      if (template.id === 'square-bg') {
        if (firstFullCanvas.node.tag !== 'rect') {
          errorsOut.push('方底模板必须使用 rect 作为背景');
        } else if (numeric(firstFullCanvas.node.attrs, 'rx') > 0.5) {
          errorsOut.push('方底模板的背景圆角必须为 0');
        }
      }
      if (template.id === 'rounded-bg') {
        if (firstFullCanvas.node.tag !== 'rect') {
          errorsOut.push('圆角方底模板必须使用 rect 作为背景');
        }
        const actualRadius = numeric(firstFullCanvas.node.attrs, 'rx');
        if (Math.abs(actualRadius - context.roundedRadiusPx) > 0.5) {
          errorsOut.push(
            `背景圆角必须等于 ${context.roundedRadiusPx}px，当前为 ${actualRadius}px`,
          );
        }
      }
    }
  } else if (fullCanvasItems.length > 0) {
    errorsOut.push('透明背景模板不允许绘制满版背景形状');
  }

  const backgroundSet = new Set(background ? [background] : []);
  const counts = colorCounts(painted, backgroundSet);
  const glyphColors = [...counts.keys()];
  if (glyphColors.length === 0) {
    errorsOut.push('图标主体缺少可见颜色');
  }

  const requestedPrimary = normalizeHex(context.primaryColor);
  let primary = requestedPrimary;
  if (!primary) {
    const stated = normalizeHex(palette.primary);
    if (stated && counts.has(stated)) {
      primary = stated;
    } else {
      primary = mostFrequent(counts);
      if (primary) warnings.push('已根据画布实际颜色校正 AI 色板主色');
    }
  }
  if (primary && !counts.has(primary)) {
    errorsOut.push(
      requestedPrimary
        ? `图标中必须实际使用用户指定的主色 ${requestedPrimary}`
        : '未能在图标中找到有效的主色',
    );
  }
  if (requestedPrimary) primary = requestedPrimary;

  if (template.supportsBackground) {
    if (!primary) {
      errorsOut.push('背景模板需要图标主色');
    } else if (background) {
      const actualBackground = background;
      if (primary === actualBackground) {
        errorsOut.push('图标主色不能与背景色完全相同');
      }
      if ((context.primaryColor === null || context.backgroundColor === null) && contrastRatio(primary, actualBackground) < 3) {
        errorsOut.push('自动规划的主色与背景色对比度不足 3:1');
      }
      const allowed = new Set([primary, actualBackground, '#FFFFFF']);
      for (const color of glyphColors) {
        if (!allowed.has(color)) {
          errorsOut.push(`背景模板只允许主色、背景色和白色辅助，发现额外颜色 ${color}`);
        }
      }
    }
  }

  if (template.id === 'line') {
    for (const item of painted) {
      if (item.fill !== 'none') {
        errorsOut.push('线性模板的图形必须使用 fill="none"，只能描边');
        break;
      }
      if (item.stroke === 'none') {
        errorsOut.push('线性模板的图形必须设置可见描边');
        break;
      }
    }
    if (glyphColors.length !== 1) {
      errorsOut.push('线性模板只能使用一种主色');
    }
  }

  if (template.id === 'solid') {
    for (const item of painted) {
      if (item.fill === 'none') {
        errorsOut.push('面性模板的图形必须使用填充');
        break;
      }
      if (item.stroke !== 'none') {
        errorsOut.push('面性模板不应使用描边');
        break;
      }
    }
    if (glyphColors.length > 3) {
      errorsOut.push('面性模板最多允许 3 个同色系色值');
    }
    if (primary) {
      for (const color of glyphColors) {
        if (color !== primary && !isSameHueFamily(primary, color)) {
          errorsOut.push(
            `面性模板的色值 ${color} 与主色 ${primary} 不属于同一色相，请只使用同色系明暗层`,
          );
          break;
        }
      }
    }
  }

  if (template.id === 'mono') {
    if (glyphColors.length !== 1) {
      errorsOut.push('单色模板只能出现一种颜色');
    }
    if (allNodes(root).some(hasNonFlatOpacity)) {
      errorsOut.push('单色模板不允许透明度层次');
    }
  }

  if (template.id === 'multicolor') {
    if (glyphColors.length < 2 || glyphColors.length > 3) {
      errorsOut.push('多色模板必须使用 2–3 种实际颜色');
    }
    if (allNodes(root).some(hasNonFlatOpacity)) {
      errorsOut.push('多色模板只允许扁平纯色，不允许透明度层次');
    }
  }

  if (template.supportsBackground && glyphColors.length > 2) {
    errorsOut.push('背景模板的图标主体最多允许主色加一种白色辅助');
  }

  let supporting: string[] = [];
  if (primary) {
    supporting = glyphColors.filter((color) => color !== primary);
    if (template.id !== 'multicolor' && template.supportsBackground) {
      const allowedWhite = supporting.filter((color) => color === '#FFFFFF');
      const unexpected = supporting.filter((color) => color !== '#FFFFFF');
      supporting = [...allowedWhite, ...unexpected].slice(0, 2);
    }
    if (template.id === 'line' || template.id === 'mono') {
      supporting = [];
    }
    if (supporting.length > 2) {
      errorsOut.push('辅助色不能超过 2 种');
    }
  }

  if (errorsOut.length > 0) {
    const colorOnly = errorsOut.every(
      (message) =>
        message.includes('颜色') ||
        message.includes('色') ||
        message.includes('对比度'),
    );
    throw new SvgGuardError(colorOnly ? 'COLOR_MISMATCH' : 'SVG_REJECTED', errorsOut);
  }

  const normalizedSvg = serializeRoot(root);
  if (normalizedSvg.length > 100_000) {
    throw new SvgGuardError('SVG_REJECTED', ['规范化后的 SVG 超过 100KB']);
  }

  return {
    svg: normalizedSvg,
    palette: {
      primary: primary ?? '#000000',
      background,
      supporting: [...new Set(supporting)].slice(0, 2),
    },
    alt: alt.trim(),
    warnings,
  };
}
