// SPDX-License-Identifier: MIT
import { describe, expect, it, vi } from 'vitest';
import type { Platform } from '../../src/create-compiler.js';
import * as browser from '../../src/index.js';
import * as node from '../../src/index.node.js';
import { BUILD_ID, fakeWorkerFactory } from '../helpers/fake-worker.js';

const EMPTY_MODULE = new WebAssembly.Module(
  new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
);

describe('index (browser entry)', () => {
  it('exports exactly the same runtime names as the Node entry', () => {
    expect(Object.keys(browser).sort()).toEqual(Object.keys(node).sort());
  });

  it('createCompiler wires the platform through createCompilerWith', async () => {
    const { spawn, workers } = fakeWorkerFactory();
    const platform: Platform = {
      baseUrl: new URL('https://example.test/dist/index.js'),
      defaultWorkerUrl: () => new URL('https://example.test/dist/worker.js'),
      defaultWasmUrl: () => new URL('https://example.test/dist/cc1psx.wasm'),
      loadModule: () => Promise.resolve(EMPTY_MODULE),
      spawnWorker: spawn,
    };
    const pending = browser.createCompiler({ limits: { defaultTimeoutMs: 14085 } }, platform);
    await vi.waitFor(() => {
      expect(workers[0]?.posted).toHaveLength(1);
    });
    workers[0]?.ready();
    const compiler = await pending;
    expect(compiler.info.buildId).toBe(BUILD_ID);
    compiler.dispose();
  });
});
