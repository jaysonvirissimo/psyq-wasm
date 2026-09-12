// SPDX-License-Identifier: MIT
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fromRoot } from '../helpers/paths.js';
import { loadPins } from '../helpers/pins.js';

interface BuildInfo {
  buildId: string;
  wasmSha256: string;
  glueSha256: string;
  emsdkImage: string;
  emsdkPlatform: string;
  homebrewPsyqSha: string;
  gccTreeSha: string;
  cflags: string;
  ldflags: string;
  objects: number;
  preprocessor: {
    buildId: string;
    wasmSha256: string;
    glueSha256: string;
    ldflags: string;
    defines: string;
    objects: number;
  };
}

const wasm = readFileSync(fromRoot('dist', 'cc1psx.wasm'));
const glue = readFileSync(fromRoot('dist', 'cc1psx.js'));
const cccpWasm = readFileSync(fromRoot('dist', 'cccp.wasm'));
const cccpGlue = readFileSync(fromRoot('dist', 'cccp.js'));
const eucjpTable = readFileSync(fromRoot('dist', 'eucjp-table.js'));
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
    const mod = (await import(pathToFileURL(fromRoot('dist', 'cc1psx.js')).href)) as {
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
    expect(info.emsdkPlatform).toBe(pins.get('EMSDK_PLATFORM'));
    expect(info.homebrewPsyqSha).toBe(pins.get('HOMEBREW_PSYQ_SHA'));
    expect(info.gccTreeSha).toBe(pins.get('GCC_TREE_SHA'));
    expect(info.cflags).toBe(pins.get('CC1_WASM_CFLAGS'));
    expect(info.ldflags).toBe(pins.get('CC1_WASM_LDFLAGS'));
    expect(info.objects).toBe(70);
  });

  it('records the preprocessor artifact alongside', () => {
    const sha = createHash('sha256').update(cccpWasm).digest('hex');
    expect(info.preprocessor.wasmSha256).toBe(sha);
    expect(info.preprocessor.buildId).toBe(`sha256:${sha.slice(0, 16)}`);
    expect(info.preprocessor.glueSha256).toBe(createHash('sha256').update(cccpGlue).digest('hex'));
    expect(info.preprocessor.ldflags).toBe(pins.get('CCCP_WASM_LDFLAGS'));
    expect(info.preprocessor.defines).toContain('-DGCC_INCLUDE_DIR=');
    expect(info.preprocessor.defines).toContain('-DPREFIX="/usr"');
    expect(info.preprocessor.objects).toBe(5);
  });

  it('matches dist/SHA256SUMS', () => {
    const sums = readFileSync(fromRoot('dist', 'SHA256SUMS'), 'utf8');
    expect(sums).toContain(`${info.wasmSha256}  cc1psx.wasm`);
    expect(sums).toContain(`${info.glueSha256}  cc1psx.js`);
    expect(sums).toContain(`${info.preprocessor.wasmSha256}  cccp.wasm`);
    expect(sums).toContain(`${info.preprocessor.glueSha256}  cccp.js`);
  });
});

describe('dist/cccp.wasm', () => {
  it('is a WebAssembly module without threads or shared memory', async () => {
    expect([...cccpWasm.subarray(0, 4)]).toEqual([0x00, 0x61, 0x73, 0x6d]);
    expect(WebAssembly.validate(cccpWasm)).toBe(true);
    const mod = await WebAssembly.compile(cccpWasm);
    const imports = WebAssembly.Module.imports(mod).map((i) => i.name);
    expect(imports.some((n) => /pthread|atomic/i.test(n))).toBe(false);
  });

  it('stays small: under 512 KiB gzip with its glue and the encoder table', () => {
    const gz = (bytes: Buffer): number => gzipSync(bytes, { level: 9 }).length;
    expect(gz(cccpWasm) + gz(cccpGlue) + gz(eucjpTable)).toBeLessThan(512 * 1024);
    // The whole pipeline stays within a 3 MB gzipped budget.
    expect(gz(wasm) + gz(glue) + gz(cccpWasm) + gz(cccpGlue) + gz(eucjpTable)).toBeLessThan(
      3 * 1024 * 1024,
    );
  });

  it('is loaded by an ES module exporting the factory and its BUILD_ID', async () => {
    const mod = (await import(pathToFileURL(fromRoot('dist', 'cccp.js')).href)) as {
      default: unknown;
      BUILD_ID: unknown;
    };
    expect(typeof mod.default).toBe('function');
    expect(mod.BUILD_ID).toBe(info.preprocessor.buildId);
    expect(mod.BUILD_ID).not.toBe(info.buildId);
  });
});
