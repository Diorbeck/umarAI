import { query, isPaused } from '../database/client.js';
import { canSetTaskStatus, type TaskStatus } from '../decisions/decision-types.js';
import { logTaskNote, appendDaily } from '../memory/obsidian-memory.js';
import { findAgent } from './agent-registry.js';

export interface AgentTask {
  id: number;
  agent: string;
  title: string;
  body: string;
  priority: string;
  status: TaskStatus;
}

export async function createTask(input: {
  agent: string;
  title: string;
  body: string;
  priority?: 'P0' | 'P1' | 'P2' | 'P3';
}): Promise<AgentTask> {
  if (await isPaused()) {
    throw new Error('Обработка агентных задач приостановлена (/pause).');
  }
  if (!findAgent(input.agent)) {
    throw new Error(`Неизвестный агент "${input.agent}". Список: /agents`);
  }
  const res = await query<AgentTask>(
    `INSERT INTO tasks (agent, title, body, priority)
     VALUES ($1, $2, $3, $4)
     RETURNING id, agent, title, body, priority, status`,
    [input.agent.toLowerCase(), input.title, input.body, input.priority ?? 'P2'],
  );
  const t = res.rows[0];
  await logTaskNote(t);
  await appendDaily(`Задача #${t.id} создана для ${t.agent}: ${t.title} [${t.priority}]`);
  return t;
}

export async function updateTaskStatus(
  id: number,
  to: TaskStatus,
  actor: 'agent' | 'qa',
): Promise<AgentTask> {
  if (!canSetTaskStatus(actor, to)) {
    throw new Error(
      actor === 'agent'
        ? `Исполнитель не может ставить статус ${to}. Максимум — READY_FOR_QA; DONE ставит QA после проверки.`
        : `Недопустимый статус ${to}`,
    );
  }
  const res = await query<AgentTask>(
    `UPDATE tasks SET status = $2, updated_at = now() WHERE id = $1
     RETURNING id, agent, title, body, priority, status`,
    [id, to],
  );
  if (res.rowCount === 0) throw new Error(`Задача #${id} не найдена`);
  const t = res.rows[0];
  await appendDaily(`Задача #${t.id} → ${t.status}`);
  return t;
}

export async function listTasks(limit = 15): Promise<AgentTask[]> {
  const res = await query<AgentTask>(
    `SELECT id, agent, title, body, priority, status FROM tasks
     WHERE status NOT IN ('DONE','REJECTED') ORDER BY id DESC LIMIT $1`,
    [limit],
  );
  return res.rows;
}

export function formatTaskList(tasks: AgentTask[]): string {
  if (tasks.length === 0) return 'Активных задач нет.';
  return tasks
    .map((t) => `#${t.id} [${t.priority}] ${t.agent} — ${t.title} → <b>${t.status}</b>`)
    .join('\n');
}
