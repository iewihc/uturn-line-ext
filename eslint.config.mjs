// 只檢查會影響維護的項目：未使用的變數／函式、未定義的名稱（含 Tampermonkey 的 GM_* 全域）。
import globals from "globals";

export default [
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        GM_info: "readonly", GM_getValue: "readonly", GM_setValue: "readonly",
        GM_xmlhttpRequest: "readonly", GM_setClipboard: "readonly", GM_cookie: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { args: "after-used", caughtErrors: "none", argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-undef": "error",
      "no-redeclare": "error",
    },
  },
];
