/**
 * 最小限のロガー。
 *
 * バックグラウンドタスクは開発ビルドの Metro ログにしか出ないので、
 * 「いつ・どのタスクが・何をしたか」を追えるように接頭辞を必ず付ける。
 * 直近のログは `recentLogs()` でメモリからも取り出せる (デバッグ画面用)。
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  at: string;
  level: Level;
  scope: string;
  message: string;
}

const RING_SIZE = 200;
const ring: LogEntry[] = [];

function push(level: Level, scope: string, message: string, args: unknown[]) {
  const entry: LogEntry = {
    at: new Date().toISOString(),
    level,
    scope,
    message: args.length > 0 ? `${message} ${args.map(safeStringify).join(' ')}` : message,
  };
  ring.push(entry);
  if (ring.length > RING_SIZE) ring.shift();

  const line = `[${scope}] ${entry.message}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

function safeStringify(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function createLogger(scope: string) {
  return {
    debug: (message: string, ...args: unknown[]) => push('debug', scope, message, args),
    info: (message: string, ...args: unknown[]) => push('info', scope, message, args),
    warn: (message: string, ...args: unknown[]) => push('warn', scope, message, args),
    error: (message: string, ...args: unknown[]) => push('error', scope, message, args),
  };
}

export type Logger = ReturnType<typeof createLogger>;

/** デバッグ画面用に、直近のログを新しい順で返す。 */
export function recentLogs(): LogEntry[] {
  return [...ring].reverse();
}
