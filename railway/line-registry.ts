import { kyotoTozaiLine } from '@/railway/lines/kyoto-tozai';
import type { RailwayLine } from '@/railway/types';

/**
 * 利用できる路線の一覧。
 * 全国対応するときは、ここに路線を足す (もしくはサーバから取得して差し替える)。
 */
const LINES: RailwayLine[] = [kyotoTozaiLine];

const byId = new Map(LINES.map((line) => [line.id, line]));

export function allLines(): RailwayLine[] {
  return LINES;
}

export function findLine(lineId: string): RailwayLine | null {
  return byId.get(lineId) ?? null;
}

/** 見つからなければ最初の路線にフォールバックする (UI を落とさないため)。 */
export function getLineOrDefault(lineId: string): RailwayLine {
  return byId.get(lineId) ?? LINES[0];
}
