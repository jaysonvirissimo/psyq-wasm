// SPDX-License-Identifier: MIT
/**
 * Runs dist/cccp.js directly, without the wrapper: the preprocessor artifact
 * must reproduce the committed reference .i for a fixture byte for byte. This
 * also proves that cccp's `freopen(out_fname, "w", stdout)` works on MEMFS.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CPP_FLAGS } from '../../src/argv.js';
import type { Cc1Factory } from '../../src/cc1psx.js';
import { readFixture } from '../helpers/fixtures.js';
import { fromRoot } from '../helpers/paths.js';

interface Glue {
  readonly default: Cc1Factory;
  readonly BUILD_ID: string;
}

describe('dist/cccp.js', () => {
  it('preprocesses t01_arith.c exactly like the reference cccp', async () => {
    const glue = (await import(pathToFileURL(fromRoot('dist', 'cccp.js')).href)) as Glue;
    const stderr: string[] = [];
    const cccp = await glue.default({
      print: () => undefined,
      printErr: (line) => stderr.push(line),
      thisProgram: 'cccp',
    });
    cccp.FS.mkdir('/work');
    cccp.FS.chdir('/work');
    cccp.FS.writeFile('/work/t01_arith.c', readFixture('src/t01_arith.c'));
    const exitCode = cccp.callMain([
      '-nostdinc',
      '-undef',
      ...DEFAULT_CPP_FLAGS,
      't01_arith.c',
      'out.i',
    ]);
    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    const expected = readFileSync(fromRoot('test', 'fixtures', 'src', 't01_arith.i'));
    expect(Buffer.compare(Buffer.from(cccp.FS.readFile('/work/out.i')), expected)).toBe(0);
    expect(glue.BUILD_ID).toMatch(/^sha256:[0-9a-f]{16}$/);
  });
});
