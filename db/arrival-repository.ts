import { getDatabaseAsync } from '@/db/database';
import type { StationArrival } from '@/railway/journey';

/**
 * 駅への到達履歴。
 *
 * 「同じ駅の到達通知が何度も飛ぶ」のを防ぐのが主な役割。
 * バックグラウンド同期とフォアグラウンド同期が同時に走っても、
 * INSERT OR IGNORE + 主キー制約で二重記録にならないようにしてある。
 */

export interface ArrivalRow {
  lineId: string;
  stationId: string;
  lap: number;
  arrivedAt: string;
  totalDistanceM: number;
}

/**
 * 到達を記録する。まだ記録されていなかったものだけを返す。
 * 呼び出し側は「返ってきたぶんだけ通知を出す」ようにすればよい。
 */
export async function recordArrivals(
  userId: string,
  arrivals: StationArrival[],
): Promise<StationArrival[]> {
  if (arrivals.length === 0) return [];
  const db = await getDatabaseAsync();
  const now = new Date().toISOString();
  const fresh: StationArrival[] = [];

  await db.withTransactionAsync(async () => {
    for (const arrival of arrivals) {
      const lineId = arrival.station.id.split('/')[0];
      const result = await db.runAsync(
        `INSERT OR IGNORE INTO station_arrivals
           (user_id, line_id, station_id, lap, arrived_at, total_distance_m)
         VALUES (?, ?, ?, ?, ?, ?)`,
        userId,
        lineId,
        arrival.station.id,
        arrival.lap,
        now,
        arrival.atTotalDistanceM,
      );
      if (result.changes > 0) fresh.push(arrival);
    }
  });

  return fresh;
}

/** 到達済みの駅 ID の集合 (周回は問わない)。実績画面用。 */
export async function getReachedStationIds(userId: string, lineId: string): Promise<Set<string>> {
  const db = await getDatabaseAsync();
  const rows = await db.getAllAsync<{ station_id: string }>(
    'SELECT DISTINCT station_id FROM station_arrivals WHERE user_id = ? AND line_id = ?',
    userId,
    lineId,
  );
  return new Set(rows.map((r) => r.station_id));
}

/** 到達履歴を新しい順に取り出す。 */
export async function getArrivalHistory(
  userId: string,
  lineId: string,
  limit = 50,
): Promise<ArrivalRow[]> {
  const db = await getDatabaseAsync();
  const rows = await db.getAllAsync<{
    line_id: string;
    station_id: string;
    lap: number;
    arrived_at: string;
    total_distance_m: number;
  }>(
    `SELECT line_id, station_id, lap, arrived_at, total_distance_m
     FROM station_arrivals WHERE user_id = ? AND line_id = ?
     ORDER BY total_distance_m DESC LIMIT ?`,
    userId,
    lineId,
    limit,
  );
  return rows.map((r) => ({
    lineId: r.line_id,
    stationId: r.station_id,
    lap: r.lap,
    arrivedAt: r.arrived_at,
    totalDistanceM: r.total_distance_m,
  }));
}
