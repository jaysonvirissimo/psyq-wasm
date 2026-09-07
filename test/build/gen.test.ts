// SPDX-License-Identifier: MIT
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fromRoot } from '../helpers/paths.js';

const GEN = fromRoot('build', 'gen');

export const GENERATED_FILES = [
  'auto-config.h',
  'bc-arity.h',
  'bc-opcode.h',
  'bc-opname.h',
  'c-gperf.h',
  'c-parse.c',
  'c-parse.h',
  'config.h',
  'hconfig.h',
  'insn-attr.h',
  'insn-attrtab.c',
  'insn-codes.h',
  'insn-config.h',
  'insn-emit.c',
  'insn-extract.c',
  'insn-flags.h',
  'insn-opinit.c',
  'insn-output.c',
  'insn-peep.c',
  'insn-recog.c',
  'options.h',
  'specs.h',
  'tconfig.h',
  'tm.h',
];

describe('build/gen', () => {
  it('contains exactly the generated sources plus README and checksums', () => {
    const entries = readdirSync(GEN).sort();
    expect(entries).toEqual([...GENERATED_FILES, 'README.md', 'SHA256SUMS'].sort());
  });

  it('is configured for an i386 host and the mips-psx target', () => {
    const config = readFileSync(`${GEN}/config.h`, 'utf8');
    expect(config).toContain('#include "auto-config.h"');
    expect(config).toContain('#include "i386/xm-linux.h"');
    expect(readFileSync(`${GEN}/tm.h`, 'utf8')).toContain('#include "mips/psx.h"');
  });

  it('carries a bison-generated parser', () => {
    expect(readFileSync(`${GEN}/c-parse.c`, 'utf8')).toMatch(/bison/i);
  });

  it('matches SHA256SUMS', () => {
    const sums = readFileSync(`${GEN}/SHA256SUMS`, 'utf8')
      .trim()
      .split('\n')
      .map((line) => {
        const m = /^([0-9a-f]{64}) [ *](.+)$/.exec(line);
        if (!m) throw new Error(`bad SHA256SUMS line: ${line}`);
        return [m[2] ?? '', m[1] ?? ''] as const;
      });
    expect(sums.map(([name]) => name).sort()).toEqual([...GENERATED_FILES].sort());
    for (const [name, expected] of sums) {
      const actual = createHash('sha256')
        .update(readFileSync(`${GEN}/${name}`))
        .digest('hex');
      expect(actual, name).toBe(expected);
    }
  });
});
