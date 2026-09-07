import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { addDaysToKey, todayKey } from '@/core/datetime';
import { createLogger } from '@/core/logger';
import { getDailyStepRange, getTotalSteps, type DailyStepRow } from '@/db/step-repository';
import { getValue, KV_KEYS } from '@/db/kv-repository';
import { getProfile, type UserProfile } from '@/db/profile-repository';
import { healthProvider } from '@/health/provider';
import { computeMetrics, stepsToMeters, type StepMetrics } from '@/metrics/metrics';
import { computeJourneyProgress, type JourneyProgress } from '@/railway/journey';
import { getLineOrDefault } from '@/railway/line-registry';
import type { RailwayLine, TouristSpot } from '@/railway/types';
import { syncIfStale, syncSteps } from '@/sync/step-sync';

/**
 * 画面が必要とする値を全部まとめて返すフック。
 *
 * 歩数の取得・保存・同期そのものは sync/step-sync.ts が持っていて、
 * ここはその結果を DB から読み出して React の state に載せるだけ。
 * こうしておくと、アプリが閉じている間にバックグラウンドタスクが更新した
 * 内容も、画面を開いた瞬間にそのまま反映される。
 *
 * 使い方:
 *   const p = usePedometerSystem();
 *   p.today.steps        // 現在の歩数
 *   p.total.distanceM    // 移動距離(累計)
 *   p.progress           // 蹴上 → 東山 と進捗バー
 *   p.nearbySpots        // 近くの観光地
 *   p.today.kcal         // 消費カロリー
 *   p.today.savedYen     // 節約した金額
 *   p.refresh()          // 右上のリロードボタン
 */

const log = createLogger('hooks/pedometer');

export type PedometerStatus =
  /** 初回読み込み中。 */
  | 'loading'
  /** 使える。 */
  | 'ready'
  /** ヘルスデータの権限が無い。requestPermission() を呼ぶ。 */
  | 'permission-required'
  /** 端末が歩数ソースに対応していない。 */
  | 'unavailable';

export interface PedometerSystem {
  status: PedometerStatus;
  /** 今日ぶんの歩数・距離・カロリー・節約額。 */
  today: StepMetrics;
  /** 全期間の累計。 */
  total: StepMetrics;
  /** 直近 7 日の日別歩数 (グラフ用、古い順)。 */
  weekly: DailyStepRow[];
  /** 路線上の現在位置。まだ計算できていなければ null。 */
  progress: JourneyProgress | null;
  line: RailwayLine;
  /** 「近くの観光地」に出すスポット。 */
  nearbySpots: TouristSpot[];
  profile: UserProfile;
  /** 最後に同期できた時刻 (ISO)。 */
  lastSyncedAt: string | null;
  /** 同期中か (リロードボタンのスピナー用)。 */
  refreshing: boolean;
  /** 手動同期。 */
  refresh(): Promise<void>;
  /** ヘルスデータの権限をリクエストする。 */
  requestPermission(): Promise<boolean>;
  /** OS のヘルスデータ設定を開く (Android のみ)。 */
  openHealthSettings(): void;
}

const EMPTY_METRICS: StepMetrics = { steps: 0, distanceM: 0, kcal: 0, savedYen: 0 };

export function usePedometerSystem(): PedometerSystem {
  const { userId, status: authStatus } = useAuth();

  const [status, setStatus] = useState<PedometerStatus>('loading');
  const [weekly, setWeekly] = useState<DailyStepRow[]>([]);
  const [totalSteps, setTotalSteps] = useState(0);
  const [profile, setProfile] = useState<UserProfile>(() => ({
    heightCm: 165,
    weightKg: 58,
    strideM: null,
    costPerKm: 30,
    lineId: 'kyoto-tozai',
  }));
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // アンマウント後に setState しないためのフラグ
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** DB から現在の値を読み直す (同期はしない)。 */
  const reload = useCallback(async () => {
    const to = todayKey();
    const from = addDaysToKey(to, -6);
    const [rows, total, nextProfile, syncedAt] = await Promise.all([
      getDailyStepRange(userId, from, to),
      getTotalSteps(userId),
      getProfile(userId),
      getValue(KV_KEYS.lastSyncAt),
    ]);

    if (!mounted.current) return;
    setWeekly(rows);
    setTotalSteps(total);
    setProfile(nextProfile);
    setLastSyncedAt(syncedAt);
  }, [userId]);

  /** 同期してから読み直す。 */
  const refresh = useCallback(async () => {
    if (!mounted.current) return;
    setRefreshing(true);
    try {
      const outcome = await syncSteps({ trigger: 'manual' });
      if (!mounted.current) return;
      if (outcome.reason === 'permission-denied') setStatus('permission-required');
      else if (outcome.reason === 'health-unavailable') setStatus('unavailable');
      else setStatus('ready');
      await reload();
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, [reload]);

  const requestPermission = useCallback(async () => {
    const granted = await healthProvider.requestPermissionsAsync();
    if (granted) {
      // Android 15 以降はバックグラウンド読み取りに追加の許可が要る。
      // 取れなくても、アプリを開いたときの同期でまとめて取り込めるので続行する。
      await healthProvider.requestBackgroundAccessAsync?.();
      await refresh();
    } else if (mounted.current) {
      setStatus('permission-required');
    }
    return granted;
  }, [refresh]);

  const openHealthSettings = useCallback(() => {
    healthProvider.openSettings?.();
  }, []);

  // 初回・ユーザ切り替え時
  useEffect(() => {
    if (authStatus === 'loading') return;
    let cancelled = false;

    (async () => {
      try {
        // まず DB の内容をすぐ出す (同期を待たせない)
        await reload();
        if (cancelled) return;

        const availability = await healthProvider.getAvailabilityAsync();
        if (cancelled) return;
        if (availability !== 'available') {
          setStatus('unavailable');
          return;
        }

        if (!(await healthProvider.hasPermissionsAsync())) {
          if (!cancelled) setStatus('permission-required');
          return;
        }

        if (!cancelled) setStatus('ready');
        await syncIfStale({ trigger: 'mount' });
        if (!cancelled) await reload();
      } catch (error) {
        log.error('初期化に失敗', error);
        if (!cancelled) setStatus('unavailable');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus, userId, reload]);

  // フォアグラウンド復帰時に同期する。
  // アプリを閉じている間に歩いたぶんは、ここで一気に取り込まれる。
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next !== 'active') return;
      syncIfStale({ trigger: 'foreground' })
        .then(() => reload())
        .catch((error) => log.warn('復帰時の同期に失敗', error));
    });
    return () => subscription.remove();
  }, [reload]);

  const line = useMemo(() => getLineOrDefault(profile.lineId), [profile.lineId]);

  const today = useMemo(() => {
    const key = todayKey();
    const steps = weekly.find((row) => row.day === key)?.steps ?? 0;
    return computeMetrics(steps, profile);
  }, [weekly, profile]);

  const total = useMemo(() => computeMetrics(totalSteps, profile), [totalSteps, profile]);

  const progress = useMemo(
    () => computeJourneyProgress(line, stepsToMeters(totalSteps, profile)),
    [line, totalSteps, profile],
  );

  const nearbySpots = useMemo(() => progress?.nearestStation.spots ?? [], [progress]);

  return {
    status,
    today: status === 'loading' ? EMPTY_METRICS : today,
    total,
    weekly,
    progress,
    line,
    nearbySpots,
    profile,
    lastSyncedAt,
    refreshing,
    refresh,
    requestPermission,
    openHealthSettings,
  };
}
