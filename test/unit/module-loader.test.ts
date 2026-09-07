// SPDX-License-Identifier: MIT
import { describe, expect, it, vi } from 'vitest';
import { InternalError } from '../../src/errors.js';
import { loadWasmModule } from '../../src/module-loader.js';

const EMPTY_MODULE_BYTES = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

describe('loadWasmModule', () => {
  it('fetches http(s) URLs and compiles the body', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(new Response(EMPTY_MODULE_BYTES, { status: 200 })));
    const readFile = vi.fn();
    const url = new URL('https://shadow-moses.example/dist/cc1psx.wasm');
    const module = await loadWasmModule(url, { fetch: fetchFn, readFile });
    expect(module).toBeInstanceOf(WebAssembly.Module);
    expect(fetchFn).toHaveBeenCalledWith(url);
    expect(readFile).not.toHaveBeenCalled();
  });

  it('reads file: URLs from disk instead of fetching', async () => {
    const fetchFn = vi.fn();
    const readFile = vi.fn(() => Promise.resolve(EMPTY_MODULE_BYTES));
    const module = await loadWasmModule(new URL('file:///opt/psyq/cc1psx.wasm'), {
      fetch: fetchFn,
      readFile,
    });
    expect(module).toBeInstanceOf(WebAssembly.Module);
    expect(readFile).toHaveBeenCalledWith('/opt/psyq/cc1psx.wasm');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('reports a failed HTTP response as InternalError with the status', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(new Response('nope', { status: 404 })));
    const promise = loadWasmModule(new URL('https://example.test/cc1psx.wasm'), {
      fetch: fetchFn,
      readFile: vi.fn(),
    });
    await expect(promise).rejects.toBeInstanceOf(InternalError);
    await expect(promise).rejects.toThrow(/404/);
  });

  it('wraps network and filesystem failures', async () => {
    const netErr = new TypeError('Failed to fetch');
    const promise = loadWasmModule(new URL('https://example.test/cc1psx.wasm'), {
      fetch: () => Promise.reject(netErr),
      readFile: vi.fn(),
    });
    await expect(promise).rejects.toBeInstanceOf(InternalError);
    await expect(promise).rejects.toMatchObject({ cause: netErr });

    const fsErr = new Error('ENOENT');
    const promise2 = loadWasmModule(new URL('file:///missing.wasm'), {
      fetch: vi.fn(),
      readFile: () => Promise.reject(fsErr),
    });
    await expect(promise2).rejects.toMatchObject({ cause: fsErr });
  });

  it('wraps invalid WebAssembly bytes with the CompileError as cause', async () => {
    const promise = loadWasmModule(new URL('file:///bad.wasm'), {
      fetch: vi.fn(),
      readFile: () => Promise.resolve(new Uint8Array([1, 2, 3, 4])),
    });
    await expect(promise).rejects.toBeInstanceOf(InternalError);
    await expect(promise).rejects.toMatchObject({
      cause: expect.any(WebAssembly.CompileError) as unknown,
    });
  });

  it('defaults to the global fetch', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response(EMPTY_MODULE_BYTES)));
    try {
      const module = await loadWasmModule(new URL('https://example.test/cc1psx.wasm'));
      expect(module).toBeInstanceOf(WebAssembly.Module);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('rejects file: URLs when no file reader is available', async () => {
    const promise = loadWasmModule(new URL('file:///x.wasm'), { fetch: vi.fn() });
    await expect(promise).rejects.toThrow(/file:/);
  });
});
