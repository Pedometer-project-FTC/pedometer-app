/**
 * アプリ全体の設定値。
 *
 * サーバの URL などは `.env` の EXPO_PUBLIC_* から読む。
 * (EXPO_PUBLIC_ 接頭辞が付いた環境変数だけがクライアントのバンドルに埋め込まれる)
 *
 * API_BASE_URL が未設定のときは「ローカル専用モード」で動く。
 * つまりログインは端末内のスタブ実装になり、歩数はサーバへ送らず端末の
 * SQLite にだけ貯まる。サーバができたら .env に URL を足すだけで切り替わる。
 */

function readString(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export const appConfig = {
  /** 例: https://api.example.com  未設定ならローカル専用モード。 */
  apiBaseUrl: readString(process.env.EXPO_PUBLIC_API_BASE_URL),

  /** 起動時・バックグラウンド同期時に、過去何日ぶんを取り直すか。 */
  syncLookbackDays: 7,

  /** バックグラウンド同期の最短間隔 (分)。OS 側の下限が 15 分。 */
  backgroundSyncMinimumIntervalMinutes: 15,

  /** フォアグラウンド復帰時、前回同期からこの秒数以上経っていたら同期する。 */
  foregroundSyncMinIntervalSeconds: 60,

  /** 駅に到達したときにローカル通知を出すか。 */
  notifyOnStationArrival: true,

  /** 現在たどっている路線。将来は全国の路線から選べるようにする。 */
  defaultLineId: 'kyoto-tozai',
} as const;

/** サーバ連携が有効か (= API_BASE_URL が設定されているか)。 */
export function isRemoteEnabled(): boolean {
  return appConfig.apiBaseUrl !== null;
}
