import { toDayKey, type DayKey } from '@/core/datetime';
import { getDatabaseAsync } from '@/db/database';

/**
 * 歩いた経路 (地図に描く線) の保存。
 *
 * 位置情報の常時取得はバッテリーを食うので、この機能は既定では動かない。
 * 利用者が「地図に経路を残す」を明示的に有効にしたときだけ、
 * background/location-task.ts が座標を流し込んでくる。
 */

export interface RoutePoint {
  latitude: number;
  longitude: number;
  recordedAt: string;
  accuracyM: number | null;
}

export interface RoutePointInput {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracyM?: number | null;
}

export async function appendRoutePoints(
  userId: string,
  points: RoutePointInput[],
): Promise<number> {
  if (points.length === 0) return 0;
  const db = await getDatabaseAsync();
  let inserted = 0;

  await db.withTransactionAsync(async () => {
    for (const point of points) {
      const at = new Date(point.timestamp);
      await db.runAsync(
        `INSERT INTO route_points (user_id, day, recorded_at, lat, lng, accuracy_m)
         VALUES (?, ?, ?, ?, ?, ?)`,
        userId,
        toDayKey(at),
        at.toISOString(),
        point.latitude,
        point.longitude,
        point.accuracyM ?? null,
      );
      inserted += 1;
    }
  });

  return inserted;
}

/** その日の経路を時刻順で返す。地図の Polyline にそのまま渡せる形。 */
export async function getRouteForDay(userId: string, day: DayKey): Promise<RoutePoint[]> {
  const db = await getDatabaseAsync();
  const rows = await db.getAllAsync<{
    lat: number;
    lng: number;
    recorded_at: string;
    accuracy_m: number | null;
  }>(
    `SELECT lat, lng, recorded_at, accuracy_m FROM route_points
     WHERE user_id = ? AND day = ? ORDER BY recorded_at ASC`,
    userId,
    day,
  );
  return rows.map((r) => ({
    latitude: r.lat,
    longitude: r.lng,
    recordedAt: r.recorded_at,
    accuracyM: r.accuracy_m,
  }));
}

/** 古い経路を捨てる (既定は 30 日より前)。DB の肥大化を防ぐ。 */
export async function pruneRoutePoints(userId: string, keepDays = 30): Promise<void> {
  const db = await getDatabaseAsync();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - keepDays);
  await db.runAsync(
    'DELETE FROM route_points WHERE user_id = ? AND day < ?',
    userId,
    toDayKey(cutoff),
  );
}
