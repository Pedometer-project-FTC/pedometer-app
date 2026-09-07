import { StyleSheet, Text, View } from 'react-native';

import { DesignColors, DesignRadius } from '@/constants/design';

/**
 * 「現在の歩数」のピンクのカード。
 *
 * Figma の指定:
 *   背景 #FFC4C4 / 角丸 20 / 見出し 16px / 数字 55px / 「歩」30px
 *   文字に薄い赤の影が乗っている。
 *
 * ※ CSS の inset シャドウ (内側の影) は React Native に無いので、
 *   外側の影だけで近づけている。
 */

interface Props {
  steps: number;
  /** 右側のキャラクター。画像が用意できるまでは省略できる。 */
  character?: React.ReactNode;
}

export function StepCountCard({ steps, character }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.textArea}>
        <Text style={styles.heading}>現在の歩数</Text>
        <Text style={styles.count} numberOfLines={1} adjustsFontSizeToFit>
          {steps.toLocaleString('ja-JP')}
          <Text style={styles.unit}>歩</Text>
        </Text>
      </View>
      <View style={styles.characterSlot}>{character}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DesignColors.stepCard,
    borderRadius: DesignRadius.card,
    paddingHorizontal: 17,
    paddingVertical: 9,
    minHeight: 93,
    // Figma: 0px 2px 5px #00000040
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  textArea: {
    flex: 1,
    justifyContent: 'center',
  },
  heading: {
    color: DesignColors.white,
    fontSize: 16,
    fontWeight: '800',
    textShadowColor: DesignColors.stepShadow,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 2,
  },
  count: {
    color: DesignColors.white,
    fontSize: 55,
    fontWeight: '700',
    lineHeight: 62,
    textShadowColor: DesignColors.stepShadow,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  unit: {
    fontSize: 30,
    fontWeight: '700',
  },
  characterSlot: {
    width: 69,
    height: 81,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
