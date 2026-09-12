// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
interface Summary {
  samples: number;
  min: number;
  p50: number;
  p95: number;
  max: number;
}
interface Row {
  n: number;
  bytes: number;
  band: string;
  compileMs: Summary;
  totalMs: Summary;
}

import {
  DEFAULT_ITERATIONS,
  DEFAULT_LARGE_ITERATIONS,
  SIZES,
  TARGETS,
  iterationsFor,
  meetsTarget,
  percentile,
  summarize,
  sweep,
} from '../../scripts/bench.mjs';

describe('percentile', () => {
  it('takes the nearest rank, not an interpolation', () => {
    const sorted = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(sorted, 50)).toBe(50);
    expect(percentile(sorted, 95)).toBe(100);
    expect(percentile(sorted, 10)).toBe(10);
  });

  it('clamps to the ends rather than reading past the array', () => {
    expect(percentile([7], 95)).toBe(7);
    expect(percentile([1, 2], 0.0001)).toBe(1);
    expect(percentile([1, 2], 100)).toBe(2);
  });

  it('refuses an empty sample instead of returning undefined', () => {
    expect(() => percentile([], 50)).toThrow(RangeError);
  });
});

describe('summarize', () => {
  it('reports the median rather than the mean, so one outlier cannot move it', () => {
    const withOutlier = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10_000];
    const summary = summarize(withOutlier);
    expect(summary.p50).toBe(10);
    expect(summary.max).toBe(10_000);
    expect(summary.min).toBe(10);
    expect(summary.samples).toBe(10);
  });

  it('does not depend on the input order', () => {
    expect(summarize([30, 10, 20])).toEqual(summarize([10, 20, 30]));
  });
});

describe('iterationsFor', () => {
  it('times large inputs fewer times, since one run is already slow', () => {
    expect(iterationsFor(1, undefined)).toBe(DEFAULT_ITERATIONS);
    expect(iterationsFor(16, undefined)).toBe(DEFAULT_ITERATIONS);
    expect(iterationsFor(256, undefined)).toBe(DEFAULT_LARGE_ITERATIONS);
  });

  it('honours an explicit request', () => {
    expect(iterationsFor(256, 3)).toBe(3);
  });

  it('keeps enough samples that p95 is not merely the maximum', () => {
    // With 20 samples ceil(0.95 * 20) == 20, i.e. the worst run. The small-size
    // default must stay well above that for the figure to mean anything.
    expect(DEFAULT_ITERATIONS).toBeGreaterThanOrEqual(50);
  });
});

describe('meetsTarget', () => {
  const row = (band: string, p50: number, p95: number) => ({
    band,
    compileMs: { p50, p95 },
  });

  it('judges only the band the targets apply to', () => {
    expect(meetsTarget(row('large', 9999, 9999))).toBeNull();
  });

  it('requires both targets', () => {
    expect(meetsTarget(row('small/medium', 10, 20))).toBe(true);
    expect(meetsTarget(row('small/medium', 10, TARGETS.p95 + 1))).toBe(false);
    expect(meetsTarget(row('small/medium', TARGETS.p50 + 1, 20))).toBe(false);
  });
});

describe('sweep', () => {
  it('discards warmup runs and times only the rest', async () => {
    let calls = 0;
    const rows = (await sweep({
      compile: () => {
        calls += 1;
        return Promise.resolve({ success: true, timings: { compileMs: calls, totalMs: calls } });
      },
      sizes: [1],
      warmup: 3,
      iterations: 4,
    })) as Row[];

    expect(calls).toBe(7);
    // The four timed runs are 4,5,6,7 -- the warmup values 1..3 never appear.
    expect(rows[0]?.compileMs.min).toBe(4);
    expect(rows[0]?.compileMs.max).toBe(7);
    expect(rows[0]?.compileMs.samples).toBe(4);
  });

  it('records the byte size and band of each input', async () => {
    const rows = (await sweep({
      compile: () => Promise.resolve({ success: true, timings: { compileMs: 1, totalMs: 2 } }),
      sizes: [1, 256],
      warmup: 0,
      iterations: 1,
    })) as Row[];

    expect(rows.map((r) => r.band)).toEqual(['small/medium', 'large']);
    expect(rows[0]?.bytes).toBeGreaterThan(0);
    expect(rows[1]?.bytes).toBeGreaterThan(rows[0]?.bytes ?? 0);
  });

  it('fails loudly when a benchmark input does not compile', async () => {
    await expect(
      sweep({
        compile: () => Promise.resolve({ success: false, timings: { compileMs: 0, totalMs: 0 } }),
        sizes: [1],
        warmup: 0,
        iterations: 1,
      }),
    ).rejects.toThrow(/failed to compile/);
  });

  it('sweeps the documented ladder by default', () => {
    expect(SIZES).toEqual([1, 4, 16, 64, 256]);
  });
});
