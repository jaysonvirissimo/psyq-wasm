// SPDX-License-Identifier: MIT
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CPP_FLAGS, buildArgv, buildCppArgv } from '../../src/argv.js';
import { fromRoot } from '../helpers/paths.js';

describe('buildArgv', () => {
  it('places wrapper-owned flags around the caller flags', () => {
    expect(
      buildArgv({ gpSize: 0, filename: 'codec.i', rawFlags: ['-O2', '-g0', '-Wall'] }),
    ).toEqual(['-quiet', '-G', '0', '-O2', '-g0', '-Wall', 'codec.i', '-o', 'out.s']);
  });

  it('works with no caller flags', () => {
    expect(buildArgv({ gpSize: 8, filename: 'otacon.i', rawFlags: [] })).toEqual([
      '-quiet',
      '-G',
      '8',
      'otacon.i',
      '-o',
      'out.s',
    ]);
  });

  it('returns a fresh array and leaves the input untouched', () => {
    const rawFlags = ['-O2'];
    const a = buildArgv({ gpSize: 8, filename: 'x.i', rawFlags });
    const b = buildArgv({ gpSize: 8, filename: 'x.i', rawFlags });
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
    expect(rawFlags).toEqual(['-O2']);
  });
});

describe('buildCppArgv', () => {
  it('owns -nostdinc, -undef, and the in/out paths around the caller flags', () => {
    expect(buildCppArgv({ filename: 'rations.c', cppFlags: ['-DFOX', '-Iinclude'] })).toEqual([
      '-nostdinc',
      '-undef',
      '-DFOX',
      '-Iinclude',
      'rations.c',
      'out.i',
    ]);
  });

  it('returns a fresh array and leaves the input untouched', () => {
    const cppFlags = ['-DHOUND'];
    const a = buildCppArgv({ filename: 'x.c', cppFlags });
    const b = buildCppArgv({ filename: 'x.c', cppFlags });
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
    expect(cppFlags).toEqual(['-DHOUND']);
  });
});

describe('DEFAULT_CPP_FLAGS', () => {
  it('is the frozen PsyQ 4.4 define set', () => {
    expect(DEFAULT_CPP_FLAGS).toEqual([
      '-D__GNUC__=2',
      '-D__OPTIMIZE__',
      '-lang-c',
      '-Dmips',
      '-D__mips__',
      '-D__mips',
      '-Dpsx',
      '-D__psx__',
      '-D__psx',
      '-D_PSYQ',
      '-D__EXTENSIONS__',
      '-D_MIPSEL',
      '-D__CHAR_UNSIGNED__',
      '-D_LANGUAGE_C',
      '-DLANGUAGE_C',
    ]);
    expect(Object.isFrozen(DEFAULT_CPP_FLAGS)).toBe(true);
  });

  it('matches the reference invocation used to generate the fixtures', () => {
    // Every committed .i was produced with exactly these defines, which is
    // what makes each fixture .c a preprocessing differential case.
    const script = readFileSync(fromRoot('build', 'compile-fixtures.sh'), 'utf8');
    const match = /^CPP_DEFS="([^"]+)"$/m.exec(script);
    expect(match?.[1]).toBe(['-undef', ...DEFAULT_CPP_FLAGS].join(' '));
  });
});
