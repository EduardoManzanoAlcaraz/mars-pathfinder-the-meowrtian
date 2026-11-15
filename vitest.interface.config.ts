import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/interface/**/*.test.ts'], environment: 'node', maxWorkers: 1, testTimeout: 60_000, hookTimeout: 30_000 } });
