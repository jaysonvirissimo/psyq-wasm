// SPDX-License-Identifier: MIT
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fixturePath, loadManifest, readFixture, readFixtureText } from '../helpers/fixtures.js';

describe('test/fixtures/manifest.json', () => {
  const { fixtures } = loadManifest();

  it('has unique names', () => {
    expect(new Set(fixtures.map((f) => f.name)).size).toBe(fixtures.length);
  });

  it('covers the twelve generic fixtures at both small-data settings plus a -g variant', () => {
    const names = fixtures.map((f) => f.name);
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      const prefix = `t${String(n).padStart(2, '0')}_`;
      expect(
        names.some((x) => x.startsWith(prefix) && x.endsWith('-g8')),
        prefix,
      ).toBe(true);
      expect(
        names.some((x) => x.startsWith(prefix) && x.endsWith('-g0')),
        prefix,
      ).toBe(true);
    }
    expect(names).toContain('t07_struct-g8-debug');
  });

  it.each(loadManifest().fixtures.map((f) => [f.name, f] as const))(
    '%s references existing files with valid options',
    (_name, f) => {
      expect(existsSync(fixturePath(f.input)), f.input).toBe(true);
      expect([0, 8]).toContain(f.gpSize);
      expect(f.filename).toMatch(/^[A-Za-z0-9_.-]+$/);
      for (const flag of f.rawFlags) expect(flag).toMatch(/^-[A-Za-z]/);
      if (f.expected !== undefined)
        expect(existsSync(fixturePath(f.expected)), f.expected).toBe(true);
      if (f.expectedStderr !== undefined) {
        expect(existsSync(fixturePath(f.expectedStderr)), f.expectedStderr).toBe(true);
      }
      if (f.expectedExitCode === 0) expect(f.expected).toBeDefined();
    },
  );

  it('keeps preprocessed inputs starting with a line marker', () => {
    for (const f of fixtures) {
      expect(readFixtureText(f.input)).toMatch(/^# 1 "/);
    }
  });

  it('keeps expected assembly with CRLF line endings only', () => {
    const seen = new Set<string>();
    for (const f of fixtures) {
      if (f.expected === undefined || seen.has(f.expected)) continue;
      seen.add(f.expected);
      const bytes = readFixture(f.expected);
      let bareLf = 0;
      let crlf = 0;
      for (let i = 0; i < bytes.length; i++) {
        if (bytes[i] === 0x0a) {
          if (i > 0 && bytes[i - 1] === 0x0d) crlf++;
          else bareLf++;
        }
      }
      expect(crlf, f.expected).toBeGreaterThan(0);
      expect(bareLf, f.expected).toBe(0);
    }
  });

  it('matches SHA256SUMS', () => {
    const lines = readFixtureText('SHA256SUMS').trim().split('\n');
    const listed = new Map<string, string>();
    for (const line of lines) {
      const m = /^([0-9a-f]{64}) [ *](.+)$/.exec(line);
      if (!m) throw new Error(`bad SHA256SUMS line: ${line}`);
      listed.set(m[2] ?? '', m[1] ?? '');
    }
    const referenced = new Set<string>();
    for (const f of fixtures) {
      referenced.add(f.input);
      if (f.expected !== undefined) referenced.add(f.expected);
      if (f.expectedStderr !== undefined) referenced.add(f.expectedStderr);
    }
    for (const rel of referenced) {
      const actual = createHash('sha256')
        .update(readFileSync(fixturePath(rel)))
        .digest('hex');
      expect(listed.get(rel), rel).toBe(actual);
    }
  });
});

describe('test/fixtures/manifest.json sources', () => {
  const { fixtures, sources } = loadManifest();

  it('has unique names that do not collide with the compile fixtures', () => {
    const names = [...fixtures.map((f) => f.name), ...sources.map((s) => s.name)];
    expect(new Set(names).size).toBe(names.length);
  });

  it('covers includes, macros, EUC-JP, and a preprocessor error at both -G settings', () => {
    const names = sources.map((s) => s.name);
    for (const prefix of ['t18_include-', 't19_macros-', 't20_eucjp-', 't21_cpperror-']) {
      expect(
        names.some((n) => n.startsWith(prefix) && n.endsWith('-g8')),
        prefix,
      ).toBe(true);
      expect(
        names.some((n) => n.startsWith(prefix) && n.endsWith('-g0')),
        prefix,
      ).toBe(true);
    }
  });

  it.each(sources.map((s) => [s.name, s] as const))(
    '%s references existing files with valid options',
    (_name, s) => {
      expect(existsSync(fixturePath(s.source)), s.source).toBe(true);
      expect(s.filename).toMatch(/^[A-Za-z0-9_.-]+\.c$/);
      expect([0, 8]).toContain(s.gpSize);
      for (const [path, file] of Object.entries(s.headers ?? {})) {
        expect(path).toMatch(/^[A-Za-z0-9_][A-Za-z0-9_./-]*$/);
        expect(existsSync(fixturePath(file)), file).toBe(true);
      }
      for (const flag of s.extraCppFlags ?? []) expect(flag).toMatch(/^-[DUIW]/);
      if (s.encoding !== undefined) expect(['utf8', 'eucjp']).toContain(s.encoding);
      expect(existsSync(fixturePath(s.expectedPreprocessed)), s.expectedPreprocessed).toBe(true);
      if (s.expected !== undefined)
        expect(existsSync(fixturePath(s.expected)), s.expected).toBe(true);
      if (s.expectedStderr !== undefined) {
        expect(existsSync(fixturePath(s.expectedStderr)), s.expectedStderr).toBe(true);
      }
      if (s.expectedExitCode === 0) {
        expect(s.expected).toBeDefined();
        expect(s.expectedStage).toBeUndefined();
      } else {
        expect(['preprocess', 'compile']).toContain(s.expectedStage);
      }
      if (s.expectedStage === 'preprocess') expect(s.expected).toBeUndefined();
    },
  );

  it('keeps every preprocessed fixture starting with the line marker of its source', () => {
    for (const s of sources) {
      expect(readFixture(s.expectedPreprocessed).subarray(0, 5)).toEqual(
        new TextEncoder().encode('# 1 "'),
      );
    }
  });

  it('commits the EUC-JP fixture as UTF-8 source and EUC-JP preprocessed bytes', () => {
    const source = readFixture('src/t20_eucjp.c');
    const preprocessed = readFixture('src/t20_eucjp.i');
    expect(() => new TextDecoder('utf-8', { fatal: true }).decode(source)).not.toThrow();
    expect(() => new TextDecoder('euc-jp', { fatal: true }).decode(preprocessed)).not.toThrow();
    expect(() => new TextDecoder('utf-8', { fatal: true }).decode(preprocessed)).toThrow();
    expect(preprocessed.some((b) => b >= 0x80)).toBe(true);
  });

  it('lists every source, header, and preprocessed file in SHA256SUMS', () => {
    const lines = readFixtureText('SHA256SUMS').trim().split('\n');
    const listed = new Map(lines.map((l) => [l.slice(66), l.slice(0, 64)]));
    const referenced = new Set<string>();
    for (const s of sources) {
      referenced.add(s.source);
      referenced.add(s.expectedPreprocessed);
      for (const file of Object.values(s.headers ?? {})) referenced.add(file);
      if (s.expected !== undefined) referenced.add(s.expected);
      if (s.expectedStderr !== undefined) referenced.add(s.expectedStderr);
    }
    for (const rel of referenced) {
      const actual = createHash('sha256')
        .update(readFileSync(fixturePath(rel)))
        .digest('hex');
      expect(listed.get(rel), rel).toBe(actual);
    }
  });
});
