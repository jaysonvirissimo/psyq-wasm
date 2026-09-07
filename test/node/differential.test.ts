// SPDX-License-Identifier: MIT
/**
 * Differential compiler tests: every fixture in the manifest must reproduce the
 * reference compiler's output byte for byte, and its stderr exactly.
 */
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type * as Api from '../../src/index.node.js';
import { existsSync } from 'node:fs';
import {
  fixturePath,
  loadManifest,
  loadSourceHeaders,
  readFixture,
  readFixtureText,
} from '../helpers/fixtures.js';
import { fromRoot } from '../helpers/paths.js';

const api = (await import(pathToFileURL(fromRoot('dist', 'index.node.js')).href)) as typeof Api;
const { fixtures, sources } = loadManifest();

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

describe('differential: wasm cccp + cc1psx vs the reference pipeline', () => {
  let compiler: Api.Compiler;

  beforeAll(async () => {
    compiler = await api.createCompiler();
  });

  afterAll(() => {
    compiler.dispose();
  });

  function compareBytes(actual: Uint8Array | undefined, expectedFile: string, what: string): void {
    const expected = readFixture(expectedFile);
    expect(actual, `no ${what} produced`).toBeDefined();
    if (actual !== undefined && Buffer.compare(actual, expected) !== 0) {
      throw new Error(`${what}: ${firstDifference(actual, expected)}`);
    }
  }

  it.each(sources.map((s) => [s.name, s] as const))('%s', async (_name, source) => {
    const result = await compiler.compileSource(readFixture(source.source), {
      gpSize: source.gpSize,
      filename: source.filename,
      rawFlags: source.rawFlags,
      headers: loadSourceHeaders(source),
      cppFlags: [...api.DEFAULT_CPP_FLAGS, ...(source.extraCppFlags ?? [])],
      ...(source.encoding === undefined ? {} : { encoding: source.encoding }),
    });

    expect(result.exitCode).toBe(source.expectedExitCode);
    if (result.success) expect('stage' in result).toBe(false);
    else expect(result.stage).toBe(source.expectedStage);

    compareBytes(result.preprocessed, source.expectedPreprocessed, 'preprocessed source');
    if (source.expected !== undefined) compareBytes(result.asm, source.expected, 'assembly');
    else expect(result.asm).toBeUndefined();

    const expectedStderr =
      source.expectedStderr === undefined ? '' : readFixtureText(source.expectedStderr);
    expect(result.rawStderr).toBe(expectedStderr);
    expect(result.rawStdout).toBe('');
  });

  // Every preprocessed fixture was produced from its .c with the default
  // preprocessor flags, so each one is also a preprocessing differential case
  // (those needing headers or re-encoding have explicit `sources` entries).
  const derived = fixtures
    .filter((f) => !f.rawFlags.includes('-g'))
    .map((f) => ({ ...f, source: f.input.replace(/\.i$/, '.c') }))
    .filter((f) => existsSync(fixturePath(f.source)))
    .filter((f) => !sources.some((s) => s.source === f.source));

  it.each(derived.map((f) => [`${f.name} from ${f.source}`, f] as const))(
    '%s',
    async (_name, fixture) => {
      const result = await compiler.compileSource(readFixture(fixture.source), {
        gpSize: fixture.gpSize,
        filename: fixture.filename.replace(/\.i$/, '.c'),
        rawFlags: fixture.rawFlags,
        cppFlags: [...api.DEFAULT_CPP_FLAGS, '-Iinclude'],
      });
      expect(result.exitCode).toBe(fixture.expectedExitCode);
      compareBytes(result.preprocessed, fixture.input, 'preprocessed source');
      if (fixture.expected !== undefined) compareBytes(result.asm, fixture.expected, 'assembly');
      const expectedStderr =
        fixture.expectedStderr === undefined ? '' : readFixtureText(fixture.expectedStderr);
      expect(result.rawStderr).toBe(expectedStderr);
    },
  );
});
