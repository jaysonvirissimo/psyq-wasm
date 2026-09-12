// SPDX-License-Identifier: MIT
// Compare isolated reference output with the committed fixture contract.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function verifyFixtures(fixtures, generated, compareBytes = true) {
  const { fixtures: manifest, sources = [] } = JSON.parse(
    readFileSync(join(fixtures, 'manifest.json'), 'utf8'),
  );
  const exits = new Map(
    readFileSync(join(generated, 'exit-codes.txt'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => {
        const [name, variant, code] = line.split(' ');
        return [`${name}/${variant}`, Number(code)];
      }),
  );
  const problems = [];
  const same = (a, b) => readFileSync(a).equals(readFileSync(b));
  /** Compare one expected file (or its absence) with the generated output. */
  const compareOutput = (name, expected, actualPath, what) => {
    if (expected === undefined) {
      if (existsSync(actualPath)) problems.push(`${name}: unexpected ${what} output`);
    } else if (!existsSync(actualPath)) {
      problems.push(`${name}: missing ${what} output`);
    } else if (compareBytes && !same(actualPath, join(fixtures, expected))) {
      problems.push(`${name}: ${what} bytes differ`);
    }
  };
  for (const fixture of manifest) {
    const base = fixture.filename.replace(/\.i$/, '');
    const variant = fixture.rawFlags.includes('-g') ? 'g' : `g${fixture.gpSize}`;
    if (exits.get(`${base}/${variant}`) !== fixture.expectedExitCode)
      problems.push(`${fixture.name}: exit status differs`);
    for (const [field, extension] of [
      ['expected', 's'],
      ['expectedStderr', 'err'],
    ]) {
      compareOutput(
        fixture.name,
        fixture[field],
        join(generated, 'expected', variant, `${base}.${extension}`),
        extension,
      );
    }
    if (compareBytes && !same(join(generated, fixture.input), join(fixtures, fixture.input)))
      problems.push(`${fixture.name}: preprocessed input differs`);
  }
  for (const source of sources) {
    const base = source.filename.replace(/\.c$/, '');
    const failedPreprocess = source.expectedStage === 'preprocess';
    if (exits.get(`${base}/pp`) !== (failedPreprocess ? source.expectedExitCode : 0))
      problems.push(`${source.name}: preprocess exit status differs`);
    compareOutput(
      source.name,
      failedPreprocess ? source.expectedStderr : undefined,
      join(generated, 'expected', 'pp', `${base}.err`),
      'preprocess err',
    );
    compareOutput(
      source.name,
      source.expectedPreprocessed,
      join(generated, 'src', `${base}.i`),
      'preprocessed',
    );
  }
  if (
    compareBytes &&
    !readFileSync(join(fixtures, 'SHA256SUMS')).equals(readFileSync(join(generated, 'SHA256SUMS')))
  )
    problems.push('fixture checksum inventory differs');
  return problems;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = verifyFixtures(process.argv[2], process.argv[3], process.argv[4] !== 'false');
  for (const problem of problems) console.error(problem);
  process.exitCode = problems.length === 0 ? 0 : 1;
}
