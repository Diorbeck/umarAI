# Умар — Telegram Bot (MVP)

Telegram-интерфейс QA Lead Умара: общение, QA review кода, координация ИИ-агентов,
решения с подтверждением кнопками. Node.js 22 + TypeScript + grammY + Claude Agent SDK + PostgreSQL.

## Возможности MVP

- Личные текстовые сообщения → ответ Умара на русском (Claude Agent SDK)
- История диалога в PostgreSQL, ограничение контекста (30 сообщений / 24 000 символов)
- Команды: `/start /ask /review /task /decision /status /memory /agents /pause`
- Приём текстовых файлов с кодом на QA review (до 256 КБ)
- Задачи агентам со статусами TODO…DONE (исполнитель не может ставить DONE — только READY_FOR_QA)
- Решения PROPOSED → APPROVED/REJECTED → EXECUTING → COMPLETED/FAILED с кнопками
  «Одобрить / Отклонить / Изменить / Подробнее»
- Markdown-журналы (Obsidian-совместимые) в `OBSIDIAN_VAULT_PATH`: decisions/ tasks/ reviews/ lessons/ daily/
- `/pause` — немедленная блокировка агентных задач и одобрений
- `GET /health`, `POST /telegram/webhook`

## Безопасность

- Доступ только для ID из `TELEGRAM_ALLOWED_USER_IDS` (чужим — молчаливый отказ)
- Проверка `X-Telegram-Bot-Api-Secret-Token` = `TELEGRAM_WEBHOOK_SECRET`
- Дедупликация `update_id` (таблица `processed_updates`)
- Секреты только в env; логи с redact-фильтром (pino)
- `bypassPermissions` не используется; агенту доступны только 5 MCP-инструментов
  (задачи/решения/память) — файловая система, shell и сеть недоступны
- Опасные действия (код, удаление данных, git push/merge, деплой, секреты, внешние контакты)
  выполняются только как решение после кнопки «Одобрить»

## Локальный запуск

```bash
cd telegram-bot
cp .env.example .env        # заполните значения
npm install
npm run dev                 # tsx watch
# в другом терминале, для локального теста webhook нужен туннель (например ngrok)
```

Тесты и сборка:

```bash
npm test        # vitest: авторизация + approval workflow
npm run build   # tsc → dist/
```

## Деплой на Railway (пошагово)

1. **Бот**: в Telegram у @BotFather → `/newbot` → получите `TELEGRAM_BOT_TOKEN`.
   Свой Telegram ID узнайте у @userinfobot.
2. **Проект**: Railway → New Project → Deploy from GitHub repo (папка `telegram-bot/`),
   Railway увидит `railway.json` + `Dockerfile`.
3. **PostgreSQL**: в проекте → New → Database → PostgreSQL. Railway создаст `DATABASE_URL` —
   добавьте его в переменные сервиса бота (Reference → Postgres.DATABASE_URL).
4. **Переменные** сервиса бота (Settings → Variables):
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_WEBHOOK_SECRET` — сгенерируйте: `openssl rand -hex 32`
   - `TELEGRAM_ALLOWED_USER_IDS` — ваш ID (можно несколько через запятую)
   - `ANTHROPIC_API_KEY`
   - `DATABASE_URL` — ссылка на Postgres
   - `OBSIDIAN_VAULT_PATH=/data/vault` (подключите Volume на `/data`, иначе память сотрётся при редеплое)
5. **Домен**: Settings → Networking → Generate Domain → получите `https://<app>.up.railway.app`.
   Healthcheck: откройте `https://<app>.up.railway.app/health` → `{"ok":true}`.
6. **Webhook**: один раз выполните (подставив свои значения):

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://<app>.up.railway.app/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>" \
  -d "allowed_updates=[\"message\",\"callback_query\"]"
```

7. Напишите боту `/start`. Проверка: `/status`, затем `/decision тестовое решение` → кнопки.

## Структура

```
src/
  index.ts                 — запуск: миграция БД, Express, /health, webhook
  config.ts                — env через zod (не стартует с кривой конфигурацией)
  logger.ts                — pino с вырезанием секретов
  telegram/                — webhook, авторизация, команды, кнопки
  umar/                    — Agent SDK: system prompt, права, MCP-инструменты, сессии
  decisions/               — типы, создание, approve/reject workflow
  agents/                  — реестр агентов, менеджер задач
  memory/                  — Markdown-журналы (Obsidian)
  database/                — pg-клиент и схема (5 таблиц)
tests/                     — vitest: авторизация, approval workflow, опасные действия
```

## Известные ограничения MVP

- Исполнение одобренного решения пока журналируется (реальные операции подключаются по одной, каждая со своим исполнителем и правами).
- Агенты developer/security/requirements — записи в реестре; реальные исполнители подключаются позже.
- Obsidian Headless Sync не подключён — память пишется в каталог `OBSIDIAN_VAULT_PATH`.
- Голосовые сообщения и Mini App — сознательно не реализованы.
