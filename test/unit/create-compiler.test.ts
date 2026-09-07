// SPDX-License-Identifier: MIT
import { describe, expect, it, vi } from 'vitest';
import { createCompilerWith, type Platform } from '../../src/create-compiler.js';
import { InvalidOptionsError } from '../../src/errors.js';
import {
  BUILD_ID,
  PREPROCESSOR_BUILD_ID,
  fakeWorkerFactory,
  type FakeWorker,
} from '../helpers/fake-worker.js';

const EMPTY_MODULE = new WebAssembly.Module(
  new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
);

function fakePlatform(): {
  platform: Platform;
  workers: FakeWorker[];
  loadModule: ReturnType<typeof vi.fn>;
} {
  const { spawn, workers } = fakeWorkerFactory();
  const loadModule = vi.fn(() => Promise.resolve(EMPTY_MODULE));
  const platform: Platform = {
    baseUrl: new URL('https://outer-heaven.example/node_modules/psyq-wasm/dist/index.js'),
    defaultWorkerUrl: () =>
      new URL('https://outer-heaven.example/node_modules/psyq-wasm/dist/worker.js'),
    defaultWasmUrl: () =>
      new URL('https://outer-heaven.example/node_modules/psyq-wasm/dist/cc1psx.wasm'),
    defaultPreprocessorWasmUrl: () =>
      new URL('https://outer-heaven.example/node_modules/psyq-wasm/dist/cccp.wasm'),
    loadModule,
    spawnWorker: (url) => {
      const w = spawn();
      (w as FakeWorker & { url?: URL | undefined }).url = url;
      return w;
    },
  };
  return { platform, workers, loadModule };
}

/** Resolve the worker's ready handshake as soon as it is spawned. */
function autoReady(workers: FakeWorker[]): void {
  const timer = setInterval(() => {
    const w = workers.at(-1);
    if (w && w.posted.length > 0 && !w.terminated && w.posted.length === 1) {
      w.ready();
      clearInterval(timer);
    }
  }, 0);
}

describe('createCompilerWith', () => {
  it('uses package-relative defaults and exposes frozen compiler info', async () => {
    const { platform, workers, loadModule } = fakePlatform();
    autoReady(workers);
    const compiler = await createCompilerWith(platform, undefined);
    expect(loadModule).toHaveBeenCalledWith(platform.defaultWasmUrl());
    expect(loadModule).toHaveBeenCalledWith(platform.defaultPreprocessorWasmUrl());
    expect(loadModule).toHaveBeenCalledTimes(2);
    // No override: the platform is asked for its own default worker.
    expect((workers[0] as FakeWorker & { url?: URL }).url).toBeUndefined();
    expect(compiler.info).toEqual({
      psyqVersion: '4.4',
      gccVersion: '2.8.1',
      buildId: BUILD_ID,
      preprocessorBuildId: PREPROCESSOR_BUILD_ID,
    });
    expect(Object.isFrozen(compiler.info)).toBe(true);
    expect(typeof compiler.compileSource).toBe('function');
    compiler.dispose();
  });

  it('resolves string overrides against the platform base URL and accepts URL objects', async () => {
    const { platform, workers, loadModule } = fakePlatform();
    autoReady(workers);
    const compiler = await createCompilerWith(platform, {
      workerUrl: './custom/worker.js',
      wasmUrl: new URL('https://cdn.example/fox/cc1psx.wasm'),
      preprocessorWasmUrl: '../hound/cccp.wasm',
    });
    expect((workers[0] as FakeWorker & { url?: URL }).url?.href).toBe(
      'https://outer-heaven.example/node_modules/psyq-wasm/dist/custom/worker.js',
    );
    expect(loadModule).toHaveBeenCalledWith(new URL('https://cdn.example/fox/cc1psx.wasm'));
    expect(loadModule).toHaveBeenCalledWith(
      new URL('https://outer-heaven.example/node_modules/psyq-wasm/hound/cccp.wasm'),
    );
    compiler.dispose();
  });

  it('applies limit overrides', async () => {
    const { platform, workers } = fakePlatform();
    autoReady(workers);
    const compiler = await createCompilerWith(platform, { limits: { maxSourceBytes: 4 } });
    await expect(
      compiler.compilePreprocessed(new Uint8Array(5), { gpSize: 8 }),
    ).rejects.toBeInstanceOf(InvalidOptionsError);
    compiler.dispose();
  });

  it('rejects invalid limits before loading anything', async () => {
    const { platform, loadModule } = fakePlatform();
    await expect(
      createCompilerWith(platform, { limits: { maxSourceBytes: 0 } }),
    ).rejects.toBeInstanceOf(InvalidOptionsError);
    expect(loadModule).not.toHaveBeenCalled();
  });

  it('delegates compileSource to the controller', async () => {
    const { platform, workers } = fakePlatform();
    autoReady(workers);
    const compiler = await createCompilerWith(platform, {});
    const pending = compiler.compileSource('int otacon;', { gpSize: 8, headers: { 'a.h': '' } });
    await vi.waitFor(() => {
      expect(workers[0]?.sources()).toHaveLength(1);
    });
    workers[0]?.result(1, { preprocessed: new Uint8Array([0x69]) });
    await expect(pending).resolves.toMatchObject({ success: true, compiler: compiler.info });
    compiler.dispose();
  });

  it('delegates compilePreprocessed and dispose to the controller', async () => {
    const { platform, workers } = fakePlatform();
    autoReady(workers);
    const compiler = await createCompilerWith(platform, {});
    const pending = compiler.compilePreprocessed(new Uint8Array([1]), { gpSize: 0 });
    await vi.waitFor(() => {
      expect(workers[0]?.compiles()).toHaveLength(1);
    });
    workers[0]?.result(1);
    await expect(pending).resolves.toMatchObject({ success: true, compiler: compiler.info });
    compiler.dispose();
    expect(workers[0]?.terminated).toBe(true);
  });
});
