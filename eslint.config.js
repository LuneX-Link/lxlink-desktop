import tsParser from "@typescript-eslint/parser"
import tsPlugin from "@typescript-eslint/eslint-plugin"
import reactHooks from "eslint-plugin-react-hooks"

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "src-tauri/**",
      "docs/**",
      "*.config.js",
    ],
  },
  {
    files: ["src/**/*.{ts,tsx}", "src-splash/**/*.{ts,tsx}", "vite.config.ts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]
