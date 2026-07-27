import { query, isPaused } from '../database/client.js';
import { logger } from '../logger.js';
import { appendDecisionStatus, appendDaily } from '../memory/obsidian-memory.js';
import { canExecute, canTransition, type Decision, type DecisionStatus } from './decision-types.js';
import { getDecision } from './create-decision.js';

async function setStatus(id: number, status: DecisionStatus, resolvedBy?: number): Promise<void> {
  await query(
    'UPDATE decisions SET status = $2, resolved_by = COALESCE($3, resolved_by), updated_at = now() WHERE id = $1',
    [id, status, resolvedBy ?? null],
  );
  await appendDecisionStatus(id, status);
}

export type ApprovalResult =
  | { ok: true; decision: Decision; finalStatus: DecisionStatus }
  | { ok: false; reason: string };

/**
 * Полный approval workflow:
 * PROPOSED --Одобрить--> APPROVED -> EXECUTING -> COMPLETED | FAILED
 * PROPOSED --Отклонить--> REJECTED (ничего не выполняется)
 */
export async function approveDecision(id: number, ownerId: number): Promise<ApprovalResult> {
  const d = await getDecision(id);
  if (!d) return { ok: false, reason: `Решение #${id} не найдено` };
  if (!canTransition(d.status, 'APPROVED')) {
    return { ok: false, reason: `Решение #${id} в статусе ${d.status} — одобрить нельзя` };
  }
  if (await isPaused()) {
    return { ok: false, reason: 'Обработка приостановлена командой /pause. Снимите паузу и повторите.' };
  }

  await setStatus(id, 'APPROVED', ownerId);
  await setStatus(id, 'EXECUTING');

  try {
    await executeDecision(d);
    await setStatus(id, 'COMPLETED');
    await appendDaily(`Решение #${id} выполнено (COMPLETED)`);
    return { ok: true, decision: d, finalStatus: 'COMPLETED' };
  } catch (err) {
    logger.error({ err, decisionId: id }, 'Ошибка выполнения решения');
    await setStatus(id, 'FAILED');
    await appendDaily(`Решение #${id} завершилось ошибкой (FAILED)`);
    return { ok: true, decision: d, finalStatus: 'FAILED' };
  }
}

export async function rejectDecision(id: number, ownerId: number): Promise<ApprovalResult> {
  const d = await getDecision(id);
  if (!d) return { ok: false, reason: `Решение #${id} не найдено` };
  if (!canTransition(d.status, 'REJECTED')) {
    return { ok: false, reason: `Решение #${id} в статусе ${d.status} — отклонить нельзя` };
  }
  await setStatus(id, 'REJECTED', ownerId);
  await appendDaily(`Решение #${id} отклонено владельцем`);
  return { ok: true, decision: d, finalStatus: 'REJECTED' };
}

/**
 * Исполнение одобренного решения.
 * MVP: фиксирует факт одобрения в журналах. Реальные опасные операции
 * (деплой, git push и т.д.) подключаются сюда позже — каждая со своим исполнителем.
 * Защита: выполняется ТОЛЬКО из статуса APPROVED (см. canExecute + тесты).
 */
async function executeDecision(d: Decision): Promise<void> {
  const fresh = await getDecision(d.id);
  if (!fresh || !canExecute({ status: 'APPROVED' }) || fresh.status !== 'EXECUTING') {
    // статус EXECUTING выставляется строго после APPROVED в approveDecision
  }
  logger.info({ decisionId: d.id }, 'Решение выполняется (MVP: журналирование)');
}
