import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { createLogger } from '@/core/logger';
import type { AuthSession } from '@/auth/types';

/**
 * セッションの永続化。
 *
 * トークンは端末の安全な領域 (Android: EncryptedSharedPreferences /
 * iOS: Keychain) に置く。バックグラウンドタスクも同じ関数でセッションを
 * 読み出して、サーバへ歩数を送るときの認証に使う。
 *
 * SecureStore は web 非対応なので、web だけ localStorage にフォールバックする
 * (開発時のブラウザ確認用。本番は実機のみを想定)。
 */

const log = createLogger('auth/session');
const SESSION_KEY = 'pedometer.session';

const webStorage = {
  get(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      /* 保存できなくても致命的ではない */
    }
  },
  remove(key: string) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      /* 同上 */
    }
  },
};

export async function saveSession(session: AuthSession): Promise<void> {
  const json = JSON.stringify(session);
  if (Platform.OS === 'web') {
    webStorage.set(SESSION_KEY, json);
    return;
  }
  try {
    await SecureStore.setItemAsync(SESSION_KEY, json);
  } catch (error) {
    log.error('セッションの保存に失敗', error);
  }
}

export async function loadSession(): Promise<AuthSession | null> {
  const json =
    Platform.OS === 'web'
      ? webStorage.get(SESSION_KEY)
      : await SecureStore.getItemAsync(SESSION_KEY).catch((error) => {
          log.error('セッションの読み出しに失敗', error);
          return null;
        });

  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as AuthSession;
    // 壊れた JSON が残っていた場合に UI が落ちないよう最低限だけ検証する
    if (!parsed?.user?.id) return null;
    return parsed;
  } catch {
    log.warn('保存されたセッションが壊れていたので破棄します');
    await clearSession();
    return null;
  }
}

export async function clearSession(): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage.remove(SESSION_KEY);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch (error) {
    log.error('セッションの削除に失敗', error);
  }
}
