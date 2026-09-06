// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.railway-check/*'],
  },
  {
    // scripts/ は Metro ではなく Node で直接動かす CommonJS スクリプト。
    // __dirname / require / process が使えることを ESLint に伝える。
    files: ['scripts/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },
]);
