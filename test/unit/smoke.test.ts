// SPDX-License-Identifier: MIT
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('project smoke', () => {
  it('has the expected package name', async () => {
    const pkg = JSON.parse(
      await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
    ) as {
      name: string;
    };
    expect(pkg.name).toBe('psyq-wasm');
  });
});
