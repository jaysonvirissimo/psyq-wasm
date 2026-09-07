// SPDX-License-Identifier: MIT
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { fromRoot } from '../helpers/paths.js';
import { loadPins } from '../helpers/pins.js';

interface BuildInfo {
  buildId: string;
  wasmSha256: string;
  glueSha256: string;
  emsdkImage: string;
  homebrewPsyqSha: string;
  gccTreeSha: string;
  cflags: string;
  ldflags: string;
  objects: number;
}

const wasm = readFileSync(fromRoot('dist', 'cc1psx.wasm'));
const glue = readFileSync(fromRoot('dist', 'cc1psx.js'));
const info = JSON.parse(readFileSync(fromRoot('dist', 'build-info.json'), 'utf8')) as BuildInfo;
const pins = loadPins();

describe('dist/cc1psx.wasm', () => {
  it('is a WebAssembly module', () => {
    expect([...wasm.subarray(0, 4)]).toEqual([0x00, 0x61, 0x73, 0x6d]);
    expect(WebAssembly.validate(wasm)).toBe(true);
  });

  it('does not use threads or shared memory', async () => {
    const mod = await WebAssembly.compile(wasm);
    const imports = WebAssembly.Module.imports(mod).map((i) => i.name);
    expect(imports.some((n) => /pthread|atomic/i.test(n))).toBe(false);
  });

  it('stays under the 1 MiB gzip payload target together with its glue', () => {
    const total = gzipSync(wasm, { level: 9 }).length + gzipSync(glue, { level: 9 }).length;
    expect(total).toBeLessThan(1024 * 1024);
  });
});

describe('dist/cc1psx.js', () => {
  it('is an ES module exporting the factory and BUILD_ID', async () => {
    const mod = (await import(fromRoot('dist', 'cc1psx.js'))) as {
      default: unknown;
      BUILD_ID: unknown;
    };
    expect(typeof mod.default).toBe('function');
    expect(mod.BUILD_ID).toBe(info.buildId);
  });
});

describe('dist/build-info.json', () => {
  it('derives buildId from the wasm hash', () => {
    const sha = createHash('sha256').update(wasm).digest('hex');
    expect(info.wasmSha256).toBe(sha);
    expect(info.buildId).toBe(`sha256:${sha.slice(0, 16)}`);
    expect(info.glueSha256).toBe(createHash('sha256').update(glue).digest('hex'));
  });

  it('records the pinned inputs', () => {
    expect(info.emsdkImage).toBe(pins.get('EMSDK_IMAGE'));
    expect(info.homebrewPsyqSha).toBe(pins.get('HOMEBREW_PSYQ_SHA'));
    expect(info.gccTreeSha).toBe(pins.get('GCC_TREE_SHA'));
    expect(info.cflags).toBe(pins.get('CC1_WASM_CFLAGS'));
    expect(info.ldflags).toBe(pins.get('CC1_WASM_LDFLAGS'));
    expect(info.objects).toBe(70);
  });

  it('matches dist/SHA256SUMS', () => {
    const sums = readFileSync(fromRoot('dist', 'SHA256SUMS'), 'utf8');
    expect(sums).toContain(`${info.wasmSha256}  cc1psx.wasm`);
    expect(sums).toContain(`${info.glueSha256}  cc1psx.js`);
  });
});
