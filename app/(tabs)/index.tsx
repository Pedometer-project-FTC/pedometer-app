import { Ionicons } from '@expo/vector-icons';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { JourneySection } from '@/components/home/journey-section';
import { StatRow, StatValue } from '@/components/home/stat-row';
import { StepCountCard } from '@/components/home/step-count-card';
import { DesignColors, DesignRadius } from '@/constants/design';
import { usePedometerSystem } from '@/hooks/use-pedometer-system';

/**
 * 「記録」タブ (Figma の Android Medium - 1)。
 *
 * 見た目は Anima が書き出した Web 版のコードから数値を写して React Native に
 * 置き換えたもの。表示する値はすべて usePedometerSystem() から取っている。
 */

export default function RecordScreen() {
  const insets = useSafeAreaInsets();
  const {
    status,
    today,
    total,
    progress,
    nearbySpots,
    refreshing,
    refresh,
    requestPermission,
  } = usePedometerSystem();

  const spot = nearbySpots[0] ?? null;

  const openSpot = useCallback(() => {
    if (spot) Linking.openURL(spot.mapsUrl).catch(() => undefined);
  }, [spot]);

  return (
    <View style={styles.screen}>
      {/* ヘッダー: 緑の帯 + 更新ボタン */}
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="更新"
          onPress={refresh}
          disabled={refreshing}
          style={styles.refreshButton}>
          {refreshing ? (
            <ActivityIndicator color={DesignColors.white} />
          ) : (
            <Ionicons name="refresh" size={30} color={DesignColors.white} />
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ヘルスデータの権限が無いときだけ出る案内 */}
        {status === 'permission-required' && (
          <Pressable style={styles.notice} onPress={requestPermission}>
            <Text style={styles.noticeText}>
              歩数を読み取る許可が必要です。タップして許可してください。
            </Text>
          </Pressable>
        )}
        {status === 'unavailable' && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              この端末では歩数を取得できません(ヘルスコネクトが未対応/未インストール)。
            </Text>
          </View>
        )}

        <StepCountCard steps={today.steps} />

        <JourneySection
          totalDistanceM={total.distanceM}
          fromStation={progress?.fromStation ?? null}
          toStation={progress?.toStation ?? null}
          progress={progress?.segmentProgress ?? 0}
        />

        <View style={styles.stats}>
          <StatRow label="近くの観光地" color={DesignColors.tourist}>
            <Pressable onPress={openSpot} disabled={!spot}>
              <Text style={[styles.spotText, { color: DesignColors.tourist }]} numberOfLines={1}>
                {spot ? `${spot.name}：${spot.mapsUrl}` : '—'}
              </Text>
            </Pressable>
          </StatRow>

          <StatRow label="消費カロリー" color={DesignColors.calorie}>
            <StatValue
              value={Math.round(today.kcal).toLocaleString('ja-JP')}
              unit="kcal"
              color={DesignColors.calorie}
            />
          </StatRow>

          <StatRow label="節約した金額" color={DesignColors.money}>
            <StatValue
              value={Math.round(today.savedYen).toLocaleString('ja-JP')}
              unit="円"
              color={DesignColors.money}
            />
          </StatRow>
        </View>

        {/*
          地図エリア。Figma ではグレーの四角なので、今はそのまま置いている。
          実際の地図を出すには react-native-maps の導入と Google Maps の
          API キーが要る (docs/BACKEND.md 参照)。
        */}
        <View style={styles.map} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DesignColors.screen,
  },
  header: {
    backgroundColor: DesignColors.green,
    alignItems: 'flex-end',
    paddingHorizontal: 13,
    paddingBottom: 4,
  },
  refreshButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 18,
  },
  notice: {
    backgroundColor: '#FFF4D1',
    borderRadius: 10,
    padding: 12,
  },
  noticeText: {
    color: '#7A5C00',
    fontSize: 13,
    lineHeight: 19,
  },
  stats: {
    gap: 14,
  },
  spotText: {
    fontSize: 16,
    fontWeight: '800',
  },
  map: {
    height: 260,
    backgroundColor: DesignColors.mapPlaceholder,
    borderRadius: DesignRadius.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
});
