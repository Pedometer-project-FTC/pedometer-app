// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite を web で動かすには wa-sqlite.wasm を読み込む必要があるが、
// Metro は既定で .wasm をアセットとして扱わない。
// (実機の Android / iOS には不要。ブラウザで画面の見た目を確認するときのため)
config.resolver.assetExts.push('wasm');

module.exports = config;
