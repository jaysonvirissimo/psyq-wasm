// SPDX-License-Identifier: MIT
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CPP_FLAGS } from '../../src/argv.js';
import { InvalidOptionsError } from '../../src/errors.js';
import {
  DEFAULT_LIMITS,
  RESERVED_PREPROCESSED_NAME,
  normalizeSourceInput,
  validateSourceOptions,
  validateVirtualPath,
} from '../../src/options.js';

const limits = DEFAULT_LIMITS;
const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

describe('validateSourceOptions', () => {
  it('normalizes a minimal request with the PsyQ defaults', () => {
    expect(validateSourceOptions({ gpSize: 8 }, limits)).toEqual({
      gpSize: 8,
      filename: 'input.c',
      rawFlags: [],
      timeoutMs: limits.defaultTimeoutMs,
      signal: undefined,
      cppFlags: DEFAULT_CPP_FLAGS,
      headers: [],
      encoding: 'utf8',
    });
  });

  it('passes explicit values through', () => {
    const signal = new AbortController().signal;
    const normalized = validateSourceOptions(
      {
        gpSize: 0,
        filename: 'rations.c',
        rawFlags: ['-O2', '-g0'],
        timeoutMs: 14085,
        signal,
        cppFlags: ['-DFOX', '-Iinclude'],
        headers: { 'include/codec.h': '#define CODEC 14085\n' },
        encoding: 'eucjp',
      },
      limits,
    );
    expect(normalized).toEqual({
      gpSize: 0,
      filename: 'rations.c',
      rawFlags: ['-O2', '-g0'],
      timeoutMs: 14085,
      signal,
      cppFlags: ['-DFOX', '-Iinclude'],
      headers: [{ path: 'include/codec.h', data: utf8('#define CODEC 14085\n') }],
      encoding: 'eucjp',
    });
  });

  it('applies the compile-option rules (gpSize, rawFlags, timeoutMs)', () => {
    expect(() => validateSourceOptions({ gpSize: 4 }, limits)).toThrow(/gpSize/);
    expect(() => validateSourceOptions({ gpSize: 8, rawFlags: ['-G8'] }, limits)).toThrow(
      InvalidOptionsError,
    );
    expect(() => validateSourceOptions({ gpSize: 8, timeoutMs: 0 }, limits)).toThrow(/timeoutMs/);
    expect(() => validateSourceOptions(null, limits)).toThrow(InvalidOptionsError);
  });

  it.each(['out.i', 'out.s'])('rejects the reserved filename %s', (filename) => {
    expect(() => validateSourceOptions({ gpSize: 8, filename }, limits)).toThrow(/reserved/);
  });

  describe('cppFlags', () => {
    it.each([
      '-DFOX',
      '-D_PSYQ=1',
      '-DCODEC(x)=(x)',
      '-DFREQ(a,b)=a##b',
      '-DMSG="mei ling"',
      '-D__OPTIMIZE__',
      '-UMIPSEL',
      '-Iinclude',
      '-Ipsyq/include',
      '-I.',
      '-Wall',
      '-Wno-comment',
      '-Wtrigraphs',
      '-pedantic',
      '-pedantic-errors',
      '-trigraphs',
      '-lang-c',
      '-traditional',
    ])('accepts %s', (flag) => {
      expect(validateSourceOptions({ gpSize: 8, cppFlags: [flag] }, limits).cppFlags).toEqual([
        flag,
      ]);
    });

    it.each([
      '-I',
      '-I/abs',
      '-I../x',
      '-Ia/../b',
      '-I-',
      '-I./x',
      '-D',
      '-D=1',
      '-D1abc',
      '-D FOX',
      '-DFOX=a\nb',
      '-U',
      '-U-x',
      '-include',
      '-imacros',
      '-idirafter',
      '-M',
      '-MD',
      '-MM',
      '-o',
      '-oout.i',
      '-P',
      '-C',
      '-dM',
      '-H',
      '-v',
      '-A',
      '-remap',
      '-nostdinc',
      '-undef',
      '-lang-c++',
      '-lang-asm',
      '-lint',
      '-W',
      '-W all',
      'rations.c',
      '',
      ' ',
    ])('rejects %j', (flag) => {
      expect(() => validateSourceOptions({ gpSize: 8, cppFlags: [flag] }, limits)).toThrow(
        InvalidOptionsError,
      );
      expect(() => validateSourceOptions({ gpSize: 8, cppFlags: [flag] }, limits)).toThrow(
        JSON.stringify(flag),
      );
    });

    it('rejects non-array and non-string entries', () => {
      expect(() => validateSourceOptions({ gpSize: 8, cppFlags: '-DFOX' }, limits)).toThrow(
        /cppFlags/,
      );
      expect(() => validateSourceOptions({ gpSize: 8, cppFlags: [1] }, limits)).toThrow(/cppFlags/);
    });

    it('returns a copy', () => {
      const cppFlags = ['-DFOX'];
      const normalized = validateSourceOptions({ gpSize: 8, cppFlags }, limits);
      expect(normalized.cppFlags).not.toBe(cppFlags);
      cppFlags.push('-DHOUND');
      expect(normalized.cppFlags).toEqual(['-DFOX']);
    });

    it('rejects anything outside the allow-list (property)', () => {
      const allowed =
        /^-(?:D[A-Za-z_][A-Za-z0-9_]*(?:\([A-Za-z_][A-Za-z0-9_]*(?:,[A-Za-z_][A-Za-z0-9_]*)*\))?(?:=.*)?|U[A-Za-z_][A-Za-z0-9_]*|I.+|W[A-Za-z][A-Za-z0-9-]*|pedantic|pedantic-errors|trigraphs|lang-c|traditional)$/s;
      fc.assert(
        fc.property(
          fc.string().filter((s) => !allowed.test(s)),
          (flag) => {
            expect(() => validateSourceOptions({ gpSize: 8, cppFlags: [flag] }, limits)).toThrow(
              InvalidOptionsError,
            );
          },
        ),
      );
    });
  });

  describe('encoding', () => {
    it.each(['raw', 'sjis', 'EUCJP', 1, null])('rejects %j', (encoding) => {
      expect(() => validateSourceOptions({ gpSize: 8, encoding }, limits)).toThrow(/encoding/);
    });
  });

  describe('headers', () => {
    it('encodes string contents as UTF-8 and copies byte contents', () => {
      const bytes = new Uint8Array([0x2f, 0x2a, 0xc6, 0xfc, 0x2a, 0x2f]);
      const normalized = validateSourceOptions(
        { gpSize: 8, headers: { 'b.h': bytes, 'a.h': 'int otacon;\n' } },
        limits,
      );
      expect(normalized.headers).toEqual([
        { path: 'a.h', data: utf8('int otacon;\n') },
        { path: 'b.h', data: bytes },
      ]);
      expect(normalized.headers[1]?.data).not.toBe(bytes);
      bytes[0] = 0;
      expect(normalized.headers[1]?.data[0]).toBe(0x2f);
    });

    it('copies only the viewed range of a Node Buffer or subarray', () => {
      const pool = new Uint8Array([1, 2, 3, 4, 5]);
      const view = pool.subarray(1, 3);
      const normalized = validateSourceOptions({ gpSize: 8, headers: { 'v.h': view } }, limits);
      expect(normalized.headers[0]?.data).toEqual(new Uint8Array([2, 3]));
      expect(normalized.headers[0]?.data.buffer.byteLength).toBe(2);
    });

    it('sorts headers by path', () => {
      const normalized = validateSourceOptions(
        { gpSize: 8, headers: { 'z/otacon.h': '', 'a/hound.h': '', 'm.h': '' } },
        limits,
      );
      expect(normalized.headers.map((h) => h.path)).toEqual(['a/hound.h', 'm.h', 'z/otacon.h']);
    });

    it('accepts an own property literally named __proto__', () => {
      const headers = Object.defineProperty({}, '__proto__', {
        value: 'int fox;',
        enumerable: true,
      });
      const normalized = validateSourceOptions({ gpSize: 8, headers }, limits);
      expect(normalized.headers).toEqual([{ path: '__proto__', data: utf8('int fox;') }]);
    });

    it.each([
      ['/abs.h', /single path segment|absolute|segment/],
      ['a//b.h', /segment/],
      ['./a.h', /segment/],
      ['../a.h', /segment/],
      ['a/../b.h', /segment/],
      ['a\\b.h', /backslash/],
      ['', /segment/],
      ['a/', /segment/],
      ['.hidden.h', /segment/],
      ['-x.h', /segment/],
      ['out.s', /reserved/],
      ['out.i', /reserved/],
      ['input.c', /reserved/],
      ['input.c/x.h', /directory/],
    ])('rejects header path %j', (path, message) => {
      expect(() => validateSourceOptions({ gpSize: 8, headers: { [path]: '' } }, limits)).toThrow(
        InvalidOptionsError,
      );
      expect(() => validateSourceOptions({ gpSize: 8, headers: { [path]: '' } }, limits)).toThrow(
        message,
      );
    });

    it('rejects a header path that is also a directory of another header', () => {
      expect(() =>
        validateSourceOptions(
          { gpSize: 8, headers: { include: '', 'include/codec.h': '' } },
          limits,
        ),
      ).toThrow(/directory/);
    });

    it('rejects a header named like the source file, in either role', () => {
      expect(() =>
        validateSourceOptions(
          { gpSize: 8, filename: 'rations.c', headers: { 'rations.c': '' } },
          limits,
        ),
      ).toThrow(/reserved/);
      expect(() =>
        validateSourceOptions(
          { gpSize: 8, filename: 'rations.c', headers: { 'rations.c/x.h': '' } },
          limits,
        ),
      ).toThrow(/directory/);
    });

    it('rejects oversized segments and paths', () => {
      const segment = 'a'.repeat(256);
      expect(() =>
        validateSourceOptions({ gpSize: 8, headers: { [segment]: '' } }, limits),
      ).toThrow(/255/);
      const path = Array.from({ length: 30 }, () => 'a'.repeat(200)).join('/');
      expect(() => validateSourceOptions({ gpSize: 8, headers: { [path]: '' } }, limits)).toThrow(
        /4096/,
      );
    });

    it('rejects non-object headers and non-string, non-byte contents', () => {
      expect(() => validateSourceOptions({ gpSize: 8, headers: ['a.h'] }, limits)).toThrow(
        /headers/,
      );
      expect(() => validateSourceOptions({ gpSize: 8, headers: 'a.h' }, limits)).toThrow(/headers/);
      expect(() => validateSourceOptions({ gpSize: 8, headers: { 'a.h': 1 } }, limits)).toThrow(
        /a\.h/,
      );
      expect(() => validateSourceOptions({ gpSize: 8, headers: { 'a.h': null } }, limits)).toThrow(
        /a\.h/,
      );
    });

    it('enforces maxHeaderCount', () => {
      const three = { 'a.h': '', 'b.h': '', 'c.h': '' };
      expect(() =>
        validateSourceOptions({ gpSize: 8, headers: three }, { ...limits, maxHeaderCount: 2 }),
      ).toThrow(/maxHeaderCount|3 headers.*2/);
      expect(
        validateSourceOptions({ gpSize: 8, headers: three }, { ...limits, maxHeaderCount: 3 })
          .headers,
      ).toHaveLength(3);
    });

    it('enforces maxHeaderBytes on the total with both sizes in the message', () => {
      const headers = { 'a.h': 'aaaa', 'b.h': 'bbb' };
      expect(() =>
        validateSourceOptions({ gpSize: 8, headers }, { ...limits, maxHeaderBytes: 6 }),
      ).toThrow(/7 bytes.*6 bytes/);
      expect(
        validateSourceOptions({ gpSize: 8, headers }, { ...limits, maxHeaderBytes: 7 }).headers,
      ).toHaveLength(2);
    });

    it('accepts any slash-joined list of valid segments and rejects dot segments (property)', () => {
      const segment = fc.stringMatching(/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,10}$/);
      const path = fc.array(segment, { minLength: 1, maxLength: 5 }).map((s) => s.join('/'));
      fc.assert(
        fc.property(path, (p) => {
          fc.pre(!['out.i', 'out.s', 'input.c'].includes(p));
          expect(validateVirtualPath(p)).toBe(p);
        }),
      );
      const dotted = fc
        .tuple(
          fc.array(segment, { maxLength: 3 }),
          fc.constantFrom('.', '..'),
          fc.array(segment, { maxLength: 3 }),
        )
        .map(([a, dot, b]) => [...a, dot, ...b].join('/'));
      fc.assert(
        fc.property(dotted, (p) => {
          expect(() => validateVirtualPath(p)).toThrow(InvalidOptionsError);
        }),
      );
      fc.assert(
        fc.property(path, segment, (p, s) => {
          fc.pre(!['out.i', 'out.s', 'input.c'].includes(p));
          expect(() =>
            validateSourceOptions({ gpSize: 8, headers: { [p]: '', [`${p}/${s}`]: '' } }, limits),
          ).toThrow(/directory/);
        }),
      );
    });
  });
});

describe('normalizeSourceInput', () => {
  it('encodes strings as UTF-8', () => {
    expect(normalizeSourceInput('int 日;')).toEqual(utf8('int 日;'));
  });

  it('copies byte input', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const out = normalizeSourceInput(bytes);
    expect(out).toEqual(bytes);
    expect(out).not.toBe(bytes);
    expect(out.buffer).not.toBe(bytes.buffer);
  });

  it('rejects anything else', () => {
    for (const bad of [1, null, undefined, {}, [0x41]]) {
      expect(() => normalizeSourceInput(bad)).toThrow(InvalidOptionsError);
    }
  });
});

describe('constants', () => {
  it('names the preprocessor output', () => {
    expect(RESERVED_PREPROCESSED_NAME).toBe('out.i');
  });
});

describe('validateVirtualPath', () => {
  it('rejects non-strings, naming what was validated', () => {
    expect(() => validateVirtualPath(5)).toThrow(/header path must be a string/);
    expect(() => validateVirtualPath(null, 'codec key')).toThrow(/codec key must be a string/);
  });
});
