import { dayKeyRange, type DayKey } from '@/core/datetime';
import type { DailyStepTotal, HealthAvailability, HealthProvider } from '@/health/types';

/**
 * 既定 (web など、ネイティブの歩数ソースが無い環境) 用のプロバイダ。
 *
 * Metro は同名の .android.ts / .ios.ts を優先して解決するため、
 * 実機ではこのファイルは使われない。TypeScript の型解決の基準にもなっている。
 */

export const healthProvider: HealthProvider = {
  id: 'unsupported',
  label: '未対応',
  maxLookbackDays: 0,

  async getAvailabilityAsync(): Promise<HealthAvailability> {
    return 'unsupported-platform';
  },
  async hasPermissionsAsync() {
    return false;
  },
  async requestPermissionsAsync() {
    return false;
  },
  async readDailyStepsAsync(from: DayKey, to: DayKey): Promise<DailyStepTotal[]> {
    return dayKeyRange(from, to).map((day) => ({ day, steps: 0 }));
  },
};
