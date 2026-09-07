import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { ScreenHeader } from '@/components/home/screen-header';
import { DesignColors } from '@/constants/design';
import { getReachedStationIds } from '@/db/arrival-repository';
import { usePedometerSystem } from '@/hooks/use-pedometer-system';

/**
 * 「アチーブ」タブ。
 * 路線の駅を並べて、到達済みの駅にチェックを付ける。
 */

export default function AchievementsScreen() {
  const { userId } = useAuth();
  const { line, progress } = usePedometerSystem();
  const [reached, setReached] = useState<Set<string>>(new Set());

  // タブを開くたびに読み直す (バックグラウンドで到達が増えている可能性があるため)
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getReachedStationIds(userId, line.id)
        .then((ids) => {
          if (!cancelled) setReached(ids);
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }, [userId, line.id]),
  );

  const total = line.stations.length - 1;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="アチーブ" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>{line.name}</Text>
          <Text style={styles.summaryCount}>
            {reached.size} / {total} 駅
          </Text>
          {progress && progress.lapCount > 0 && (
            <Text style={styles.summaryLap}>{progress.lapCount} 周達成！</Text>
          )}
        </View>

        {line.stations.map((station, index) => {
          const done = reached.has(station.id);
          // 起点駅は「到達」の対象外なので、進み始めていれば通過済み扱いにする
          const isOrigin = index === 0;
          const checked = done || (isOrigin && reached.size > 0);

          return (
            <View key={station.id} style={styles.row}>
              <Ionicons
                name={checked ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={checked ? DesignColors.green : '#CCC'}
              />
              <View style={styles.rowText}>
                <Text style={[styles.stationName, !checked && styles.dim]}>
                  {station.code} {station.name}
                </Text>
                <Text style={styles.stationKana}>{station.kana}</Text>
              </View>
              <Text style={styles.distance}>
                {(station.cumulativeM / 1000).toFixed(1)} km
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DesignColors.screen },
  content: { padding: 20, gap: 4, paddingBottom: 40 },
  summary: {
    backgroundColor: '#F4F8F1',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 4,
  },
  summaryTitle: { fontSize: 14, color: '#5A6B4E', fontWeight: '700' },
  summaryCount: { fontSize: 28, fontWeight: '800', color: DesignColors.stationText },
  summaryLap: { fontSize: 13, fontWeight: '700', color: DesignColors.green },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEE',
  },
  rowText: { flex: 1 },
  stationName: { fontSize: 16, fontWeight: '700', color: DesignColors.stationText },
  stationKana: { fontSize: 11, color: '#999' },
  dim: { color: '#AAA' },
  distance: { fontSize: 12, color: '#999' },
});
