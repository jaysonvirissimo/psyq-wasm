// SPDX-License-Identifier: MIT
import { describe, expect, it, vi } from 'vitest';
import * as browser from '../../src/index.js';
import * as node from '../../src/index.node.js';
import { BUILD_ID, fakeWorkerFactory } from '../helpers/fake-worker.js';

const { createBrowserPlatform } = vi.hoisted(() => ({ createBrowserPlatform: vi.fn() }));
vi.mock('../../src/platform-browser.js', () => ({ createBrowserPlatform }));

const EMPTY_MODULE = new WebAssembly.Module(
  new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
);

describe('index (browser entry)', () => {
  it('exports exactly the same runtime names as the Node entry', () => {
    expect(Object.keys(browser).sort()).toEqual(Object.keys(node).sort());
  });

  it('createCompiler defaults to the browser platform', async () => {
    const { spawn, workers } = fakeWorkerFactory();
    createBrowserPlatform.mockReturnValue({
      baseUrl: new URL('https://example.test/dist/index.js'),
      defaultWasmUrl: () => new URL('https://example.test/dist/cc1psx.wasm'),
      defaultPreprocessorWasmUrl: () => new URL('https://example.test/dist/cccp.wasm'),
      loadModule: () => Promise.resolve(EMPTY_MODULE),
      spawnWorker: spawn,
    });

    // No platform can be injected any more: the entry point must reach for its
    // own host bindings. Anything else means the wrong worker would be spawned.
    const pending = browser.createCompiler();
    await vi.waitFor(() => {
      expect(workers[0]?.posted).toHaveLength(1);
    });
    workers[0]?.ready();
    const compiler = await pending;

    expect(createBrowserPlatform).toHaveBeenCalledTimes(1);
    expect(compiler.info.buildId).toBe(BUILD_ID);
    compiler.dispose();
  });
});
