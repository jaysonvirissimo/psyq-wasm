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
