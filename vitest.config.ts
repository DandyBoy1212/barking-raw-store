import { defineConfig, configDefaults } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    // Git worktrees live in .claude/worktrees, so without this the root run collects
    // every worktree's copy of every test as well as its own. They fail on import
    // rather than on an assertion, because server-only resolves against the root's
    // node_modules instead of the worktree's, which reads as a broken suite.
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
});
