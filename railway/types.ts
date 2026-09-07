/**
 * 路線データの型定義。
 *
 * 「今は京都市営地下鉄東西線だけ、将来は全国の路線へ」という要件なので、
 * 路線は単なるデータ (RailwayLine) として表現し、判定ロジック(journey.ts)は
 * 路線に依存しないようにしてある。新しい路線を足すときは
 * railway/lines/ に 1 ファイル追加して line-registry.ts に登録するだけでよい。
 */

/** 駅の近くの観光地。UI の「近くの観光地」カードに出す。 */
export interface TouristSpot {
  name: string;
  /** タップで開く Google マップの URL。 */
  mapsUrl: string;
  note?: string;
}

export interface Station {
  /** 路線をまたいで一意な ID。'<lineId>/<code>' の形式。 */
  id: string;
  /** 駅ナンバリング (例: 'T09')。路線内で一意。 */
  code: string;
  /** 表示名 (例: '蹴上')。 */
  name: string;
  /** ふりがな (例: 'けあげ')。UI の駅名下の小さい字。 */
  kana: string;
  romaji: string;
  lat: number;
  lng: number;
  /** 起点駅からの累計営業キロ (m)。起点は 0。 */
  cumulativeM: number;
  spots: TouristSpot[];
}

/**
 * 距離に応じた運賃段階。
 * 実運賃を「節約した金額」に使いたい場合に埋める。
 * 事業者が改定するたびに変わるので、確かな出典を確認してから入れること。
 */
export interface FareStage {
  /** この段階の上限距離 (m)。 */
  upToM: number;
  /** 運賃 (円)。 */
  yen: number;
}

export interface RailwayLine {
  id: string;
  name: string;
  operator: string;
  /** 路線カラー (UI のライン表示用)。 */
  color: string;
  /** 起点→終点の順に並んだ駅。cumulativeM は昇順であること。 */
  stations: Station[];
  /** 全長 (m)。= 終点駅の cumulativeM。 */
  totalLengthM: number;
  /** 未確認なら null のままにしておく (metrics 側は距離単価にフォールバックする)。 */
  fareStages: FareStage[] | null;
}

/** 隣り合う 2 駅の区間。 */
export interface Segment {
  index: number;
  from: Station;
  to: Station;
  lengthM: number;
}

/** 路線の全区間を取り出す。 */
export function segmentsOf(line: RailwayLine): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i < line.stations.length - 1; i += 1) {
    const from = line.stations[i];
    const to = line.stations[i + 1];
    segments.push({ index: i, from, to, lengthM: to.cumulativeM - from.cumulativeM });
  }
  return segments;
}

/** 運賃段階から距離ぶんの運賃を引く。段階が未設定なら null。 */
export function fareByDistance(line: RailwayLine, distanceM: number): number | null {
  if (!line.fareStages || line.fareStages.length === 0) return null;
  for (const stage of line.fareStages) {
    if (distanceM <= stage.upToM) return stage.yen;
  }
  return line.fareStages[line.fareStages.length - 1].yen;
}
