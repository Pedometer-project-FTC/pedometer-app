import { createLogger } from '@/core/logger';
import { registerStepSyncTaskAsync } from '@/background/step-sync-task';
import { pruneOldRoutesAsync } from '@/background/location-task';
import { configureNotifications, ensureNotificationChannelAsync } from '@/sync/notifications';
import { syncSteps } from '@/sync/step-sync';

/**
 * バックグラウンド機能の入口。
 *
 * このファイルを import した時点で、各タスクの defineTask がトップレベルで
 * 実行される (import 副作用)。OS がバックグラウンドで JS を起こしたときに
 * タスクが「定義済み」でないと実行できないため、
 * app/_layout.tsx の先頭で必ず import すること。
 *
 * 下の import 文はどれも「モジュールを読み込むこと自体」に意味がある。
 * step-sync-task / location-task を読み込んだ時点で defineTask が走るので、
 * 使っていないように見えても消さないこと。
 */

const log = createLogger('background');

// 通知ハンドラもトップレベルで設定しておく (バックグラウンド起動時にも必要)
configureNotifications();

let bootstrapped = false;

/**
 * アプリ起動時に一度だけ呼ぶ初期化。
 *
 * ・定期同期タスクを登録する
 * ・通知チャンネルを用意する
 * ・起動直後に一度同期する (アプリを閉じている間に歩いたぶんを取り込む)
 *
 * どれか失敗しても他は続行する。ここで例外を投げると起動できなくなるため。
 */
export async function bootstrapBackgroundAsync(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;

  await ensureNotificationChannelAsync();
  await registerStepSyncTaskAsync();

  // 起動時同期。ここを待たずに UI を出したいので、呼び出し側は await しなくてよい。
  syncSteps({ trigger: 'launch' }).catch((error) => {
    log.error('起動時同期に失敗', error);
  });

  pruneOldRoutesAsync().catch(() => {
    /* 掃除の失敗は無視してよい */
  });
}

export { registerStepSyncTaskAsync, unregisterStepSyncTaskAsync, triggerStepSyncForTestingAsync } from '@/background/step-sync-task';
export { startRouteTrackingAsync, stopRouteTrackingAsync, isRouteTrackingAsync } from '@/background/location-task';
export { TASK_NAMES } from '@/background/task-names';
