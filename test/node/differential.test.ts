// SPDX-License-Identifier: MIT
/**
 * Differential compiler tests: every fixture in the manifest must reproduce the
 * reference compiler's output byte for byte, and its stderr exactly.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type * as Api from '../../src/index.node.js';
import { loadManifest, readFixture, readFixtureText } from '../helpers/fixtures.js';
import { fromRoot } from '../helpers/paths.js';

const api = (await import(fromRoot('dist', 'index.node.js'))) as typeof Api;
const { fixtures } = loadManifest();

/** Describe the first differing byte with some context, for readable failures. */
function firstDifference(actual: Uint8Array, expected: Uint8Array): string {
  const n = Math.min(actual.length, expected.length);
  let i = 0;
  while (i < n && actual[i] === expected[i]) i++;
  const show = (bytes: Uint8Array): string =>
    JSON.stringify(new TextDecoder().decode(bytes.subarray(Math.max(0, i - 40), i + 40)));
  return (
    `first difference at byte ${String(i)} (actual ${String(actual.length)} bytes, expected ${String(expected.length)} bytes)\n` +
    `  actual:   ${show(actual)}\n  expected: ${show(expected)}`
  );
}

describe('differential: wasm cc1psx vs reference cc1psx', () => {
  let compiler: Api.Compiler;

  beforeAll(async () => {
    compiler = await api.createCompiler();
  });

  afterAll(() => {
    compiler.dispose();
  });

  it.each(fixtures.map((f) => [f.name, f] as const))('%s', async (_name, fixture) => {
    const result = await compiler.compilePreprocessed(readFixture(fixture.input), {
      gpSize: fixture.gpSize,
      filename: fixture.filename,
      rawFlags: fixture.rawFlags,
    });

    expect(result.exitCode).toBe(fixture.expectedExitCode);

    if (fixture.expected !== undefined) {
      const expected = readFixture(fixture.expected);
      expect(result.asm, 'no assembly produced').toBeDefined();
      if (result.asm !== undefined && Buffer.compare(result.asm, expected) !== 0) {
        throw new Error(firstDifference(result.asm, expected));
      }
    } else {
      expect(result.asm).toBeUndefined();
    }

    const expectedStderr =
      fixture.expectedStderr === undefined ? '' : readFixtureText(fixture.expectedStderr);
    expect(result.rawStderr).toBe(expectedStderr);
    expect(result.rawStdout).toBe('');
  });
});
