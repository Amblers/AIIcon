import { createApp } from './app';
import {
  getBaseUrl,
  getClientDistPath,
  getConfigDir,
  getDefaultModel,
  getEnvApiKey,
  getServerHost,
  getServerPort,
  getUpstreamTimeoutMs,
} from './env';
import { ConfigVault } from './services/config-vault';

async function main(): Promise<void> {
  const vault = new ConfigVault({
    dir: getConfigDir(),
    envKey: getEnvApiKey(),
    defaultModel: getDefaultModel(),
    baseUrl: getBaseUrl(),
  });

  const app = await createApp({
    vault,
    timeoutMs: getUpstreamTimeoutMs(),
    webDist: getClientDistPath(),
    logger: true,
  });

  const host = getServerHost();
  const port = getServerPort();

  try {
    await app.listen({ host, port });
    const status = await vault.getStatus();
    app.log.info(
      {
        configSource: status.source,
        model: status.model,
        keyConfigured: status.configured,
      },
      'AIicon API ready',
    );
    app.log.info(`Open http://${host}:${port} after running pnpm build, or use the Vite dev server.`);
  } catch (error) {
    app.log.error(error, 'Failed to start AIicon');
    process.exitCode = 1;
  }

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down');
    await app.close();
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

void main();
