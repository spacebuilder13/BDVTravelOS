const js = require("@eslint/js");
const globals = require("globals");

// Money helpers only. The rest of the app stays on the CRA lint pass.
module.exports = [
  {
    files: ["src/utils/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.jest,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
    },
  },
];
