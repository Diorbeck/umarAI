import { query } from '../database/client.js';
import { logDecisionNote, appendDaily } from '../memory/obsidian-memory.js';
import type { Decision } from './decision-types.js';

export interface NewDecision {
  title: string;
  description: string;
  risks: string;
  proposedAction: string;
}

/** Создаёт решение в статусе PROPOSED + Markdown-запись. */
export async function createDecision(input: NewDecision): Promise<Decision> {
  const res = await query<Decision>(
    `INSERT INTO decisions (title, description, risks, proposed_action)
     VALUES ($1, $2, $3, $4)
     RETURNING id, title, description, risks, proposed_action, status, resolved_by`,
    [input.title, input.description, input.risks, input.proposedAction],
  );
  const d = res.rows[0];
  await logDecisionNote({
    id: d.id,
    title: d.title,
    description: d.description,
    risks: d.risks,
    proposedAction: d.proposed_action,
    status: d.status,
  });
  await appendDaily(`Решение #${d.id} предложено: ${d.title}`);
  return d;
}

export async function getDecision(id: number): Promise<Decision | null> {
  const res = await query<Decision>(
    'SELECT id, title, description, risks, proposed_action, status, resolved_by FROM decisions WHERE id = $1',
    [id],
  );
  return res.rows[0] ?? null;
}

export async function listDecisions(limit = 10): Promise<Decision[]> {
  const res = await query<Decision>(
    'SELECT id, title, description, risks, proposed_action, status, resolved_by FROM decisions ORDER BY id DESC LIMIT $1',
    [limit],
  );
  return res.rows;
}

export function formatDecisionMessage(d: Decision): string {
  return (
    `📋 <b>Решение #${d.id}: ${escapeHtml(d.title)}</b>\n` +
    `Статус: <b>${d.status}</b>\n\n` +
    `${escapeHtml(d.description)}\n\n` +
    `<b>Действие:</b> ${escapeHtml(d.proposed_action)}\n` +
    `<b>Риски:</b> ${escapeHtml(d.risks || '—')}`
  );
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
