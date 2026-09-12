// SPDX-License-Identifier: MIT
/**
 * Warm-compile benchmark behind docs/PERFORMANCE.md.
 *
 *   node scripts/bench.mjs [--json out.json] [--sizes 1,4,16] [--iterations 50]
 *
 * Also importable, in browsers too: the Playwright bench config drives the same
 * measurement code through the harness page, so Node and the three browsers are
 * measured by one implementation. Nothing Node-specific may be imported
 * statically (see scripts/gen-stress-fixture.mjs, which has the same rule).
 *
 * "Warm" means one live Compiler whose worker is already up, reused across the
 * whole sweep -- how an editor holds it. The first compiles pay module
 * instantiation and JIT warmup, so they are discarded rather than measured.
 */
import { generate } from './gen-stress-fixture.mjs';

/** Function counts to sweep. n=1..16 are the "small/medium" band §20.3 targets. */
export const SIZES = [1, 4, 16, 64, 256];

/** Sizes above this get fewer iterations; a single run is already slow. */
const LARGE_SIZE = 64;

export const DEFAULT_ITERATIONS = 50;
export const DEFAULT_LARGE_ITERATIONS = 10;
export const DEFAULT_WARMUP = 5;

/** §20.3 targets, in milliseconds, for the small/medium band only. */
export const TARGETS = { p50: 50, p95: 150, band: LARGE_SIZE / 4 };

/**
 * Nearest-rank percentile of an ascending-sorted array.
 *
 * @param {number[]} sorted ascending samples, non-empty
 * @param {number} p percentile in (0, 100]
 * @returns {number} the sample at that rank
 */
export function percentile(sorted, p) {
  if (sorted.length === 0) throw new RangeError('no samples');
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1];
}

/**
 * Reduce raw timings to the figures the report quotes. The median is reported
 * rather than the mean: compile times are right-skewed, so a mean overstates
 * typical latency. min/max make an outlier obvious.
 *
 * @param {number[]} samples measured milliseconds
 * @returns {{samples: number, min: number, p50: number, p95: number, max: number}}
 */
export function summarize(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    samples: sorted.length,
    min: sorted[0],
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    max: sorted[sorted.length - 1],
  };
}

/** Iterations to time for a given size. */
export function iterationsFor(n, requested) {
  if (requested !== undefined) return requested;
  return n >= LARGE_SIZE ? DEFAULT_LARGE_ITERATIONS : DEFAULT_ITERATIONS;
}

/**
 * Sweep one runtime. `compile` must resolve a CompileResult for the given bytes.
 *
 * @param {object} options
 * @param {(source: Uint8Array) => Promise<{success: boolean, timings: {compileMs: number, totalMs: number}}>} options.compile
 * @param {number[]} [options.sizes]
 * @param {number} [options.iterations] overrides the per-size default
 * @param {number} [options.warmup]
 * @param {(message: string) => void} [options.onProgress]
 * @returns {Promise<object[]>} one row per size
 */
export async function sweep({
  compile,
  sizes = SIZES,
  iterations,
  warmup = DEFAULT_WARMUP,
  onProgress,
}) {
  const rows = [];
  for (const n of sizes) {
    const text = generate(n);
    const source = new TextEncoder().encode(text);
    const count = iterationsFor(n, iterations);
    onProgress?.(`n=${n} (${source.byteLength} bytes) warmup ${warmup}, timed ${count}`);

    for (let i = 0; i < warmup; i++) {
      const result = await compile(source);
      if (!result.success) throw new Error(`benchmark input n=${n} failed to compile`);
    }

    const compileMs = [];
    const totalMs = [];
    for (let i = 0; i < count; i++) {
      const result = await compile(source);
      if (!result.success) throw new Error(`benchmark input n=${n} failed to compile`);
      compileMs.push(result.timings.compileMs);
      totalMs.push(result.timings.totalMs);
    }

    rows.push({
      n,
      bytes: source.byteLength,
      band: n <= TARGETS.band ? 'small/medium' : 'large',
      compileMs: summarize(compileMs),
      totalMs: summarize(totalMs),
    });
  }
  return rows;
}

/** True when a row is in the band §20.3 targets and meets both targets. */
export function meetsTarget(row) {
  if (row.band !== 'small/medium') return null;
  return row.compileMs.p50 < TARGETS.p50 && row.compileMs.p95 < TARGETS.p95;
}

/* c8 ignore start -- CLI wrapper, exercised via npm run bench */
// `process` does not exist in the browser, and this module is imported by the
// harness page. Guard on the global itself, not just on argv.
if (typeof process !== 'undefined' && process.argv[1] !== undefined) {
  const { pathToFileURL } = await import('node:url');
  if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const { writeFileSync, readFileSync } = await import('node:fs');
    const os = await import('node:os');
    const arg = (flag) => {
      const i = process.argv.indexOf(flag);
      return i === -1 ? undefined : process.argv[i + 1];
    };
    const root = new URL('..', import.meta.url);
    const { createCompiler } = await import(new URL('dist/index.node.js', root).href);
    const buildInfo = JSON.parse(readFileSync(new URL('dist/build-info.json', root), 'utf8'));

    const sizesArg = arg('--sizes');
    const iterationsArg = arg('--iterations');
    const compiler = await createCompiler();
    let rows;
    try {
      rows = await sweep({
        compile: (source) =>
          compiler.compilePreprocessed(source, {
            gpSize: 8,
            filename: 'codec.i',
            rawFlags: ['-O2', '-g0', '-Wall'],
          }),
        sizes: sizesArg === undefined ? undefined : sizesArg.split(',').map(Number),
        iterations: iterationsArg === undefined ? undefined : Number(iterationsArg),
        onProgress: (message) => console.log(`  ${message}`),
      });
    } finally {
      compiler.dispose();
    }

    const cpus = os.cpus();
    const report = {
      runtime: `Node.js ${process.version}`,
      os: `${os.platform()} ${os.release()}`,
      arch: process.arch,
      cpu: cpus[0]?.model ?? 'unknown',
      cpuCount: cpus.length,
      memoryGiB: Math.round(os.totalmem() / 1024 ** 3),
      buildId: buildInfo.buildId,
      measuredAt: new Date().toISOString(),
      rows,
    };

    const out = arg('--json');
    if (out !== undefined) writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  }
}
/* c8 ignore stop */
