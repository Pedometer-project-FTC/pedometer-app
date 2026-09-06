/**
 * 歩数から「距離 / 消費カロリー / 節約金額」を出す計算。
 *
 * UI の 3 カード (移動距離・消費カロリー・節約した金額) はすべてここを通す。
 * 係数は利用者のプロフィール依存なので、必ず `MetricsProfile` を引数に取る。
 */

/** 計算に使う利用者プロフィール。 */
export interface MetricsProfile {
  /** 身長 (cm)。歩幅の推定に使う。 */
  heightCm: number;
  /** 体重 (kg)。消費カロリーに使う。 */
  weightKg: number;
  /** 歩幅 (m)。未指定なら身長から推定する。 */
  strideM?: number | null;
  /**
   * 1km あたりの「節約額」(円)。
   * 歩かずに交通機関を使っていたら掛かっていたであろう額の目安。
   * 既定値 30 円/km は市内バス・地下鉄の平均的な距離単価からの概算値であり、
   * 正確な運賃計算ではない。路線ごとの実運賃を使いたい場合は
   * railway/types.ts の `fareStages` を埋めて fareByDistance() 側に差し替える。
   */
  costPerKm: number;
}

export const DEFAULT_METRICS_PROFILE: MetricsProfile = {
  heightCm: 165,
  weightKg: 58,
  strideM: null,
  costPerKm: 30,
};

/**
 * 歩幅 (m)。
 * 一般的な近似式「歩幅 ≒ 身長 × 0.45」を使う。
 * プロフィールに実測値が入っていればそちらを優先する。
 */
export function strideMeters(profile: MetricsProfile): number {
  if (profile.strideM && profile.strideM > 0) return profile.strideM;
  return (profile.heightCm * 0.45) / 100;
}

/** 歩数 → 距離 (m)。 */
export function stepsToMeters(steps: number, profile: MetricsProfile): number {
  return Math.max(0, steps) * strideMeters(profile);
}

/**
 * 歩数 → 消費カロリー (kcal)。
 * 歩行のエネルギー消費は「体重1kgを1km運ぶのに約1.036kcal」という近似を使う。
 * (厳密には速度・傾斜で変わるが、歩数計アプリの表示としてはこの精度で十分)
 */
export function stepsToKcal(steps: number, profile: MetricsProfile): number {
  const km = stepsToMeters(steps, profile) / 1000;
  return km * profile.weightKg * 1.036;
}

/** 歩数 → 節約金額 (円)。距離 × 単価。 */
export function stepsToSavedYen(steps: number, profile: MetricsProfile): number {
  const km = stepsToMeters(steps, profile) / 1000;
  return km * profile.costPerKm;
}

/** UI カードにそのまま流し込める形にまとめたもの。 */
export interface StepMetrics {
  steps: number;
  distanceM: number;
  kcal: number;
  savedYen: number;
}

export function computeMetrics(steps: number, profile: MetricsProfile): StepMetrics {
  return {
    steps,
    distanceM: stepsToMeters(steps, profile),
    kcal: stepsToKcal(steps, profile),
    savedYen: stepsToSavedYen(steps, profile),
  };
}
