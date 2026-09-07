/**
 * 路線判定ロジック (railway/journey.ts) の検証スクリプト。
 *
 *   npm run check:railway
 *
 * テストランナーを入れずに済ませるため、tsc で必要なファイルだけを
 * .railway-check/ に JS で吐き出し、@/ エイリアスを相対パスへ書き換えてから
 * 素の node で実行している。
 * 本格的なテストが必要になったら jest / vitest に置き換えてよい。
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '.railway-check');

const SOURCES = [
  'railway/journey.ts',
  'railway/types.ts',
  'railway/line-registry.ts',
  'railway/lines/kyoto-tozai.ts',
];

function compile() {
  // npx を経由すると Windows で解決に失敗することがあるので、
  // node_modules の tsc を node で直接叩く。
  const tsc = require.resolve('typescript/bin/tsc');
  try {
    execFileSync(
      process.execPath,
      [
        tsc,
        ...SOURCES,
        '--outDir',
        OUT,
        '--module',
        'commonjs',
        '--target',
        'es2020',
        '--moduleResolution',
        'node',
        '--skipLibCheck',
        '--esModuleInterop',
      ],
      { cwd: ROOT, stdio: 'pipe' },
    );
  } catch (error) {
    // tsc は @/ エイリアスを解決できず必ず TS2307 を出すが、JS 自体は出力される。
    // それ以外のエラーが混ざっていたらここで止める。
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    const unexpected = output
      .split('\n')
      .filter((line) => line.includes('error TS') && !line.includes('TS2307'));
    if (unexpected.length > 0) {
      console.error('コンパイルに失敗しました:\n' + unexpected.join('\n'));
      process.exit(1);
    }
  }
}

/** 出力 JS の require("@/railway/x") を相対パスに直す。 */
function rewriteAliases() {
  for (const rel of ['journey.js', 'line-registry.js', 'types.js', 'lines/kyoto-tozai.js']) {
    const file = path.join(OUT, rel);
    const prefix = rel.includes('/') ? '../' : './';
    const src = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(
      file,
      src.replace(/require\("@\/railway\/([^"]+)"\)/g, (_m, p) => `require("${prefix}${p}")`),
    );
  }
}

let failures = 0;

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}` +
      (ok
        ? ''
        : `\n      期待: ${JSON.stringify(expected)}\n      実際: ${JSON.stringify(actual)}`),
  );
}

function main() {
  compile();
  rewriteAliases();

  const { kyotoTozaiLine: line } = require(path.join(OUT, 'lines/kyoto-tozai.js'));
  const {
    computeJourneyProgress,
    stationsReachedBetween,
    toRoutePolyline,
    currentLatLng,
  } = require(path.join(OUT, 'journey.js'));

  console.log('=== 路線データ ===');
  check('駅数', line.stations.length, 17);
  check('全長(m)', line.totalLengthM, 17500);
  check('起点', line.stations[0].name, '六地蔵');
  check('終点', line.stations[16].name, '太秦天神川');
  check(
    '累計キロが昇順',
    line.stations.every((s, i, a) => i === 0 || s.cumulativeM > a[i - 1].cumulativeM),
    true,
  );
  check(
    '全駅に緯度経度',
    line.stations.every((s) => s.lat > 34 && s.lat < 36 && s.lng > 135 && s.lng < 136),
    true,
  );
  check('全駅に観光地', line.stations.every((s) => s.spots.length > 0), true);

  console.log('\n=== 区間判定 (Figma の 蹴上 → 東山) ===');
  // 蹴上 10.5km / 東山 11.5km。11.0km 地点は区間のちょうど半分。
  const mid = computeJourneyProgress(line, 11000);
  check('from', mid.fromStation.name, '蹴上');
  check('to', mid.toStation.name, '東山');
  check('区間進捗', mid.segmentProgress, 0.5);
  check('次の駅まで(m)', mid.distanceToNextStationM, 500);
  check('周回数', mid.lapCount, 0);
  check('到達駅数', mid.reachedStationCount, 8);
  check('近くの駅 (半分以上進んだので次駅)', mid.nearestStation.name, '東山');
  check('蹴上直後の観光地', computeJourneyProgress(line, 10600).nearestStation.spots[0].name, '南禅寺');

  console.log('\n=== 境界値 ===');
  const exact = computeJourneyProgress(line, 1100);
  check('駅ちょうどは次の区間の先頭', [exact.fromStation.name, exact.toStation.name], ['石田', '醍醐']);
  check('駅ちょうどの進捗は0', exact.segmentProgress, 0);
  const zero = computeJourneyProgress(line, 0);
  check('0m は 六地蔵→石田', [zero.fromStation.name, zero.toStation.name], ['六地蔵', '石田']);

  console.log('\n=== 周回 ===');
  const lap = computeJourneyProgress(line, 17500 + 1200);
  check('周回数', lap.lapCount, 1);
  check('2周目の位置', [lap.fromStation.name, lap.toStation.name], ['石田', '醍醐']);
  check('2周目の到達駅数', lap.reachedStationCount, 17);
  const exactLap = computeJourneyProgress(line, 17500);
  check('ちょうど1周は2周目の起点', [exactLap.lapCount, exactLap.fromStation.name], [1, '六地蔵']);

  console.log('\n=== 到達判定 (stationsReachedBetween) ===');
  check(
    '0→10500 で 石田〜蹴上 の8駅',
    stationsReachedBetween(line, 0, 10500).map((a) => a.station.name),
    ['石田', '醍醐', '小野', '椥辻', '東野', '山科', '御陵', '蹴上'],
  );
  check('進んでいなければ空', stationsReachedBetween(line, 11000, 11000).length, 0);
  check('後退したら空 (データ訂正対策)', stationsReachedBetween(line, 11000, 9000).length, 0);
  check('境界ちょうどで1駅', stationsReachedBetween(line, 1099, 1100).map((a) => a.station.name), ['石田']);
  check('同じ境界を2度またがない', stationsReachedBetween(line, 1100, 1101).length, 0);
  check('区間内の移動では駅なし', stationsReachedBetween(line, 10600, 11400).length, 0);

  const across = stationsReachedBetween(line, 17000, 17500 + 1200);
  check('1周をまたぐ到達', across.map((a) => `${a.station.name}(${a.lap})`), ['太秦天神川(0)', '石田(1)']);

  console.log('\n=== 地図用 ===');
  check('ポリライン点数', toRoutePolyline(line).length, 17);
  const pos = currentLatLng(mid);
  const keage = line.stations[8];
  const higashiyama = line.stations[9];
  check(
    '現在地は蹴上と東山の中間',
    [
      Math.abs(pos.latitude - (keage.lat + higashiyama.lat) / 2) < 1e-9,
      Math.abs(pos.longitude - (keage.lng + higashiyama.lng) / 2) < 1e-9,
    ],
    [true, true],
  );

  console.log('\n=== 歩数からの換算 (身長165cm → 歩幅0.7425m) ===');
  const stride = (165 * 0.45) / 100;
  const steps = Math.round(11000 / stride);
  console.log(`  11.0km 進むのに必要な歩数: 約 ${steps.toLocaleString()} 歩`);
  const fromSteps = computeJourneyProgress(line, steps * stride);
  check('歩数経由でも 蹴上→東山', [fromSteps.fromStation.name, fromSteps.toStation.name], ['蹴上', '東山']);

  console.log(`\n${failures === 0 ? '全テスト成功' : `${failures} 件失敗`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
