// SPDX-License-Identifier: MIT
/**
 * EUC-JP encoder for the convenience pipeline. The browser platform decodes
 * EUC-JP but cannot encode it, so the mapping is shipped in-tree: JIS X 0208
 * and JIS X 0212 from `eucjp-table.ts` (generated from Ruby's converter, the
 * same tool that transcodes the reference fixtures), plus ASCII and the
 * half-width katakana block by formula.
 *
 * Unmappable characters are an error, never substituted: the bytes handed to
 * the compiler must be exactly what the reference pipeline would produce.
 */
import { EncodingError } from './errors.js';
import { JIS0208_ROWS, JIS0212_ROWS } from './eucjp-table.js';

const CELLS = 94;
const FIRST_CELL = 0xa1;
const HALFWIDTH_PREFIX = 0x8e;
const JIS0212_PREFIX = 0x8f;
const HALFWIDTH_FIRST = 0xff61;
const HALFWIDTH_LAST = 0xff9f;

/** Code point → packed byte pair `(hi << 8) | lo`; JIS X 0212 entries carry an extra 0x10000 bit. */
let table: Map<number, number> | undefined;

function buildTable(): Map<number, number> {
  const map = new Map<number, number>();
  const planes: [readonly string[], number][] = [
    [JIS0208_ROWS, 0],
    [JIS0212_ROWS, 0x10000],
  ];
  for (const [rows, plane] of planes) {
    rows.forEach((row, r) => {
      for (let c = 0; c < CELLS; c += 1) {
        const code = row.charCodeAt(c);
        if (code !== 0) map.set(code, plane | ((FIRST_CELL + r) << 8) | (FIRST_CELL + c));
      }
    });
  }
  return map;
}

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text.charCodeAt(i) === 0x0a) line += 1;
  return line;
}

/** Code point of a one-character string (a surrogate pair or a single code unit). */
function codePoint(character: string): number {
  if (character.length === 2) {
    return (
      ((character.charCodeAt(0) - 0xd800) << 10) + (character.charCodeAt(1) - 0xdc00) + 0x10000
    );
  }
  return character.charCodeAt(0);
}

function unmappable(text: string, index: number, character: string): EncodingError {
  const code = codePoint(character);
  const label = `U+${code.toString(16).toUpperCase().padStart(4, '0')}`;
  return new EncodingError(
    `${label} ${JSON.stringify(character)} at line ${String(lineOf(text, index))} of the preprocessed output has no EUC-JP mapping.`,
    { character, index },
  );
}

/** Encode a string as EUC-JP bytes. Throws `EncodingError` for the first unmappable character. */
export function encodeEucJp(text: string): Uint8Array {
  table ??= buildTable();
  // Worst case is three bytes per UTF-16 code unit (JIS X 0212).
  const out = new Uint8Array(text.length * 3);
  let n = 0;
  for (let i = 0; i < text.length; i += 1) {
    const unit = text.charCodeAt(i);
    if (unit < 0x80) {
      out[n] = unit;
      n += 1;
      continue;
    }
    if (unit >= HALFWIDTH_FIRST && unit <= HALFWIDTH_LAST) {
      out[n] = HALFWIDTH_PREFIX;
      out[n + 1] = FIRST_CELL + (unit - HALFWIDTH_FIRST);
      n += 2;
      continue;
    }
    const packed = table.get(unit);
    if (packed === undefined) {
      // A high surrogate followed by a low surrogate is one character.
      const next = text.charCodeAt(i + 1);
      const pair = unit >= 0xd800 && unit <= 0xdbff && next >= 0xdc00 && next <= 0xdfff;
      throw unmappable(text, i, text.slice(i, i + (pair ? 2 : 1)));
    }
    if (packed & 0x10000) {
      out[n] = JIS0212_PREFIX;
      n += 1;
    }
    out[n] = (packed >> 8) & 0xff;
    out[n + 1] = packed & 0xff;
    n += 2;
  }
  return out.slice(0, n);
}
