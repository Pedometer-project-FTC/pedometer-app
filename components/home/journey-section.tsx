import { StyleSheet, Text, View } from 'react-native';

import { DesignColors, DesignRadius } from '@/constants/design';
import type { Station } from '@/railway/types';

/**
 * 「移動距離」と「駅 → 駅」の区間表示。
 *
 * Figma の指定:
 *   駅カード = 上半分 #F0F0F0 (駅名 25px / 文字色 #63799E)、
 *              下半分 #647A9F (ふりがな 白 10px)、角丸 5
 *   あいだに緑の三角形、下に白い破線の入った緑の帯。
 *
 * 破線の帯は元デザインでは飾りだが、せっかく進捗が計算できるので
 * 「進んだぶんだけ白く塗る」ようにして区間の進み具合が分かるようにした。
 */

interface Props {
  /** 累計の移動距離 (m)。ヘッダーの「移動距離：〇〇km」に出す。 */
  totalDistanceM: number;
  fromStation: Station | null;
  toStation: Station | null;
  /** 区間内の進捗 0〜1。 */
  progress: number;
}

/** 破線の本数。Figma のデザインに合わせて 5 本。 */
const DASH_COUNT = 5;

export function JourneySection({ totalDistanceM, fromStation, toStation, progress }: Props) {
  const km = Math.floor(totalDistanceM / 1000).toLocaleString('ja-JP');

  return (
    <View style={styles.section}>
      {/* 「移動距離：999km」— 背景に細い緑の線が横切り、その上に丸いラベルが乗る */}
      <View style={styles.distanceRow}>
        <View style={styles.distanceLine} />
        <View style={styles.distancePill}>
          <Text style={styles.distanceText}>移動距離：{km}km</Text>
        </View>
      </View>

      {/* 駅 → 駅 */}
      <View style={styles.stationRow}>
        <StationCard station={fromStation} />
        <View style={styles.arrowWrap}>
          <View style={styles.arrow} />
        </View>
        <StationCard station={toStation} />
      </View>

      {/* 線路(進捗バー) */}
      <View style={styles.track}>
        {Array.from({ length: DASH_COUNT }).map((_, index) => {
          // この破線が「もう通り過ぎた位置」かどうか
          const passed = progress >= (index + 1) / DASH_COUNT;
          return (
            <View
              key={index}
              style={[styles.dash, passed ? styles.dashPassed : styles.dashUpcoming]}
            />
          );
        })}
      </View>
    </View>
  );
}

function StationCard({ station }: { station: Station | null }) {
  return (
    <View style={styles.stationCard}>
      <View style={styles.stationFace}>
        <Text style={styles.stationName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
          {station?.name ?? '—'}
        </Text>
      </View>
      <View style={styles.stationKana}>
        <Text style={styles.stationKanaText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {station?.kana ?? ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },

  distanceRow: {
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  distanceLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 22,
    bottom: 0,
    backgroundColor: DesignColors.green,
    opacity: 0.55,
    borderRadius: 4,
  },
  distancePill: {
    backgroundColor: DesignColors.green,
    borderRadius: DesignRadius.pill,
    paddingHorizontal: 24,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  distanceText: {
    color: DesignColors.white,
    fontSize: 16,
    fontWeight: '800',
  },

  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stationCard: {
    flex: 1,
    borderRadius: DesignRadius.station,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  stationFace: {
    backgroundColor: DesignColors.stationFace,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 7,
  },
  stationName: {
    color: DesignColors.stationText,
    fontSize: 25,
    fontWeight: '800',
  },
  stationKana: {
    backgroundColor: DesignColors.stationKana,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  stationKanaText: {
    color: DesignColors.white,
    fontSize: 10,
    fontWeight: '800',
  },

  arrowWrap: {
    width: 65,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // React Native で三角形を作る定番の書き方 (幅0・高さ0の要素の枠線を使う)
  arrow: {
    width: 0,
    height: 0,
    borderTopWidth: 20,
    borderBottomWidth: 20,
    borderLeftWidth: 30,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: DesignColors.green,
  },

  track: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    height: 14,
    backgroundColor: DesignColors.green,
    borderRadius: 3,
    paddingHorizontal: 6,
  },
  dash: {
    flex: 1,
    height: 5,
    marginHorizontal: 5,
    borderRadius: 2,
  },
  dashPassed: {
    backgroundColor: DesignColors.white,
  },
  dashUpcoming: {
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
});
