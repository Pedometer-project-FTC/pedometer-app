import { appConfig } from '@/config/app-config';

/**
 * サーバ通信の薄いラッパ。
 *
 * ・タイムアウトを必ず付ける (バックグラウンドタスクは実行時間に上限があるため、
 *   応答の無いリクエストで枠を使い切ると同期そのものが失敗扱いになる)
 * ・ステータスコードを保った HttpError を投げる (認証切れの判定に使う)
 */

export class HttpError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

/** ネットワークに届かなかった場合 (圏外・DNS 失敗・タイムアウト)。 */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export interface ApiRequest {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Bearer トークン。 */
  token?: string | null;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export async function apiFetch<T>({
  path,
  method = 'GET',
  body,
  token,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ApiRequest): Promise<T> {
  const base = appConfig.apiBaseUrl;
  if (!base) {
    throw new NetworkError('API_BASE_URL が設定されていません (ローカル専用モード)');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/$/, '')}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new NetworkError(`通信に失敗しました: ${reason}`);
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    const message =
      (parsed as { message?: string } | null)?.message ?? `HTTP ${response.status}`;
    throw new HttpError(response.status, message, parsed);
  }

  return parsed as T;
}
