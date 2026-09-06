import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as TaskManager from 'expo-task-manager';

import {
  isRouteTrackingAsync,
  startRouteTrackingAsync,
  stopRouteTrackingAsync,
  TASK_NAMES,
  triggerStepSyncForTestingAsync,
} from '@/background';
import { useAuth } from '@/auth/auth-context';
import { isRemoteEnabled } from '@/config/app-config';
import { recentLogs, type LogEntry } from '@/core/logger';
import { healthProvider } from '@/health/provider';
import { requestNotificationPermissionAsync } from '@/sync/notifications';
import { usePedometerSystem } from '@/hooks/use-pedometer-system';

/**
 * 開発用ダッシュボード。
 *
 * バックグラウンド周りは画面が無いと動作確認しづらいので、実機で状態を
 * 一覧できる画面を用意した。本番の UI とは無関係なので、リリース前に
 * このタブごと消してよい。
 */

export default function DevConsoleScreen() {
  const pedometer = usePedometerSystem();
  const auth = useAuth();

  const [taskRegistered, setTaskRegistered] = useState<boolean | null>(null);
  const [tracking, setTracking] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const reloadStatus = useCallback(async () => {
    const registered = await TaskManager.isTaskRegisteredAsync(TASK_NAMES.stepSync).catch(
      () => false,
    );
    setTaskRegistered(registered);
    setTracking(await isRouteTrackingAsync());
    setLogs(recentLogs().slice(0, 40));
  }, []);

  useEffect(() => {
    reloadStatus();
    const timer = setInterval(() => setLogs(recentLogs().slice(0, 40)), 3000);
    return () => clearInterval(timer);
  }, [reloadStatus]);

  const onRefresh = useCallback(async () => {
    await pedometer.refresh();
    await reloadStatus();
  }, [pedometer, reloadStatus]);

  const toggleTracking = useCallback(async () => {
    if (tracking) {
      await stopRouteTrackingAsync();
    } else {
      await startRouteTrackingAsync();
    }
    await reloadStatus();
  }, [tracking, reloadStatus]);

  const p = pedometer.progress;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={pedometer.refreshing} onRefresh={onRefresh} />}>
      <Text style={styles.h1}>開発用ダッシュボード</Text>

      <Section title="歩数ソース">
        <Row label="プロバイダ" value={`${healthProvider.label} (${healthProvider.id})`} />
        <Row label="状態" value={pedometer.status} />
        <Row label="最終同期" value={formatTime(pedometer.lastSyncedAt)} />
        {pedometer.status === 'permission-required' && (
          <Button label="権限をリクエスト" onPress={pedometer.requestPermission} />
        )}
        {healthProvider.openSettings && (
          <Button
            label="ヘルスコネクトの設定を開く"
            onPress={pedometer.openHealthSettings}
            tone="ghost"
          />
        )}
      </Section>

      <Section title="歩数">
        <Row label="今日" value={`${pedometer.today.steps.toLocaleString()} 歩`} />
        <Row label="今日の距離" value={`${(pedometer.today.distanceM / 1000).toFixed(2)} km`} />
        <Row label="消費カロリー" value={`${Math.round(pedometer.today.kcal)} kcal`} />
        <Row label="節約した金額" value={`${Math.round(pedometer.today.savedYen)} 円`} />
        <Row label="累計" value={`${pedometer.total.steps.toLocaleString()} 歩`} />
        <Row label="累計距離" value={`${(pedometer.total.distanceM / 1000).toFixed(2)} km`} />
      </Section>

      <Section title={pedometer.line.name}>
        {p ? (
          <>
            <Row label="現在地" value={`${p.fromStation.name} → ${p.toStation.name}`} />
            <Row label="区間進捗" value={`${Math.round(p.segmentProgress * 100)} %`} />
            <Row label="次の駅まで" value={`${Math.round(p.distanceToNextStationM)} m`} />
            <Row label="到達駅数" value={`${p.reachedStationCount} 駅 (${p.lapCount} 周)`} />
            <Row
              label="近くの観光地"
              value={pedometer.nearbySpots.map((s) => s.name).join('、') || '—'}
            />
          </>
        ) : (
          <Text style={styles.muted}>計算中…</Text>
        )}
      </Section>

      <Section title="直近7日">
        {pedometer.weekly.length === 0 ? (
          <Text style={styles.muted}>まだデータがありません</Text>
        ) : (
          pedometer.weekly.map((row) => (
            <Row key={row.day} label={row.day} value={`${row.steps.toLocaleString()} 歩`} />
          ))
        )}
      </Section>

      <Section title="バックグラウンド">
        <Row
          label="定期同期タスク"
          value={taskRegistered === null ? '確認中' : taskRegistered ? '登録済み' : '未登録'}
        />
        <Row label="経路記録" value={tracking ? '記録中' : '停止中'} />
        <Button label="いま同期する" onPress={onRefresh} />
        <Button
          label="バックグラウンドタスクを手動実行 (開発ビルドのみ)"
          onPress={async () => {
            await triggerStepSyncForTestingAsync();
            await reloadStatus();
          }}
          tone="ghost"
        />
        <Button label="通知を許可する" onPress={requestNotificationPermissionAsync} tone="ghost" />
        <Button
          label={tracking ? '経路記録を停止' : '経路記録を開始 (電池を使います)'}
          onPress={toggleTracking}
          tone="ghost"
        />
      </Section>

      <Section title="アカウント">
        <Row label="モード" value={isRemoteEnabled() ? 'サーバ接続' : 'ローカル専用'} />
        <Row label="状態" value={auth.status} />
        <Row label="user_id" value={auth.userId} />
        {auth.user && <Row label="メール" value={auth.user.email} />}
        <Link href="/login" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonLabel}>
              {auth.status === 'authenticated' ? 'アカウント画面' : 'ログイン / 新規登録'}
            </Text>
          </Pressable>
        </Link>
      </Section>

      <Section title="ログ (新しい順)">
        {logs.map((entry, index) => (
          <Text
            key={`${entry.at}-${index}`}
            style={[styles.log, entry.level === 'error' && styles.logError]}>
            {entry.at.slice(11, 19)} [{entry.scope}] {entry.message}
          </Text>
        ))}
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.h2}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function Button({
  label,
  onPress,
  tone = 'solid',
}: {
  label: string;
  onPress: () => void | Promise<unknown>;
  tone?: 'solid' | 'ghost';
}) {
  return (
    <Pressable
      style={[styles.button, tone === 'ghost' && styles.buttonGhost]}
      onPress={() => {
        void onPress();
      }}>
      <Text style={[styles.buttonLabel, tone === 'ghost' && styles.buttonGhostLabel]}>{label}</Text>
    </Pressable>
  );
}

function formatTime(iso: string | null): string {
  if (!iso) return 'まだ同期していません';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('ja-JP');
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f6f7f4' },
  content: { padding: 16, paddingBottom: 48, gap: 14 },
  h1: { fontSize: 22, fontWeight: '700', marginTop: 40 },
  h2: { fontSize: 15, fontWeight: '700', marginBottom: 6, color: '#4a7c2f' },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 14, gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 3 },
  rowLabel: { fontSize: 13, color: '#666', flexShrink: 0 },
  rowValue: { fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  muted: { fontSize: 13, color: '#999' },
  button: {
    backgroundColor: '#8FBC72',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonGhost: { backgroundColor: '#eef2ea' },
  buttonLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },
  buttonGhostLabel: { color: '#4a7c2f' },
  log: { fontSize: 11, color: '#555', fontFamily: 'monospace' },
  logError: { color: '#c0392b' },
});
