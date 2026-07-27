/**
 * Права Умара в Telegram-боте.
 *
 * Принципы:
 * - bypassPermissions НЕ используется нигде;
 * - агенту доступны ТОЛЬКО наши MCP-инструменты (задачи/решения/память);
 * - опасные действия не выполняются напрямую — оформляются как Decision(PROPOSED)
 *   и ждут кнопку «Одобрить» от владельца.
 */

/** Инструменты, разрешённые агенту (никаких Bash/Write/WebFetch и т.п.). */
export const ALLOWED_TOOLS = [
  'mcp__umar__create_task',
  'mcp__umar__update_task_status',
  'mcp__umar__list_tasks',
  'mcp__umar__propose_decision',
  'mcp__umar__save_memory_note',
] as const;

/** Категории действий, требующие явного одобрения владельца. */
export const DANGEROUS_ACTION_PATTERNS: RegExp[] = [
  /изменени[ея] продуктового кода|change production code/i,
  /удал(ить|ение) данн|delete data|drop table/i,
  /git\s+(push|merge)/i,
  /production\s+deploy|деплой в production|прод[- ]?деплой/i,
  /секрет|token|api[-_ ]?key|password|пароль/i,
  /отправ(ить|ка) (письм|сообщени)[а-я]* внешн|contact external/i,
];

export function isDangerousAction(actionDescription: string): boolean {
  return DANGEROUS_ACTION_PATTERNS.some((re) => re.test(actionDescription));
}

/**
 * canUseTool для Agent SDK: deny всему, что не в allowlist.
 * Это вторая линия обороны после allowedTools.
 */
export function buildCanUseTool() {
  return async (toolName: string, input: Record<string, unknown>) => {
    if ((ALLOWED_TOOLS as readonly string[]).includes(toolName)) {
      return { behavior: 'allow' as const, updatedInput: input };
    }
    return {
      behavior: 'deny' as const,
      message: `Инструмент ${toolName} запрещён политикой telegram-бота. Разрешены только инструменты задач/решений/памяти.`,
    };
  };
}
