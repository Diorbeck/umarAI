import { Router, type Request, type Response } from 'express';
import { Bot, webhookCallback } from 'grammy';
import { loadConfig } from '../config.js';
import { logger } from '../logger.js';
import { isValidWebhookSecret } from './authorization.js';
import { alreadyProcessed } from '../database/client.js';

/**
 * POST /telegram/webhook
 * Защита:
 * 1) заголовок X-Telegram-Bot-Api-Secret-Token должен совпасть с TELEGRAM_WEBHOOK_SECRET;
 * 2) update_id обрабатывается не более одного раза (processed_updates).
 */
export function buildWebhookRouter(bot: Bot): Router {
  const cfg = loadConfig();
  const router = Router();
  const handleUpdate = webhookCallback(bot, 'express');

  router.post('/telegram/webhook', async (req: Request, res: Response) => {
    const secret = req.header('X-Telegram-Bot-Api-Secret-Token');
    if (!isValidWebhookSecret(secret, cfg.TELEGRAM_WEBHOOK_SECRET)) {
      logger.warn('Webhook: неверный секрет');
      res.status(401).json({ ok: false });
      return;
    }

    const updateId: unknown = (req.body as { update_id?: unknown })?.update_id;
    if (typeof updateId === 'number') {
      try {
        if (await alreadyProcessed(updateId)) {
          logger.info({ updateId }, 'Повторный update — пропущен');
          res.status(200).json({ ok: true, duplicate: true });
          return;
        }
      } catch (err) {
        // При сбое дедупликации продолжаем: лучше редкий дубль, чем потерянное сообщение
        logger.error({ err }, 'Ошибка дедупликации update');
      }
    }

    try {
      await handleUpdate(req, res);
    } catch (err) {
      logger.error({ err }, 'Ошибка обработки webhook');
      if (!res.headersSent) res.status(200).json({ ok: true }); // Telegram не должен ретраить бесконечно
    }
  });

  return router;
}
