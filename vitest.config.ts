import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['tests/routing/**/*.test.ts'], environment: 'node',
    maxWorkers: 1, testTimeout: 30_000, hookTimeout: 30_000 },
});
