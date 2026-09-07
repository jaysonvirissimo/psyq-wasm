// SPDX-License-Identifier: MIT
import { describe, expect, it, vi } from 'vitest';
import type { Platform } from '../../src/create-compiler.js';
import * as node from '../../src/index.node.js';
import { BUILD_ID, fakeWorkerFactory } from '../helpers/fake-worker.js';

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
    expect(node.isAbortError).toBeTypeOf('function');
    expect(node.parseDiagnostics).toBeTypeOf('function');
    expect(node.DEFAULT_LIMITS.maxSourceBytes).toBeGreaterThan(0);
  });

  it('createCompiler wires the platform through createCompilerWith', async () => {
    const { spawn, workers } = fakeWorkerFactory();
    const platform: Platform = {
      baseUrl: new URL('file:///pkg/dist/index.node.js'),
      defaultWorkerUrl: () => new URL('file:///pkg/dist/worker.node.js'),
      defaultWasmUrl: () => new URL('file:///pkg/dist/cc1psx.wasm'),
      loadModule: () => Promise.resolve(EMPTY_MODULE),
      spawnWorker: spawn,
    };
    const pending = node.createCompiler(undefined, platform);
    await vi.waitFor(() => {
      expect(workers[0]?.posted).toHaveLength(1);
    });
    workers[0]?.ready();
    const compiler = await pending;
    expect(compiler.info.buildId).toBe(BUILD_ID);
    compiler.dispose();
  });
});
