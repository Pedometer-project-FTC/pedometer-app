import { segmentsOf, type RailwayLine, type Station } from '@/railway/types';

/**
 * 「歩いた総距離」を路線上の位置に変換する。
 *
 * 要件の「駅間距離を歩いたかどうかの判定」はここが本体。
 * 総距離が路線の全長を超えたら 2 周目・3 周目として折り返す (lapCount)。
 */

export interface JourneyProgress {
  lineId: string;
  /** 歩いた総距離 (m)。 */
  totalDistanceM: number;
  /** 何周したか (0 なら 1 周目)。 */
  lapCount: number;
  /** 今の周回における路線上の位置 (m)。0 <= x < totalLengthM。 */
  distanceOnLineM: number;
  /** 直前に通過した駅 (= 今いる区間の起点)。 */
  fromStation: Station;
  /** 次に到達する駅 (= 今いる区間の終点)。 */
  toStation: Station;
  /** 今いる区間のインデックス。 */
  segmentIndex: number;
  /** 区間内の進捗 0..1。UI のプログレスバーにそのまま使える。 */
  segmentProgress: number;
  /** 区間の起点からの距離 (m)。 */
  distanceIntoSegmentM: number;
  /** 次の駅までの残り距離 (m)。 */
  distanceToNextStationM: number;
  /** 通過した駅の総数 (周回ぶんを含む、起点駅は数えない)。 */
  reachedStationCount: number;
  /** 「近くの観光地」に使う駅。区間の半分を過ぎたら次の駅に切り替わる。 */
  nearestStation: Station;
}

/** 総距離から現在地を求める。 */
export function computeJourneyProgress(line: RailwayLine, totalDistanceM: number): JourneyProgress {
  const total = line.totalLengthM;
  const distance = Math.max(0, totalDistanceM);
  const segments = segmentsOf(line);

  // 全長が 0 (駅が 1 つしかない等) の壊れたデータでも落ちないようにする
  if (total <= 0 || segments.length === 0) {
    const only = line.stations[0];
    return {
      lineId: line.id,
      totalDistanceM: distance,
      lapCount: 0,
      distanceOnLineM: 0,
      fromStation: only,
      toStation: only,
      segmentIndex: 0,
      segmentProgress: 0,
      distanceIntoSegmentM: 0,
      distanceToNextStationM: 0,
      reachedStationCount: 0,
      nearestStation: only,
    };
  }

  const lapCount = Math.floor(distance / total);
  const distanceOnLineM = distance - lapCount * total;

  // 現在地を含む区間を探す (cumulativeM は昇順なので線形探索で十分な駅数)
  let segment = segments[segments.length - 1];
  for (const candidate of segments) {
    if (distanceOnLineM < candidate.to.cumulativeM) {
      segment = candidate;
      break;
    }
  }

  const distanceIntoSegmentM = distanceOnLineM - segment.from.cumulativeM;
  const segmentProgress = segment.lengthM > 0
    ? Math.min(1, Math.max(0, distanceIntoSegmentM / segment.lengthM))
    : 0;

  const stationsPerLap = line.stations.length - 1;
  const reachedStationCount = lapCount * stationsPerLap + segment.index;

  return {
    lineId: line.id,
    totalDistanceM: distance,
    lapCount,
    distanceOnLineM,
    fromStation: segment.from,
    toStation: segment.to,
    segmentIndex: segment.index,
    segmentProgress,
    distanceIntoSegmentM,
    distanceToNextStationM: Math.max(0, segment.lengthM - distanceIntoSegmentM),
    reachedStationCount,
    nearestStation: segmentProgress >= 0.5 ? segment.to : segment.from,
  };
}

/** 到達イベント (通知や実績解除に使う)。 */
export interface StationArrival {
  station: Station;
  /** 何周目で到達したか (0 起算)。 */
  lap: number;
  /** 到達した時点の総距離 (m)。 */
  atTotalDistanceM: number;
}

/**
 * 総距離が prev から next に増えたあいだに「新しく到達した駅」を返す。
 *
 * 同期のたびにこれを呼び、返ってきた駅ぶんだけ通知を出す/実績を記録する。
 * prev >= next のときは空配列 (歩数が減ることは通常ないが、
 * ヘルスデータの訂正で起こりうるので安全側に倒す)。
 */
export function stationsReachedBetween(
  line: RailwayLine,
  prevTotalDistanceM: number,
  nextTotalDistanceM: number,
): StationArrival[] {
  const total = line.totalLengthM;
  if (total <= 0 || nextTotalDistanceM <= prevTotalDistanceM) return [];

  const arrivals: StationArrival[] = [];
  const startLap = Math.floor(Math.max(0, prevTotalDistanceM) / total);
  const endLap = Math.floor(nextTotalDistanceM / total);

  // 一度の同期で何周もするのは現実的でないが、データ異常で暴走しないよう上限を設ける
  const maxLap = Math.min(endLap, startLap + 10);

  for (let lap = startLap; lap <= maxLap; lap += 1) {
    // 起点駅(index 0)は「到達」に数えない。周回時は前周の終点駅と同一地点のため。
    for (let i = 1; i < line.stations.length; i += 1) {
      const station = line.stations[i];
      const absolute = lap * total + station.cumulativeM;
      if (absolute > prevTotalDistanceM && absolute <= nextTotalDistanceM) {
        arrivals.push({ station, lap, atTotalDistanceM: absolute });
      }
    }
  }

  arrivals.sort((a, b) => a.atTotalDistanceM - b.atTotalDistanceM);
  return arrivals;
}

/** 地図に路線を描くための座標列。 */
export function toRoutePolyline(line: RailwayLine): { latitude: number; longitude: number }[] {
  return line.stations.map((s) => ({ latitude: s.lat, longitude: s.lng }));
}

/**
 * 現在地の緯度経度を、区間を直線補間して求める。
 * 実際の線形ではなく駅間を直線で結んだ近似なので、地図上の「だいたいここ」表示用。
 */
export function currentLatLng(progress: JourneyProgress): { latitude: number; longitude: number } {
  const { fromStation, toStation, segmentProgress } = progress;
  return {
    latitude: fromStation.lat + (toStation.lat - fromStation.lat) * segmentProgress,
    longitude: fromStation.lng + (toStation.lng - fromStation.lng) * segmentProgress,
  };
}
