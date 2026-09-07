import { getDatabaseAsync } from '@/db/database';

/**
 * 汎用の key-value ストア。
 * 「最後に同期した時刻」「前回の累計距離」など、テーブルを起こすほどでもない状態を置く。
 */

export const KV_KEYS = {
  /** 最後に歩数同期が成功した時刻 (ISO)。 */
  lastSyncAt: 'sync:lastSyncAt',
  /** 直近の同期で算出した累計距離 (m)。駅到達の差分判定に使う。 */
  lastTotalDistanceM: (userId: string, lineId: string) =>
    `journey:${userId}:${lineId}:lastDistanceM`,
  /** 歩数の取り込みを開始した日 (これより前は遡らない)。 */
  syncAnchorDay: (userId: string) => `sync:${userId}:anchorDay`,
} as const;

export async function getValue(key: string): Promise<string | null> {
  const db = await getDatabaseAsync();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setValue(key: string, value: string): Promise<void> {
  const db = await getDatabaseAsync();
  await db.runAsync(
    `INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    key,
    value,
    new Date().toISOString(),
  );
}

export async function getNumber(key: string, fallback = 0): Promise<number> {
  const raw = await getValue(key);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function setNumber(key: string, value: number): Promise<void> {
  await setValue(key, String(value));
}

export async function deleteValue(key: string): Promise<void> {
  const db = await getDatabaseAsync();
  await db.runAsync('DELETE FROM kv WHERE key = ?', key);
}
