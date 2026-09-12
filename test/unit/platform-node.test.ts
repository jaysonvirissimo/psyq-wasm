// SPDX-License-Identifier: MIT
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { createNodePlatform, type NodeWorkerLike } from '../../src/platform-node.js';

class FakeNodeWorker extends EventEmitter implements NodeWorkerLike {
  static instances: FakeNodeWorker[] = [];
  readonly url: URL;
  readonly options: unknown;
  readonly postMessage = vi.fn();
  readonly terminate = vi.fn(() => Promise.resolve(0));

  constructor(url: URL, options: unknown) {
    super();
    this.url = url;
    this.options = options;
    FakeNodeWorker.instances.push(this);
  }
}

const EMPTY_MODULE_BYTES = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

describe('createNodePlatform', () => {
  const platform = createNodePlatform({
    Worker: FakeNodeWorker as unknown as new (url: URL, options?: unknown) => NodeWorkerLike,
    readFile: () => Promise.resolve(EMPTY_MODULE_BYTES),
    baseUrl: new URL('file:///opt/app/node_modules/psyq-wasm/dist/index.node.js'),
  });

  it('resolves package-relative default asset URLs', () => {
    expect(platform.defaultWorkerUrl().href).toBe(
      'file:///opt/app/node_modules/psyq-wasm/dist/worker.node.js',
    );
    expect(platform.defaultWasmUrl().href).toBe(
      'file:///opt/app/node_modules/psyq-wasm/dist/cc1psx.wasm',
    );
    expect(platform.defaultPreprocessorWasmUrl().href).toBe(
      'file:///opt/app/node_modules/psyq-wasm/dist/cccp.wasm',
    );
    expect(platform.baseUrl.href).toBe('file:///opt/app/node_modules/psyq-wasm/dist/index.node.js');
  });

  it('loads the module through the injected file reader', async () => {
    await expect(platform.loadModule(platform.defaultWasmUrl())).resolves.toBeInstanceOf(
      WebAssembly.Module,
    );
  });

  it('spawns the default worker when no URL is given', () => {
    platform.spawnWorker(undefined);
    expect(FakeNodeWorker.instances.at(-1)?.url.href).toBe(platform.defaultWorkerUrl().href);
    expect(FakeNodeWorker.instances.at(-1)?.options).toEqual({ type: 'module' });
  });

  it('spawns a worker_threads worker and adapts its events', () => {
    const handle = platform.spawnWorker(new URL('file:///opt/app/worker.node.js'));
    const worker = FakeNodeWorker.instances.at(-1);
    if (!worker) throw new Error('no worker');
    expect(worker.url.href).toBe('file:///opt/app/worker.node.js');

    const onMessage = vi.fn();
    const onError = vi.fn();
    const onExit = vi.fn();
    handle.onMessage(onMessage);
    handle.onError(onError);
    handle.onExit(onExit);

    worker.emit('message', { type: 'ready', buildId: 'x', preprocessorBuildId: 'y' });
    worker.emit('error', new Error('boom'));
    worker.emit('exit', 3);
    expect(onMessage).toHaveBeenCalledWith({
      type: 'ready',
      buildId: 'x',
      preprocessorBuildId: 'y',
    });
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onExit).toHaveBeenCalledWith(3);

    const transfer = [new ArrayBuffer(2)];
    const module = new WebAssembly.Module(EMPTY_MODULE_BYTES);
    const modules = { cc1: module, cccp: module };
    handle.postMessage({ type: 'init', modules }, transfer);
    expect(worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'init' }),
      transfer,
    );
    handle.postMessage({ type: 'init', modules });
    expect(worker.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'init' }),
      undefined,
    );

    handle.terminate();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('uses the real worker_threads and fs by default', () => {
    const real = createNodePlatform();
    expect(real.defaultWorkerUrl().pathname.endsWith('/worker.node.js')).toBe(true);
    expect(real.defaultWasmUrl().pathname.endsWith('/cc1psx.wasm')).toBe(true);
    expect(real.defaultPreprocessorWasmUrl().pathname.endsWith('/cccp.wasm')).toBe(true);
    expect(real.baseUrl.protocol).toBe('file:');
  });
});
