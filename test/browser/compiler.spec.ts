// SPDX-License-Identifier: MIT
/**
 * Browser integration tests. They run the real dist/ build in Chromium,
 * Firefox, and WebKit via the harness page in test/browser/page/.
 */
import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { loadManifest, readFixture, readFixtureText } from '../helpers/fixtures.js';

const PAGE = '/test/browser/page/';
const FLAGS = ['-O2', '-g0', '-Wall'];

interface Summary {
  success: boolean;
  exitCode: number;
  asmSha256: string | null;
  asmLength: number | null;
  textHasCr: boolean | null;
  diagnostics: { severity: string; file?: string; line?: number; message: string }[];
  rawStderr: string;
  compiler: { psyqVersion: string; gccVersion: string; buildId: string };
  timings: { instantiateMs: number; compileMs: number; totalMs: number };
}

interface ErrorSummary {
  name: string;
  code: string | undefined;
  message: string;
  isAbortError: boolean;
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Requests for package assets, tracked to prove the module is fetched once. */
function trackAssets(page: Page): { wasm: string[]; worker: string[] } {
  const seen = { wasm: [] as string[], worker: [] as string[] };
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('/dist/cc1psx.wasm')) seen.wasm.push(url.pathname);
    if (url.pathname.endsWith('/dist/worker.js')) seen.worker.push(url.pathname);
  });
  return seen;
}

async function openHarness(page: Page): Promise<void> {
  await page.goto(PAGE);
  await page.waitForFunction(
    () => (window as unknown as { psyqReady?: boolean }).psyqReady === true,
  );
}

/** Create a compiler on the page and keep it on window.compiler. */
async function createCompiler(
  page: Page,
  options?: Record<string, unknown>,
): Promise<Summary['compiler']> {
  return page.evaluate(async (opts) => {
    const w = window as unknown as {
      psyq: { createCompiler: (o?: unknown) => Promise<{ info: Summary['compiler'] }> };
      compiler: unknown;
    };
    const compiler = await w.psyq.createCompiler(opts);
    w.compiler = compiler;
    return compiler.info;
  }, options);
}

async function compileFixture(
  page: Page,
  input: string,
  options: { gpSize: 0 | 8; filename?: string; rawFlags?: string[]; timeoutMs?: number },
): Promise<Summary> {
  return page.evaluate(
    async ([inputPath, opts]) => {
      const w = window as unknown as {
        psyq: {
          fetchFixture: (p: string) => Promise<Uint8Array>;
          summarize: (r: unknown) => Promise<Summary>;
        };
        compiler: { compilePreprocessed: (s: Uint8Array, o: unknown) => Promise<unknown> };
      };
      const source = await w.psyq.fetchFixture(inputPath);
      return w.psyq.summarize(await w.compiler.compilePreprocessed(source, opts));
    },
    [input, options] as const,
  );
}

