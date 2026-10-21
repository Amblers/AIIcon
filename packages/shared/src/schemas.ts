import { z } from 'zod';
import {
  MAX_CONTENT_LENGTH,
  MAX_KEYWORDS,
  MAX_KEYWORD_LENGTH,
  MAX_KEYWORDS_TOTAL_LENGTH,
  MAX_ROUNDED_RADIUS,
  TEMPLATE_IDS,
  type TemplateId,
} from './types';

const templateIdSchema = z.enum(TEMPLATE_IDS as unknown as [TemplateId, ...TemplateId[]]);
const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const optionalApiKeySchema = z
  .string()
  .trim()
  .max(512)
  .refine((value) => value.length === 0 || value.length >= 8, {
    message: 'API Key 长度不正确',
  });

export const GenerateRequestSchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(1, '请填写图标内容')
      .max(MAX_CONTENT_LENGTH, `图标内容不能超过 ${MAX_CONTENT_LENGTH} 个字符`),
    templateId: templateIdSchema,
    keywords: z
      .array(z.string().trim().min(1).max(MAX_KEYWORD_LENGTH))
      .max(MAX_KEYWORDS)
      .refine(
        (keywords) => keywords.join('').length <= MAX_KEYWORDS_TOTAL_LENGTH,
        `关键词总长度不能超过 ${MAX_KEYWORDS_TOTAL_LENGTH} 个字符`,
      ),
    primaryColor: hexColorSchema.nullable(),
    backgroundColor: hexColorSchema.nullable(),
    roundedRadiusPx: z.number().int().min(0).max(MAX_ROUNDED_RADIUS),
  })
  .strict();

export const ConfigUpdateSchema = z
  .object({
    apiKey: optionalApiKeySchema.optional(),
    model: z.string().trim().min(1).max(80),
  })
  .strict();

export const ConfigTestSchema = z
  .object({
    apiKey: optionalApiKeySchema.optional(),
    model: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export const ModelResponseSchema = z
  .object({
    svg: z.string().min(40).max(100_000),
    palette: z
      .object({
        primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
        background: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable(),
        supporting: z.array(z.string().regex(/^#[0-9A-Fa-f]{6}$/)).max(2),
      })
      .strict(),
    alt: z.string().trim().max(120).optional().default(''),
  })
  .strict();

export type GenerateRequestInput = z.infer<typeof GenerateRequestSchema>;
export type ModelResponse = z.infer<typeof ModelResponseSchema>;
export type ConfigUpdateInput = z.infer<typeof ConfigUpdateSchema>;
export type ConfigTestInput = z.infer<typeof ConfigTestSchema>;
