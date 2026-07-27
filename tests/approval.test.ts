import { describe, expect, it } from 'vitest';
import {
  canExecute,
  canSetTaskStatus,
  canTransition,
} from '../src/decisions/decision-types.js';
import { isDangerousAction } from '../src/umar/permissions.js';

describe('Approval workflow решений', () => {
  it('PROPOSED можно одобрить или отклонить', () => {
    expect(canTransition('PROPOSED', 'APPROVED')).toBe(true);
    expect(canTransition('PROPOSED', 'REJECTED')).toBe(true);
  });

  it('выполнение начинается только после APPROVED', () => {
    expect(canTransition('APPROVED', 'EXECUTING')).toBe(true);
    expect(canTransition('PROPOSED', 'EXECUTING')).toBe(false);
    expect(canTransition('REJECTED', 'EXECUTING')).toBe(false);
  });

  it('EXECUTING завершается COMPLETED или FAILED', () => {
    expect(canTransition('EXECUTING', 'COMPLETED')).toBe(true);
    expect(canTransition('EXECUTING', 'FAILED')).toBe(true);
  });

  it('терминальные статусы не меняются', () => {
    expect(canTransition('REJECTED', 'APPROVED')).toBe(false);
    expect(canTransition('COMPLETED', 'EXECUTING')).toBe(false);
    expect(canTransition('FAILED', 'EXECUTING')).toBe(false);
  });

  it('нельзя перепрыгнуть из PROPOSED сразу в COMPLETED', () => {
    expect(canTransition('PROPOSED', 'COMPLETED')).toBe(false);
  });

  it('canExecute: только APPROVED', () => {
    expect(canExecute({ status: 'APPROVED' })).toBe(true);
    expect(canExecute({ status: 'PROPOSED' })).toBe(false);
    expect(canExecute({ status: 'REJECTED' })).toBe(false);
  });
});

describe('Статусы задач агентов', () => {
  it('исполнитель не может поставить DONE или APPROVED', () => {
    expect(canSetTaskStatus('agent', 'DONE')).toBe(false);
    expect(canSetTaskStatus('agent', 'APPROVED')).toBe(false);
  });

  it('исполнитель может поставить READY_FOR_QA и рабочие статусы', () => {
    expect(canSetTaskStatus('agent', 'READY_FOR_QA')).toBe(true);
    expect(canSetTaskStatus('agent', 'IN_PROGRESS')).toBe(true);
    expect(canSetTaskStatus('agent', 'BLOCKED')).toBe(true);
  });

  it('QA может поставить DONE после проверки', () => {
    expect(canSetTaskStatus('qa', 'DONE')).toBe(true);
    expect(canSetTaskStatus('qa', 'CHANGES_REQUIRED')).toBe(true);
  });
});

describe('Детектор опасных действий (→ решение PROPOSED)', () => {
  it('распознаёт git push/merge, деплой, удаление данных, секреты', () => {
    expect(isDangerousAction('выполнить git push в main')).toBe(true);
    expect(isDangerousAction('git merge feature-branch')).toBe(true);
    expect(isDangerousAction('запустить production deploy')).toBe(true);
    expect(isDangerousAction('удалить данные из таблицы users')).toBe(true);
    expect(isDangerousAction('передать API key подрядчику')).toBe(true);
  });

  it('не срабатывает на безопасные действия', () => {
    expect(isDangerousAction('прочитать файл README')).toBe(false);
    expect(isDangerousAction('создать задачу для developer')).toBe(false);
    expect(isDangerousAction('показать список задач')).toBe(false);
  });
});
