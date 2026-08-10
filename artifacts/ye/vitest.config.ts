import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // Enable the automatic React JSX transform so component rendering tests can
  // call renderToStaticMarkup without needing `import React` in every file.
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    globalSetup: ['src/tests/global-setup.ts'],
    setupFiles: ['src/tests/setup-env.ts'],
    // DB-backed integration tests share state (daily-limit counters etc.)
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
