import { Bot, Context } from 'grammy';
import { loadConfig } from '../config.js';
import { logger } from '../logger.js';
import { isAllowedUser } from './authorization.js';
import { decisionKeyboard, parseDecisionCallback } from './keyboards.js';
import { askUmar } from '../umar/agent.js';
import { getMode, setMode } from '../umar/session.js';
import type { UmarMode } from '../umar/system-prompt.js';
import { setFlag, isPaused } from '../database/client.js';
import { approveDecision, rejectDecision } from '../decisions/approve-decision.js';
import { formatDecisionMessage, getDecision, listDecisions, escapeHtml } from '../decisions/create-decision.js';
import { listTasks, formatTaskList } from '../agents/task-manager.js';
import { agentListText } from '../agents/agent-registry.js';
import { appendDaily } from '../memory/obsidian-memory.js';
import { vaultPath } from '../memory/markdown-writer.js';

const TG_LIMIT = 4096;

/** Отправка длинного текста частями (лимит Telegram 4096). */
async function replyChunked(ctx: Context, text: string, extra: Parameters<Context['reply']>[1] = {}): Promise<void> {
  for (let i = 0; i < text.length; i += TG_LIMIT) {
    const chunk = text.slice(i, i + TG_LIMIT);
    // parse_mode только для последнего куска с кнопками не критичен; шлём как есть
    await ctx.reply(chunk, i + TG_LIMIT >= text.length ? extra : {});
  }
}

/** Обработка текста через агентное ядро + отправка решений с кнопками. */
async function handleWithUmar(ctx: Context, mode: UmarMode, text: string): Promise<void> {
  await ctx.replyWithChatAction('typing');
  const chatId = ctx.chat!.id;
  const reply = await askUmar(chatId, mode, text);
  await replyChunked(ctx, reply.text);
  for (const d of reply.pendingDecisions) {
    const full = await getDecision(d.id);
    if (full) {
      await ctx.reply(formatDecisionMessage(full), {
        parse_mode: 'HTML',
        reply_markup: decisionKeyboard(full.id),
      });
    }
  }
}

