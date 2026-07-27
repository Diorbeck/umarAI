import pg from 'pg';
import { loadConfig } from '../config.js';
import { logger } from '../logger.js';
import { SCHEMA_SQL } from './schema.js';

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const cfg = loadConfig();
    pool = new pg.Pool({ connectionString: cfg.DATABASE_URL, max: 5 });
    pool.on('error', (err) => logger.error({ err }, 'Ошибка пула PostgreSQL'));
  }
  return pool;
}

export async function migrate(): Promise<void> {
  await getPool().query(SCHEMA_SQL);
  logger.info('Миграция БД выполнена');
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params);
}

/** Возвращает true, если update уже обрабатывался (защита от повторов). */
export async function alreadyProcessed(updateId: number): Promise<boolean> {
  const res = await query(
    'INSERT INTO processed_updates (update_id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING update_id',
    [updateId],
  );
  return res.rowCount === 0;
}

export async function setFlag(key: string, value: string): Promise<void> {
  await query(
    'INSERT INTO flags (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = $2',
    [key, value],
  );
}

export async function getFlag(key: string): Promise<string | null> {
  const res = await query<{ value: string }>('SELECT value FROM flags WHERE key = $1', [key]);
  return res.rows[0]?.value ?? null;
}

export async function isPaused(): Promise<boolean> {
  return (await getFlag('paused')) === 'true';
}

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = null;
}
