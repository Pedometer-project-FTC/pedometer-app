import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DesignColors, DesignRadius } from '@/constants/design';

/**
 * 「近くの観光地 / 消費カロリー / 節約した金額」の 3 行に共通の見た目。
 *
 * Figma の指定:
 *   左に色付きのラベル (上だけ角丸 10、白の極太 16px)、
 *   その下から右へ細い同色の線が伸びる。値も同じ色。
 */

interface Props {
  label: string;
  /** 帯の色。DesignColors.tourist / calorie / money のどれか。 */
  color: string;
  children: ReactNode;
}

export function StatRow({ label, color, children }: Props) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <View style={[styles.chip, { backgroundColor: color }]}>
          <Text style={styles.chipLabel}>{label}</Text>
        </View>
        <View style={styles.valueArea}>{children}</View>
      </View>
      <View style={[styles.underline, { backgroundColor: color }]} />
    </View>
  );
}

/** 「99,999 kcal」のように、数字と単位を並べて出す値表示。 */
export function StatValue({
  value,
  unit,
  color,
}: {
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <View style={styles.valueRow}>
      <Text style={[styles.valueNumber, { color }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.valueUnit, { color }]}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    // 影は線ではなくラベル側に付けたいので、はみ出しを許容する
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  chip: {
    borderTopLeftRadius: DesignRadius.pill,
    borderTopRightRadius: DesignRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
    justifyContent: 'center',
  },
  chipLabel: {
    color: DesignColors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  valueArea: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingLeft: 10,
    paddingBottom: 2,
  },
  underline: {
    height: 4,
    borderBottomLeftRadius: 5,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },

  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  valueNumber: {
    fontSize: 18,
    fontWeight: '700',
  },
  valueUnit: {
    fontSize: 16,
    fontWeight: '800',
  },
});
