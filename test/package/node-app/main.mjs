// SPDX-License-Identifier: MIT
// Consumer smoke test: import the packed library the way a user would and
// compile a fixture, comparing against the reference output byte for byte.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createCompiler } from 'psyq-wasm';

// The runner points PSYQ_FIXTURES at test/fixtures; default assumes an in-place run.
const fixtures = new URL(
  `${process.env.PSYQ_FIXTURES ?? new URL('../../fixtures', import.meta.url).pathname}/`,
  'file://',
);
const source = readFileSync(new URL('src/t05_loop.i', fixtures));
const expected = readFileSync(new URL('expected/g8/t05_loop.s', fixtures));

const compiler = await createCompiler();
try {
  const result = await compiler.compilePreprocessed(new Uint8Array(source), {
    gpSize: 8,
    filename: 't05_loop.i',
    rawFlags: ['-O2', '-g0', '-Wall'],
  });
  console.log(`buildId ${compiler.info.buildId} success=${String(result.success)}`);
  if (!result.success) {
    console.error(result.rawStderr);
    process.exit(1);
  }
  const actual = createHash('sha256').update(result.asm).digest('hex');
  const wanted = createHash('sha256').update(expected).digest('hex');
  if (actual !== wanted) {
    console.error(`hash mismatch: ${actual} != ${wanted}`);
    process.exit(1);
  }
  console.log('NODE-SMOKE-OK');
} finally {
  compiler.dispose();
}
