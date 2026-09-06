import type { DayKey } from '@/core/datetime';
import { getDatabaseAsync, GUEST_USER_ID } from '@/db/database';
import type { DailyStepTotal } from '@/health/types';

/**
 * 日別歩数テーブルの読み書き。
 * 歩数の「正」はここ。ヘルスデータもサーバも、最終的にこのテーブルへ集約する。
 */

export interface DailyStepRow extends DailyStepTotal {
  source: string;
  updatedAt: string;
  syncedAt: string | null;
}

/**
 * ヘルスデータから読んだ日別歩数を書き込む。
 *
 * ヘルスデータ側は後からレコードが追加・訂正されるので、常に上書きしてよい。
 * ただし値が変わっていない行は synced_at を潰さない (無駄な再送を防ぐため)。
 * 戻り値は「実際に値が変わった日」の一覧。
 */
export async function upsertDailySteps(
  userId: string,
  totals: DailyStepTotal[],
  source: string,
): Promise<DayKey[]> {
  if (totals.length === 0) return [];
  const db = await getDatabaseAsync();
  const now = new Date().toISOString();
  const changed: DayKey[] = [];

  await db.withTransactionAsync(async () => {
    for (const { day, steps } of totals) {
      const existing = await db.getFirstAsync<{ steps: number }>(
        'SELECT steps FROM daily_steps WHERE user_id = ? AND day = ?',
        userId,
        day,
      );
      if (existing && existing.steps === steps) continue;

      await db.runAsync(
        `INSERT INTO daily_steps (user_id, day, steps, source, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?, NULL)
         ON CONFLICT(user_id, day) DO UPDATE SET
           steps = excluded.steps,
           source = excluded.source,
           updated_at = excluded.updated_at,
           synced_at = NULL`,
        userId,
        day,
        steps,
        source,
        now,
      );
      changed.push(day);
    }
  });

  return changed;
}

export async function getDailySteps(userId: string, day: DayKey): Promise<number> {
  const db = await getDatabaseAsync();
  const row = await db.getFirstAsync<{ steps: number }>(
    'SELECT steps FROM daily_steps WHERE user_id = ? AND day = ?',
    userId,
    day,
  );
  return row?.steps ?? 0;
}

export async function getDailyStepRange(
  userId: string,
  from: DayKey,
  to: DayKey,
): Promise<DailyStepRow[]> {
  const db = await getDatabaseAsync();
  const rows = await db.getAllAsync<{
    day: string;
    steps: number;
    source: string;
    updated_at: string;
    synced_at: string | null;
  }>(
    `SELECT day, steps, source, updated_at, synced_at FROM daily_steps
     WHERE user_id = ? AND day >= ? AND day <= ? ORDER BY day ASC`,
    userId,
    from,
    to,
  );
  return rows.map((r) => ({
    day: r.day,
    steps: r.steps,
    source: r.source,
    updatedAt: r.updated_at,
    syncedAt: r.synced_at,
  }));
}

/** 全期間の合計歩数。累計距離 から路線上の位置を出すのに使う。 */
export async function getTotalSteps(userId: string): Promise<number> {
  const db = await getDatabaseAsync();
  const row = await db.getFirstAsync<{ total: number | null }>(
    'SELECT SUM(steps) AS total FROM daily_steps WHERE user_id = ?',
    userId,
  );
  return row?.total ?? 0;
}

/** まだサーバへ送れていない日。 */
export async function getUnsyncedDays(userId: string, limit = 60): Promise<DailyStepRow[]> {
  const db = await getDatabaseAsync();
  const rows = await db.getAllAsync<{
    day: string;
    steps: number;
    source: string;
    updated_at: string;
  }>(
    `SELECT day, steps, source, updated_at FROM daily_steps
     WHERE user_id = ? AND synced_at IS NULL ORDER BY day ASC LIMIT ?`,
    userId,
    limit,
  );
  return rows.map((r) => ({
    day: r.day,
    steps: r.steps,
    source: r.source,
    updatedAt: r.updated_at,
    syncedAt: null,
  }));
}

export async function markDaysSynced(userId: string, days: DayKey[]): Promise<void> {
  if (days.length === 0) return;
  const db = await getDatabaseAsync();
  const now = new Date().toISOString();
  const placeholders = days.map(() => '?').join(', ');
  await db.runAsync(
    `UPDATE daily_steps SET synced_at = ? WHERE user_id = ? AND day IN (${placeholders})`,
    now,
    userId,
    ...days,
  );
}

/**
 * サーバから降ってきた歩数を取り込む (別端末で歩いたぶんなど)。
 * 端末側の値より大きいときだけ採用する。同じ日を複数端末で計測したとき、
 * 単純合算すると二重計上になるため「大きい方を採る」で寄せている。
 */
export async function mergeRemoteDailySteps(
  userId: string,
  totals: DailyStepTotal[],
): Promise<void> {
  if (totals.length === 0) return;
  const db = await getDatabaseAsync();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    for (const { day, steps } of totals) {
      await db.runAsync(
        `INSERT INTO daily_steps (user_id, day, steps, source, updated_at, synced_at)
         VALUES (?, ?, ?, 'remote', ?, ?)
         ON CONFLICT(user_id, day) DO UPDATE SET
           steps = MAX(daily_steps.steps, excluded.steps),
           updated_at = excluded.updated_at`,
        userId,
        day,
        steps,
        now,
        now,
      );
    }
  });
}

/**
 * ゲスト(未ログイン)で貯めたデータを、ログインしたアカウントへ引き継ぐ。
 * 同じ日が両方にある場合は大きい方を残す。
 */
export async function mergeGuestDataInto(userId: string): Promise<void> {
  if (userId === GUEST_USER_ID) return;
  const db = await getDatabaseAsync();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO daily_steps (user_id, day, steps, source, updated_at, synced_at)
       SELECT ?, day, steps, source, ?, NULL FROM daily_steps WHERE user_id = ?
       ON CONFLICT(user_id, day) DO UPDATE SET
         steps = MAX(daily_steps.steps, excluded.steps),
         updated_at = excluded.updated_at,
         synced_at = NULL`,
      userId,
      now,
      GUEST_USER_ID,
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO station_arrivals
         (user_id, line_id, station_id, lap, arrived_at, total_distance_m)
       SELECT ?, line_id, station_id, lap, arrived_at, total_distance_m
       FROM station_arrivals WHERE user_id = ?`,
      userId,
      GUEST_USER_ID,
    );
    await db.runAsync(
      'UPDATE route_points SET user_id = ? WHERE user_id = ?',
      userId,
      GUEST_USER_ID,
    );
    await db.runAsync('DELETE FROM daily_steps WHERE user_id = ?', GUEST_USER_ID);
    await db.runAsync('DELETE FROM station_arrivals WHERE user_id = ?', GUEST_USER_ID);
  });
}
