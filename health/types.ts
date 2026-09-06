import type { DayKey } from '@/core/datetime';

/**
 * 歩数ソースの抽象化。
 *
 * 「アプリを閉じていても歩数が取れる」ことを成立させるため、歩数はアプリ自身が
 * 数えるのではなく OS 側の健康データストアから読み出す方針にしている。
 *   - Android: Health Connect (端末/Google Fit 等が常時記録している)
 *   - iOS:     CMPedometer (expo-sensors の Pedometer。過去7日ぶん保持)
 * どちらも「アプリが起動していない間の歩数も、後からまとめて読める」ため、
 * 常駐サービスを持たずにバックグラウンド計測を実現できる。
 */

export type HealthAvailability =
  /** 使える。 */
  | 'available'
  /** Health Connect 本体の更新が必要 (Android)。 */
  | 'provider-update-required'
  /** 端末が対応していない / 未インストール。 */
  | 'unavailable'
  /** このプラットフォームでは未対応 (web など)。 */
  | 'unsupported-platform';

/** 1 日ぶんの歩数。 */
export interface DailyStepTotal {
  day: DayKey;
  steps: number;
}

export interface HealthProvider {
  readonly id: 'health-connect' | 'ios-pedometer' | 'unsupported';
  readonly label: string;
  /** このプロバイダが遡って読める最大日数。 */
  readonly maxLookbackDays: number;

  getAvailabilityAsync(): Promise<HealthAvailability>;
  hasPermissionsAsync(): Promise<boolean>;
  /** 権限ダイアログを出す。付与されたら true。 */
  requestPermissionsAsync(): Promise<boolean>;
  /**
   * from〜to (両端含む、ローカル暦日) の日別歩数。
   * データが無い日も 0 で埋めて、必ず全日ぶん返す。
   */
  readDailyStepsAsync(from: DayKey, to: DayKey): Promise<DailyStepTotal[]>;

  /** OS の健康データ設定を開く (対応していれば)。 */
  openSettings?(): void;
  /**
   * バックグラウンドでの読み取り権限を要求する (Android 15+ の Health Connect)。
   * 対応していないプラットフォームでは未定義。
   */
  requestBackgroundAccessAsync?(): Promise<boolean>;
}
