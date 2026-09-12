// SPDX-License-Identifier: MIT
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { EncodingError } from '../../src/errors.js';
import { JIS0208_ROWS, JIS0212_ROWS } from '../../src/eucjp-table.js';
import { encodeEucJp } from '../../src/eucjp.js';

const CELLS = 94;

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

/** Every assigned (character, bytes) pair of both planes. */
function assignedCells(): { char: string; bytes: Uint8Array }[] {
  const out: { char: string; bytes: Uint8Array }[] = [];
  const planes: [readonly string[], number[]][] = [
    [JIS0208_ROWS, []],
    [JIS0212_ROWS, [0x8f]],
  ];
  for (const [rows, prefix] of planes) {
    rows.forEach((row, r) => {
      for (let c = 0; c < CELLS; c += 1) {
        const char = row.charAt(c);
        if (char !== '\0') out.push({ char, bytes: bytes(...prefix, 0xa1 + r, 0xa1 + c) });
      }
    });
  }
  return out;
}

/** Test-side decoder over the same table, so the round trip is independent of any browser mapping. */
function decodeWithTable(encoded: Uint8Array): string {
  let text = '';
  for (let i = 0; i < encoded.length;) {
    const b = encoded[i] ?? 0;
    if (b < 0x80) {
      text += String.fromCharCode(b);
      i += 1;
    } else if (b === 0x8e) {
      text += String.fromCharCode(0xff61 + ((encoded[i + 1] ?? 0) - 0xa1));
      i += 2;
    } else if (b === 0x8f) {
      text += (JIS0212_ROWS[(encoded[i + 1] ?? 0) - 0xa1] ?? '').charAt(
        (encoded[i + 2] ?? 0) - 0xa1,
      );
      i += 3;
    } else {
      text += (JIS0208_ROWS[b - 0xa1] ?? '').charAt((encoded[i + 1] ?? 0) - 0xa1);
      i += 2;
    }
  }
  return text;
}

describe('encodeEucJp', () => {
  it('encodes JIS X 0208 characters as two bytes', () => {
    expect(encodeEucJp('日本語')).toEqual(bytes(0xc6, 0xfc, 0xcb, 0xdc, 0xb8, 0xec));
    expect(encodeEucJp('「」')).toEqual(bytes(0xa1, 0xd6, 0xa1, 0xd7));
    expect(encodeEucJp('￥')).toEqual(bytes(0xa1, 0xef)); // FULLWIDTH YEN SIGN
    expect(encodeEucJp('〜')).toEqual(bytes(0xa1, 0xc1)); // WAVE DASH, JIS mapping
    expect(encodeEucJp('−')).toEqual(bytes(0xa1, 0xdd)); // MINUS SIGN, JIS mapping
  });

  it('encodes JIS X 0212 characters as three bytes', () => {
    expect(encodeEucJp('丂')).toEqual(bytes(0x8f, 0xb0, 0xa1));
    expect(encodeEucJp('é')).toEqual(bytes(0x8f, 0xab, 0xb1));
  });

  it('encodes half-width katakana with the 0x8E prefix', () => {
    expect(encodeEucJp('ｶﾀｶﾅ')).toEqual(bytes(0x8e, 0xb6, 0x8e, 0xc0, 0x8e, 0xb6, 0x8e, 0xc5));
    expect(encodeEucJp('｡')).toEqual(bytes(0x8e, 0xa1));
    expect(encodeEucJp('ﾟ')).toEqual(bytes(0x8e, 0xdf));
  });

  it('passes ASCII through unchanged, including backslash and tilde', () => {
    const ascii = 'int rations = 140;\\\n\t~otacon() {}\r\n';
    expect(encodeEucJp(ascii)).toEqual(new TextEncoder().encode(ascii));
    expect(encodeEucJp('')).toEqual(bytes());
  });

  it('mixes ASCII and multibyte text', () => {
    expect(encodeEucJp('a日b')).toEqual(bytes(0x61, 0xc6, 0xfc, 0x62));
  });

  it.each([
    ['¥', 'U+00A5'], // YEN SIGN: 0x5C is a backslash in this mapping
    ['‾', 'U+203E'], // OVERLINE
    ['～', 'U+FF5E'], // FULLWIDTH TILDE (the WHATWG alias of WAVE DASH)
    ['－', 'U+FF0D'], // FULLWIDTH HYPHEN-MINUS
    ['\u{1f600}', 'U+1F600'],
  ])('rejects %s with EncodingError', (char, label) => {
    let caught: unknown;
    try {
      encodeEucJp(`codec ${char}`);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(EncodingError);
    const err = caught as EncodingError;
    expect(err.code).toBe('encoding');
    expect(err.character).toBe(char);
    expect(err.index).toBe(6);
    expect(err.message).toContain(label);
    expect(err.message).toContain('EUC-JP');
  });

  it('reports the line of the offending character', () => {
    let caught: unknown;
    try {
      encodeEucJp('int a;\nint b;\n/* ¥ */\n');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(EncodingError);
    expect((caught as EncodingError).message).toContain('line 3');
    expect((caught as EncodingError).index).toBe(17);
  });

  it('rejects a lone surrogate, reporting the code unit itself', () => {
    expect(() => encodeEucJp('\ud83d')).toThrow(EncodingError);
    expect(() => encodeEucJp('\ud83d')).toThrow(/U\+D83D/);
    expect(() => encodeEucJp('\ud83dx')).toThrow(/U\+D83D/);
    expect(() => encodeEucJp('\ude00x')).toThrow(/U\+DE00/);
  });

  it('round-trips every assigned cell of both planes', () => {
    for (const cell of assignedCells()) {
      expect(encodeEucJp(cell.char), `U+${cell.char.codePointAt(0)?.toString(16) ?? ''}`).toEqual(
        cell.bytes,
      );
    }
  });

  it('round-trips arbitrary mixtures of ASCII, kana, and table characters (property)', () => {
    const cells = assignedCells().map((c) => c.char);
    const ascii = fc.integer({ min: 0, max: 0x7f }).map((n) => String.fromCharCode(n));
    const kana = fc.integer({ min: 0xff61, max: 0xff9f }).map((n) => String.fromCharCode(n));
    const table = fc.constantFrom(...cells);
    const text = fc.array(fc.oneof(ascii, kana, table), { maxLength: 40 }).map((a) => a.join(''));
    fc.assert(
      fc.property(text, (s) => {
        expect(decodeWithTable(encodeEucJp(s))).toBe(s);
      }),
    );
  });
});

describe('eucjp-table', () => {
  it('holds 94 rows of 94 cells per plane', () => {
    for (const rows of [JIS0208_ROWS, JIS0212_ROWS]) {
      expect(rows).toHaveLength(CELLS);
      for (const row of rows) expect(row).toHaveLength(CELLS);
    }
  });

  it('maps each code point to at most one cell, all in the BMP', () => {
    const seen = new Set<string>();
    for (const { char } of assignedCells()) {
      expect(seen.has(char), char).toBe(false);
      seen.add(char);
      const code = char.charCodeAt(0);
      expect(code >= 0xd800 && code <= 0xdfff).toBe(false);
    }
    expect(seen.size).toBeGreaterThan(12_000);
  });

  it('uses the JIS mappings rather than the WHATWG aliases', () => {
    const chars = new Set(assignedCells().map((c) => c.char));
    expect(chars.has('〜')).toBe(true);
    expect(chars.has('～')).toBe(false);
    expect(chars.has('∥')).toBe(false);
    expect(chars.has('‖')).toBe(true);
  });
});
