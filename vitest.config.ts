// SPDX-License-Identifier: MIT
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['test/unit/**/*.test.ts', 'test/build/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['test/node/**/*.test.ts'],
          setupFiles: ['test/node/require-dist.ts'],
          testTimeout: 120_000,
          hookTimeout: 120_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Exclusions are documented in CONTRIBUTING.md ("Coverage exclusions").
      exclude: ['src/worker.ts', 'src/worker.node.ts', 'src/cc1psx.d.ts', 'src/public-types.ts'],
      thresholds: {
        statements: 99,
        branches: 99,
        functions: 99,
        lines: 99,
      },
      reporter: ['text', 'lcov', 'json-summary'],
    },
  },
});
