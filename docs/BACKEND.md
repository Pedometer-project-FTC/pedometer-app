# バックグラウンド / データ層 の設計

Figma の画面に値を流し込むための「裏側」一式。
UI との紐づけはまだしていないので、画面側は `usePedometerSystem()` を呼ぶだけで
必要な値が全部取れるようにしてある。

---

## 1. いちばん大事な考え方：歩数はアプリが数えない

「アプリを閉じていても歩数を計測する」を素直に実装しようとすると、
常駐サービスを立てて加速度センサを回し続けることになる。これは電池を食うし、
Android では OS にプロセスを殺されると計測が止まる。

そこでこのアプリは **自分で数えるのをやめて、OS が常時記録している歩数を後から読む**
方式にした。

| プラットフォーム | 歩数ソース | 実装 |
| --- | --- | --- |
| Android | Health Connect | `health/provider.android.ts` |
| iOS | CMPedometer (expo-sensors の Pedometer) | `health/provider.ios.ts` |
| web など | ダミー (常に 0) | `health/provider.ts` |

どちらも OS 側がアプリの起動状態と無関係に歩数を貯めているので、
アプリは「前回読んだ続きから、まとめて読む」だけでよい。

- アプリを 3 日間開かなくても、次に開いた瞬間に 3 日ぶんが入る
- 電池の消費はほぼゼロ
- プロセスを殺されても歩数は失われない

**Metro は `provider.android.ts` / `provider.ios.ts` をプラットフォームごとに
自動で選ぶ**ので、呼び出し側は `import { healthProvider } from '@/health/provider'`
と書くだけでよい（iOS のバンドルに Health Connect は入らないことを確認済み）。

### バックグラウンドタスクの役割

`expo-background-task` で 15 分おきの同期を登録している
（`background/step-sync-task.ts`）。ただしこれは **歩数を計測するためではない**。
「アプリを開かなくても、駅に着いたら通知を出す / サーバに送る」ためのもの。

OS は電池残量や利用パターンを見て実行タイミングを決めるので、15 分ごとに必ず
走るわけではない。走らなくても歩数は失われない（上記のとおり OS が持っている）。

---

## 2. ディレクトリ構成

```
config/app-config.ts      設定値 (.env から読む)
core/
  datetime.ts             DayKey ('YYYY-MM-DD') 周りのユーティリティ
  logger.ts               スコープ付きロガー (直近200件をメモリにも保持)
  http.ts                 fetch ラッパ (タイムアウト付き)
health/
  types.ts                HealthProvider インタフェース
  provider.ts             既定 (web)
  provider.android.ts     Health Connect
  provider.ios.ts         CMPedometer
db/
  database.ts             SQLite 接続 + マイグレーション
  step-repository.ts      日別歩数 (歩数の唯一の正)
  arrival-repository.ts   駅への到達履歴
  profile-repository.ts   身長・体重・歩幅・路線
  kv-repository.ts        雑多な状態 (最終同期時刻など)
  route-repository.ts     歩行経路 (地図用、任意機能)
auth/
  types.ts                AuthBackend インタフェース
  backend.ts              バックエンドの選択 + React 外からの参照
  local-backend.ts        端末内スタブ (開発用)
  http-backend.ts         実サーバ用
  session-store.ts        SecureStore への保存
  auth-context.tsx        AuthProvider / useAuth
railway/
  types.ts                RailwayLine / Station の型
  lines/kyoto-tozai.ts    京都市営地下鉄 東西線のデータ
  line-registry.ts        路線の一覧
  journey.ts              距離 → 駅間位置 の判定  ★要件の中核
metrics/metrics.ts        歩数 → 距離 / kcal / 円
sync/
  step-sync.ts            同期の本体 ★全部の入口がここを通る
  remote-sync.ts          サーバとの送受信
  notifications.ts        駅到達のローカル通知
background/
  task-names.ts           タスク名の定数
  step-sync-task.ts       定期同期タスク
  location-task.ts        経路記録タスク (任意機能)
  index.ts                初期化の入口
hooks/use-pedometer-system.ts   ★画面が使うフック
```

---

## 3. データの流れ

```
      OS のヘルスデータ
            │  readDailyStepsAsync(from, to)
            ▼
   sync/step-sync.ts  ─────────────────────────────┐
            │  upsertDailySteps                    │
            ▼                                      │
   SQLite (daily_steps)                            │
            │  getTotalSteps                       │
            ▼                                      │
   metrics: 歩数 → 距離                            │
            │                                      │
            ▼                                      │
   railway/journey.ts: 距離 → 蹴上→東山 55%        │
            │                                      │
            ├─ 新しく到達した駅 → 通知 + 実績記録   │
            │                                      │
            └─ 未送信ぶんをサーバへ ←──────────────┘
```

