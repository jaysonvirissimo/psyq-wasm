// SPDX-License-Identifier: MIT
/**
 * Warm-compile measurements for docs/PERFORMANCE.md, in all three browsers.
 *
 *   npm run bench:browser
 *
 * Not part of `npm run test:browser`: playwright.config.ts matches only
 * `**\/*.spec.ts`, so this file is never collected by the default run. It
 * asserts nothing about latency -- SDD §20.3 is a reporting target, not a gate,
 * and CI runners are far too noisy to hold to it. It fails only if a compile
 * fails.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { SIZES } from '../../scripts/bench.mjs';

const PAGE = '/test/browser/page/';
const OUT = 'build/out/bench';

interface Row {
  n: number;
  bytes: number;
  band: string;
  compileMs: { samples: number; min: number; p50: number; p95: number; max: number };
  totalMs: { samples: number; min: number; p50: number; p95: number; max: number };
}

test('warm compile sweep', async ({ page, browser, browserName }, testInfo) => {
  test.setTimeout(15 * 60_000);

  await page.goto(PAGE);
  await page.waitForFunction(
    () => (window as unknown as { psyqReady?: boolean }).psyqReady === true,
  );

  const rows = (await page.evaluate(async (sizes) => {
    const w = window as unknown as {
      psyq: {
        createCompiler: () => Promise<{
          compilePreprocessed: (s: Uint8Array, o: unknown) => Promise<unknown>;
          dispose: () => void;
        }>;
        sweep: (o: unknown) => Promise<unknown>;
      };
    };
    // One compiler for the whole sweep: "warm" means the worker is already up.
    const compiler = await w.psyq.createCompiler();
    try {
      return await w.psyq.sweep({
        sizes,
        compile: (source: Uint8Array) =>
          compiler.compilePreprocessed(source, {
            gpSize: 8,
            filename: 'codec.i',
            rawFlags: ['-O2', '-g0', '-Wall'],
          }),
      });
    } finally {
      compiler.dispose();
    }
  }, SIZES)) as Row[];

  expect(rows).toHaveLength(SIZES.length);
  for (const row of rows) expect(row.compileMs.samples).toBeGreaterThan(0);

  const report = {
    runtime: `${browserName} ${browser.version()}`,
    browserName,
    browserVersion: browser.version(),
    os: `${process.platform} ${(await import('node:os')).release()}`,
    arch: process.arch,
    cpu: (await import('node:os')).cpus()[0]?.model ?? 'unknown',
    measuredAt: new Date().toISOString(),
    rows,
  };

  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/${browserName}.json`, `${JSON.stringify(report, null, 2)}\n`);
  await testInfo.attach(`${browserName}.json`, {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json',
  });

  for (const row of rows) {
    // Printing the sweep is the point of this file; the reporter is how the
    // measurements reach whoever is updating docs/PERFORMANCE.md.
    // eslint-disable-next-line no-console
    console.log(
      `${browserName} n=${String(row.n)} (${String(row.bytes)} B, ${row.band}) ` +
        `p50 ${row.compileMs.p50.toFixed(1)} ms  p95 ${row.compileMs.p95.toFixed(1)} ms`,
    );
  }
});
