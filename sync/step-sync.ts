import { appConfig } from '@/config/app-config';
import { addDaysToKey, todayKey, type DayKey } from '@/core/datetime';
import { createLogger } from '@/core/logger';
import { getActiveUserId } from '@/auth/backend';
import { recordArrivals } from '@/db/arrival-repository';
import { getNumber, getValue, KV_KEYS, setNumber, setValue } from '@/db/kv-repository';
import { getProfile } from '@/db/profile-repository';
import { getDailySteps, getTotalSteps, upsertDailySteps } from '@/db/step-repository';
import { healthProvider } from '@/health/provider';
import { stepsToMeters } from '@/metrics/metrics';
import { computeJourneyProgress, stationsReachedBetween, type JourneyProgress, type StationArrival } from '@/railway/journey';
import { getLineOrDefault } from '@/railway/line-registry';
import { notifyArrivals } from '@/sync/notifications';
import { pushArrivals, pushSteps, type RemoteSyncOutcome } from '@/sync/remote-sync';

/**
 * 歩数同期の本体。
 *
 * この 1 関数が「アプリ起動時」「フォアグラウンド復帰時」「バックグラウンドタスク」
 * すべての入口から呼ばれる。処理の流れ:
 *
 *   1. OS のヘルスデータから、直近数日ぶんの日別歩数を読む
 *   2. 端末の SQLite に反映する (変化のあった日だけ未送信フラグを立てる)
 *   3. 全期間の合計歩数 → 距離 → 路線上の位置 を計算する
 *   4. 前回位置と比べて新しく到達した駅があれば記録し、通知を出す
 *   5. 未送信ぶんをサーバへ送る (サーバ未設定ならスキップ)
 *
 * 「アプリが閉じていても計測できる」のは 1 が担保している。
 * OS 側が常時歩数を記録しているので、こちらは後追いで読むだけでよい。
 */

const log = createLogger('sync/steps');

export type SyncSkipReason =
  | 'already-running'
  | 'health-unavailable'
  | 'permission-denied'
  | 'error';

export interface SyncOutcome {
  ok: boolean;
  reason?: SyncSkipReason;
  message?: string;
  at: string;
  userId: string;
  providerId: string;
  /** 値が変わった日。 */
  changedDays: DayKey[];
  todaySteps: number;
  totalSteps: number;
  totalDistanceM: number;
  progress: JourneyProgress | null;
  /** 今回はじめて到達した駅。 */
  newArrivals: StationArrival[];
  remote: RemoteSyncOutcome | null;
}

/** 同時実行の防止。前景と背景で同時に走ると二重集計こそ無いが無駄なので弾く。 */
let running: Promise<SyncOutcome> | null = null;

function skipped(reason: SyncSkipReason, userId: string, message?: string): SyncOutcome {
  return {
    ok: false,
    reason,
    message,
    at: new Date().toISOString(),
    userId,
    providerId: healthProvider.id,
    changedDays: [],
    todaySteps: 0,
    totalSteps: 0,
    totalDistanceM: 0,
    progress: null,
    newArrivals: [],
    remote: null,
  };
}

export interface SyncOptions {
  /** ログに残す呼び出し元 ('launch' | 'foreground' | 'background' | 'manual')。 */
  trigger?: string;
  /** 何日ぶん遡るか。既定は appConfig.syncLookbackDays。 */
  lookbackDays?: number;
}

/**
 * 同期を 1 回実行する。
 * 実行中に再度呼ばれた場合は、走っている方の結果を共有する。
 */
export function syncSteps(options: SyncOptions = {}): Promise<SyncOutcome> {
  if (running) {
    log.debug(`同期が実行中のため合流します (${options.trigger ?? 'unknown'})`);
    return running;
  }
  running = runSync(options).finally(() => {
    running = null;
  });
  return running;
}

