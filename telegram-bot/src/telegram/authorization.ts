/**
 * Авторизация: только Telegram ID из TELEGRAM_ALLOWED_USER_IDS.
 * Чистые функции — покрыты тестами (tests/authorization.test.ts).
 */

export function isAllowedUser(userId: number | undefined, allowedIds: number[]): boolean {
  if (userId === undefined || userId === null) return false;
  if (!Number.isInteger(userId) || userId <= 0) return false;
  return allowedIds.includes(userId);
}

/**
 * Проверка секрета webhook: Telegram присылает его в заголовке
 * X-Telegram-Bot-Api-Secret-Token. Сравнение постоянной длины не требуется
 * для этого сценария, но избегаем утечки через тайминги простым способом.
 */
export function isValidWebhookSecret(
  headerValue: string | undefined,
  expectedSecret: string,
): boolean {
  if (!headerValue || !expectedSecret) return false;
  if (headerValue.length !== expectedSecret.length) return false;
  let diff = 0;
  for (let i = 0; i < expectedSecret.length; i++) {
    diff |= headerValue.charCodeAt(i) ^ expectedSecret.charCodeAt(i);
  }
  return diff === 0;
}