test.describe('psyq-wasm in the browser', () => {
  test('initializes from package-relative assets and reports the compiler identity', async ({
    page,
  }) => {
    const assets = trackAssets(page);
    await openHarness(page);
    const info = await createCompiler(page);
    expect(info.psyqVersion).toBe('4.4');
    expect(info.gccVersion).toBe('2.8.1');
    expect(info.buildId).toMatch(/^sha256:[0-9a-f]{16}$/);
    expect(assets.wasm).toEqual(['/dist/cc1psx.wasm']);
    expect(assets.worker).toEqual(['/dist/worker.js']);
  });

  test('compiles a fixture to exactly the reference bytes', async ({ page }) => {
    await openHarness(page);
    await createCompiler(page);
    const summary = await compileFixture(page, 'src/t01_arith.i', {
      gpSize: 8,
      filename: 't01_arith.i',
      rawFlags: FLAGS,
    });
    expect(summary.success).toBe(true);
    expect(summary.asmSha256).toBe(sha256(readFixture('expected/g8/t01_arith.s')));
    expect(summary.textHasCr).toBe(false);
    expect(summary.rawStderr).toBe(readFixtureText('expected/g8/t01_arith.err'));
    expect(summary.diagnostics).toEqual([
      {
        severity: 'warning',
        file: 't01_arith.c',
        line: 3,
        message: 'suggest parentheses around arithmetic in operand of |',
      },
    ]);
    expect(summary.timings.totalMs).toBeGreaterThan(0);
  });

  test('matches the reference for every fixture in the manifest', async ({ page }) => {
    await openHarness(page);
    await createCompiler(page);
    for (const fixture of loadManifest().fixtures) {
      const summary = await compileFixture(page, fixture.input, {
        gpSize: fixture.gpSize,
        filename: fixture.filename,
        rawFlags: [...fixture.rawFlags],
      });
      expect(summary.exitCode, fixture.name).toBe(fixture.expectedExitCode);
      if (fixture.expected !== undefined) {
        expect(summary.asmSha256, fixture.name).toBe(sha256(readFixture(fixture.expected)));
      }
    }
  });

  test('reports a compiler error as a failed result', async ({ page }) => {
    await openHarness(page);
    await createCompiler(page);
    const summary = await page.evaluate(async () => {
      const w = window as unknown as {
        psyq: { summarize: (r: unknown) => Promise<Summary> };
        compiler: { compilePreprocessed: (s: Uint8Array, o: unknown) => Promise<unknown> };
      };
      const source = new TextEncoder().encode('int otacon(void) { return 1; }\nint hound( { }\n');
      return w.psyq.summarize(
        await w.compiler.compilePreprocessed(source, { gpSize: 8, filename: 'hound.i' }),
      );
    });
    expect(summary.success).toBe(false);
    expect(summary.exitCode).not.toBe(0);
    expect(summary.diagnostics[0]).toMatchObject({ severity: 'error', file: 'hound.i', line: 2 });
  });

  test('times out, cancels, restarts the worker without refetching, and compiles again', async ({
    page,
  }) => {
    const assets = trackAssets(page);
    await openHarness(page);
    await createCompiler(page);

    const timeout = await page.evaluate(async () => {
      const w = window as unknown as {
        psyq: { generate: (n: number) => string; describeError: (e: unknown) => ErrorSummary };
        compiler: { compilePreprocessed: (s: Uint8Array, o: unknown) => Promise<unknown> };
      };
      const source = new TextEncoder().encode(w.psyq.generate(1500));
      try {
        await w.compiler.compilePreprocessed(source, {
          gpSize: 8,
          rawFlags: ['-O2'],
          timeoutMs: 1,
        });
        return null;
      } catch (err) {
        return w.psyq.describeError(err);
      }
    });
    expect(timeout).toMatchObject({ name: 'CompileTimeoutError', code: 'timeout' });

    const aborted = await page.evaluate(async () => {
      const w = window as unknown as {
        psyq: { generate: (n: number) => string; describeError: (e: unknown) => ErrorSummary };
        compiler: { compilePreprocessed: (s: Uint8Array, o: unknown) => Promise<unknown> };
      };
      const source = new TextEncoder().encode(w.psyq.generate(1500));
      const controller = new AbortController();
      setTimeout(() => {
        controller.abort();
      }, 5);
      try {
        await w.compiler.compilePreprocessed(source, {
          gpSize: 8,
          rawFlags: ['-O2'],
          signal: controller.signal,
        });
        return null;
      } catch (err) {
        return w.psyq.describeError(err);
      }
    });
    expect(aborted).toMatchObject({ isAbortError: true });

    const after = await compileFixture(page, 'src/t07_struct.i', { gpSize: 0, rawFlags: FLAGS });
    expect(after.success).toBe(true);
    expect(after.asmSha256).toBe(sha256(readFixture('expected/g0/t07_struct.s')));

    // The module was fetched exactly once; only the worker script was reloaded.
    expect(assets.wasm).toHaveLength(1);
    expect(assets.worker.length).toBe(3);
  });

  test('dispose rejects further compiles', async ({ page }) => {
    await openHarness(page);
    await createCompiler(page);
    const err = await page.evaluate(async () => {
      const w = window as unknown as {
        psyq: { describeError: (e: unknown) => ErrorSummary };
        compiler: {
          dispose: () => void;
          compilePreprocessed: (s: Uint8Array, o: unknown) => Promise<unknown>;
        };
      };
      w.compiler.dispose();
      try {
        await w.compiler.compilePreprocessed(new Uint8Array(1), { gpSize: 8 });
        return null;
      } catch (e) {
        return w.psyq.describeError(e);
      }
    });
    expect(err).toMatchObject({ name: 'CompilerDisposedError', code: 'disposed' });
  });

  test('accepts explicit asset URL overrides', async ({ page }) => {
    const assets = trackAssets(page);
    await openHarness(page);
    await createCompiler(page, {
      workerUrl: 'http://127.0.0.1:4173/dist/worker.js?override=1',
      wasmUrl: new URL('/dist/cc1psx.wasm?override=1', 'http://127.0.0.1:4173').href,
    });
    const summary = await compileFixture(page, 'src/t03_muldiv.i', { gpSize: 8, rawFlags: FLAGS });
    expect(summary.success).toBe(true);
    expect(assets.wasm).toEqual(['/dist/cc1psx.wasm']);
  });
});