async function runSync(options: SyncOptions): Promise<SyncOutcome> {
  const trigger = options.trigger ?? 'manual';
  const userId = await getActiveUserId();
  log.info(`同期開始 (${trigger}, user=${userId})`);

  try {
    const availability = await healthProvider.getAvailabilityAsync();
    if (availability !== 'available') {
      log.warn(`歩数ソースが使えません: ${availability}`);
      return skipped('health-unavailable', userId, availability);
    }

    if (!(await healthProvider.hasPermissionsAsync())) {
      log.warn('歩数の読み取り権限がありません');
      return skipped('permission-denied', userId);
    }

    // --- 1. ヘルスデータを読む -------------------------------------------------
    const lookback = Math.min(
      options.lookbackDays ?? appConfig.syncLookbackDays,
      healthProvider.maxLookbackDays,
    );
    const to = todayKey();
    const from = addDaysToKey(to, -Math.max(0, lookback - 1));
    const totals = await healthProvider.readDailyStepsAsync(from, to);

    // --- 2. 端末 DB に反映 -----------------------------------------------------
    const changedDays = await upsertDailySteps(userId, totals, healthProvider.id);

    // 最初に同期した日を覚えておく (「いつからの記録か」を UI に出せるように)
    const anchorKey = KV_KEYS.syncAnchorDay(userId);
    if ((await getValue(anchorKey)) === null) {
      await setValue(anchorKey, from);
    }

    // --- 3. 合計歩数 → 距離 → 路線上の位置 ------------------------------------
    const profile = await getProfile(userId);
    const line = getLineOrDefault(profile.lineId);
    const totalSteps = await getTotalSteps(userId);
    const totalDistanceM = stepsToMeters(totalSteps, profile);
    const progress = computeJourneyProgress(line, totalDistanceM);

    // --- 4. 新しく到達した駅 ---------------------------------------------------
    const distanceKey = KV_KEYS.lastTotalDistanceM(userId, line.id);
    const previousRaw = await getValue(distanceKey);
    // 初回同期では、それまでの履歴ぶんの駅が一気に「到達」になる。
    // 記録は残すが通知はしない (インストール直後に通知が連発するのを避ける)。
    const isFirstRun = previousRaw === null;
    const previousDistanceM = isFirstRun ? 0 : await getNumber(distanceKey, 0);

    const candidates = stationsReachedBetween(line, previousDistanceM, totalDistanceM);
    const newArrivals = await recordArrivals(userId, candidates);
    await setNumber(distanceKey, totalDistanceM);

    if (newArrivals.length > 0) {
      log.info(`新しく到達: ${newArrivals.map((a) => a.station.name).join(', ')}`);
      if (appConfig.notifyOnStationArrival && !isFirstRun) {
        await notifyArrivals(line, newArrivals);
      }
      await pushArrivals(userId, line.id, newArrivals);
    }

    // --- 5. サーバへ送る -------------------------------------------------------
    const remote = await pushSteps(userId, line.id);

    await setValue(KV_KEYS.lastSyncAt, new Date().toISOString());
    const todaySteps = await getDailySteps(userId, to);

    log.info(
      `同期完了 (${trigger}): 今日=${todaySteps}歩 累計=${totalSteps}歩 ` +
        `${line.name} ${progress.fromStation.name}→${progress.toStation.name} ` +
        `${Math.round(progress.segmentProgress * 100)}%`,
    );

    return {
      ok: true,
      at: new Date().toISOString(),
      userId,
      providerId: healthProvider.id,
      changedDays,
      todaySteps,
      totalSteps,
      totalDistanceM,
      progress,
      newArrivals,
      remote,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('同期に失敗', message);
    return skipped('error', userId, message);
  }
}

/** 前回同期からの経過秒。まだ一度も同期していなければ Infinity。 */
export async function secondsSinceLastSync(): Promise<number> {
  const raw = await getValue(KV_KEYS.lastSyncAt);
  if (!raw) return Number.POSITIVE_INFINITY;
  const at = Date.parse(raw);
  if (!Number.isFinite(at)) return Number.POSITIVE_INFINITY;
  return (Date.now() - at) / 1000;
}

/** 前回同期からある程度時間が経っていれば同期する (フォアグラウンド復帰時用)。 */
export async function syncIfStale(options: SyncOptions = {}): Promise<SyncOutcome | null> {
  const elapsed = await secondsSinceLastSync();
  if (elapsed < appConfig.foregroundSyncMinIntervalSeconds) return null;
  return syncSteps(options);
}
