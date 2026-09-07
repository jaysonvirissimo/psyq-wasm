// SPDX-License-Identifier: MIT
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { InvalidOptionsError } from '../../src/errors.js';
import {
  DEFAULT_LIMITS,
  RESERVED_OUTPUT_NAME,
  WORK_DIR,
  resolveLimits,
  validateCompileOptions,
  validateSource,
} from '../../src/options.js';

const limits = DEFAULT_LIMITS;

describe('validateCompileOptions', () => {
  it.each([1, 2_147_483_647])('accepts timer boundary %s', (timeoutMs) => {
    expect(validateCompileOptions({ gpSize: 8, timeoutMs }, limits).timeoutMs).toBe(timeoutMs);
    expect(
      resolveLimits({ defaultTimeoutMs: timeoutMs, initTimeoutMs: timeoutMs }).initTimeoutMs,
    ).toBe(timeoutMs);
  });

  it.each([2_147_483_648, Number.MAX_SAFE_INTEGER])(
    'rejects overflowing timer %s at every boundary',
    (timeoutMs) => {
      expect(() => validateCompileOptions({ gpSize: 8, timeoutMs }, limits)).toThrow(
        InvalidOptionsError,
      );
      expect(() => resolveLimits({ defaultTimeoutMs: timeoutMs })).toThrow(InvalidOptionsError);
      expect(() => resolveLimits({ initTimeoutMs: timeoutMs })).toThrow(InvalidOptionsError);
    },
  );
  it('normalizes a minimal valid request', () => {
    const normalized = validateCompileOptions({ gpSize: 8 }, limits);
    expect(normalized).toEqual({
      gpSize: 8,
      filename: 'input.i',
      rawFlags: [],
      timeoutMs: limits.defaultTimeoutMs,
      signal: undefined,
    });
  });

  it('passes through explicit values', () => {
    const controller = new AbortController();
    const normalized = validateCompileOptions(
      {
        gpSize: 0,
        filename: 'rations.i',
        rawFlags: ['-O2', '-g0', '-Wall'],
        timeoutMs: 14085,
        signal: controller.signal,
      },
      limits,
    );
    expect(normalized.gpSize).toBe(0);
    expect(normalized.filename).toBe('rations.i');
    expect(normalized.rawFlags).toEqual(['-O2', '-g0', '-Wall']);
    expect(normalized.timeoutMs).toBe(14085);
    expect(normalized.signal).toBe(controller.signal);
  });

  it('returns a copy of rawFlags', () => {
    const flags = ['-O2'];
    const normalized = validateCompileOptions({ gpSize: 8, rawFlags: flags }, limits);
    flags.push('-g0');
    expect(normalized.rawFlags).toEqual(['-O2']);
  });

  it.each([undefined, null, 'otacon', 42, []])('rejects a non-object options value %j', (bad) => {
    expect(() => validateCompileOptions(bad, limits)).toThrow(InvalidOptionsError);
  });

  it.each([undefined, 4, '8', 8.5, null, -0.5])('rejects gpSize %j', (gpSize) => {
    expect(() => validateCompileOptions({ gpSize }, limits)).toThrow(/gpSize/);
  });

  describe('filename', () => {
    it.each(['rations.c', 'shadow_moses.i', 'a', 'x.y.z', 'UPPER.I', 'dash-ok.i'])(
      'accepts %j',
      (filename) => {
        expect(validateCompileOptions({ gpSize: 8, filename }, limits).filename).toBe(filename);
      },
    );

    it.each([
      ['', /filename/],
      ['.', /filename/],
      ['..', /filename/],
      ['sub/dir.c', /filename/],
      ['sub\\dir.c', /filename/],
      ['out.s', /reserved/],
      ['a\0b', /filename/],
      [' leading.c', /filename/],
      ['trailing.c ', /filename/],
      ['-dash.c', /filename/],
      ['x'.repeat(256), /filename/],
      ['codec\nfreq.c', /filename/],
      [42, /filename/],
    ])('rejects %j', (filename, message) => {
      expect(() => validateCompileOptions({ gpSize: 8, filename }, limits)).toThrow(message);
    });

    it('accepts a 255-byte name', () => {
      const name = 'x'.repeat(255);
      expect(validateCompileOptions({ gpSize: 8, filename: name }, limits).filename).toBe(name);
    });
  });

  describe('rawFlags', () => {
    it.each([
      ['-O2'],
      ['-O0'],
      ['-g0'],
      ['-g'],
      ['-Wall'],
      ['-Wno-parentheses'],
      ['-fno-builtin'],
      ['-fomit-frame-pointer'],
      ['-fno-dos-line-endings'],
      ['-mgas'],
      ['-mno-gpopt'],
      ['-w'],
    ])('accepts %s', (flag) => {
      expect(validateCompileOptions({ gpSize: 8, rawFlags: [flag] }, limits).rawFlags).toEqual([
        flag,
      ]);
    });

    it.each([
      '-G',
      '-G8',
      '-G 8',
      '-G0',
      '-o',
      '-oout.s',
      '-o out.s',
      '-quiet',
      '-version',
      '-aux-info',
      '-aux-info=foo',
      '-dumpbase',
      'shadow_moses.i',
      'out.s',
      '',
      ' -O2',
      '-O2 -g0',
      '-O2\t',
      '-f\0',
      '-',
      '--',
      '-1',
      '-O2;rm',
      '-fprofile-arcs\n',
    ])('rejects %j and names it', (flag) => {
      let caught: unknown;
      try {
        validateCompileOptions({ gpSize: 8, rawFlags: [flag] }, limits);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(InvalidOptionsError);
      expect((caught as Error).message).toContain(JSON.stringify(flag));
    });

    it('rejects non-array and non-string entries', () => {
      expect(() => validateCompileOptions({ gpSize: 8, rawFlags: '-O2' }, limits)).toThrow(
        /rawFlags/,
      );
      expect(() => validateCompileOptions({ gpSize: 8, rawFlags: [2] }, limits)).toThrow(
        /rawFlags/,
      );
    });

    it('rejects every -G and -o spelling and every positional argument (property)', () => {
      const denied = fc.oneof(
        fc.string().map((s) => `-G${s}`),
        fc.string().map((s) => `-o${s}`),
        fc.string().filter((s) => !s.startsWith('-')),
      );
      fc.assert(
        fc.property(denied, (flag) => {
          expect(() => validateCompileOptions({ gpSize: 8, rawFlags: [flag] }, limits)).toThrow(
            InvalidOptionsError,
          );
        }),
      );
    });

    it('accepts any well-formed switch outside the denylist (property)', () => {
      const denylist = new Set(['-quiet', '-version', '-aux-info', '-dumpbase']);
      const wellFormed = fc
        .stringMatching(/^-[A-FH-Za-np-z][A-Za-z0-9=_.,+-]{0,20}$/)
        .filter((s) => !denylist.has(s) && !s.startsWith('-aux-info'));
      fc.assert(
        fc.property(wellFormed, (flag) => {
          expect(validateCompileOptions({ gpSize: 8, rawFlags: [flag] }, limits).rawFlags).toEqual([
            flag,
          ]);
        }),
      );
    });
  });

  describe('timeoutMs', () => {
    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5, '1000', null])(
      'rejects %j',
      (timeoutMs) => {
        expect(() => validateCompileOptions({ gpSize: 8, timeoutMs }, limits)).toThrow(/timeoutMs/);
      },
    );

    it('accepts a positive integer', () => {
      expect(validateCompileOptions({ gpSize: 8, timeoutMs: 1 }, limits).timeoutMs).toBe(1);
    });
  });

  it('rejects a signal that is not an AbortSignal', () => {
    expect(() => validateCompileOptions({ gpSize: 8, signal: {} }, limits)).toThrow(/signal/);
  });
});

