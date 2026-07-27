import express from 'express';
import { Bot } from 'grammy';
import { loadConfig } from './config.js';
import { logger } from './logger.js';
import { migrate, closePool } from './database/client.js';
import { registerHandlers } from './telegram/commands.js';
import { buildWebhookRouter } from './telegram/webhook.js';
import { mkdir } from 'node:fs/promises';

async function main(): Promise<void> {
  const cfg = loadConfig();

  await migrate();
  await mkdir(cfg.OBSIDIAN_VAULT_PATH, { recursive: true });

  // DEV_FAKE_BOT_INFO=true — только для локального смоук-теста без сети к Telegram
  // (в production игнорируется: identity всегда запрашивается у Telegram).
  const devStub = cfg.NODE_ENV !== 'production' && process.env.DEV_FAKE_BOT_INFO === 'true';
  const bot = new Bot(
    cfg.TELEGRAM_BOT_TOKEN,
    devStub
      ? {
          botInfo: {
            id: 1,
            is_bot: true,
            first_name: 'UmarDev',
            username: 'umar_dev_bot',
            can_join_groups: false,
            can_read_all_group_messages: false,
            supports_inline_queries: false,
            can_connect_to_business: false,
            has_main_web_app: false,
          } as unknown as import('grammy/types').UserFromGetMe,
        }
      : undefined,
  );
  registerHandlers(bot);
  if (!devStub) await bot.init(); // получаем identity бота без запуска polling

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true, service: 'umar-telegram-bot' });
  });

  app.use(buildWebhookRouter(bot));

  const server = app.listen(cfg.PORT, () => {
    logger.info({ port: cfg.PORT }, 'Умар-бот запущен (webhook mode)');
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Останавливаюсь…');
    server.close();
    await closePool();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  // Не выводим значения секретов — только сообщение об ошибке
  logger.error({ err: (err as Error).message }, 'Фатальная ошибка запуска');
  process.exit(1);
});
