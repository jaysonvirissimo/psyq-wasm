// SPDX-License-Identifier: MIT
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { isContextLine, parseDiagnostics } from '../../src/diagnostics.js';

describe('parseDiagnostics', () => {
  it('returns nothing for empty or whitespace stderr', () => {
    expect(parseDiagnostics('')).toEqual([]);
    expect(parseDiagnostics('\n\n')).toEqual([]);
  });

  it('parses a warning and drops the function-context line', () => {
    const stderr =
      "rations.c: In function `otacon':\n" +
      'rations.c:3: warning: suggest parentheses around arithmetic in operand of |\n';
    expect(parseDiagnostics(stderr)).toEqual([
      {
        severity: 'warning',
        file: 'rations.c',
        line: 3,
        message: 'suggest parentheses around arithmetic in operand of |',
      },
    ]);
  });

  it('parses an unprefixed error and drops the include-context line', () => {
    const stderr =
      'In file included from hound.c:6:\n' +
      "/psyq/include/libgpu.h:83: parse error before `->'\n" +
      "/psyq/include/libgpu.h:92: stray '\\' in program\n";
    expect(parseDiagnostics(stderr)).toEqual([
      {
        severity: 'error',
        file: '/psyq/include/libgpu.h',
        line: 83,
        message: "parse error before `->'",
      },
      {
        severity: 'error',
        file: '/psyq/include/libgpu.h',
        line: 92,
        message: "stray '\\' in program",
      },
    ]);
  });

  it('keeps colons inside the file name', () => {
    const [diag] = parseDiagnostics("C:\\zanzibar\\fox.c:7: parse error before `}'\n");
    expect(diag).toMatchObject({ severity: 'error', file: 'C:\\zanzibar\\fox.c', line: 7 });
  });

  it('never emits a column (GCC 2.8.1 reports none)', () => {
    for (const d of parseDiagnostics('cardboard.c:12: warning: comparison is always 0\n')) {
      expect('column' in d).toBe(false);
    }
  });

  it('parses driver-level messages without a file', () => {
    expect(
      parseDiagnostics(
        'cc1: warning: -Wuninitialized is not supported without -O\ncc1: out of memory\n',
      ),
    ).toEqual([
      { severity: 'warning', message: '-Wuninitialized is not supported without -O' },
      { severity: 'error', message: 'out of memory' },
    ]);
  });

  it('accepts the program names the reference and the preprocessor print', () => {
    expect(
      parseDiagnostics(
        'cc1psx: warning: -Wuninitialized is not supported without -O\ncccp: Usage: cccp [switches] input output\n',
      ),
    ).toEqual([
      { severity: 'warning', message: '-Wuninitialized is not supported without -O' },
      { severity: 'error', message: 'Usage: cccp [switches] input output' },
    ]);
  });

  it('parses a preprocessor #error as a located error', () => {
    expect(parseDiagnostics('t21_cpperror.c:9: #error shadow moses codec unavailable\n')).toEqual([
      {
        severity: 'error',
        file: 't21_cpperror.c',
        line: 9,
        message: '#error shadow moses codec unavailable',
      },
    ]);
  });

  it('ignores context lines and unrelated chatter', () => {
    const stderr =
      "meiling.c: In function `save':\n" +
      'At top level:\n' +
      'In file included from meiling.c:2,\n' +
      '                 from codec.h:1:\n' +
      'Execution times (seconds)\n' +
      "meiling.c:9: warning: unused variable `freq'\n";
    expect(parseDiagnostics(stderr)).toEqual([
      { severity: 'warning', file: 'meiling.c', line: 9, message: "unused variable `freq'" },
    ]);
  });

  it('tolerates CRLF line endings', () => {
    expect(parseDiagnostics('x.c:1: warning: a\r\nx.c:2: b\r\n')).toEqual([
      { severity: 'warning', file: 'x.c', line: 1, message: 'a' },
      { severity: 'error', file: 'x.c', line: 2, message: 'b' },
    ]);
  });

  it('round-trips arbitrary file/line/message triples (property)', () => {
    const file = fc.stringMatching(/^[A-Za-z0-9_./-]{1,20}$/);
    const line = fc.integer({ min: 0, max: 999_999 });
    const message = fc.stringMatching(/^[^\r\n]{0,40}$/).filter((m) => m === m.trimStart());
    fc.assert(
      fc.property(file, line, message, fc.boolean(), (f, l, m, warn) => {
        const text = `${f}:${String(l)}: ${warn ? 'warning: ' : ''}${m}\n`;
        expect(parseDiagnostics(text)).toEqual([
          { severity: warn ? 'warning' : 'error', file: f, line: l, message: m },
        ]);
      }),
    );
  });
});

describe('isContextLine', () => {
  it.each([
    "rations.c: In function `otacon':",
    'In file included from hound.c:6:',
    '                 from codec.h:1:',
    'At top level:',
    'rations.c: At top level:',
  ])('recognises %j', (line) => {
    expect(isContextLine(line)).toBe(true);
  });

  it.each(['rations.c:3: warning: x', 'cc1: warning: y', 'random text'])('rejects %j', (line) => {
    expect(isContextLine(line)).toBe(false);
  });
});
