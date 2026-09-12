// SPDX-License-Identifier: MIT
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fromRoot } from '../helpers/paths.js';

describe('build/objs.txt', () => {
  const objs = readFileSync(fromRoot('build', 'objs.txt'), 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '' && !l.startsWith('#'));

  it('lists the 70 objects of the reference cc1 link line', () => {
    expect(objs).toHaveLength(70);
    expect(new Set(objs).size).toBe(70);
  });

  it('keeps the reference link order', () => {
    expect(objs[0]).toBe('c-parse.o');
    expect(objs.at(-1)).toBe('obstack.o');
    expect(objs.indexOf('toplev.o')).toBeLessThan(objs.indexOf('tree.o'));
  });

  it('includes the PsyQ-specific and target-specific objects', () => {
    expect(objs).toContain('unix2dos.o');
    expect(objs).toContain('mips.o');
    expect(objs).toContain('insn-attrtab.o');
  });

  it('uses plain object file names', () => {
    for (const o of objs) expect(o).toMatch(/^[a-z0-9-]+\.o$/);
  });
});

describe('build/cccp-objs.txt', () => {
  const objs = readFileSync(fromRoot('build', 'cccp-objs.txt'), 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '' && !l.startsWith('#'));

  it('lists the five objects of the reference cccp link line, in order', () => {
    expect(objs).toEqual(['cccp.o', 'cexp.o', 'prefix.o', 'version.o', 'obstack.o']);
  });
});
