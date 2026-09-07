import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DesignColors } from '@/constants/design';

/**
 * 各タブの上に出る緑の帯。
 * Figma のヘッダー (背景 #96C17D) をそのまま使い回している。
 */

interface Props {
  title?: string;
  /** 右端に置くボタンなど。 */
  right?: ReactNode;
}

export function ScreenHeader({ title, right }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
      <Text style={styles.title}>{title ?? ''}</Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: DesignColors.green,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 13,
    paddingBottom: 4,
    minHeight: 52,
  },
  title: {
    color: DesignColors.white,
    fontSize: 18,
    fontWeight: '800',
    paddingLeft: 8,
  },
  right: {
    minHeight: 44,
    justifyContent: 'center',
  },
});
