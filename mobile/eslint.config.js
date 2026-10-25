// ESLint（Expo の推奨設定）。実行: npm run lint
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "ios/*", "android/*", ".expo/*", "metro.config.cjs"],
  },
  {
    rules: {
      // React Compiler 向けの規則。このアプリはコンパイラを使っておらず、
      // PanResponder の最新クロージャ参照（ref）や Date.now() を描画中に読む書き方を意図して使っている
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
    },
  },
]);
