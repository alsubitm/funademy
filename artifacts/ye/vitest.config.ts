import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
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
