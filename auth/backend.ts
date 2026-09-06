import { isRemoteEnabled } from '@/config/app-config';
import { httpAuthBackend } from '@/auth/http-backend';
import { localAuthBackend } from '@/auth/local-backend';
import { loadSession } from '@/auth/session-store';
import type { AuthBackend, AuthSession } from '@/auth/types';
import { GUEST_USER_ID } from '@/db/database';

/**
 * どの認証バックエンドを使うかの決定と、React の外からセッションを触るための入口。
 * バックグラウンドタスクは React コンテキストを使えないので、ここ経由で
 * 「今ログインしているのは誰か」を知る。
 */

export function getAuthBackend(): AuthBackend {
  return isRemoteEnabled() ? httpAuthBackend : localAuthBackend;
}

/**
 * 保存済みセッションで発行されたバックエンドを返す。
 * 設定を途中で変えた場合でも、セッションを発行した側でログアウトできるようにするため。
 */
export function backendForSession(session: AuthSession): AuthBackend {
  return session.backend === 'http' ? httpAuthBackend : localAuthBackend;
}

/**
 * 今のユーザ ID。未ログインならゲスト ID。
 * 歩数はログイン前から貯めておき、ログイン時に本アカウントへ引き継ぐ。
 */
export async function getActiveUserId(): Promise<string> {
  const session = await loadSession();
  return session?.user.id ?? GUEST_USER_ID;
}

/** 今のセッション (未ログインなら null)。 */
export async function getActiveSession(): Promise<AuthSession | null> {
  return loadSession();
}
