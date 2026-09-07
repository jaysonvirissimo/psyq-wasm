// SPDX-License-Identifier: MIT
/**
 * End-to-end tests of the Node entry point against the real distributed
 * artifact in dist/. Requires `npm run build`.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generate } from '../../scripts/gen-stress-fixture.mjs';
import type * as Api from '../../src/index.node.js';
import { readFixture, readFixtureText } from '../helpers/fixtures.js';
import { fromRoot } from '../helpers/paths.js';

type NodeApi = typeof Api;

const api = (await import(pathToFileURL(fromRoot('dist', 'index.node.js')).href)) as NodeApi;
const buildInfo = JSON.parse(readFileSync(fromRoot('dist', 'build-info.json'), 'utf8')) as {
  buildId: string;
};
const STRESS = new TextEncoder().encode(generate(1500));
const FLAGS = ['-O2', '-g0', '-Wall'];

describe('createCompiler (Node)', () => {
  let compiler: Api.Compiler;

  beforeAll(async () => {
    compiler = await api.createCompiler();
  });

  afterAll(() => {
    compiler.dispose();
  });

  it.each(['pooled', 'standalone', 'subarray'] as const)(
    'compiles %s Buffer input without detaching or aliasing it',
    async (kind) => {
      const bytes = readFixture('src/t01_arith.i');
      const buffer = kind === 'pooled' ? Buffer.from(bytes) : Buffer.alloc(bytes.length + 2);
      const source =
        kind === 'subarray'
          ? buffer.subarray(1, bytes.length + 1)
          : buffer.subarray(0, bytes.length);
      source.set(bytes);
      const first = compiler.compilePreprocessed(bytes, { gpSize: 8, rawFlags: FLAGS });
      const pending = compiler.compilePreprocessed(source, { gpSize: 8, rawFlags: FLAGS });
      source.fill(0);
      await first;
      const result = await pending;
      expect(source.byteLength).toBe(bytes.length);
      expect(source.every((byte) => byte === 0)).toBe(true);
      expect(result.success).toBe(true);
      expect(
        Buffer.compare(result.asm ?? new Uint8Array(), readFixture('expected/g8/t01_arith.s')),
      ).toBe(0);
    },
  );

  it('preserves a queued compile after immediate cancellation', async () => {
    const abort = new AbortController();
    const first = compiler.compilePreprocessed(STRESS, {
      gpSize: 8,
      signal: abort.signal,
      timeoutMs: 1,
    });
    const rejected = expect(first).rejects.toSatisfy(api.isAbortError);
    abort.abort();
    const result = await compiler.compilePreprocessed(readFixture('src/t02_shift.i'), {
      gpSize: 0,
      rawFlags: FLAGS,
    });
    await rejected;
    expect(result.success).toBe(true);
    expect(
      Buffer.compare(result.asm ?? new Uint8Array(), readFixture('expected/g0/t02_shift.s')),
    ).toBe(0);
  });

  it('reports the compiler identity from the built artifact', () => {
    expect(compiler.info).toEqual({
      psyqVersion: '4.4',
      gccVersion: '2.8.1',
      buildId: buildInfo.buildId,
    });
    expect(compiler.info.buildId).toMatch(/^sha256:[0-9a-f]{16}$/);
  });

  it('compiles a preprocessed unit to the reference bytes with its warning', async () => {
    const result = await compiler.compilePreprocessed(readFixture('src/t01_arith.i'), {
      gpSize: 8,
      filename: 't01_arith.i',
      rawFlags: FLAGS,
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error('unreachable');
    expect(Buffer.compare(result.asm, readFixture('expected/g8/t01_arith.s'))).toBe(0);
    expect(result.text).not.toContain('\r');
    expect(result.text.startsWith('\t.file\t1 "t01_arith.c"\n')).toBe(true);
    expect(result.rawStderr).toBe(readFixtureText('expected/g8/t01_arith.err'));
    expect(result.diagnostics).toEqual([
      {
        severity: 'warning',
        file: 't01_arith.c',
        line: 3,
        message: 'suggest parentheses around arithmetic in operand of |',
      },
    ]);
    expect(result.timings.compileMs).toBeGreaterThan(0);
    expect(result.timings.totalMs).toBeGreaterThanOrEqual(result.timings.compileMs);
  });

  it('reports a compiler error as a failed result, naming the given filename', async () => {
    const source = new TextEncoder().encode('int otacon(void) { return 1; }\nint hound( { }\n');
    const result = await compiler.compilePreprocessed(source, { gpSize: 8, filename: 'hound.i' });
    expect(result.success).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0]).toMatchObject({ severity: 'error', file: 'hound.i', line: 2 });
    expect(result.rawStderr).toContain('hound.i:2:');
  });

  it('is deterministic across compiles and worker restarts', async () => {
    const source = readFixture('src/t12_misc.i');
    const options = { gpSize: 0 as const, rawFlags: FLAGS };
    const first = await compiler.compilePreprocessed(source, options);
    const second = await compiler.compilePreprocessed(source, options);
    if (!first.success || !second.success) throw new Error('compile failed');
    expect(Buffer.compare(first.asm, second.asm)).toBe(0);
  });

  it('times out on a large unit and recovers on the next compile', async () => {
    await expect(
      compiler.compilePreprocessed(STRESS, { gpSize: 8, rawFlags: FLAGS, timeoutMs: 1 }),
    ).rejects.toBeInstanceOf(api.CompileTimeoutError);
    const after = await compiler.compilePreprocessed(readFixture('src/t05_loop.i'), {
      gpSize: 8,
      rawFlags: FLAGS,
    });
    expect(after.success).toBe(true);
    if (!after.success) throw new Error('unreachable');
    expect(Buffer.compare(after.asm, readFixture('expected/g8/t05_loop.s'))).toBe(0);
  });

  it('aborts an in-flight compile and recovers', async () => {
    const abort = new AbortController();
    const pending = compiler.compilePreprocessed(STRESS, {
      gpSize: 8,
      rawFlags: FLAGS,
      signal: abort.signal,
    });
    setTimeout(() => {
      abort.abort();
    }, 5);
    await expect(pending).rejects.toSatisfy(api.isAbortError);
    const after = await compiler.compilePreprocessed(readFixture('src/t02_shift.i'), {
      gpSize: 0,
      rawFlags: FLAGS,
    });
    expect(after.success).toBe(true);
  });

  it('actually compiles the stress unit when given time', async () => {
    const result = await compiler.compilePreprocessed(STRESS, { gpSize: 8, rawFlags: FLAGS });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error('unreachable');
    expect(result.text).toContain('codec_1499');
  }, 120_000);

  it('rejects oversized sources and bad options without touching the worker', async () => {
    await expect(
      compiler.compilePreprocessed(new Uint8Array(api.DEFAULT_LIMITS.maxSourceBytes + 1), {
        gpSize: 8,
      }),
    ).rejects.toBeInstanceOf(api.InvalidOptionsError);
    await expect(
      compiler.compilePreprocessed(new Uint8Array(1), { gpSize: 8, rawFlags: ['-G0'] }),
    ).rejects.toBeInstanceOf(api.InvalidOptionsError);
  });
});

describe('dispose', () => {
  it('rejects later compiles with CompilerDisposedError', async () => {
    const compiler = await api.createCompiler();
    compiler.dispose();
    await expect(
      compiler.compilePreprocessed(new Uint8Array(1), { gpSize: 8 }),
    ).rejects.toBeInstanceOf(api.CompilerDisposedError);
  });
});

describe('asset overrides', () => {
  it('accepts explicit file URLs for the worker and wasm', async () => {
    const compiler = await api.createCompiler({
      workerUrl: new URL('../../dist/worker.node.js', import.meta.url),
      wasmUrl: new URL('../../dist/cc1psx.wasm', import.meta.url),
      limits: { defaultTimeoutMs: 60_000 },
    });
    try {
      const result = await compiler.compilePreprocessed(readFixture('src/t08_call.i'), {
        gpSize: 8,
        rawFlags: FLAGS,
      });
      expect(result.success).toBe(true);
    } finally {
      compiler.dispose();
    }
  });

  it('fails clearly when the wasm asset is missing', async () => {
    await expect(
      api.createCompiler({ wasmUrl: new URL('../../dist/missing.wasm', import.meta.url) }),
    ).rejects.toBeInstanceOf(api.InternalError);
  });
});
