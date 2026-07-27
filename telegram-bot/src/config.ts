import 'dotenv/config';
import { z } from 'zod';

/**
 * Конфигурация из переменных окружения.
 * Приложение НЕ стартует с невалидной конфигурацией.
 * Секреты нигде не логируются (см. logger.ts — redact).
 */
const EnvSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(20, 'TELEGRAM_BOT_TOKEN обязателен'),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(16, 'TELEGRAM_WEBHOOK_SECRET минимум 16 символов'),
  TELEGRAM_ALLOWED_USER_IDS: z
    .string()
    .min(1)
    .transform((s) =>
      s
        .split(',')
        .map((x) => Number(x.trim()))
        .filter((n) => Number.isInteger(n) && n > 0),
    )
    .refine((ids) => ids.length > 0, 'Нужен хотя бы один Telegram ID'),
  ANTHROPIC_API_KEY: z.string().min(10, 'ANTHROPIC_API_KEY обязателен'),
  DATABASE_URL: z.string().url().or(z.string().startsWith('postgres')),
  OBSIDIAN_VAULT_PATH: z.string().default('./vault'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CONTEXT_MAX_MESSAGES: z.coerce.number().int().positive().default(30),
  CONTEXT_MAX_CHARS: z.coerce.number().int().positive().default(24_000),
});

export type AppConfig = z.infer<typeof EnvSchema>;

let cached: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Показываем ТОЛЬКО имена невалидных переменных, не значения.
    const fields = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Некорректная конфигурация окружения: ${fields}`);
  }
  cached = parsed.data;
  return cached;
}
