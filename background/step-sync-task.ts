import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { appConfig } from '@/config/app-config';
import { createLogger } from '@/core/logger';
import { TASK_NAMES } from '@/background/task-names';
import { syncSteps } from '@/sync/step-sync';

/**
 * 定期同期タスク。
 *
 * OS (Android: WorkManager / iOS: BGTaskScheduler) が空いているタイミングで
 * 呼んでくれる。最短 15 分間隔だが、実際の起動タイミングは OS が
 * バッテリー残量・充電状態・利用パターンから決めるので保証はされない。
 *
 * ここでやることは「ヘルスデータを読んで DB とサーバに反映する」だけ。
 * 歩数の計測そのものは OS 側が常時行っているので、このタスクが多少間引かれても
 * 歩数は失われない (次に起動したときにまとめて取り込まれる)。
 *
 * defineTask はモジュールのトップレベルで呼ぶ必要がある。
 * React のライフサイクル内では呼べない (バックグラウンド起動時は
 * ビューをマウントせずに JS だけが立ち上がるため)。
 */

const log = createLogger('background/step-sync');

TaskManager.defineTask(TASK_NAMES.stepSync, async () => {
  try {
    const outcome = await syncSteps({ trigger: 'background' });
    if (!outcome.ok) {
      log.warn(`同期できませんでした: ${outcome.reason}`);
      // 権限が無いなど、こちらでは解決できない理由での失敗は Success を返す。
      // Failed を返し続けると OS がタスクの実行頻度を落としてしまうため。
      return BackgroundTask.BackgroundTaskResult.Success;
    }
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    log.error('タスクが例外で終了', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** 定期同期を有効にする。すでに登録済みなら何もしない。 */
export async function registerStepSyncTaskAsync(): Promise<boolean> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status === BackgroundTask.BackgroundTaskStatus.Restricted) {
      // 省電力モードや MDM の制限などで、OS がバックグラウンド実行を認めていない。
      // アプリを開いたときの同期だけで動作は継続できる。
      log.warn('OS がバックグラウンド実行を許可していません');
      return false;
    }

    if (await TaskManager.isTaskRegisteredAsync(TASK_NAMES.stepSync)) {
      log.debug('定期同期は登録済みです');
      return true;
    }

    await BackgroundTask.registerTaskAsync(TASK_NAMES.stepSync, {
      minimumInterval: appConfig.backgroundSyncMinimumIntervalMinutes,
    });
    log.info(`定期同期を登録しました (最短 ${appConfig.backgroundSyncMinimumIntervalMinutes} 分間隔)`);
    return true;
  } catch (error) {
    log.error('定期同期の登録に失敗', error);
    return false;
  }
}

export async function unregisterStepSyncTaskAsync(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(TASK_NAMES.stepSync)) {
      await BackgroundTask.unregisterTaskAsync(TASK_NAMES.stepSync);
      log.info('定期同期を解除しました');
    }
  } catch (error) {
    log.error('定期同期の解除に失敗', error);
  }
}

/**
 * 開発ビルドで、OS の都合を待たずにタスクを 1 回走らせる。
 * リリースビルドでは効かない。
 */
export async function triggerStepSyncForTestingAsync(): Promise<boolean> {
  try {
    return await BackgroundTask.triggerTaskWorkerForTestingAsync();
  } catch (error) {
    log.error('テスト実行に失敗', error);
    return false;
  }
}
