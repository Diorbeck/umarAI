/**
 * Схема БД. Миграция выполняется на старте (idempotent: IF NOT EXISTS).
 * PostgreSQL — источник истины по статусам; Markdown — человекочитаемый журнал.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sessions (
  chat_id     BIGINT PRIMARY KEY,
  mode        TEXT NOT NULL DEFAULT 'CHAT',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id          BIGSERIAL PRIMARY KEY,
  chat_id     BIGINT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages (chat_id, id DESC);

CREATE TABLE IF NOT EXISTS tasks (
  id          BIGSERIAL PRIMARY KEY,
  agent       TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  priority    TEXT NOT NULL DEFAULT 'P2' CHECK (priority IN ('P0','P1','P2','P3')),
  status      TEXT NOT NULL DEFAULT 'TODO' CHECK (status IN
    ('TODO','IN_PROGRESS','BLOCKED','READY_FOR_QA','CHANGES_REQUIRED','APPROVED','REJECTED','DONE')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS decisions (
  id              BIGSERIAL PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  risks           TEXT NOT NULL DEFAULT '',
  proposed_action TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PROPOSED' CHECK (status IN
    ('PROPOSED','APPROVED','REJECTED','EXECUTING','COMPLETED','FAILED')),
  resolved_by     BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Защита от повторной обработки одного Telegram update
CREATE TABLE IF NOT EXISTS processed_updates (
  update_id    BIGINT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Глобальные флаги (пауза агентных задач и т.п.)
CREATE TABLE IF NOT EXISTS flags (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;
