/**
 * ログイン周りの型。
 *
 * サーバがまだ無いので、認証は「バックエンド差し替え式」にしてある。
 *   - EXPO_PUBLIC_API_BASE_URL が未設定 → LocalAuthBackend (端末内スタブ)
 *   - 設定済み                          → HttpAuthBackend (実サーバ)
 * 画面側は AuthBackend のインタフェースだけを見るので、
 * サーバができても UI を書き換える必要はない。
 */

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthSession {
  user: AuthUser;
  /** サーバ発行のアクセストークン。ローカルスタブでは null。 */
  accessToken: string | null;
  refreshToken: string | null;
  /** アクセストークンの失効時刻 (ISO)。不明なら null。 */
  expiresAt: string | null;
  /** どのバックエンドで発行されたセッションか。 */
  backend: 'local' | 'http';
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

/** 認証の失敗理由。UI 側で日本語メッセージに変換する。 */
export type AuthErrorCode =
  | 'invalid-credentials'
  | 'email-already-in-use'
  | 'weak-password'
  | 'invalid-email'
  | 'network'
  | 'server'
  | 'unknown';

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

export interface AuthBackend {
  readonly kind: 'local' | 'http';
  signUp(input: SignUpInput): Promise<AuthSession>;
  signIn(input: SignInInput): Promise<AuthSession>;
  signOut(session: AuthSession): Promise<void>;
  /**
   * 保存済みセッションが今も有効か確認し、必要なら更新して返す。
   * 無効なら null を返す (呼び出し側はサインアウト扱いにする)。
   */
  restore(session: AuthSession): Promise<AuthSession | null>;
}

/** 日本語のエラーメッセージ。 */
export function authErrorMessage(code: AuthErrorCode): string {
  switch (code) {
    case 'invalid-credentials':
      return 'メールアドレスまたはパスワードが違います。';
    case 'email-already-in-use':
      return 'このメールアドレスは既に登録されています。';
    case 'weak-password':
      return 'パスワードは8文字以上にしてください。';
    case 'invalid-email':
      return 'メールアドレスの形式が正しくありません。';
    case 'network':
      return 'ネットワークに接続できませんでした。';
    case 'server':
      return 'サーバでエラーが発生しました。時間をおいて試してください。';
    default:
      return '不明なエラーが発生しました。';
  }
}
