import { appendNote, frontmatter, today, writeNote } from './markdown-writer.js';

/**
 * Журналы в Markdown (Obsidian-совместимые):
 * decisions/  — решения
 * tasks/      — задания агентам
 * reviews/    — code review
 * lessons/    — уроки
 * daily/      — ежедневные итоги
 */

export async function logDecisionNote(d: {
  id: number;
  title: string;
  description: string;
  risks: string;
  proposedAction: string;
  status: string;
}): Promise<string> {
  const body =
    frontmatter({ id: d.id, type: 'decision', status: d.status, date: today() }) +
    `# Решение #${d.id}: ${d.title}\n\n` +
    `## Описание\n${d.description}\n\n` +
    `## Предлагаемое действие\n${d.proposedAction}\n\n` +
    `## Риски\n${d.risks || '—'}\n\n` +
    `## Статус\n${d.status}\n`;
  return writeNote(`decisions/${today()}-decision-${d.id}.md`, body);
}

export async function appendDecisionStatus(id: number, status: string, note = ''): Promise<void> {
  await appendNote(
    `decisions/${today()}-decision-${id}.md`,
    `\n> ${new Date().toISOString()} — статус: **${status}**${note ? ` — ${note}` : ''}\n`,
  );
}

export async function logTaskNote(t: {
  id: number;
  agent: string;
  title: string;
  body: string;
  priority: string;
  status: string;
}): Promise<string> {
  const body =
    frontmatter({ id: t.id, type: 'agent-task', agent: t.agent, priority: t.priority, status: t.status, date: today() }) +
    `# Задача #${t.id} для ${t.agent}: ${t.title}\n\n${t.body}\n\n## Статус\n${t.status}\n`;
  return writeNote(`tasks/${today()}-task-${t.id}.md`, body);
}

export async function logReviewNote(subject: string, verdict: string, details: string): Promise<string> {
  const slug = subject.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').slice(0, 40);
  const body =
    frontmatter({ type: 'code-review', verdict, date: today() }) +
    `# Code Review: ${subject}\n\n**Вердикт:** ${verdict}\n\n${details}\n`;
  return writeNote(`reviews/${today()}-review-${slug}.md`, body);
}

export async function logLesson(lesson: string): Promise<void> {
  await appendNote(`lessons/lessons.md`, `\n- ${today()}: ${lesson}\n`);
}

export async function appendDaily(line: string): Promise<void> {
  await appendNote(`daily/${today()}.md`, `- ${new Date().toISOString().slice(11, 16)} ${line}\n`);
}
