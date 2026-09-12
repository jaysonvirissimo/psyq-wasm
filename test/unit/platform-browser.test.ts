// SPDX-License-Identifier: MIT
import { describe, expect, it, vi } from 'vitest';
import { createBrowserPlatform, type BrowserWorkerLike } from '../../src/platform-browser.js';

const EMPTY_MODULE_BYTES = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

class FakeDomWorker implements BrowserWorkerLike {
  static instances: FakeDomWorker[] = [];
  onmessage: BrowserWorkerLike['onmessage'] = null;
  onerror: BrowserWorkerLike['onerror'] = null;
  readonly postMessage = vi.fn();
  readonly terminate = vi.fn();
  constructor(
    readonly url: URL,
    readonly options: unknown,
  ) {
    FakeDomWorker.instances.push(this);
  }
}

describe('createBrowserPlatform', () => {
  const platform = createBrowserPlatform({
    Worker: FakeDomWorker,
    spawnDefaultWorker: () =>
      new FakeDomWorker(new URL('../../src/worker.js', import.meta.url), { type: 'module' }),
    fetch: () => Promise.resolve(new Response(EMPTY_MODULE_BYTES)),
  });

  it('resolves defaults relative to its own module URL', () => {
    expect(platform.defaultWorkerUrl().href).toBe(
      new URL('../../src/worker.js', import.meta.url).href,
    );
    expect(platform.defaultWasmUrl().href).toBe(
      new URL('../../src/cc1psx.wasm', import.meta.url).href,
    );
    expect(platform.defaultPreprocessorWasmUrl().href).toBe(
      new URL('../../src/cccp.wasm', import.meta.url).href,
    );
    expect(platform.baseUrl.href).toBe(
      new URL('../../src/platform-browser.ts', import.meta.url).href,
    );
  });

  it('loads the module through the injected fetch', async () => {
    await expect(
      platform.loadModule(new URL('https://example.test/cc1psx.wasm')),
    ).resolves.toBeInstanceOf(WebAssembly.Module);
  });

  it('uses the injected default-worker factory when no URL is given', () => {
    platform.spawnWorker(undefined);
    const worker = FakeDomWorker.instances.at(-1);
    expect(worker?.url.href).toBe(platform.defaultWorkerUrl().href);
    expect(worker?.options).toEqual({ type: 'module' });
  });

  it('spawns the package worker with the bundler-visible literal by default', () => {
    vi.stubGlobal('Worker', FakeDomWorker);
    try {
      const real = createBrowserPlatform();
      real.spawnWorker(undefined);
      const worker = FakeDomWorker.instances.at(-1);
      expect(worker?.url.href).toBe(real.defaultWorkerUrl().href);
      expect(worker?.options).toEqual({ type: 'module' });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('spawns a module worker at an explicit URL and adapts its events', () => {
    const handle = platform.spawnWorker(new URL('https://example.test/custom/worker.js'));
    const worker = FakeDomWorker.instances.at(-1);
    if (!worker) throw new Error('no worker');
    expect(worker.url.href).toBe('https://example.test/custom/worker.js');

    const onMessage = vi.fn();
    const onError = vi.fn();
    const onExit = vi.fn();
    handle.onMessage(onMessage);
    handle.onError(onError);
    handle.onExit(onExit);
    worker.onmessage?.(
      new MessageEvent('message', {
        data: { type: 'ready', buildId: 'x', preprocessorBuildId: 'y' },
      }),
    );
    // Node has no ErrorEvent constructor; a structurally similar object suffices.
    worker.onerror?.({ message: 'script error', filename: 'worker.js' } as ErrorEvent);
    // Some engines deliver a bare value instead of an ErrorEvent.
    worker.onerror?.('opaque' as unknown as ErrorEvent);
    expect(onMessage).toHaveBeenCalledWith({
      type: 'ready',
      buildId: 'x',
      preprocessorBuildId: 'y',
    });
    expect(onError).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ message: 'script error' }),
    );
    expect(onError).toHaveBeenNthCalledWith(2, 'opaque');
    expect(onExit).not.toHaveBeenCalled();

    const module = new WebAssembly.Module(EMPTY_MODULE_BYTES);
    const modules = { cc1: module, cccp: module };
    handle.postMessage({ type: 'init', modules }, []);
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'init', modules }, []);
    handle.terminate();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('falls back to the global Worker and fetch', async () => {
    vi.stubGlobal('Worker', FakeDomWorker);
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(EMPTY_MODULE_BYTES)));
    try {
      const real = createBrowserPlatform();
      real.spawnWorker(new URL('https://example.test/w.js'));
      expect(FakeDomWorker.instances.at(-1)?.url.href).toBe('https://example.test/w.js');
      await expect(
        real.loadModule(new URL('https://example.test/cc1psx.wasm')),
      ).resolves.toBeInstanceOf(WebAssembly.Module);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
