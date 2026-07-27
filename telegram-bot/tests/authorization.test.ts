import { describe, expect, it } from 'vitest';
import { isAllowedUser, isValidWebhookSecret } from '../src/telegram/authorization.js';

describe('Авторизация по Telegram ID', () => {
  const allowed = [123456789, 555];

  it('пропускает пользователя из allowlist', () => {
    expect(isAllowedUser(123456789, allowed)).toBe(true);
    expect(isAllowedUser(555, allowed)).toBe(true);
  });

  it('отклоняет чужой ID', () => {
    expect(isAllowedUser(999999, allowed)).toBe(false);
  });

  it('отклоняет отсутствующий/некорректный ID', () => {
    expect(isAllowedUser(undefined, allowed)).toBe(false);
    expect(isAllowedUser(0, allowed)).toBe(false);
    expect(isAllowedUser(-5, allowed)).toBe(false);
    expect(isAllowedUser(1.5, allowed)).toBe(false);
  });

  it('отклоняет всех при пустом allowlist', () => {
    expect(isAllowedUser(123, [])).toBe(false);
  });
});

describe('Секрет webhook', () => {
  const secret = 'super-secret-webhook-token-123';

  it('принимает точное совпадение', () => {
    expect(isValidWebhookSecret(secret, secret)).toBe(true);
  });

  it('отклоняет неверный секрет', () => {
    expect(isValidWebhookSecret('wrong-secret-webhook-token-12', secret)).toBe(false);
    expect(isValidWebhookSecret(secret + 'x', secret)).toBe(false);
  });

  it('отклоняет отсутствующий заголовок и пустой секрет', () => {
    expect(isValidWebhookSecret(undefined, secret)).toBe(false);
    expect(isValidWebhookSecret('', secret)).toBe(false);
    expect(isValidWebhookSecret(secret, '')).toBe(false);
  });
});
