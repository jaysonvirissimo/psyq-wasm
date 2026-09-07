// SPDX-License-Identifier: MIT
// Compare isolated reference output with the committed fixture contract.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function verifyFixtures(fixtures, generated, compareBytes = true) {
  const { fixtures: manifest } = JSON.parse(readFileSync(join(fixtures, 'manifest.json'), 'utf8'));
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
  for (const fixture of manifest) {
    const base = fixture.filename.replace(/\.i$/, '');
    const variant = fixture.rawFlags.includes('-g') ? 'g' : `g${fixture.gpSize}`;
    if (exits.get(`${base}/${variant}`) !== fixture.expectedExitCode)
      problems.push(`${fixture.name}: exit status differs`);
    for (const [field, extension] of [
      ['expected', 's'],
      ['expectedStderr', 'err'],
    ]) {
      const actualPath = join(generated, 'expected', variant, `${base}.${extension}`);
      if (fixture[field] === undefined) {
        if (existsSync(actualPath))
          problems.push(`${fixture.name}: unexpected ${extension} output`);
      } else if (!existsSync(actualPath)) {
        problems.push(`${fixture.name}: missing ${extension} output`);
      } else if (
        compareBytes &&
        !readFileSync(actualPath).equals(readFileSync(join(fixtures, fixture[field])))
      ) {
        problems.push(`${fixture.name}: ${extension} bytes differ`);
      }
    }
    if (
      compareBytes &&
      !readFileSync(join(generated, fixture.input)).equals(
        readFileSync(join(fixtures, fixture.input)),
      )
    )
      problems.push(`${fixture.name}: preprocessed input differs`);
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
