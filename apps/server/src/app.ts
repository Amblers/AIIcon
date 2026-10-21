import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import {
  ConfigTestSchema,
  ConfigUpdateSchema,
  GenerateRequestSchema,
  type ApiErrorCode,
} from '@aiicon/shared';
import { ZodError } from 'zod';
import { AppError, isAppError } from './errors';
import { ConfigVault } from './services/config-vault';
import { DeepSeekClient } from './services/deepseek';
import { GenerationService } from './services/generation-service';

export interface AppDependencies {
  vault: ConfigVault;
  deepseek?: DeepSeekClient;
  generation?: GenerationService;
  timeoutMs: number;
  webDist: string;
  logger?: boolean;
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    return ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

function apiErrorBody(code: ApiErrorCode, message: string, retryable: boolean, requestId: string, details?: string[]) {
  return {
    error: {
      code,
      message,
      retryable,
      requestId,
      ...(details?.length ? { details } : {}),
    },
  };
}

function sendError(
  reply: FastifyReply,
  request: FastifyRequest,
  error: AppError,
): FastifyReply {
  return reply.status(error.statusCode).send(
    apiErrorBody(error.code, error.message, error.retryable, request.id, error.details),
  );
}

async function registerStatic(app: FastifyInstance, webDist: string): Promise<void> {
  if (!existsSync(webDist)) return;
  await app.register(fastifyStatic, {
    root: webDist,
    prefix: '/',
    decorateReply: true,
    wildcard: false,
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.status(404).send(
        apiErrorBody('VALIDATION_ERROR', '接口不存在。', false, request.id),
      );
    }
    if (request.method === 'GET') {
      return reply.sendFile('index.html');
    }
    return reply.status(404).send({ error: { code: 'VALIDATION_ERROR', message: 'Not found' } });
  });
}

export async function createApp(dependencies: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    logger: dependencies.logger ?? false,
    bodyLimit: 64 * 1024,
    genReqId: () => randomUUID(),
    requestTimeout: 200_000,
  });

  const deepseek = dependencies.deepseek ?? new DeepSeekClient();
  const generation =
    dependencies.generation ??
    new GenerationService({
      vault: dependencies.vault,
      client: deepseek,
      timeoutMs: dependencies.timeoutMs,
    });

  app.addHook('onRequest', async (request, reply) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      if (!isAllowedOrigin(request.headers.origin)) {
        return reply.status(403).send(
          apiErrorBody('VALIDATION_ERROR', '拒绝跨站请求。', false, request.id),
        );
      }
    }
  });

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    );
    return payload;
  });

  app.get('/api/health', async () => ({
    ok: true,
    service: 'aiicon',
    version: '0.1.2',
  }));

  app.get('/api/config', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    return dependencies.vault.getStatus();
  });

  app.put('/api/config', async (request, reply) => {
    const body = ConfigUpdateSchema.safeParse(request.body);
    if (!body.success) {
      const message = body.error.issues[0]?.message ?? '配置内容不合法。';
      return reply.status(422).send(
        apiErrorBody('VALIDATION_ERROR', message, false, request.id),
      );
    }
    try {
      const status = await dependencies.vault.save(body.data);
      reply.header('Cache-Control', 'no-store');
      return status;
    } catch (error) {
      if (isAppError(error)) return sendError(reply, request, error);
      throw error;
    }
  });

  app.delete('/api/config/key', async (request, reply) => {
    try {
      const status = await dependencies.vault.clearKey();
      reply.header('Cache-Control', 'no-store');
      return status;
    } catch (error) {
      if (isAppError(error)) return sendError(reply, request, error);
      throw error;
    }
  });

  app.post('/api/config/test', async (request, reply) => {
    const body = ConfigTestSchema.safeParse(request.body);
    if (!body.success) {
      const message = body.error.issues[0]?.message ?? '测试参数不合法。';
      return reply.status(422).send(
        apiErrorBody('VALIDATION_ERROR', message, false, request.id),
      );
    }
    if (dependencies.vault.envKey && body.data.apiKey) {
      return reply.status(409).send(
        apiErrorBody(
          'CONFIG_ENV_READONLY',
          '当前 API Key 来自环境变量，无需在测试中重新填写。',
          false,
          request.id,
        ),
      );
    }
    const key = body.data.apiKey || (await dependencies.vault.getApiKey());
    if (!key) {
      return reply.status(400).send(
        apiErrorBody('CONFIG_MISSING', '请先配置 DeepSeek API Key。', false, request.id),
      );
    }
    const model = body.data.model || (await dependencies.vault.getModel());
    try {
      const result = await deepseek.testConnection({
        apiKey: key,
        baseUrl: dependencies.vault.baseUrl,
        model,
        timeoutMs: Math.min(dependencies.timeoutMs, 45_000),
      });
      return {
        ok: true,
        model: result.model,
        latencyMs: result.latencyMs,
      };
    } catch (error) {
      if (isAppError(error)) {
        return reply.status(200).send({
          ok: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }
      return reply.status(200).send({
        ok: false,
        error: {
          code: 'UPSTREAM_ERROR',
          message: '连接测试失败，请稍后重试。',
        },
      });
    }
  });

  app.post('/api/icons/generate', async (request, reply) => {
    const body = GenerateRequestSchema.safeParse(request.body);
    if (!body.success) {
      const message = body.error.issues[0]?.message ?? '生成参数不合法。';
      return reply.status(422).send(
        apiErrorBody('VALIDATION_ERROR', message, false, request.id),
      );
    }

    const controller = new AbortController();
    let finished = false;
    const onClose = () => {
      if (!finished && !reply.raw.writableEnded) controller.abort();
    };
    reply.raw.on('close', onClose);

    try {
      const result = await generation.generate(
        {
          ...body.data,
          templateId: body.data.templateId as typeof body.data.templateId,
        },
        request.id,
        controller.signal,
      );
      finished = true;
      reply.header('Cache-Control', 'no-store');
      return result;
    } catch (error) {
      finished = true;
      if (isAppError(error)) return sendError(reply, request, error);
      throw error;
    } finally {
      finished = true;
      reply.raw.off('close', onClose);
    }
  });

  await registerStatic(app, dependencies.webDist);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(422).send(
        apiErrorBody(
          'VALIDATION_ERROR',
          error.issues[0]?.message ?? '请求参数不合法。',
          false,
          request.id,
        ),
      );
    }
    if (isAppError(error)) return sendError(reply, request, error);
    request.log.error({ err: error, requestId: request.id }, 'Unhandled application error');
    return reply.status(500).send(
      apiErrorBody('INTERNAL_ERROR', '服务出现异常，请稍后重试。', true, request.id),
    );
  });

  return app;
}


