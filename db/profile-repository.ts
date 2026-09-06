import { appConfig } from '@/config/app-config';
import { getDatabaseAsync } from '@/db/database';
import { DEFAULT_METRICS_PROFILE, type MetricsProfile } from '@/metrics/metrics';

/**
 * 計算に使うプロフィール (身長・体重・歩幅・単価) と、たどっている路線。
 * 未設定なら既定値を返すので、呼び出し側は null チェックをしなくてよい。
 */

export interface UserProfile extends MetricsProfile {
  /** 今たどっている路線 ID。 */
  lineId: string;
}

export const DEFAULT_USER_PROFILE: UserProfile = {
  ...DEFAULT_METRICS_PROFILE,
  lineId: appConfig.defaultLineId,
};

export async function getProfile(userId: string): Promise<UserProfile> {
  const db = await getDatabaseAsync();
  const row = await db.getFirstAsync<{
    height_cm: number;
    weight_kg: number;
    stride_m: number | null;
    cost_per_km: number;
    line_id: string;
  }>(
    'SELECT height_cm, weight_kg, stride_m, cost_per_km, line_id FROM profiles WHERE user_id = ?',
    userId,
  );

  if (!row) return DEFAULT_USER_PROFILE;

  return {
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    strideM: row.stride_m,
    costPerKm: row.cost_per_km,
    lineId: row.line_id,
  };
}

/** 部分更新。渡さなかった項目は現状維持。 */
export async function saveProfile(
  userId: string,
  patch: Partial<UserProfile>,
): Promise<UserProfile> {
  const current = await getProfile(userId);
  const next: UserProfile = { ...current, ...patch };
  const db = await getDatabaseAsync();

  await db.runAsync(
    `INSERT INTO profiles (user_id, height_cm, weight_kg, stride_m, cost_per_km, line_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       height_cm = excluded.height_cm,
       weight_kg = excluded.weight_kg,
       stride_m = excluded.stride_m,
       cost_per_km = excluded.cost_per_km,
       line_id = excluded.line_id,
       updated_at = excluded.updated_at`,
    userId,
    next.heightCm,
    next.weightKg,
    next.strideM ?? null,
    next.costPerKm,
    next.lineId,
    new Date().toISOString(),
  );

  return next;
}
