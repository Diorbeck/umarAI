import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { createTask, listTasks, updateTaskStatus, formatTaskList } from '../agents/task-manager.js';
import { createDecision } from '../decisions/create-decision.js';
import { TASK_STATUSES } from '../decisions/decision-types.js';
import { logLesson, logReviewNote, appendDaily } from '../memory/obsidian-memory.js';
import { logger } from '../logger.js';

/**
 * MCP-инструменты Умара. Это ЕДИНСТВЕННЫЕ инструменты, доступные агенту
 * (см. permissions.ts). Никакого доступа к файловой системе, сети или shell.
 *
 * pendingDecisions — очередь решений, созданных за один ответ агента:
 * webhook-слой после ответа отправит их владельцу с кнопками.
 */
export interface PendingDecision {
  id: number;
  title: string;
}

export function buildUmarMcpServer(pendingDecisions: PendingDecision[]) {
  return createSdkMcpServer({
    name: 'umar',
    version: '1.0.0',
    tools: [
      tool(
        'create_task',
        'Создать структурированную задачу для другого ИИ-агента (developer/security/requirements).',
        {
          agent: z.string().describe('Имя агента: developer | security | requirements'),
          title: z.string().max(200).describe('Короткая цель задачи'),
          body: z
            .string()
            .describe(
              'Полное задание: цель, контекст, необходимо, не изменять, критерии готовности, вернуть в ответе',
            ),
          priority: z.enum(['P0', 'P1', 'P2', 'P3']).default('P2'),
        },
        async (args) => {
          try {
            const t = await createTask(args);
            return { content: [{ type: 'text', text: `Задача #${t.id} создана для ${t.agent} (статус TODO).` }] };
          } catch (e) {
            return { content: [{ type: 'text', text: `Ошибка: ${(e as Error).message}` }], isError: true };
          }
        },
      ),

      tool(
        'update_task_status',
        'Изменить статус задачи агента. Умар действует как QA: может ставить любой допустимый статус, включая DONE после проверки.',
        {
          task_id: z.number().int().positive(),
          status: z.enum(TASK_STATUSES),
        },
        async (args) => {
          try {
            const t = await updateTaskStatus(args.task_id, args.status, 'qa');
            return { content: [{ type: 'text', text: `Задача #${t.id} → ${t.status}` }] };
          } catch (e) {
            return { content: [{ type: 'text', text: `Ошибка: ${(e as Error).message}` }], isError: true };
          }
        },
      ),

      tool('list_tasks', 'Показать активные задачи агентов.', {}, async () => {
        const tasks = await listTasks();
        return { content: [{ type: 'text', text: formatTaskList(tasks).replace(/<\/?b>/g, '') }] };
      }),

      tool(
        'propose_decision',
        'Оформить ОПАСНОЕ или важное действие как решение PROPOSED. Действие НЕ выполняется — владелец получит кнопки Одобрить/Отклонить.',
        {
          title: z.string().max(200),
          description: z.string().describe('Что предлагается и почему'),
          risks: z.string().describe('Риски и план отката'),
          proposed_action: z.string().describe('Точное действие, которое будет выполнено после одобрения'),
        },
        async (args) => {
          try {
            const d = await createDecision({
              title: args.title,
              description: args.description,
              risks: args.risks,
              proposedAction: args.proposed_action,
            });
            pendingDecisions.push({ id: d.id, title: d.title });
            return {
              content: [
                { type: 'text', text: `Решение #${d.id} создано в статусе PROPOSED и отправлено владельцу на подтверждение.` },
              ],
            };
          } catch (e) {
            return { content: [{ type: 'text', text: `Ошибка: ${(e as Error).message}` }], isError: true };
          }
        },
      ),

      tool(
        'save_memory_note',
        'Сохранить запись в Markdown-память: урок, итог дня или результат code review.',
        {
          kind: z.enum(['lesson', 'daily', 'review']),
          subject: z.string().max(200).describe('Тема (для review — что проверялось)'),
          content: z.string(),
          verdict: z.string().optional().describe('Для review: APPROVED / CHANGES REQUIRED / ...'),
        },
        async (args) => {
          try {
            if (args.kind === 'lesson') await logLesson(`${args.subject}: ${args.content}`);
            else if (args.kind === 'daily') await appendDaily(`${args.subject}: ${args.content}`);
            else await logReviewNote(args.subject, args.verdict ?? 'N/A', args.content);
            return { content: [{ type: 'text', text: 'Записано в память.' }] };
          } catch (e) {
            logger.error({ err: e }, 'Ошибка записи памяти');
            return { content: [{ type: 'text', text: `Ошибка записи: ${(e as Error).message}` }], isError: true };
          }
        },
      ),
    ],
  });
}
