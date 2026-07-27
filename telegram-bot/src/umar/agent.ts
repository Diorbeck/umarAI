import { query as agentQuery } from '@anthropic-ai/claude-agent-sdk';
import { logger } from '../logger.js';
import { buildSystemPrompt, type UmarMode } from './system-prompt.js';
import { ALLOWED_TOOLS, buildCanUseTool } from './permissions.js';
import { buildUmarMcpServer, type PendingDecision } from './tools.js';
import { historyToPrompt, loadHistory, saveMessage } from './session.js';

export interface UmarReply {
  text: string;
  pendingDecisions: PendingDecision[];
}

/**
 * Один ход Умара: история из БД → Claude Agent SDK → текст ответа + решения на подтверждение.
 * bypassPermissions НЕ используется; инструменты — только allowlist (permissions.ts).
 */
export async function askUmar(chatId: number, mode: UmarMode, userText: string): Promise<UmarReply> {
  const pendingDecisions: PendingDecision[] = [];
  const history = await loadHistory(chatId);
  const prompt = historyToPrompt(history, userText);

  await saveMessage(chatId, 'user', userText);

  let finalText = '';
  try {
    const stream = agentQuery({
      prompt,
      options: {
        systemPrompt: buildSystemPrompt(mode),
        mcpServers: { umar: buildUmarMcpServer(pendingDecisions) },
        allowedTools: [...ALLOWED_TOOLS],
        canUseTool: buildCanUseTool(),
        permissionMode: 'default',
        maxTurns: 8,
        settingSources: [],
      },
    });

    for await (const message of stream) {
      if (message.type === 'assistant') {
        for (const block of message.message.content) {
          if (block.type === 'text') finalText += block.text;
        }
      }
      if (message.type === 'result') {
        if (message.subtype === 'success' && message.result) {
          finalText = message.result;
        } else if (message.subtype !== 'success') {
          logger.warn({ subtype: message.subtype }, 'Agent SDK завершился с ошибкой');
        }
      }
    }
  } catch (err) {
    logger.error({ err }, 'Ошибка Claude Agent SDK');
    finalText =
      'Не удалось получить ответ от агентного ядра. Это проблема окружения или API, не вашего запроса. Попробуйте ещё раз через минуту.';
  }

  if (!finalText.trim()) {
    finalText = 'Ответ пуст. Повторите запрос или уточните формулировку.';
  }

  await saveMessage(chatId, 'assistant', finalText);
  return { text: finalText, pendingDecisions };
}
