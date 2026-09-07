// SPDX-License-Identifier: MIT
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fromRoot } from '../helpers/paths.js';

/**
 * Bundlers (Vite, webpack, Rollup) only recognise worker and asset references
 * written as these exact literals. A refactor that breaks them would still pass
 * every behavioural test, so the literals are pinned here.
 */
describe('bundler-visible asset literals', () => {
  const browser = readFileSync(fromRoot('src', 'platform-browser.ts'), 'utf8');

  it('spawns the default worker with the literal module-worker form', () => {
    expect(browser).toContain(
      "new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })",
    );
  });

  it('resolves the wasm asset with the literal URL form', () => {
    expect(browser).toContain("new URL('./cc1psx.wasm', import.meta.url)");
  });

  it('never spells the default asset names any other way', () => {
    const worker = readFileSync(fromRoot('src', 'worker.ts'), 'utf8');
    expect(worker).toContain("from './cc1psx.js'");
    expect(readFileSync(fromRoot('src', 'worker.node.ts'), 'utf8')).toContain("from './cc1psx.js'");
  });
});
