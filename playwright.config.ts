import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke-набор daruz.uz — безопасные read-only проверки.
 * Данные не изменяются, формы не отправляются.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 10_000 },

  // Нестабильный тест повторяется один раз
  retries: 1,

  // Последовательный запуск: набор маленький, так проще читать отчёт
  workers: 1,

  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'https://daruz.uz',
    // Скриншот и trace — только при падении
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
    locale: 'ru-RU',
    viewport: { width: 1440, height: 900 },
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // В облачной среде Умара путь к Chromium задаётся переменной окружения;
        // локально оставьте пустым — Playwright возьмёт свой браузер.
        launchOptions: {
          executablePath: process.env.CHROMIUM_PATH || undefined,
          chromiumSandbox: false,
        },
      },
    },
  ],
});
