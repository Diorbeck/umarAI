/**
 * Решения и их жизненный цикл.
 * Чистая state-machine — покрыта тестами (tests/approval.test.ts).
 */

export const DECISION_STATUSES = [
  'PROPOSED',
  'APPROVED',
  'REJECTED',
  'EXECUTING',
  'COMPLETED',
  'FAILED',
] as const;

export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export interface Decision {
  id: number;
  title: string;
  description: string;
  risks: string;
  proposed_action: string;
  status: DecisionStatus;
  resolved_by: number | null;
}

/** Разрешённые переходы статусов. Всё остальное — запрещено. */
const TRANSITIONS: Record<DecisionStatus, DecisionStatus[]> = {
  PROPOSED: ['APPROVED', 'REJECTED'],
  APPROVED: ['EXECUTING'],
  EXECUTING: ['COMPLETED', 'FAILED'],
  REJECTED: [],
  COMPLETED: [],
  FAILED: [],
};

export function canTransition(from: DecisionStatus, to: DecisionStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Выполнять действие можно ТОЛЬКО из статуса APPROVED (после кнопки владельца). */
export function canExecute(d: Pick<Decision, 'status'>): boolean {
  return d.status === 'APPROVED';
}

// --- Задачи агентам ---

export const TASK_STATUSES = [
  'TODO',
  'IN_PROGRESS',
  'BLOCKED',
  'READY_FOR_QA',
  'CHANGES_REQUIRED',
  'APPROVED',
  'REJECTED',
  'DONE',
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

/**
 * Правило QA Lead: исполнитель не может поставить DONE — только READY_FOR_QA.
 * DONE ставит только владелец/Умар после проверки (actor='qa').
 */
export function canSetTaskStatus(actor: 'agent' | 'qa', to: TaskStatus): boolean {
  if (!TASK_STATUSES.includes(to)) return false;
  if (actor === 'agent' && (to === 'DONE' || to === 'APPROVED')) return false;
  return true;
}
