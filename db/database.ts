import * as SQLite from 'expo-sqlite';

import { createLogger } from '@/core/logger';

/**
 * SQLite の接続とマイグレーション。
 *
 * バックグラウンドタスクは React の外側で動くので、SQLiteProvider(コンテキスト)は
 * 使わず、モジュールスコープのシングルトン接続を共有する。
 * UI 側も同じ接続を使うため、フォアグラウンドと背景で状態がズレない。
 */

const log = createLogger('db');

export const DATABASE_NAME = 'pedometer.db';
const DATABASE_VERSION = 1;

/**
 * 未ログイン時に使うユーザ ID。
 * ログイン前に歩いたぶんを捨てないためのもので、サインイン時に
 * step-repository の mergeUserData() で本アカウントへ引き継ぐ。
 */
export const GUEST_USER_ID = 'guest';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  if (version >= DATABASE_VERSION) return;

  if (version === 0) {
    log.info('スキーマを作成します (v1)');
    await db.execAsync(`
      PRAGMA journal_mode = WAL;

      -- 日別の歩数。歩数の唯一の正 (single source of truth)。
      CREATE TABLE IF NOT EXISTS daily_steps (
        user_id     TEXT NOT NULL,
        day         TEXT NOT NULL,          -- 'YYYY-MM-DD' (端末ローカル暦日)
        steps       INTEGER NOT NULL,
        source      TEXT NOT NULL,          -- 'health-connect' | 'ios-pedometer' など
        updated_at  TEXT NOT NULL,
        synced_at   TEXT,                   -- サーバへ送れた時刻。NULL なら未送信
        PRIMARY KEY (user_id, day)
      );

      -- 同期トークンや最終同期時刻などの雑多な状態。
      CREATE TABLE IF NOT EXISTS kv (
        key        TEXT PRIMARY KEY NOT NULL,
        value      TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- 駅への到達履歴 (実績・通知の重複防止に使う)。
      CREATE TABLE IF NOT EXISTS station_arrivals (
        user_id          TEXT NOT NULL,
        line_id          TEXT NOT NULL,
        station_id       TEXT NOT NULL,
        lap              INTEGER NOT NULL,  -- 何周目か (0 起算)
        arrived_at       TEXT NOT NULL,
        total_distance_m REAL NOT NULL,
        PRIMARY KEY (user_id, line_id, station_id, lap)
      );

      -- サーバ未送信のデータ。オフラインでも取りこぼさないための送信待ち行列。
      CREATE TABLE IF NOT EXISTS sync_queue (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    TEXT NOT NULL,
        kind       TEXT NOT NULL,           -- 'steps' | 'arrival'
        payload    TEXT NOT NULL,           -- JSON
        created_at TEXT NOT NULL,
        attempts   INTEGER NOT NULL DEFAULT 0,
        last_error TEXT
      );

      -- 身長体重など、計算に使うプロフィール。
      CREATE TABLE IF NOT EXISTS profiles (
        user_id     TEXT PRIMARY KEY NOT NULL,
        height_cm   REAL NOT NULL,
        weight_kg   REAL NOT NULL,
        stride_m    REAL,
        cost_per_km REAL NOT NULL,
        line_id     TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      -- ローカル専用モード(サーバ未接続)のアカウント。開発用スタブ。
      CREATE TABLE IF NOT EXISTS local_users (
        id            TEXT PRIMARY KEY NOT NULL,
        email         TEXT NOT NULL UNIQUE,
        display_name  TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        created_at    TEXT NOT NULL
      );

      -- 地図に描く歩行経路 (任意機能。位置情報を有効にしたときだけ溜まる)。
      CREATE TABLE IF NOT EXISTS route_points (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     TEXT NOT NULL,
        day         TEXT NOT NULL,
        recorded_at TEXT NOT NULL,
        lat         REAL NOT NULL,
        lng         REAL NOT NULL,
        accuracy_m  REAL
      );
      CREATE INDEX IF NOT EXISTS idx_route_points_day ON route_points (user_id, day);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_user ON sync_queue (user_id, id);
    `);
    version = 1;
  }

  // 今後のマイグレーションはここに if (version === 1) { ... version = 2; } と足していく。

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
  log.info(`スキーマを v${DATABASE_VERSION} にしました`);
}

/**
 * 接続を取得する (初回のみ open + マイグレーション)。
 * 同時に複数回呼ばれても Promise を共有するので open は 1 回だけ走る。
 */
export function getDatabaseAsync(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await migrate(db);
      return db;
    })().catch((error) => {
      log.error('データベースを開けませんでした', error);
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

/** テスト・リセット用。 */
export async function closeDatabaseAsync(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.closeAsync();
  dbPromise = null;
}
