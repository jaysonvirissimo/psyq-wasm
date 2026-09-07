// SPDX-License-Identifier: MIT
// Consumer smoke test: import the packed library the way a user would and
// compile a fixture, comparing against the reference output byte for byte.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve, sep } from 'node:path';
import { DEFAULT_CPP_FLAGS, createCompiler } from 'psyq-wasm';

// The runner points PSYQ_FIXTURES at test/fixtures; default assumes an in-place run.
const fixtures =
  process.env.PSYQ_FIXTURES === undefined
    ? new URL('../../fixtures/', import.meta.url)
    : pathToFileURL(resolve(process.env.PSYQ_FIXTURES) + sep);
const source = readFileSync(new URL('src/t05_loop.i', fixtures));
const expected = readFileSync(new URL('expected/g8/t05_loop.s', fixtures));
const rawSource = readFileSync(new URL('src/t18_include.c', fixtures));
const expectedFromSource = readFileSync(new URL('expected/g8/t18_include.s', fixtures));
const header = (file) => readFileSync(new URL(file, fixtures));

const compiler = await createCompiler();
try {
  const result = await compiler.compilePreprocessed(source, {
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
  // The raw-source pipeline: preprocess with virtual headers, then compile.
  const fromSource = await compiler.compileSource(rawSource, {
    gpSize: 8,
    filename: 't18_include.c',
    rawFlags: ['-O2', '-g0', '-Wall'],
    cppFlags: [...DEFAULT_CPP_FLAGS, '-Iinclude'],
    headers: {
      't18_include.h': header('src/t18_include.h'),
      'include/codec.h': header('include/codec.h'),
      'include/codec/freq.h': header('include/codec/freq.h'),
    },
  });
  console.log(
    `preprocessorBuildId ${compiler.info.preprocessorBuildId} success=${String(fromSource.success)}`,
  );
  if (!fromSource.success) {
    console.error(fromSource.rawStderr);
    process.exit(1);
  }
  const actualFromSource = createHash('sha256').update(fromSource.asm).digest('hex');
  const wantedFromSource = createHash('sha256').update(expectedFromSource).digest('hex');
  if (actualFromSource !== wantedFromSource) {
    console.error(`compileSource hash mismatch: ${actualFromSource} != ${wantedFromSource}`);
    process.exit(1);
  }
  console.log('NODE-SMOKE-OK');
} finally {
  compiler.dispose();
}
