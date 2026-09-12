// SPDX-License-Identifier: MIT
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === 'node_modules' || name === 'dist' || name === 'vendor' || name === 'out') continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function firstLines(file: string, n: number): string {
  return readFileSync(file, 'utf8').split(/\r?\n/).slice(0, n).join('\n');
}

const MIT_MARKER = 'SPDX-License-Identifier: MIT';
const GPL_MARKER = 'SPDX-License-Identifier: GPL-2.0-only';

describe('licensing', () => {
  it('ships both license texts', () => {
    expect(readFileSync(join(ROOT, 'LICENSES/MIT.txt'), 'utf8')).toContain('MIT License');
    expect(readFileSync(join(ROOT, 'LICENSES/GPL-2.0-only.txt'), 'utf8')).toContain(
      'GNU GENERAL PUBLIC LICENSE',
    );
    expect(readFileSync(join(ROOT, 'LICENSES/GPL-2.0-only.txt'), 'utf8')).toContain('Version 2');
  });

  it('explains the license split at the top level', () => {
    const license = readFileSync(join(ROOT, 'LICENSE'), 'utf8');
    expect(license).toContain('MIT');
    expect(license).toContain('GPL-2.0-only');
    expect(license).toContain('build/gen');
  });

  it('declares the combined SPDX expression in package.json', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { license: string };
    expect(pkg.license).toBe('MIT AND GPL-2.0-only');
  });

  it('marks every original TypeScript/JavaScript source file as MIT', () => {
    const roots = ['src', 'test', 'scripts', 'demo'].map((d) => join(ROOT, d));
    const files = roots
      .filter((d) => {
        try {
          return statSync(d).isDirectory();
        } catch {
          return false;
        }
      })
      .flatMap((d) => walk(d))
      .filter((f) => /\.(ts|mts|js|mjs)$/.test(f))
      .filter((f) => !f.includes(join('test', 'fixtures')))
      .filter((f) => !f.includes(join('test', 'package')) || !f.includes('dist'));
    expect(files.length).toBeGreaterThan(0);
    const missing = files.filter((f) => !firstLines(f, 3).includes(MIT_MARKER));
    expect(missing.map((f) => relative(ROOT, f))).toEqual([]);
  });

  it('marks every compatibility patch as GPL-2.0-only', () => {
    const files = walk(join(ROOT, 'build', 'patches'));
    expect(files.length).toBeGreaterThan(0);
    const missing = files.filter((f) => !firstLines(f, 5).includes(GPL_MARKER));
    expect(missing.map((f) => relative(ROOT, f))).toEqual([]);
  });

  it('declares the generated GCC sources as GPL-2.0-only in their README', () => {
    // The generated files themselves are committed byte-for-byte as produced by
    // the historical build so their checksums stay comparable; the directory
    // README carries the license statement instead of per-file headers.
    const readme = readFileSync(join(ROOT, 'build', 'gen', 'README.md'), 'utf8');
    expect(firstLines(join(ROOT, 'build', 'gen', 'README.md'), 5)).toContain(GPL_MARKER);
    expect(readme).toContain('GNU General Public License');
  });
});
