import { apiFetch, HttpError, NetworkError } from '@/core/http';
import { createLogger } from '@/core/logger';
import {
  AuthError,
  type AuthBackend,
  type AuthSession,
  type SignInInput,
  type SignUpInput,
} from '@/auth/types';

/**
 * 実サーバ向けの認証バックエンド。
 *
 * 想定しているエンドポイント (サーバ側を作るときの仕様):
 *   POST /auth/signup   { email, password, displayName } -> AuthResponse
 *   POST /auth/signin   { email, password }              -> AuthResponse
 *   POST /auth/signout  { refreshToken }                 -> 204
 *   POST /auth/refresh  { refreshToken }                 -> AuthResponse
 *   GET  /auth/me       (Bearer)                         -> { user }
 *
 * AuthResponse = { user: { id, email, displayName },
 *                  accessToken, refreshToken, expiresAt }
 */

const log = createLogger('auth/http');

interface AuthResponse {
  user: { id: string; email: string; displayName: string };
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
}

function toSession(res: AuthResponse): AuthSession {
  return {
    user: res.user,
    accessToken: res.accessToken,
    refreshToken: res.refreshToken ?? null,
    expiresAt: res.expiresAt ?? null,
    backend: 'http',
  };
}

/** サーバのエラーを AuthError に翻訳する。 */
function toAuthError(error: unknown): AuthError {
  if (error instanceof AuthError) return error;
  if (error instanceof NetworkError) {
    return new AuthError('network', error.message);
  }
  if (error instanceof HttpError) {
    // サーバが code を返してくれるならそれを尊重する
    const code = (error.body as { code?: string } | null)?.code;
    if (code === 'email-already-in-use') {
      return new AuthError('email-already-in-use', error.message);
    }
    if (code === 'weak-password') return new AuthError('weak-password', error.message);
    if (code === 'invalid-email') return new AuthError('invalid-email', error.message);
    if (error.status === 401 || error.status === 403 || error.status === 404) {
      return new AuthError('invalid-credentials', error.message);
    }
    if (error.status === 409) {
      return new AuthError('email-already-in-use', error.message);
    }
    return new AuthError('server', error.message);
  }
  return new AuthError('unknown', error instanceof Error ? error.message : String(error));
}

export const httpAuthBackend: AuthBackend = {
  kind: 'http',

  async signUp({ email, password, displayName }: SignUpInput): Promise<AuthSession> {
    try {
      const res = await apiFetch<AuthResponse>({
        path: '/auth/signup',
        method: 'POST',
        body: { email: email.trim().toLowerCase(), password, displayName: displayName.trim() },
      });
      return toSession(res);
    } catch (error) {
      throw toAuthError(error);
    }
  },

  async signIn({ email, password }: SignInInput): Promise<AuthSession> {
    try {
      const res = await apiFetch<AuthResponse>({
        path: '/auth/signin',
        method: 'POST',
        body: { email: email.trim().toLowerCase(), password },
      });
      return toSession(res);
    } catch (error) {
      throw toAuthError(error);
    }
  },

  async signOut(session: AuthSession): Promise<void> {
    // サーバ側の失効に失敗しても、端末のセッションは消す方が利用者の意図に沿う。
    // ここでは投げずにログだけ残す。
    try {
      await apiFetch<void>({
        path: '/auth/signout',
        method: 'POST',
        token: session.accessToken,
        body: { refreshToken: session.refreshToken },
      });
    } catch (error) {
      log.warn('サーバ側のサインアウトに失敗 (端末のセッションは破棄します)', error);
    }
  },

  async restore(session: AuthSession): Promise<AuthSession | null> {
    // まだ期限内なら、通信せずにそのまま使う (起動を速くするため)
    const expiresAt = session.expiresAt ? Date.parse(session.expiresAt) : NaN;
    if (Number.isFinite(expiresAt) && expiresAt - Date.now() > 60_000) {
      return session;
    }

    if (session.refreshToken) {
      try {
        const res = await apiFetch<AuthResponse>({
          path: '/auth/refresh',
          method: 'POST',
          body: { refreshToken: session.refreshToken },
        });
        return toSession(res);
      } catch (error) {
        if (error instanceof NetworkError) {
          // オフラインなだけならセッションを消さない。次回オンライン時に再試行する。
          log.warn('オフラインのためトークンを更新できませんでした');
          return session;
        }
        log.info('リフレッシュトークンが失効していました');
        return null;
      }
    }

    // リフレッシュトークンが無い場合は、アクセストークンの生死を直接確かめる
    try {
      await apiFetch<{ user: AuthResponse['user'] }>({
        path: '/auth/me',
        token: session.accessToken,
      });
      return session;
    } catch (error) {
      if (error instanceof NetworkError) return session;
      return null;
    }
  },
};
