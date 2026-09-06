import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { createLogger } from '@/core/logger';
import type { StationArrival } from '@/railway/journey';
import type { RailwayLine } from '@/railway/types';

/**
 * 駅に到達したときのローカル通知。
 *
 * バックグラウンド同期で「新しく駅に着いた」と分かったときに出す。
 * リモートプッシュではなくローカル通知なので、サーバが無くても動く。
 */

const log = createLogger('notify');
const ANDROID_CHANNEL_ID = 'station-arrival';

/**
 * 通知ハンドラの登録。
 * defineTask と同じくアプリ起動時に一度だけ呼ぶ (background/tasks.ts から呼ばれる)。
 */
export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/** Android の通知チャンネルを用意する (Android 8 以降は必須)。 */
export async function ensureNotificationChannelAsync(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: '駅への到達',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
      vibrationPattern: [0, 200],
    });
  } catch (error) {
    log.warn('通知チャンネルの作成に失敗', error);
  }
}

/** 通知の許可を求める。拒否されても機能全体は止めない。 */
export async function requestNotificationPermissionAsync(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
      await ensureNotificationChannelAsync();
      return true;
    }
    const result = await Notifications.requestPermissionsAsync();
    if (result.granted) await ensureNotificationChannelAsync();
    return result.granted;
  } catch (error) {
    log.warn('通知権限の要求に失敗', error);
    return false;
  }
}

/**
 * 駅到達を通知する。
 * 一度の同期で複数駅を通過することがあるので、その場合は 1 通にまとめる
 * (5 駅ぶん通知が並ぶと鬱陶しいため)。
 */
export async function notifyArrivals(
  line: RailwayLine,
  arrivals: StationArrival[],
): Promise<void> {
  if (arrivals.length === 0) return;

  const permission = await Notifications.getPermissionsAsync().catch(() => null);
  if (!permission?.granted) {
    log.info('通知が許可されていないので送信しません');
    return;
  }

  const last = arrivals[arrivals.length - 1];
  const title =
    arrivals.length === 1
      ? `${last.station.name}駅に到着しました！`
      : `${arrivals.length}駅ぶん進みました！`;

  const spot = last.station.spots[0];
  const bodyParts = [`${line.name} ${last.station.name}(${last.station.kana})`];
  if (arrivals.length > 1) {
    bodyParts.push(`通過: ${arrivals.map((a) => a.station.name).join('→')}`);
  }
  if (spot) bodyParts.push(`近くの観光地: ${spot.name}`);

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: bodyParts.join('\n'),
        data: { stationId: last.station.id, lineId: line.id },
      },
      // Android は作成済みチャンネルに載せる。iOS は null で即時配信。
      trigger: Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : null,
    });
  } catch (error) {
    log.warn('通知の送信に失敗', error);
  }
}