`syncSteps()` を呼ぶ入口は 4 つあるが、処理は全部同じ：

| 入口 | いつ | 場所 |
| --- | --- | --- |
| `launch` | アプリ起動時 | `background/index.ts` |
| `foreground` | バックグラウンドから復帰時 | `hooks/use-pedometer-system.ts` |
| `background` | OS が起こしたとき (15分〜) | `background/step-sync-task.ts` |
| `manual` | リロードボタン | `usePedometerSystem().refresh()` |

同時に走らないようにミューテックスを入れてある（後から来た方は走っている方の結果を共有する）。

---

## 4. 画面との紐づけかた

**実装済み。** Figma (Anima が書き出した Web 版のコード) を React Native へ翻訳して、
下記の画面に実データを流し込んである。

```
app/(tabs)/index.tsx          記録 (Figma の Android Medium - 1)
app/(tabs)/map.tsx            マップ (地図は未実装、枠のみ)
app/(tabs)/achievements.tsx   アチーブ (駅の到達チェックリスト)
app/(tabs)/account.tsx        アカウント
app/login.tsx                 ログイン / 新規登録
app/debug.tsx                 開発用ダッシュボード
components/home/              記録画面のパーツ
constants/design.ts           Figma の色・角丸の定義
```

呼び出しかたは以下のとおり。

```tsx
import { usePedometerSystem } from '@/hooks/use-pedometer-system';

const p = usePedometerSystem();

p.today.steps          // 現在の歩数        → 99,999 歩
p.total.distanceM      // 移動距離(累計)    → 999km
p.progress.fromStation // 蹴上 / .kana='けあげ'
p.progress.toStation   // 東山 / .kana='ひがしやま'
p.progress.segmentProgress  // 0〜1 → 進捗バーの幅
p.nearbySpots[0]       // 近くの観光地 { name:'南禅寺', mapsUrl:'https://...' }
p.today.kcal           // 消費カロリー
p.today.savedYen       // 節約した金額
p.refresh()            // 右上のリロードボタン
p.refreshing           // リロード中フラグ
p.status               // 'loading' | 'ready' | 'permission-required' | 'unavailable'
p.requestPermission()  // 'permission-required' のときに呼ぶ
```

地図に線を引くときは：

```tsx
import { toRoutePolyline, currentLatLng } from '@/railway/journey';
import { getRouteForDay } from '@/db/route-repository';

toRoutePolyline(p.line)   // 路線の駅を結んだ座標列
currentLatLng(p.progress) // 今いる場所 (駅間を直線補間した近似)
getRouteForDay(userId, day) // 実際に歩いた経路 (経路記録を有効にした場合)
```

ログイン状態は `useAuth()`：

```tsx
const { status, user, userId, signIn, signUp, signOut } = useAuth();
```

---

## 5. ログイン

サーバがまだ無いので、**バックエンド差し替え式**にしてある。

- `EXPO_PUBLIC_API_BASE_URL` が未設定 → `LocalAuthBackend`（端末内スタブ）
- 設定済み → `HttpAuthBackend`（実サーバ）

画面側は `useAuth()` しか見ないので、サーバができても UI の書き換えは不要。

> ⚠️ `LocalAuthBackend` は開発用。パスワード検証が端末内で完結しているので
> 本番では使えない。ソルト付き SHA-256 の 1 万回反復で保存してはいるが、
> あくまで「DB を覗かれても平文ではない」程度の話。

### 未ログインでも動く

未ログイン時は `user_id = 'guest'` として歩数を貯める。
ログインした時点で `mergeGuestDataInto()` が走り、ゲストのデータが
本アカウントへ引き継がれる。「まず使ってみて、あとで登録する」導線が作れる。

### サーバ側に実装してほしい API

```
POST /auth/signup   { email, password, displayName } -> AuthResponse
POST /auth/signin   { email, password }              -> AuthResponse
POST /auth/signout  { refreshToken }                 -> 204
POST /auth/refresh  { refreshToken }                 -> AuthResponse
GET  /auth/me       (Bearer)                         -> { user }

AuthResponse = {
  user: { id, email, displayName },
  accessToken, refreshToken, expiresAt
}

POST /steps/sync (Bearer)
  req: { lineId, days: [{ day, steps, source, updatedAt }] }
  res: { days: [{ day, steps }] }    // サーバ側で確定した値 (他端末ぶんを含む)

POST /achievements/arrivals (Bearer)
  req: { arrivals: [{ lineId, stationId, lap, totalDistanceM, arrivedAt }] }
```

`day` は端末ローカル暦日の `'YYYY-MM-DD'`。UTC で切ると日本時間の朝 9 時に
日付が変わってしまうので、必ずこの形式で揃えること。

同じ日を複数端末で計測したときは **大きい方を採る**（単純合算すると二重計上になる）。

