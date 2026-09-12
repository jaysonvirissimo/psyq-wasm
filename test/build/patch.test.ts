// SPDX-License-Identifier: MIT
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fromRoot } from '../helpers/paths.js';
import { loadPins } from '../helpers/pins.js';

const PATCH = fromRoot('build', 'patches', 'obstack.h.diff');
const pins = loadPins();
const VENDOR_OBSTACK = fromRoot(
  'build',
  'vendor',
  'homebrew-psyq',
  pins.get('GCC_SUBDIR') ?? '',
  'gcc',
  'obstack.h',
);

describe('build/patches/obstack.h.diff', () => {
  const text = readFileSync(PATCH, 'utf8');
  const body = text.split('\n').filter((l) => !l.startsWith('---') && !l.startsWith('+++'));
  const removed = body.filter((l) => l.startsWith('-'));
  const added = body.filter((l) => l.startsWith('+'));

  it('targets obstack.h with -p1 style paths', () => {
    expect(text).toContain('--- a/obstack.h');
    expect(text).toContain('+++ b/obstack.h');
  });

  it('only rewrites the six lvalue-cast increment macros', () => {
    expect(removed).toHaveLength(6);
    for (const line of removed) expect(line).toMatch(/\)\+\+ = /);
    expect(added).toHaveLength(8);
    for (const line of added) expect(line).not.toMatch(/\)\+\+ = /);
    const macros = ['obstack_ptr_grow', 'obstack_int_grow'];
    for (const m of macros) {
      expect(text).toContain(`${m}_fast`);
    }
  });

  it('does not touch anything outside obstack.h', () => {
    const headers = text.split('\n').filter((l) => l.startsWith('+++ '));
    expect(headers).toEqual(['+++ b/obstack.h']);
  });

  // Requires the pinned source checkout (`npm run build:vendor`), which needs
  // network access; the patch content itself is verified above regardless.
  it.skipIf(!existsSync(VENDOR_OBSTACK))('applies cleanly to the pinned obstack.h', () => {
    const result = spawnSync('patch', ['--dry-run', '-p1', '-i', PATCH, VENDOR_OBSTACK], {
      encoding: 'utf8',
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
  });
});
