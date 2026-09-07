// SPDX-License-Identifier: MIT
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePins, verify } from '../../scripts/verify-provenance.mjs';
import { fromRoot } from '../helpers/paths.js';

const provenance = readFileSync(fromRoot('PROVENANCE.md'), 'utf8');
const pins = parsePins(readFileSync(fromRoot('build', 'pins.env'), 'utf8'));

describe('PROVENANCE.md', () => {
  it('records every pinned build input', () => {
    expect(verify({ provenance, pins, packageVersion: '0.1.0' })).toEqual([]);
  });

  it('documents the required sections', () => {
    for (const heading of [
      'Artifact identity',
      'Compiler source',
      'Historical build environment',
      'Generated build-time sources',
      'Compatibility changes',
      'WebAssembly toolchain',
      'Reproducibility',
      'Corresponding source',
    ]) {
      expect(provenance).toMatch(new RegExp(`^## \\d+\\. ${heading}`, 'm'));
    }
  });

  it('agrees with a built artifact when one is present', () => {
    const path = fromRoot('dist', 'build-info.json');
    if (!existsSync(path)) return;
    const buildInfo = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    expect(verify({ provenance, pins, buildInfo, packageVersion: '0.1.0' })).toEqual([]);
  });
});

describe('verify-provenance', () => {
  it('reports each mismatch', () => {
    const stale = new Map(pins);
    stale.set('EMSDK_IMAGE', 'emscripten/emsdk:0.0.1');
    const problems = verify({
      provenance,
      pins: stale,
      buildInfo: {
        emsdkImage: 'emscripten/emsdk:6.0.9',
        homebrewPsyqSha: pins.get('HOMEBREW_PSYQ_SHA') ?? '',
        gccTreeSha: pins.get('GCC_TREE_SHA') ?? '',
        cflags: pins.get('CC1_WASM_CFLAGS') ?? '',
        ldflags: pins.get('CC1_WASM_LDFLAGS') ?? '',
        buildId: 'sha256:0000000000000000',
        wasmSha256: 'abcdef',
      },
      packageVersion: '0.1.0',
      tag: 'v0.2.0',
    });
    expect(problems).toEqual([
      'PROVENANCE.md does not mention EMSDK_IMAGE=emscripten/emsdk:0.0.1',
      'build-info.json emsdkImage=emscripten/emsdk:6.0.9 differs from pins EMSDK_IMAGE=emscripten/emsdk:0.0.1',
      'build-info.json buildId is not derived from wasmSha256',
      'package.json version 0.1.0 does not match tag v0.2.0',
    ]);
    const missing = new Map(pins);
    missing.delete('GCC_TREE_SHA');
    expect(verify({ provenance, pins: missing, packageVersion: '0.1.0' })).toEqual([
      'pins.env is missing GCC_TREE_SHA',
    ]);
  });

  it('runs as a command-line tool', () => {
    const out = execFileSync(process.execPath, [fromRoot('scripts', 'verify-provenance.mjs')], {
      encoding: 'utf8',
    });
    expect(out.trim()).toBe('provenance: OK');
  });
});
