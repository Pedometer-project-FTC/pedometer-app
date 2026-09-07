# UI をいじるときのガイド

プログラミングが分からなくても、色や文字や大きさは変えられます。
「どのファイルを開けばいいか」と「どこを書き換えればいいか」だけ覚えれば大丈夫です。

---

## 1. まず覚えること: ファイルは上下 2 つに分かれている

画面のファイルを開くと、必ずこの形になっています。

```tsx
      ...省略...

      <Text style={styles.heading}>現在の歩数</Text>     ← 上半分: 画面に出るもの

      ...省略...

const styles = StyleSheet.create({                       ← ここから下が「見た目の設定」
  heading: {
    color: '#FFFFFF',      ← 文字の色
    fontSize: 16,          ← 文字の大きさ
  },
});
```

- **上半分** = 「何を出すか」(文章・並び順)
- **下半分** = 「どう見せるか」(色・大きさ・余白)

`styles.heading` と書いてある部分が、下半分の `heading:` と繋がっています。
**名前が同じもの同士がペア**、とだけ思っておけば十分です。

---

## 2. どのファイルをいじる?

### 色を変えたい → `constants/design.ts`

**アプリ全体の色はここ 1 つにまとまっています。** ここを直すと全画面に反映されます。

```ts
export const DesignColors = {
  green: '#96C17D',        ← 上の帯と下のタブの緑
  stepCard: '#FFC4C4',     ← 歩数カードのピンク
  stationFace: '#F0F0F0',  ← 駅名カードの白っぽい部分
  stationText: '#63799E',  ← 駅名の文字色
  stationKana: '#647A9F',  ← ふりがなの帯の色
  tourist: '#5FC0CA',      ← 「近くの観光地」の水色
  calorie: '#FFB969',      ← 「消費カロリー」のオレンジ
  money: '#C98BE3',        ← 「節約した金額」の紫
};
```

`'#96C17D'` の部分を別の色コードに書き換えるだけです。
色コードは Figma で対象を選ぶと右側に出てきます (`#` から始まる 6 桁)。

> 引用符 `'` は消さないでください。`'#96C17D'` の **中身だけ** 書き換えます。

### 画面ごとの中身を変えたい → `app/(tabs)/` の中

| 変えたい画面 | 開くファイル |
| --- | --- |
| 記録 (メイン画面) | `app/(tabs)/index.tsx` |
| マップ | `app/(tabs)/map.tsx` |
| アチーブ | `app/(tabs)/achievements.tsx` |
| アカウント | `app/(tabs)/account.tsx` |
| 下のタブバー | `app/(tabs)/_layout.tsx` |
| ログイン画面 | `app/login.tsx` |

### 記録画面の一部分だけ変えたい → `components/home/` の中

記録画面はパーツに分けてあります。触りたい部分のファイルだけ開けば済みます。

| 変えたい部分 | 開くファイル |
| --- | --- |
| ピンクの歩数カード | `components/home/step-count-card.tsx` |
| 移動距離・駅 → 駅・線路のバー | `components/home/journey-section.tsx` |
| 観光地 / カロリー / 節約額の 3 本の帯 | `components/home/stat-row.tsx` |
| 上の緑の帯 | `components/home/screen-header.tsx` |

---

## 3. よくある変更のやり方

### 文字を変える

`<Text>` と `</Text>` に挟まれた部分が画面に出る文字です。

```tsx
<Text style={styles.heading}>現在の歩数</Text>
                             ^^^^^^^^ ここを書き換える
```

### 文字の大きさを変える

下半分の `fontSize` の数字を変えます。単位は書きません。

```ts
heading: {
  fontSize: 16,    → fontSize: 20,  にすると大きくなる
},
```

### 余白を変える

| 書き方 | 意味 |
| --- | --- |
| `padding` | 内側の余白 (全方向) |
| `paddingHorizontal` | 内側の余白 (左右だけ) |
| `paddingVertical` | 内側の余白 (上下だけ) |
| `margin` | 外側の余白 |
| `gap` | 並んでいるもの同士の間隔 |

数字を大きくすれば広がり、小さくすれば詰まります。

### 角の丸みを変える

```ts
borderRadius: 20,    数字を大きくするほど丸くなる。0 で角ばる
```

---

## 4. 変更した結果を見る方法

エミュレータを立ち上げなくても、ブラウザで確認できます。

```bash
npx expo start
```

出てきたメッセージの中の `http://localhost:8081` をブラウザで開いてください。
**ファイルを保存すると自動で画面が更新されます。**

> 歩数は 0 のままですが、色や配置の確認には十分です。
> 実際の歩数まで確認したいときは実機かエミュレータが必要です。

---

## 5. 触らないほうがいいところ

以下は動作に関わるので、触ると画面が真っ白になったりエラーが出ます。

- ファイルの **いちばん上にある `import` から始まる行** (部品の取り寄せ設定)
- `usePedometerSystem()` や `useAuth()` と書いてある行 (データの取得)
- `{` `}` `(` `)` `<` `>` などの記号 (数が合わないと壊れます)
- `app/(tabs)/` 以外のフォルダ (`db/` `sync/` `auth/` `health/` `railway/` `background/` `core/` はデータ処理の担当)

---

## 6. 壊してしまったときの戻しかた

**安心してください。保存前の状態にいつでも戻せます。**

いじったファイルを全部リセットする:

```bash
git checkout -- .
```

これで最後にコミットした状態に戻ります。エラーが出て分からなくなったら、まずこれを実行してください。

> 逆に言うと、**うまくいったらこまめにコミット**しておくと安心です。
> コミット = その時点を保存ポイントとして記録すること。

---

## 7. 素材を差し込みたいとき

### キャラクター画像 (歩数カードの右側の恐竜)

1. 画像を `assets/images/step-character.png` として置く
2. `app/(tabs)/index.tsx` を開いて、以下の行を探す

```tsx
<StepCountCard steps={today.steps} />
```

3. こう書き換える

```tsx
<StepCountCard
  steps={today.steps}
  character={
    <Image
      source={require('@/assets/images/step-character.png')}
      style={{ width: 69, height: 81 }}
    />
  }
/>
```

4. ファイルのいちばん上に次の行を足す

```tsx
import { Image } from 'expo-image';
```

### タブのアイコン

`app/(tabs)/_layout.tsx` の中の `tabBarIcon` の行を差し替えます。
今はアイコンライブラリで代用しているので、Figma の素材が揃ったら
画像に置き換えられます。分からなければ聞いてください。

---

## 8. 困ったときは

- **画面が真っ白になった** → `git checkout -- .` で戻す
- **赤いエラー画面が出た** → エラーの 1 行目をコピーして相談する
- **どのファイルか分からない** → 変えたい部分の文字 (例: 「近くの観光地」) を
  エディタの全体検索にかけると、そのファイルが見つかります
  (VS Code なら `Ctrl + Shift + F`)
