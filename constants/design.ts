/**
 * Figma のデザイン値。
 *
 * Anima が書き出した Web 版のコード (Tailwind) から色・サイズをそのまま写したもの。
 * 数値を直接書かずここを参照することで、デザイン変更時に 1 か所直せば済むようにしている。
 *
 * 元デザインのキャンバスサイズ: 360 × 800 (Android Medium)
 */

export const DesignColors = {
  /** ヘッダーとタブバーの緑。 */
  green: '#96C17D',
  /** 歩数カードのピンク。 */
  stepCard: '#FFC4C4',
  /** 歩数カードの内側の影・文字の影。 */
  stepShadow: 'rgba(255, 114, 114, 0.30)',

  /** 駅名カードの上半分 (駅名)。 */
  stationFace: '#F0F0F0',
  /** 駅名の文字色。 */
  stationText: '#63799E',
  /** 駅名カードの下半分 (ふりがな) の背景。 */
  stationKana: '#647A9F',

  /** 「近くの観光地」の帯。 */
  tourist: '#5FC0CA',
  /** 「消費カロリー」の帯。 */
  calorie: '#FFB969',
  /** 「節約した金額」の帯。 */
  money: '#C98BE3',

  /** 地図エリアの仮置き色。 */
  mapPlaceholder: '#D9D9D9',

  white: '#FFFFFF',
  screen: '#FFFFFF',
} as const;

/** 元デザインの基準幅。画面幅に合わせて拡大縮小するときの分母。 */
export const DESIGN_WIDTH = 360;

export const DesignRadius = {
  card: 20,
  station: 5,
  pill: 10,
} as const;
