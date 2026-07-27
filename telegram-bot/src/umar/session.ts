import { query } from '../database/client.js';
import { loadConfig } from '../config.js';
import type { UmarMode } from './system-prompt.js';

export interface StoredMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function getMode(chatId: number): Promise<UmarMode> {
  const res = await query<{ mode: UmarMode }>('SELECT mode FROM sessions WHERE chat_id = $1', [chatId]);
  return res.rows[0]?.mode ?? 'CHAT';
}

export async function setMode(chatId: number, mode: UmarMode): Promise<void> {
  await query(
    `INSERT INTO sessions (chat_id, mode) VALUES ($1, $2)
     ON CONFLICT (chat_id) DO UPDATE SET mode = $2, updated_at = now()`,
    [chatId, mode],
  );
}

export async function saveMessage(chatId: number, role: StoredMessage['role'], content: string): Promise<void> {
  // Ограничиваем размер одного сообщения, чтобы не раздувать БД и контекст
  const trimmed = content.length > 16_000 ? `${content.slice(0, 16_000)}\n…[обрезано]` : content;
  await query('INSERT INTO messages (chat_id, role, content) VALUES ($1, $2, $3)', [chatId, role, trimmed]);
}

/**
 * История диалога с ограничением контекста:
 * не более CONTEXT_MAX_MESSAGES сообщений и CONTEXT_MAX_CHARS символов (с конца).
 */
export async function loadHistory(chatId: number): Promise<StoredMessage[]> {
  const cfg = loadConfig();
  const res = await query<StoredMessage>(
    'SELECT role, content FROM messages WHERE chat_id = $1 ORDER BY id DESC LIMIT $2',
    [chatId, cfg.CONTEXT_MAX_MESSAGES],
  );
  const recentFirst = res.rows;
  const selected: StoredMessage[] = [];
  let total = 0;
  for (const m of recentFirst) {
    total += m.content.length;
    if (total > cfg.CONTEXT_MAX_CHARS) break;
    selected.push(m);
  }
  return selected.reverse();
}

export function historyToPrompt(history: StoredMessage[], userText: string): string {
  const lines = history.map((m) => `${m.role === 'user' ? 'Владелец' : 'Умар'}: ${m.content}`);
  lines.push(`Владелец: ${userText}`);
  lines.push('Умар:');
  return `Контекст предыдущего диалога:\n${lines.join('\n\n')}`;
}
