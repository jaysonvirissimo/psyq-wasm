// SPDX-License-Identifier: MIT
// Vitest setup file for the `node` project: these tests exercise the real
// distributed artifact and must fail loudly, never skip, when it is absent.
import { existsSync } from 'node:fs';
import { fromRoot } from '../helpers/paths.js';

const required = [
  'dist/cc1psx.wasm',
  'dist/cc1psx.js',
  'dist/cccp.wasm',
  'dist/cccp.js',
  'dist/index.node.js',
  'dist/worker.node.js',
];
const missing = required.filter((rel) => !existsSync(fromRoot(rel)));

if (missing.length > 0) {
  throw new Error(
    `Missing build output: ${missing.join(', ')}.\n` +
      'Run `npm run build:wasm && npm run build:ts` before `npm run test:node`.',
  );
}
