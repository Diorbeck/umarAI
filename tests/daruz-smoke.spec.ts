import { test, expect, Page } from '@playwright/test';

/**
 * Smoke-набор daruz.uz — 4 безопасных read-only теста.
 *
 * Правила набора:
 * - формы НЕ отправляются, данные НЕ изменяются;
 * - контактная модалка открывается, но звонков/сообщений нет;
 * - персональные данные в отчёт не выводятся (маскируются);
 * - локаторы: role / text / placeholder / data-slot, без длинных XPath.
 */

// Карточка объявления. ВАЖНО: карточки сейчас не <a> (см. BUG-007),
// поэтому используем атрибут data-slot="card" как самый устойчивый из доступных.
const cardLocator = (page: Page) =>
  page.locator('[data-slot="card"]').filter({ hasText: '$' });

// Сбор критических ошибок загрузки (JS-исключения страницы)
function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err?.message ?? err)));
  return errors;
}

test.describe('daruz.uz smoke', () => {
  test('1. Главная /ru: заголовок, форма поиска, без критических ошибок', async ({ page }) => {
    const errors = collectPageErrors(page);

    const response = await page.goto('/ru', { waitUntil: 'domcontentloaded' });
    expect(response, 'Сервер должен ответить').toBeTruthy();
    expect(response!.status(), 'Статус ответа < 400').toBeLessThan(400);

    // Основной заголовок
    await expect(
      page.getByRole('heading', { level: 1 }),
      'H1 главной должен отображаться',
    ).toBeVisible();

    // Форма поиска: поля «Тип объявления», «Тип недвижимости», адрес
    await expect(page.getByText('Тип объявления').first()).toBeVisible();
    await expect(page.getByText('Тип недвижимости').first()).toBeVisible();
    await expect(page.getByPlaceholder('Введите адрес').first()).toBeVisible();

    // Нет критических JS-ошибок при загрузке
    expect(errors, `JS-ошибки страницы: ${errors.join('; ')}`).toHaveLength(0);
  });

  test('2. Поиск /ru/search: фильтры, список, минимум одно объявление', async ({ page }) => {
    const response = await page.goto('/ru/search', { waitUntil: 'domcontentloaded' });
    expect(response!.status()).toBeLessThan(400);

    // Блок фильтров
    await expect(page.getByText('Фильтры').first()).toBeVisible();
    await expect(page.getByText('ID объявления').first()).toBeVisible();

    // Счётчик результатов (формулировка «результаты/результатов» — см. BUG-006)
    await expect(page.getByText(/\d+\s+результат/).first()).toBeVisible();

    // Минимум одна карточка объявления с ценой
    await expect(cardLocator(page).first()).toBeVisible({ timeout: 15_000 });
    expect(await cardLocator(page).count()).toBeGreaterThan(0);
  });

  test('3. Объявление: фото, цена, описание, контактная кнопка (без звонков)', async ({ page }) => {
    await page.goto('/ru/search', { waitUntil: 'domcontentloaded' });

    const firstCard = cardLocator(page).first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });

    // Карточка — div с onClick (BUG-007), открываем кликом
    await firstCard.click();
    await page.waitForURL(/\/announcements\//, { timeout: 15_000 });

    // Фото объявления
    await expect(
      page.locator('main img, [class*="carousel"] img').first(),
      'Должна отображаться хотя бы одна фотография',
    ).toBeVisible();

    // Цена в формате $ N или сумах
    await expect(page.getByText(/\$\s?[\d\s,.]+/).first()).toBeVisible();

    // Описание
    await expect(page.getByText('Описание недвижимости')).toBeVisible();

    // Контактная кнопка: открываем модалку, НО не звоним и не пишем
    await page.getByRole('button', { name: 'Контактная информация' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Контактная информация')).toBeVisible();

    // Проверяем, что телефон присутствует, НЕ выводя его в отчёт (маскировка ПД)
    const phoneVisible = await dialog
      .getByText(/\+998[\d\s()-]{7,}/)
      .first()
      .isVisible()
      .catch(() => false);
    expect(phoneVisible, 'В контактах должен быть телефон формата +998… (значение скрыто)').toBe(true);

    // Закрываем модалку без каких-либо действий
    await page.keyboard.press('Escape');
  });

  test('4. Локализация RU/UZ/EN: страницы открываются, есть заголовок', async ({ page }, testInfo) => {
    const locales = [
      { path: '/ru', name: 'RU' },
      { path: '/uz', name: 'UZ' },
      { path: '/en', name: 'EN' },
    ];
    const h1s: Record<string, string> = {};

    for (const { path, name } of locales) {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(response!.status(), `${name}: статус < 400`).toBeLessThan(400);

      const h1 = page.getByRole('heading', { level: 1 }).first();
      await expect(h1, `${name}: H1 должен отображаться`).toBeVisible();
      h1s[name] = (await h1.textContent())?.trim() ?? '';
      expect(h1s[name].length, `${name}: H1 не пустой`).toBeGreaterThan(0);
    }

    // Отсутствующие переводы — наблюдение, не падение теста
    const pairs: Array<[string, string]> = [
      ['RU', 'UZ'],
      ['RU', 'EN'],
      ['UZ', 'EN'],
    ];
    for (const [a, b] of pairs) {
      if (h1s[a] && h1s[a] === h1s[b]) {
        testInfo.annotations.push({
          type: 'observation',
          description: `Возможно отсутствует перевод: H1 совпадает для ${a} и ${b} («${h1s[a]}»)`,
        });
      }
    }

    // Известное наблюдение из аудита: html lang не соответствует локали (BUG-003)
    const lang = await page.evaluate(() => document.documentElement.lang);
    if (lang !== 'en') {
      testInfo.annotations.push({
        type: 'observation',
        description: `html lang="${lang}" — проверить соответствие локалям (в аудите v1 был "en" везде)`,
      });
    }
  });
});
