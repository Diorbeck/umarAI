import { pino } from 'pino';

/**
 * Логгер с вырезанием секретов.
 * Правило безопасности №2: секреты не попадают ни в сообщения, ни в логи.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'token',
      '*.token',
      'authorization',
      '*.authorization',
      'apiKey',
      '*.apiKey',
      'ANTHROPIC_API_KEY',
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_WEBHOOK_SECRET',
      'DATABASE_URL',
      'req.headers["x-telegram-bot-api-secret-token"]',
    ],
    censor: '[REDACTED]',
  },
});
