import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    files: ["src/app/api/resume/[[]id[]]/export/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["src/components/preview/templates/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Test fixtures intentionally poke malformed shapes through public APIs;
  // `any` there documents "arbitrary input", not a missing type.
  {
    files: ["**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".worktrees/**",
    // gitignored AI 工具目录（AGENTS.md：AI 工具本地状态不入库）
    ".agents/**",
    ".claude/**",
    ".commandcode/**",
    ".codex/**",
    ".superpowers/**",
    "agent/**",
    "data/**",
  ]),
]);

export default eslintConfig;