export function registerHandlers(bot: Bot): void {
  const cfg = loadConfig();

  // --- Авторизация для ВСЕХ апдейтов (правило безопасности №1) ---
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!isAllowedUser(userId, cfg.TELEGRAM_ALLOWED_USER_IDS)) {
      logger.warn({ userId }, 'Отклонён неавторизованный пользователь');
      return; // молчаливый отказ — не раскрываем существование бота
    }
    await next();
  });

  // --- Команды ---
  bot.command('start', async (ctx) => {
    await setMode(ctx.chat.id, 'CHAT');
    await ctx.reply(
      'Умар на связи. Режим: CHAT.\n\n' +
        'Команды:\n' +
        '/ask — вопрос Умару\n' +
        '/review — режим QA review (пришлите код или файл)\n' +
        '/task — постановка задачи агенту\n' +
        '/decision — предложить решение с кнопками\n' +
        '/status — статусы задач и решений\n' +
        '/memory — где лежит Markdown-память\n' +
        '/agents — список агентов\n' +
        '/pause — пауза/возобновление агентных задач',
    );
  });

  bot.command('ask', async (ctx) => {
    const text = ctx.match?.trim();
    await setMode(ctx.chat.id, 'CHAT');
    if (!text) return void (await ctx.reply('Использование: /ask <вопрос>'));
    await handleWithUmar(ctx, 'CHAT', text);
  });

  bot.command('review', async (ctx) => {
    await setMode(ctx.chat.id, 'QA_REVIEW');
    const text = ctx.match?.trim();
    if (text) return void (await handleWithUmar(ctx, 'QA_REVIEW', text));
    await ctx.reply('Режим QA_REVIEW включён. Пришлите код текстом или файлом (.ts/.js/.py/.md и т.п.).');
  });

  bot.command('task', async (ctx) => {
    await setMode(ctx.chat.id, 'COORDINATOR');
    const text = ctx.match?.trim();
    if (text) return void (await handleWithUmar(ctx, 'COORDINATOR', text));
    await ctx.reply('Режим COORDINATOR включён. Опишите, что нужно сделать и какому агенту (/agents — список).');
  });

  bot.command('decision', async (ctx) => {
    await setMode(ctx.chat.id, 'DECISION');
    const text = ctx.match?.trim();
    if (text) return void (await handleWithUmar(ctx, 'DECISION', text));
    await ctx.reply('Режим DECISION включён. Опишите действие — я оформлю решение с рисками и кнопками подтверждения.');
  });

  bot.command('status', async (ctx) => {
    const [tasks, decisions, paused] = await Promise.all([listTasks(), listDecisions(5), isPaused()]);
    const lines = [
      paused ? '⏸ Пауза агентных задач: ВКЛЮЧЕНА' : '▶️ Пауза: выключена',
      '',
      '<b>Задачи агентов:</b>',
      formatTaskList(tasks),
      '',
      '<b>Последние решения:</b>',
      decisions.length
        ? decisions.map((d) => `#${d.id} ${escapeHtml(d.title)} → <b>${d.status}</b>`).join('\n')
        : 'Решений нет.',
    ];
    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
  });

  bot.command('memory', async (ctx) => {
    await ctx.reply(
      'Markdown-память (Obsidian-совместимая) хранится в каталоге:\n' +
        `<code>${escapeHtml(vaultPath())}</code>\n\n` +
        'Структура: decisions/ tasks/ reviews/ lessons/ daily/',
      { parse_mode: 'HTML' },
    );
  });

  bot.command('agents', async (ctx) => {
    await ctx.reply(`Зарегистрированные агенты:\n${agentListText()}`, { parse_mode: 'HTML' });
  });

  bot.command('pause', async (ctx) => {
    const paused = await isPaused();
    await setFlag('paused', paused ? 'false' : 'true');
    await appendDaily(paused ? 'Пауза снята владельцем' : 'Пауза включена владельцем');
    await ctx.reply(
      paused
        ? '▶️ Пауза снята. Агентные задачи снова обрабатываются.'
        : '⏸ Пауза включена. Новые агентные задачи и одобрения решений заблокированы до повторного /pause.',
    );
  });

  // --- Файлы с кодом для review (текстовые, до 256 КБ) ---
  bot.on('message:document', async (ctx) => {
    const doc = ctx.message.document;
    const okExt = /\.(ts|tsx|js|jsx|py|md|txt|json|yaml|yml|sql|java|go|rb|php|css|html)$/i;
    if (!okExt.test(doc.file_name ?? '')) {
      return void (await ctx.reply('Для QA review принимаю текстовые файлы с кодом (.ts, .js, .py, .md и т.п.).'));
    }
    if ((doc.file_size ?? 0) > 256 * 1024) {
      return void (await ctx.reply('Файл больше 256 КБ. Пришлите фрагмент или diff.'));
    }
    try {
      const file = await ctx.getFile();
      const url = `https://api.telegram.org/file/bot${cfg.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Telegram file API: ${res.status}`);
      const content = await res.text();
      const caption = ctx.message.caption?.trim() ?? '';
      const mode = await getMode(ctx.chat.id);
      const prompt =
        `${caption ? caption + '\n\n' : ''}Файл ${doc.file_name} прислан на QA review:\n\n` +
        '```\n' + content.slice(0, 20_000) + '\n```' +
        (content.length > 20_000 ? '\n[файл обрезан до 20 000 символов]' : '');
      await handleWithUmar(ctx, mode === 'CHAT' ? 'QA_REVIEW' : mode, prompt);
    } catch (err) {
      logger.error({ err }, 'Ошибка загрузки файла из Telegram');
      await ctx.reply('Не удалось скачать файл из Telegram. Попробуйте ещё раз.');
    }
  });

  // --- Кнопки решений ---
  bot.on('callback_query:data', async (ctx) => {
    const cb = parseDecisionCallback(ctx.callbackQuery.data);
    if (!cb) return void (await ctx.answerCallbackQuery());
    const ownerId = ctx.from.id;

    if (cb.action === 'approve') {
      const result = await approveDecision(cb.decisionId, ownerId);
      await ctx.answerCallbackQuery({ text: result.ok ? `Статус: ${result.finalStatus}` : result.reason });
      await ctx.reply(
        result.ok
          ? `Решение #${cb.decisionId}: одобрено → ${result.finalStatus}.`
          : `Решение #${cb.decisionId}: ${result.reason}`,
      );
    } else if (cb.action === 'reject') {
      const result = await rejectDecision(cb.decisionId, ownerId);
      await ctx.answerCallbackQuery({ text: result.ok ? 'Отклонено' : result.reason });
      await ctx.reply(
        result.ok ? `Решение #${cb.decisionId} отклонено. Действие выполнено не будет.` : result.reason,
      );
    } else if (cb.action === 'details') {
      const d = await getDecision(cb.decisionId);
      await ctx.answerCallbackQuery();
      await ctx.reply(d ? formatDecisionMessage(d) : `Решение #${cb.decisionId} не найдено`, { parse_mode: 'HTML' });
    } else if (cb.action === 'modify') {
      await ctx.answerCallbackQuery();
      await ctx.reply(
        `Опишите, что изменить в решении #${cb.decisionId} — я подготовлю новую версию (старая останется PROPOSED, пока вы её не отклоните).`,
      );
    }
  });

  // --- Обычный текст: текущий режим сессии ---
  bot.on('message:text', async (ctx) => {
    const mode = await getMode(ctx.chat.id);
    await handleWithUmar(ctx, mode, ctx.message.text);
  });

  bot.catch((err) => {
    logger.error({ err: err.error }, 'Необработанная ошибка бота');
  });
}