describe('validateSource', () => {
  it('accepts a Uint8Array within the limit, including empty input', () => {
    expect(() => {
      validateSource(new Uint8Array(0), limits);
    }).not.toThrow();
    expect(() => {
      validateSource(new TextEncoder().encode('int hound(void) { return 1; }\n'), limits);
    }).not.toThrow();
  });

  it('rejects non-Uint8Array input', () => {
    expect(() => {
      validateSource('int x;' as unknown as Uint8Array, limits);
    }).toThrow(InvalidOptionsError);
    expect(() => {
      validateSource(new Uint16Array(2) as unknown as Uint8Array, limits);
    }).toThrow(/Uint8Array/);
  });

  it('rejects sources over maxSourceBytes with both sizes in the message', () => {
    const small = { ...limits, maxSourceBytes: 16 };
    expect(() => {
      validateSource(new Uint8Array(17), small);
    }).toThrow(/17.*16|16.*17/);
    expect(() => {
      validateSource(new Uint8Array(16), small);
    }).not.toThrow();
  });
});

describe('resolveLimits', () => {
  it('returns documented defaults', () => {
    expect(resolveLimits(undefined)).toEqual({
      maxSourceBytes: 4 * 1024 * 1024,
      defaultTimeoutMs: 20_000,
      initTimeoutMs: 10_000,
    });
    expect(resolveLimits({})).toEqual(DEFAULT_LIMITS);
  });

  it('applies overrides', () => {
    expect(resolveLimits({ maxSourceBytes: 14085, defaultTimeoutMs: 141 })).toEqual({
      maxSourceBytes: 14085,
      defaultTimeoutMs: 141,
      initTimeoutMs: 10_000,
    });
  });

  it.each([
    [{ maxSourceBytes: 0 }],
    [{ maxSourceBytes: -1 }],
    [{ maxSourceBytes: 1.5 }],
    [{ defaultTimeoutMs: 0 }],
    [{ defaultTimeoutMs: Number.NaN }],
    [{ initTimeoutMs: 0 }],
    [{ initTimeoutMs: '5' }],
  ])('rejects invalid override %j', (bad) => {
    expect(() => resolveLimits(bad as never)).toThrow(InvalidOptionsError);
  });
});

describe('constants', () => {
  it('names the wrapper-owned paths', () => {
    expect(WORK_DIR).toBe('/work');
    expect(RESERVED_OUTPUT_NAME).toBe('out.s');
  });
});
