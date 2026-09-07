// SPDX-License-Identifier: MIT
/**
 * Generate a large, valid, preprocessed GNU89 translation unit for timeout and
 * cancellation tests. Deterministic: the same `n` always yields the same text.
 *
 *   node scripts/gen-stress-fixture.mjs [functions] > codec.i
 *
 * Also importable: `import { generate } from './gen-stress-fixture.mjs'`.
 */
import { pathToFileURL } from 'node:url';

const CASES = 32;

/**
 * @param {number} n number of functions to emit
 * @returns {string} preprocessed C source beginning with a line marker
 */
export function generate(n) {
  if (!Number.isInteger(n) || n < 1) throw new RangeError('n must be a positive integer');
  const parts = [`# 1 "codec_${String(n)}.c"\n`];
  parts.push('extern int burst(int channel, int value);\n');
  for (let i = 0; i < n; i++) {
    const lines = [
      `int codec_${String(i)}(int frequency, int channel)\n{\n  int total = ${String(i)};\n  switch (frequency & ${String(CASES - 1)}) {\n`,
    ];
    for (let c = 0; c < CASES; c++) {
      lines.push(
        `  case ${String(c)}: total += burst(channel, ${String((i * 31 + c * 7) % 1409)}); break;\n`,
      );
    }
    lines.push('  default: total = -1; break;\n  }\n  return total + channel;\n}\n');
    parts.push(lines.join(''));
  }
  return parts.join('');
}

const invokedDirectly =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const n = Number(process.argv[2] ?? '3000');
  process.stdout.write(generate(n));
}
