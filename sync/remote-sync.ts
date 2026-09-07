import { isRemoteEnabled } from '@/config/app-config';
import { apiFetch, HttpError, NetworkError } from '@/core/http';
import { createLogger } from '@/core/logger';
import type { DayKey } from '@/core/datetime';
import { getActiveSession } from '@/auth/backend';
import {
  getUnsyncedDays,
  markDaysSynced,
  mergeRemoteDailySteps,
} from '@/db/step-repository';
import type { StationArrival } from '@/railway/journey';

/**
 * サーバとの歩数同期。
 *
 * 想定エンドポイント (サーバ側を作るときの仕様):
 *   POST /steps/sync (Bearer)
 *     req: { lineId, days: [{ day, steps, source, updatedAt }] }
 *     res: { days: [{ day, steps }] }   // サーバ側で確定した値 (他端末ぶんを含む)
 *   POST /achievements/arrivals (Bearer)
 *     req: { arrivals: [{ lineId, stationId, lap, totalDistanceM, arrivedAt }] }
 *
 * オフラインでも歩数はローカル DB に残り、synced_at が NULL のまま積まれる。
 * 次にオンラインになったときの同期でまとめて送られる。
 */

const log = createLogger('sync/remote');

export type RemoteSyncOutcome =
  | { status: 'skipped'; reason: string }
  | { status: 'ok'; uploadedDays: number }
  | { status: 'offline' }
  | { status: 'unauthorized' }
  | { status: 'error'; message: string };

interface StepsSyncResponse {
  days?: { day: DayKey; steps: number }[];
}

/** 未送信の歩数をまとめて送り、サーバ側の確定値を取り込む。 */
export async function pushSteps(userId: string, lineId: string): Promise<RemoteSyncOutcome> {
  if (!isRemoteEnabled()) return { status: 'skipped', reason: 'ローカル専用モード' };

  const session = await getActiveSession();
  if (!session?.accessToken) return { status: 'skipped', reason: '未ログイン' };
  if (session.user.id !== userId) {
    return { status: 'skipped', reason: 'セッションのユーザと一致しません' };
  }

  const pending = await getUnsyncedDays(userId);
  if (pending.length === 0) return { status: 'ok', uploadedDays: 0 };

  try {
    const res = await apiFetch<StepsSyncResponse>({
      path: '/steps/sync',
      method: 'POST',
      token: session.accessToken,
      body: {
        lineId,
        days: pending.map((d) => ({
          day: d.day,
          steps: d.steps,
          source: d.source,
          updatedAt: d.updatedAt,
        })),
      },
    });

    await markDaysSynced(userId, pending.map((d) => d.day));

    // サーバが「確定値」を返してきたら取り込む (別端末で歩いたぶんの反映)
    if (res?.days?.length) {
      await mergeRemoteDailySteps(userId, res.days);
    }

    log.info(`${pending.length} 日ぶんの歩数を送信しました`);
    return { status: 'ok', uploadedDays: pending.length };
  } catch (error) {
    if (error instanceof NetworkError) {
      log.info('オフラインのため送信を見送りました');
      return { status: 'offline' };
    }
    if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
      log.warn('認証が切れているため送信できませんでした');
      return { status: 'unauthorized' };
    }
    const message = error instanceof Error ? error.message : String(error);
    log.error('歩数の送信に失敗', message);
    return { status: 'error', message };
  }
}

/** 駅到達の実績をサーバへ送る。失敗しても致命的ではないので投げない。 */
export async function pushArrivals(
  userId: string,
  lineId: string,
  arrivals: StationArrival[],
): Promise<void> {
  if (!isRemoteEnabled() || arrivals.length === 0) return;

  const session = await getActiveSession();
  if (!session?.accessToken || session.user.id !== userId) return;

  try {
    await apiFetch<void>({
      path: '/achievements/arrivals',
      method: 'POST',
      token: session.accessToken,
      body: {
        arrivals: arrivals.map((a) => ({
          lineId,
          stationId: a.station.id,
          lap: a.lap,
          totalDistanceM: a.atTotalDistanceM,
          arrivedAt: new Date().toISOString(),
        })),
      },
    });
  } catch (error) {
    log.warn('実績の送信に失敗 (次回まとめて再送されます)', error);
  }
}
