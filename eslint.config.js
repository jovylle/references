import js from "@eslint/js";

const browserGlobals = {
  window: "readonly",
  document: "readonly",
  globalThis: "readonly",
  console: "readonly",
  fetch: "readonly",
  localStorage: "readonly",
  sessionStorage: "readonly",
  URLSearchParams: "readonly",
  Intl: "readonly",
  HTMLElement: "readonly",
  Event: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  ProjectMate: "readonly",
  confirm: "readonly",
};

const nodeGlobals = {
  process: "readonly",
  console: "readonly",
};

const unusedVarsRule = [
  "error",
  { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
];

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: browserGlobals,
    },
    rules: {
      "no-unused-vars": unusedVarsRule,
    },
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: nodeGlobals,
    },
    rules: {
      "no-unused-vars": unusedVarsRule,
    },
  },
  {
    ignores: ["node_modules/**"],
  },
];
