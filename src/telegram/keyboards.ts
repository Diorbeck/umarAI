import { InlineKeyboard } from 'grammy';

/** Кнопки решения: Одобрить / Отклонить / Изменить / Подробнее */
export function decisionKeyboard(decisionId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Одобрить', `decision:approve:${decisionId}`)
    .text('❌ Отклонить', `decision:reject:${decisionId}`)
    .row()
    .text('✏️ Изменить', `decision:modify:${decisionId}`)
    .text('ℹ️ Подробнее', `decision:details:${decisionId}`);
}

export type DecisionCallback = {
  action: 'approve' | 'reject' | 'modify' | 'details';
  decisionId: number;
};

export function parseDecisionCallback(data: string | undefined): DecisionCallback | null {
  if (!data) return null;
  const m = /^decision:(approve|reject|modify|details):(\d+)$/.exec(data);
  if (!m) return null;
  return { action: m[1] as DecisionCallback['action'], decisionId: Number(m[2]) };
}