オフラインでも歩数は `synced_at IS NULL` のまま端末に残り、次にオンラインに
なったときの同期でまとめて送られる。

---

## 6. 路線の判定 (要件の中核)

`railway/journey.ts` の `computeJourneyProgress(line, totalDistanceM)` が、
歩いた総距離を「今どの駅間にいるか」に変換する。

- 全長 (東西線なら 17.5km) を超えたら 2 周目・3 周目として折り返す (`lapCount`)
- `segmentProgress` (0〜1) がそのまま進捗バーの幅になる
- `stationsReachedBetween(line, 前回距離, 今回距離)` で「新しく着いた駅」が取れる。
  これを通知と実績に使う。同じ駅で 2 度通知が飛ばないよう、
  `station_arrivals` テーブルの主キー制約でも二重に防いでいる

### 路線データ

`railway/lines/kyoto-tozai.ts` に全 17 駅ぶん入っている。

- 駅間キロ / 営業キロ: Wikipedia「京都市営地下鉄東西線」の駅一覧（全長 17.5km）
- 緯度経度: rosenzu.net の東西線 緯度経度一覧
- 観光地: 各駅の徒歩圏。URL は Google マップの検索リンクなのでリンク切れしない

**全国対応するとき**は `railway/lines/` にファイルを 1 つ足して
`line-registry.ts` に登録するだけでよい。判定ロジックは路線に依存していない。

### 検証

```bash
npm run check:railway
```

駅数・全長・境界値・周回・到達判定など 33 項目を実際に動かして確認する。

---

## 7. 動作確認の手順

app.json のプラグインと権限を変更したので、**一度ネイティブを作り直す必要がある**。

```bash
npx expo prebuild --clean
```

```bash
npx expo run:android
```

1. 「Explore」タブ（開発用ダッシュボードに置き換えてある）を開く
2. 「権限をリクエスト」→ ヘルスコネクトの権限ダイアログで歩数を許可
3. 「通知を許可する」
4. 「いま同期する」→ 歩数・現在地・観光地が埋まる
5. 「バックグラウンドタスクを手動実行」→ OS の都合を待たずにタスクを 1 回走らせる
   （開発ビルドのみ有効）
6. アプリを閉じて少し歩き、開き直すと歩数が増えていることを確認

Pixel の実機で歩数が 0 のままの場合は、ヘルスコネクト本体に歩数を書き込んでいる
アプリ（Fitbit など）があるか確認する。書き込み側が無いと読むデータも無い。

### 追加した権限

Android:
- `android.permission.health.READ_STEPS`
- `android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND` (Android 15+)
- 位置情報系（経路記録を使う場合のみ）

iOS:
- `NSMotionUsageDescription`
- `UIBackgroundModes: [processing, location]`

---

## 8. 任意機能：歩行経路の記録

地図に「実際に歩いた線」を引くには位置情報が要る。ただし常時取得は電池を食うので
**既定では動かない**。`startRouteTrackingAsync()` を呼んだときだけ記録が始まる。

歩数計測とは完全に独立している（位置情報を切っていても歩数は取れる）。

制約：
- Android は前面サービス通知が常時表示される（OS の要件）
- 利用者がアプリをスワイプで終了させると位置更新は止まる

---

## 9. 未確定・今後の課題

- **運賃**: 「節約した金額」は今のところ距離 × 単価（既定 30 円/km）の概算。
  2025年10月の京都市営地下鉄の運賃改定を確認できなかったため、
  実運賃テーブル (`RailwayLine.fareStages`) は `null` のままにしてある。
  正確な運賃を使いたい場合は出典を確認してから埋めること。
- **プロフィール入力画面**: `db/profile-repository.ts` の読み書きはできているが、
  身長・体重を入力する UI はまだ無い（既定値 165cm / 58kg で計算している）。
- **サーバ**: 上記の API 仕様に沿って実装が必要。
- **開発用ダッシュボード**: `app/debug.tsx` は動作確認用なので、
  リリース前に消してよい (アカウントタブのリンクも一緒に消すこと)。
- **キャラクター画像**: Figma にある恐竜のイラストが未入手。
  素材が届いたら `assets/images/` に置き、`app/(tabs)/index.tsx` の
  `<StepCountCard steps={...} />` に `character={<Image .../>}` を渡す。
- **地図**: `react-native-maps` と Google Maps の API キーが必要。
  描画に使うデータ (`toRoutePolyline` / `currentLatLng` / `getRouteForDay`) は揃っている。
- **web プレビュー**: `metro.config.js` で `.wasm` をアセット扱いにしてあるので、
  `npx expo start` して `http://localhost:8081` を開けばブラウザで画面を確認できる。
  歩数は取れないが、レイアウトの確認には使える。
