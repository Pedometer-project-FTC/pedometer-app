import {
  SdkAvailabilityStatus,
  aggregateGroupByPeriod,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  requestPermission,
} from 'react-native-health-connect';

import { dayKeyRange, endOfLocalDay, fromDayKey, toDayKey, type DayKey } from '@/core/datetime';
import { createLogger } from '@/core/logger';
import type { DailyStepTotal, HealthAvailability, HealthProvider } from '@/health/types';

/**
 * Android 版: Health Connect から歩数を読む。
 *
 * Health Connect は端末(Pixel なら Fitbit/ヘルスコネクト本体)が常時歩数を書き込んで
 * いるので、このアプリが起動していなくても歩数は溜まり続ける。
 * こちらは「後からまとめて読み出す」だけでよい ＝ 常駐サービス不要。
 *
 * 注意: minSdkVersion 26 以上が必要 (app.json の expo-build-properties で設定済み)。
 */

const log = createLogger('health/android');

/** initialize() は何度呼んでもよいが、無駄なので一度だけ走らせる。 */
let initPromise: Promise<boolean> | null = null;

function ensureInitialized(): Promise<boolean> {
  if (!initPromise) {
    initPromise = initialize().catch((error) => {
      log.error('initialize に失敗', error);
      // 失敗を握りっぱなしにすると次回以降ずっと初期化できないのでリセットする
      initPromise = null;
      return false;
    });
  }
  return initPromise;
}

async function ensureReady(): Promise<boolean> {
  const status = await getSdkStatus();
  if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
    log.warn('Health Connect が利用不可', status);
    return false;
  }
  return ensureInitialized();
}

export const healthProvider: HealthProvider = {
  id: 'health-connect',
  label: 'ヘルスコネクト',
  // ReadHealthDataHistory 権限なしで遡れるのは 30 日ぶん。
  maxLookbackDays: 30,

  async getAvailabilityAsync(): Promise<HealthAvailability> {
    try {
      const status = await getSdkStatus();
      if (status === SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
      if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
        return 'provider-update-required';
      }
      return 'unavailable';
    } catch (error) {
      log.error('getSdkStatus に失敗', error);
      return 'unavailable';
    }
  },

  async hasPermissionsAsync(): Promise<boolean> {
    if (!(await ensureReady())) return false;
    try {
      const granted = await getGrantedPermissions();
      return granted.some((p) => p.accessType === 'read' && p.recordType === 'Steps');
    } catch (error) {
      log.error('getGrantedPermissions に失敗', error);
      return false;
    }
  },

  async requestPermissionsAsync(): Promise<boolean> {
    if (!(await ensureReady())) return false;
    try {
      const granted = await requestPermission([{ accessType: 'read', recordType: 'Steps' }]);
      const ok = granted.some((p) => p.accessType === 'read' && p.recordType === 'Steps');
      log.info(ok ? '歩数の読み取り権限を取得' : '歩数の読み取り権限を拒否された');
      return ok;
    } catch (error) {
      log.error('requestPermission に失敗', error);
      return false;
    }
  },

  /**
   * Android 15 以降は、アプリがフォアグラウンドにいない間に読むために
   * 追加の権限が要る。取れなくても致命的ではない (次回起動時にまとめて読める)
   * ので、失敗しても false を返すだけにしておく。
   */
  async requestBackgroundAccessAsync(): Promise<boolean> {
    if (!(await ensureReady())) return false;
    try {
      const granted = await requestPermission([
        { accessType: 'read', recordType: 'BackgroundAccessPermission' },
      ]);
      const ok = granted.some((p) => p.recordType === 'BackgroundAccessPermission');
      log.info(ok ? 'バックグラウンド読み取り権限を取得' : 'バックグラウンド読み取り権限なし');
      return ok;
    } catch (error) {
      log.warn('バックグラウンド権限の要求に失敗', error);
      return false;
    }
  },

  async readDailyStepsAsync(from: DayKey, to: DayKey): Promise<DailyStepTotal[]> {
    const days = dayKeyRange(from, to);
    const empty = days.map((day) => ({ day, steps: 0 }));
    if (days.length === 0) return empty;
    if (!(await ensureReady())) return empty;

    // 期間は [from の 00:00, to の翌日 00:00) 。ライブラリ側は Instant.parse するので
    // タイムゾーン付きの ISO 文字列 (toISOString) を渡す必要がある。
    const startTime = fromDayKey(from).toISOString();
    // 「+24時間」ではなく暦日で翌日 00:00 を作る (夏時間のある地域でもずれないように)
    const endExclusive = endOfLocalDay(fromDayKey(days[days.length - 1])).toISOString();

    try {
      // 日単位で切って集計させる。端末のタイムゾーンで日境界が決まる。
      const groups = await aggregateGroupByPeriod({
        recordType: 'Steps',
        timeRangeFilter: { operator: 'between', startTime, endTime: endExclusive },
        timeRangeSlicer: { period: 'DAYS', length: 1 },
      });

      const byDay = new Map<DayKey, number>();
      for (const group of groups) {
        // startTime は LocalDateTime 相当で返る。Date に食わせるとローカル解釈になるので
        // そのまま暦日キーへ変換してよい。
        const day = toDayKey(new Date(group.startTime));
        byDay.set(day, (byDay.get(day) ?? 0) + (group.result.COUNT_TOTAL ?? 0));
      }

      return days.map((day) => ({ day, steps: byDay.get(day) ?? 0 }));
    } catch (error) {
      log.error('aggregateGroupByPeriod に失敗', error);
      return empty;
    }
  },

  openSettings() {
    openHealthConnectSettings();
  },
};
