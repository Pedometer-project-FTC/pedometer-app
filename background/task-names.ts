/**
 * バックグラウンドタスクの名前。
 *
 * この文字列は OS 側に永続化される (アプリを再インストールするまで残る) ので、
 * 一度リリースしたら変更しないこと。変えると古い登録が孤児になる。
 */
export const TASK_NAMES = {
  /** 定期的にヘルスデータを読んで同期する。 */
  stepSync: 'pedometer.step-sync',
  /** 歩行経路の記録 (任意機能)。 */
  locationTracking: 'pedometer.location-tracking',
} as const;
