// SPDX-License-Identifier: MIT
import { describe, expect, it, vi } from 'vitest';
import * as node from '../../src/index.node.js';
import { BUILD_ID, fakeWorkerFactory } from '../helpers/fake-worker.js';

const { createNodePlatform } = vi.hoisted(() => ({ createNodePlatform: vi.fn() }));
vi.mock('../../src/platform-node.js', () => ({ createNodePlatform }));

const EMPTY_MODULE = new WebAssembly.Module(
  new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
);

describe('index.node', () => {
  it('exports the public runtime surface', () => {
    expect(node.createCompiler).toBeTypeOf('function');
    expect(node.PsyqWasmError).toBeTypeOf('function');
    expect(node.CompileTimeoutError).toBeTypeOf('function');
    expect(node.WorkerCrashError).toBeTypeOf('function');
    expect(node.InternalError).toBeTypeOf('function');
    expect(node.InvalidOptionsError).toBeTypeOf('function');
    expect(node.CompilerDisposedError).toBeTypeOf('function');
    expect(node.EncodingError).toBeTypeOf('function');
    expect(node.encodeEucJp).toBeTypeOf('function');
    expect(node.DEFAULT_CPP_FLAGS).toContain('-D_PSYQ');
    expect(node.isAbortError).toBeTypeOf('function');
    expect(node.parseDiagnostics).toBeTypeOf('function');
    expect(node.DEFAULT_LIMITS.maxSourceBytes).toBeGreaterThan(0);
  });

  it('createCompiler defaults to the node platform', async () => {
    const { spawn, workers } = fakeWorkerFactory();
    createNodePlatform.mockReturnValue({
      baseUrl: new URL('file:///pkg/dist/index.node.js'),
      defaultWasmUrl: () => new URL('file:///pkg/dist/cc1psx.wasm'),
      defaultPreprocessorWasmUrl: () => new URL('file:///pkg/dist/cccp.wasm'),
      loadModule: () => Promise.resolve(EMPTY_MODULE),
      spawnWorker: spawn,
    });

    // No platform can be injected any more: the entry point must reach for its
    // own host bindings. Anything else means the wrong worker would be spawned.
    const pending = node.createCompiler();
    await vi.waitFor(() => {
      expect(workers[0]?.posted).toHaveLength(1);
    });
    workers[0]?.ready();
    const compiler = await pending;

    expect(createNodePlatform).toHaveBeenCalledTimes(1);
    expect(compiler.info.buildId).toBe(BUILD_ID);
    compiler.dispose();
  });
});
