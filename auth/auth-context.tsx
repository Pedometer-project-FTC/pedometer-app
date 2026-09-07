import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { createLogger } from '@/core/logger';
import { backendForSession, getAuthBackend } from '@/auth/backend';
import { clearSession, loadSession, saveSession } from '@/auth/session-store';
import {
  AuthError,
  authErrorMessage,
  type AuthSession,
  type AuthUser,
  type SignInInput,
  type SignUpInput,
} from '@/auth/types';
import { GUEST_USER_ID } from '@/db/database';
import { mergeGuestDataInto } from '@/db/step-repository';
import { syncSteps } from '@/sync/step-sync';

/**
 * ログイン状態を配る React コンテキスト。
 *
 * 未ログインでも歩数の記録は動く (ゲストとして端末内に貯まる)。
 * ログインした時点でゲストのデータを本アカウントへ引き継ぐので、
 * 「まず使ってみて、あとで登録する」導線が作れる。
 */

const log = createLogger('auth/context');

export type AuthStatus = 'loading' | 'authenticated' | 'guest';

interface AuthContextValue {
  status: AuthStatus;
  session: AuthSession | null;
  user: AuthUser | null;
  /** 歩数データを紐づける ID。未ログインならゲスト ID。 */
  userId: string;
  /** 直近の操作で出たエラーメッセージ (日本語)。 */
  error: string | null;
  /** サインイン/アップの処理中か。 */
  busy: boolean;
  signIn(input: SignInInput): Promise<boolean>;
  signUp(input: SignUpInput): Promise<boolean>;
  signOut(): Promise<void>;
  clearError(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 起動時に保存済みセッションを復元する
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const stored = await loadSession();
        if (!stored) {
          if (!cancelled) setStatus('guest');
          return;
        }

        const restored = await backendForSession(stored).restore(stored);
        if (cancelled) return;

        if (restored) {
          await saveSession(restored);
          setSession(restored);
          setStatus('authenticated');
          log.info(`セッションを復元しました (${restored.user.email})`);
        } else {
          await clearSession();
          setStatus('guest');
          log.info('保存されていたセッションは失効していました');
        }
      } catch (restoreError) {
        log.error('セッションの復元に失敗', restoreError);
        if (!cancelled) setStatus('guest');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /** サインイン/サインアップ後の共通処理。 */
  const adopt = useCallback(async (next: AuthSession) => {
    await saveSession(next);
    // 未ログイン中に貯めた歩数を引き継ぐ
    await mergeGuestDataInto(next.user.id).catch((mergeError) => {
      log.warn('ゲストデータの引き継ぎに失敗', mergeError);
    });
    setSession(next);
    setStatus('authenticated');
    // 引き継いだデータを含めてサーバへ送る
    syncSteps({ trigger: 'sign-in' }).catch(() => {
      /* 同期の失敗はログイン自体を失敗させない */
    });
  }, []);

  const run = useCallback(
    async (action: () => Promise<AuthSession>): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        await adopt(await action());
        return true;
      } catch (actionError) {
        const message =
          actionError instanceof AuthError
            ? authErrorMessage(actionError.code)
            : '不明なエラーが発生しました。';
        log.warn('認証に失敗', actionError);
        setError(message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [adopt],
  );

  const signIn = useCallback(
    (input: SignInInput) => run(() => getAuthBackend().signIn(input)),
    [run],
  );

  const signUp = useCallback(
    (input: SignUpInput) => run(() => getAuthBackend().signUp(input)),
    [run],
  );

  const signOut = useCallback(async () => {
    const current = session;
    setSession(null);
    setStatus('guest');
    await clearSession();
    if (current) {
      await backendForSession(current).signOut(current).catch(() => {
        /* サーバ側の失効に失敗しても端末側はログアウト済みにする */
      });
    }
    log.info('サインアウトしました');
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      userId: session?.user.id ?? GUEST_USER_ID,
      error,
      busy,
      signIn,
      signUp,
      signOut,
      clearError: () => setError(null),
    }),
    [status, session, error, busy, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth は AuthProvider の内側で使ってください');
  }
  return value;
}
