/**
 * Реестр известных ИИ-агентов команды.
 * MVP: агенты-заглушки; реальные исполнители подключаются позже.
 */

export interface RegisteredAgent {
  name: string;
  role: string;
  description: string;
}

export const AGENT_REGISTRY: RegisteredAgent[] = [
  {
    name: 'developer',
    role: 'Агент-разработчик',
    description: 'Исправляет баги и реализует задачи по заданию Умара. Возвращает diff, тесты, ограничения.',
  },
  {
    name: 'security',
    role: 'Security Agent',
    description: 'Проверяет гипотезы безопасности без разрушающих действий, возвращает уровень риска.',
  },
  {
    name: 'requirements',
    role: 'Агент по требованиям',
    description: 'Уточняет ожидаемое поведение, когда требования неоднозначны.',
  },
];

export function findAgent(name: string): RegisteredAgent | undefined {
  return AGENT_REGISTRY.find((a) => a.name === name.toLowerCase());
}

export function agentListText(): string {
  return AGENT_REGISTRY.map((a) => `• <b>${a.name}</b> — ${a.role}: ${a.description}`).join('\n');
}
