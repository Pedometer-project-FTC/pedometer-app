import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { createLogger } from '@/core/logger';
import { TASK_NAMES } from '@/background/task-names';
import { getActiveUserId } from '@/auth/backend';
import { appendRoutePoints, pruneRoutePoints } from '@/db/route-repository';

/**
 * 歩いた経路の記録 (地図に線を引くためのもの)。
 *
 * ⚠️ 既定では動かない。位置情報の常時取得はバッテリー消費が大きいので、
 *    利用者が明示的に有効にしたときだけ startRouteTrackingAsync() を呼ぶこと。
 *
 * 歩数計測とは独立している。位置情報を切っていても歩数は取れる
 * (歩数は OS のヘルスデータから読んでいるため)。
 *
 * 制約:
 *   - 利用者がアプリをスワイプで終了させると、Android では位置更新も止まる
 *   - Android では前面サービス通知が常時表示される (OS の要件)
 */

const log = createLogger('background/location');

TaskManager.defineTask(TASK_NAMES.locationTracking, async ({ data, error }) => {
  if (error) {
    log.error('位置情報タスクがエラーを受け取りました', error.message);
    return;
  }

  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  if (!locations || locations.length === 0) return;

  try {
    const userId = await getActiveUserId();
    const saved = await appendRoutePoints(
      userId,
      locations.map((l) => ({
        latitude: l.coords.latitude,
        longitude: l.coords.longitude,
        timestamp: l.timestamp,
        accuracyM: l.coords.accuracy ?? null,
      })),
    );
    log.debug(`経路を ${saved} 点追加しました`);
  } catch (taskError) {
    log.error('経路の保存に失敗', taskError);
  }
});

export type RouteTrackingStart =
  | { status: 'started' }
  | { status: 'already-running' }
  | { status: 'permission-denied'; which: 'foreground' | 'background' }
  | { status: 'error'; message: string };

/** 経路記録を開始する。前景・背景の両方の位置情報権限が要る。 */
export async function startRouteTrackingAsync(): Promise<RouteTrackingStart> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TASK_NAMES.locationTracking)) {
      return { status: 'already-running' };
    }

    // 背景権限は前景権限を取ってからでないと要求できない
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (!foreground.granted) return { status: 'permission-denied', which: 'foreground' };

    const background = await Location.requestBackgroundPermissionsAsync();
    if (!background.granted) return { status: 'permission-denied', which: 'background' };

    await Location.startLocationUpdatesAsync(TASK_NAMES.locationTracking, {
      accuracy: Location.Accuracy.Balanced,
      // 歩行経路が目的なので、20m 動くごとで十分。細かくすると電池を食う。
      distanceInterval: 20,
      // 更新をまとめて受け取り、起こされる回数を減らす
      deferredUpdatesDistance: 100,
      deferredUpdatesInterval: 60_000,
      pausesUpdatesAutomatically: true,
      foregroundService: {
        notificationTitle: '歩行経路を記録中',
        notificationBody: '地図に表示する経路を記録しています',
        notificationColor: '#8FBC72',
      },
    });

    log.info('経路記録を開始しました');
    return { status: 'started' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('経路記録を開始できませんでした', message);
    return { status: 'error', message };
  }
}

export async function stopRouteTrackingAsync(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TASK_NAMES.locationTracking)) {
      await Location.stopLocationUpdatesAsync(TASK_NAMES.locationTracking);
      log.info('経路記録を停止しました');
    }
  } catch (error) {
    log.error('経路記録の停止に失敗', error);
  }
}

export async function isRouteTrackingAsync(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(TASK_NAMES.locationTracking);
  } catch {
    return false;
  }
}

/** 古い経路を掃除する。起動時などに呼ぶ。 */
export async function pruneOldRoutesAsync(): Promise<void> {
  try {
    const userId = await getActiveUserId();
    await pruneRoutePoints(userId);
  } catch (error) {
    log.warn('古い経路の削除に失敗', error);
  }
}
