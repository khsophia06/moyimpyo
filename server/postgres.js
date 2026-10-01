import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFileSync } from 'node:fs';

// Only the backend holds DATABASE_URL. Tables live outside Supabase's public API schema.
export function openPostgres(connectionString) {
  const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: true, ca: readFileSync(new URL('./supabase-ca.crt', import.meta.url), 'utf8') }, max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000 });
  const scope = new AsyncLocalStorage();
  const convert = sql => {
    let n = 0;
    let result = sql.replace(/\?/g, () => `$${++n}`);
    if (/INSERT OR IGNORE/i.test(result)) result = result.replace(/INSERT OR IGNORE/i, 'INSERT') + ' ON CONFLICT DO NOTHING';
    for (const table of ['users', 'sessions', 'meetings', 'participants', 'places', 'votes', 'removed_participants']) {
      result = result.replace(new RegExp(`\\b(FROM|JOIN|INTO|UPDATE)\\s+${table}\\b`, 'gi'), `$1 moimpyo.${table}`);
    }
    return result;
  };
  const query = async (sql, params) => {
    const result = await (scope.getStore() || pool).query(convert(sql), params);
    for (const row of result.rows) for (const key of ['n', 'count']) if (key in row) row[key] = Number(row[key]);
    return result;
  };
  return {
    kind: 'postgres',
    prepare(sql) {
      return {
        get: async (...params) => (await query(sql, params)).rows[0],
        all: async (...params) => (await query(sql, params)).rows,
        run: async (...params) => ({ changes: (await query(sql, params)).rowCount }),
      };
    },
    async transaction(fn) {
      if (scope.getStore()) return fn();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await scope.run(client, fn);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
    close: () => pool.end(),
  };
}
