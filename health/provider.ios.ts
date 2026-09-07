import { Pedometer } from 'expo-sensors';

import { dayKeyRange, endOfLocalDay, fromDayKey, type DayKey } from '@/core/datetime';
import { createLogger } from '@/core/logger';
import type { DailyStepTotal, HealthAvailability, HealthProvider } from '@/health/types';

/**
 * iOS 版: CMPedometer (expo-sensors の Pedometer) から歩数を読む。
 *
 * getStepCountAsync は iOS 限定 API で、CMPedometer が OS レベルで記録している
 * 履歴を読み出す。つまりアプリが起動していなかった時間帯の歩数も後から取れる。
 * ただし Apple の制約で「直近 7 日ぶん」しか保持されない。
 *
 * watchStepCount はバックグラウンドでは配信されないため、ここでは使わない。
 */

const log = createLogger('health/ios');

/** Apple が保持している歩数履歴は 7 日ぶんまで。 */
const MAX_LOOKBACK_DAYS = 7;

export const healthProvider: HealthProvider = {
  id: 'ios-pedometer',
  label: 'モーションとフィットネス',
  maxLookbackDays: MAX_LOOKBACK_DAYS,

  async getAvailabilityAsync(): Promise<HealthAvailability> {
    try {
      return (await Pedometer.isAvailableAsync()) ? 'available' : 'unavailable';
    } catch (error) {
      log.error('isAvailableAsync に失敗', error);
      return 'unavailable';
    }
  },

  async hasPermissionsAsync(): Promise<boolean> {
    try {
      const { granted } = await Pedometer.getPermissionsAsync();
      return granted;
    } catch (error) {
      log.error('getPermissionsAsync に失敗', error);
      return false;
    }
  },

  async requestPermissionsAsync(): Promise<boolean> {
    try {
      const { granted } = await Pedometer.requestPermissionsAsync();
      log.info(granted ? 'モーション権限を取得' : 'モーション権限を拒否された');
      return granted;
    } catch (error) {
      log.error('requestPermissionsAsync に失敗', error);
      return false;
    }
  },

  async readDailyStepsAsync(from: DayKey, to: DayKey): Promise<DailyStepTotal[]> {
    const days = dayKeyRange(from, to);
    if (days.length === 0) return [];

    // 1 日ずつ問い合わせる。7 日ぶんでも 7 回なので直列で十分。
    // 1 日でも失敗したら 0 として続行し、他の日の結果を巻き添えにしない。
    const results: DailyStepTotal[] = [];
    for (const day of days) {
      const start = fromDayKey(day);
      const end = endOfLocalDay(start);
      try {
        const { steps } = await Pedometer.getStepCountAsync(start, end);
        results.push({ day, steps: steps ?? 0 });
      } catch (error) {
        log.warn(`${day} の歩数取得に失敗`, error);
        results.push({ day, steps: 0 });
      }
    }
    return results;
  },
};
