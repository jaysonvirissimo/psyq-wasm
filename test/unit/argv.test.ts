// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { buildArgv } from '../../src/argv.js';

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
