import { describe, expect, it } from 'vitest';
import { GenerateRequestSchema, ModelResponseSchema } from '../src/schemas';

const baseRequest = {
  content: '购物车',
  templateId: 'line',
  keywords: ['圆润', '极简'],
  primaryColor: null,
  backgroundColor: null,
  roundedRadiusPx: 96,
};

describe('request schemas', () => {
  it('accepts a valid generation request and infers the template enum', () => {
    const parsed = GenerateRequestSchema.parse(baseRequest);
    expect(parsed.templateId).toBe('line');
  });

  it('rejects unknown template ids', () => {
    expect(() =>
      GenerateRequestSchema.parse({ ...baseRequest, templateId: 'sketch' }),
    ).toThrow();
  });

  it('rejects oversized content and keywords', () => {
    expect(() =>
      GenerateRequestSchema.parse({ ...baseRequest, content: 'x'.repeat(201) }),
    ).toThrow();
    expect(() =>
      GenerateRequestSchema.parse({
        ...baseRequest,
        keywords: Array.from({ length: 9 }, (_, index) => `k${index}`),
      }),
    ).toThrow();
  });

  it('rejects invalid colors', () => {
    expect(() =>
      GenerateRequestSchema.parse({ ...baseRequest, primaryColor: 'red' }),
    ).toThrow();
  });

  it('accepts a strict model response', () => {
    const parsed = ModelResponseSchema.parse({
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M0 0" fill="#FFFFFF"/></svg>',
      palette: { primary: '#FFFFFF', background: null, supporting: [] },
      alt: '图标',
    });
    expect(parsed.alt).toBe('图标');
  });
});
