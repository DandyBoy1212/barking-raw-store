import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Git worktrees live here, each with its own .next build output. These patterns
    // are root-relative, so ".next/**" does not match a worktree's copy, and eslint
    // walked into the bundled build output and died with a heap limit error rather
    // than a lint failure. Ignore the whole directory: a worktree lints itself.
    ".claude/**",
  ]),
]);

export default eslintConfig;
