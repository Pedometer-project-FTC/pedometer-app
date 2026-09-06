import * as Crypto from 'expo-crypto';

import { createLogger } from '@/core/logger';
import {
  AuthError,
  type AuthBackend,
  type AuthSession,
  type SignInInput,
  type SignUpInput,
} from '@/auth/types';
import { getDatabaseAsync } from '@/db/database';

/**
 * 端末内だけで完結するログイン (開発用スタブ)。
 *
 * ⚠️ 本番では絶対に使わないこと。
 *   - パスワードの検証が端末内で完結しているので、端末を触れる人には突破できる
 *   - 端末を変えるとアカウントが引き継げない
 * サーバができるまで「ログイン導線とデータの user_id 分離」を先に作って
 * おくための足場であり、EXPO_PUBLIC_API_BASE_URL を設定すれば
 * HttpAuthBackend に自動で切り替わる。
 *
 * それでも平文保存はしたくないので、ソルト付き SHA-256 の反復で保存している。
 * (PBKDF2 ではないが、DB を覗かれてもそのままは読めない程度には固める)
 */

const log = createLogger('auth/local');
const HASH_ROUNDS = 10_000;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function hashPassword(password: string, salt: string): Promise<string> {
  let digest = `${salt}:${password}`;
  for (let i = 0; i < HASH_ROUNDS; i += 1) {
    digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, digest);
  }
  return digest;
}

function randomSalt(): string {
  const bytes = Crypto.getRandomBytes(16);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validate(email: string, password: string): void {
  if (!EMAIL_PATTERN.test(email)) {
    throw new AuthError('invalid-email', 'メールアドレスの形式が正しくありません');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError('weak-password', `パスワードは${MIN_PASSWORD_LENGTH}文字以上必要です`);
  }
}

function toSession(user: { id: string; email: string; display_name: string }): AuthSession {
  return {
    user: { id: user.id, email: user.email, displayName: user.display_name },
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    backend: 'local',
  };
}

export const localAuthBackend: AuthBackend = {
  kind: 'local',

  async signUp({ email, password, displayName }: SignUpInput): Promise<AuthSession> {
    const normalized = normalizeEmail(email);
    validate(normalized, password);

    const db = await getDatabaseAsync();
    const existing = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM local_users WHERE email = ?',
      normalized,
    );
    if (existing) {
      throw new AuthError('email-already-in-use', 'このメールアドレスは登録済みです');
    }

    const salt = randomSalt();
    const hash = await hashPassword(password, salt);
    const id = Crypto.randomUUID();
    const name = displayName.trim() || normalized.split('@')[0];

    await db.runAsync(
      `INSERT INTO local_users (id, email, display_name, password_hash, password_salt, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      normalized,
      name,
      hash,
      salt,
      new Date().toISOString(),
    );

    log.info('ローカルアカウントを作成しました');
    return toSession({ id, email: normalized, display_name: name });
  },

  async signIn({ email, password }: SignInInput): Promise<AuthSession> {
    const normalized = normalizeEmail(email);
    const db = await getDatabaseAsync();
    const row = await db.getFirstAsync<{
      id: string;
      email: string;
      display_name: string;
      password_hash: string;
      password_salt: string;
    }>(
      'SELECT id, email, display_name, password_hash, password_salt FROM local_users WHERE email = ?',
      normalized,
    );

    if (!row) {
      // 「メールが存在しない」と「パスワードが違う」を区別しない
      throw new AuthError('invalid-credentials', 'メールアドレスまたはパスワードが違います');
    }

    const hash = await hashPassword(password, row.password_salt);
    if (hash !== row.password_hash) {
      throw new AuthError('invalid-credentials', 'メールアドレスまたはパスワードが違います');
    }

    return toSession(row);
  },

  async signOut(): Promise<void> {
    // ローカルスタブにはサーバ側のセッションが無いので、やることはない
  },

  async restore(session: AuthSession): Promise<AuthSession | null> {
    const db = await getDatabaseAsync();
    const row = await db.getFirstAsync<{ id: string; email: string; display_name: string }>(
      'SELECT id, email, display_name FROM local_users WHERE id = ?',
      session.user.id,
    );
    return row ? toSession(row) : null;
  },
};
