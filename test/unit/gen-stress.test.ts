// SPDX-License-Identifier: MIT
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { generate } from '../../scripts/gen-stress-fixture.mjs';
import { fromRoot } from '../helpers/paths.js';

describe('gen-stress-fixture', () => {
  it('is deterministic and grows with n', () => {
    expect(generate(3)).toBe(generate(3));
    expect(generate(30).length).toBeGreaterThan(generate(3).length * 5);
  });

  it('emits a line marker and one function per unit', () => {
    const text = generate(4);
    expect(text.startsWith('# 1 "codec_4.c"\n')).toBe(true);
    expect(text.match(/^int codec_\d+\(/gm)).toHaveLength(4);
    expect(text).toContain('case 31:');
    expect(text).not.toContain('case 32:');
  });

  it('rejects invalid sizes', () => {
    expect(() => generate(0)).toThrow(RangeError);
    expect(() => generate(1.5)).toThrow(RangeError);
  });

  it('works as a command-line tool', () => {
    const out = execFileSync(
      process.execPath,
      [fromRoot('scripts', 'gen-stress-fixture.mjs'), '2'],
      {
        encoding: 'utf8',
      },
    );
    expect(out).toBe(generate(2));
  });
});
