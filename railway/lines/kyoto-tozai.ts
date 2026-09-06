import type { RailwayLine, Station, TouristSpot } from '@/railway/types';

/**
 * 京都市営地下鉄 東西線 (六地蔵 → 太秦天神川)。
 *
 * ・駅間キロ / 営業キロ: Wikipedia「京都市営地下鉄東西線」の駅一覧より (全長 17.5km)
 * ・緯度経度: rosenzu.net の東西線 緯度経度一覧より
 * ・観光地: 各駅の徒歩圏にある代表的なスポット。URL は Google マップの
 *   検索リンクなので、場所が移動したり閉業してもリンク切れにならない。
 */

const LINE_ID = 'kyoto-tozai';

function spot(name: string, note?: string): TouristSpot {
  return {
    name,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`,
    note,
  };
}

/** [駅番号, 駅名, かな, ローマ字, 累計営業キロ(km), 緯度, 経度, 観光地...] */
type Row = [string, string, string, string, number, number, number, TouristSpot[]];

const ROWS: Row[] = [
  ['T01', '六地蔵', 'ろくじぞう', 'Rokujizo', 0.0, 34.932778, 135.797334,
    [spot('大善寺 六地蔵', '六地蔵めぐりの一つ'), spot('宇治川')]],
  ['T02', '石田', 'いしだ', 'Ishida', 1.1, 34.9402821, 135.8036767,
    [spot('日野誕生院'), spot('法界寺')]],
  ['T03', '醍醐', 'だいご', 'Daigo', 2.4, 34.95086, 135.81063,
    [spot('醍醐寺', '世界遺産'), spot('三宝院')]],
  ['T04', '小野', 'おの', 'Ono', 3.6, 34.961218, 135.812733,
    [spot('随心院', '小野小町ゆかりの寺'), spot('勧修寺')]],
  ['T05', '椥辻', 'なぎつじ', 'Nagitsuji', 4.9, 34.972717, 135.814888,
    [spot('山科中央公園')]],
  ['T06', '東野', 'ひがしの', 'Higashino', 5.9, 34.982207, 135.816763,
    [spot('山科疏水')]],
  ['T07', '山科', 'やましな', 'Yamashina', 7.0, 34.992336, 135.817083,
    [spot('毘沙門堂'), spot('琵琶湖疏水 山科'), spot('折上稲荷神社')]],
  ['T08', '御陵', 'みささぎ', 'Misasagi', 8.7, 34.996158, 135.801637,
    [spot('天智天皇陵'), spot('日ノ岡')]],
  ['T09', '蹴上', 'けあげ', 'Keage', 10.5, 35.008037, 135.790227,
    [spot('南禅寺'), spot('蹴上インクライン'), spot('琵琶湖疏水記念館')]],
  ['T10', '東山', 'ひがしやま', 'Higashiyama', 11.5, 35.009431, 135.779717,
    [spot('平安神宮'), spot('青蓮院門跡'), spot('知恩院')]],
  ['T11', '三条京阪', 'さんじょうけいはん', 'Sanjo-Keihan', 12.1, 35.009278, 135.773773,
    [spot('鴨川'), spot('先斗町'), spot('高瀬川')]],
  ['T12', '京都市役所前', 'きょうとしやくしょまえ', 'Kyoto Shiyakusho-mae', 12.6, 35.011003, 135.768829,
    [spot('本能寺'), spot('京都市役所')]],
  ['T13', '烏丸御池', 'からすまおいけ', 'Karasuma Oike', 13.5, 35.010517, 135.759638,
    [spot('六角堂 頂法寺'), spot('京都文化博物館'), spot('京都国際マンガミュージアム')]],
  ['T14', '二条城前', 'にじょうじょうまえ', 'Nijojo-mae', 14.3, 35.011892, 135.750473,
    [spot('二条城', '世界遺産'), spot('神泉苑')]],
  ['T15', '二条', 'にじょう', 'Nijo', 15.1, 35.010967, 135.741701,
    [spot('京都市学校歴史博物館'), spot('三条会商店街')]],
  ['T16', '西大路御池', 'にしおおじおいけ', 'Nishioji Oike', 16.2, 35.010933, 135.730466,
    [spot('京都市中央卸売市場')]],
  ['T17', '太秦天神川', 'うずまさてんじんがわ', 'Uzumasa Tenjingawa', 17.5, 35.01081, 135.715556,
    [spot('東映太秦映画村'), spot('広隆寺'), spot('車折神社')]],
];

const stations: Station[] = ROWS.map(([code, name, kana, romaji, km, lat, lng, spots]) => ({
  id: `${LINE_ID}/${code}`,
  code,
  name,
  kana,
  romaji,
  lat,
  lng,
  cumulativeM: Math.round(km * 1000),
  spots,
}));

export const kyotoTozaiLine: RailwayLine = {
  id: LINE_ID,
  name: '京都市営地下鉄 東西線',
  operator: '京都市交通局',
  // 東西線のラインカラーは朱色。
  color: '#C1272D',
  stations,
  totalLengthM: stations[stations.length - 1].cumulativeM,
  // 2025年10月の改定を確認できていないため、実運賃は未設定にしておく。
  // 確認できたら [{ upToM: 3000, yen: ... }, ...] の形で埋める。
  fareStages: null,
};
