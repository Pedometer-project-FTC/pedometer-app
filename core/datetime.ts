/**
 * 日付ユーティリティ。
 *
 * このアプリの歩数は「端末のローカルタイムの暦日」でバケット分けする。
 * サーバとやり取りする際も、この `DayKey`('YYYY-MM-DD') を主キーとして使う。
 * (UTC で切ると日本時間の朝 9 時に日付が変わってしまうため、ローカル基準で統一する)
 */

/** 'YYYY-MM-DD' 形式のローカル暦日。 */
export type DayKey = string;

const DAY_MS = 24 * 60 * 60 * 1000;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Date → ローカル暦日のキー。 */
export function toDayKey(date: Date): DayKey {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** 今日のキー。 */
export function todayKey(now: Date = new Date()): DayKey {
  return toDayKey(now);
}

/** キー → その日のローカル 00:00:00.000 の Date。 */
export function fromDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** その日のローカル 00:00。 */
export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

/** 翌日のローカル 00:00 (= その日の排他的な終端)。 */
export function endOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
}

/** n 日ずらした Date を返す (n は負でもよい)。 */
export function addDays(date: Date, n: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + n);
  return next;
}

/** キーを n 日ずらす。 */
export function addDaysToKey(key: DayKey, n: number): DayKey {
  return toDayKey(addDays(fromDayKey(key), n));
}

/** from〜to (両端含む) のキー一覧。逆順で渡された場合は空配列。 */
export function dayKeyRange(from: DayKey, to: DayKey): DayKey[] {
  const keys: DayKey[] = [];
  let cursor = fromDayKey(from);
  const last = fromDayKey(to);
  // 1 年ぶんを超える range は事故なので打ち切る
  let guard = 0;
  while (cursor.getTime() <= last.getTime() && guard < 400) {
    keys.push(toDayKey(cursor));
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return keys;
}

/** 2 つのキーの日数差 (to - from)。 */
export function diffDays(from: DayKey, to: DayKey): number {
  return Math.round((fromDayKey(to).getTime() - fromDayKey(from).getTime()) / DAY_MS);
}

/** Health Connect / API に渡す ISO 8601 instant 文字列 ('...Z')。 */
export function toIsoInstant(date: Date): string {
  return date.toISOString();
}
