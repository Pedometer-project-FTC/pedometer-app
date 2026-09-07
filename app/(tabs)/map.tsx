import { StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '@/components/home/screen-header';
import { DesignColors, DesignRadius } from '@/constants/design';
import { usePedometerSystem } from '@/hooks/use-pedometer-system';

/**
 * 「マップ」タブ。
 *
 * 地図そのものはまだ入っていない。react-native-maps の導入と
 * Google Maps の API キーが必要なので、それまでは Figma と同じグレーの枠を置き、
 * 描画に必要なデータ(現在地・路線の座標列)が揃っていることだけ確認できるようにしている。
 *
 * 地図を入れるときは:
 *   toRoutePolyline(line)   → 路線を結ぶ線
 *   currentLatLng(progress) → 現在地のピン
 *   getRouteForDay(...)     → 実際に歩いた経路
 */

export default function MapScreen() {
  const { line, progress } = usePedometerSystem();

  return (
    <View style={styles.screen}>
      <ScreenHeader title="マップ" />
      <View style={styles.content}>
        <View style={styles.map}>
          <Text style={styles.mapNote}>地図はこれから実装します</Text>
        </View>

        <View style={styles.info}>
          <Text style={styles.infoTitle}>{line.name}</Text>
          {progress && (
            <>
              <Text style={styles.infoRow}>
                現在地: {progress.fromStation.name} → {progress.toStation.name}(
                {Math.round(progress.segmentProgress * 100)}%)
              </Text>
              <Text style={styles.infoRow}>
                次の駅まで: 約 {Math.round(progress.distanceToNextStationM)} m
              </Text>
            </>
          )}
          <Text style={styles.infoRow}>路線の座標: {line.stations.length} 点</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DesignColors.screen },
  content: { flex: 1, padding: 22, gap: 16 },
  map: {
    flex: 1,
    backgroundColor: DesignColors.mapPlaceholder,
    borderRadius: DesignRadius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapNote: { color: '#8A8A8A', fontSize: 13 },
  info: { gap: 4 },
  infoTitle: { fontSize: 15, fontWeight: '800', color: DesignColors.stationText },
  infoRow: { fontSize: 13, color: '#666' },
});
