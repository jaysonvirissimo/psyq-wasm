// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { createNodePlatform } from '../../src/platform-node.js';

// A tiny worker that echoes the parent's messages back.
const ECHO_WORKER = new URL(
  `data:text/javascript,${encodeURIComponent(
    "import { parentPort } from 'node:worker_threads'; parentPort.on('message', (m) => parentPort.postMessage(m));",
  )}`,
);

describe('createNodePlatform with the real worker_threads', () => {
  it('spawns, exchanges messages with, and terminates a module worker', async () => {
    const platform = createNodePlatform();
    const handle = platform.spawnWorker(ECHO_WORKER);
    const echoed = new Promise<unknown>((resolve) => {
      handle.onMessage(resolve);
    });
    const exited = new Promise<number>((resolve) => {
      handle.onExit(resolve);
    });
    handle.onError(() => undefined);
    // The echo worker ignores the message shape; any structured-cloneable value works.
    const module = await WebAssembly.compile(new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]));
    handle.postMessage({ type: 'init', modules: { cc1: module, cccp: module } });
    await expect(echoed).resolves.toMatchObject({ type: 'init' });
    handle.terminate();
    await expect(exited).resolves.toBeTypeOf('number');
  });

  it('reads the wasm bytes from disk for file: URLs', async () => {
    const platform = createNodePlatform();
    const fixture = new URL('../fixtures/src/t01_arith.i', import.meta.url);
    // Not a wasm module, so compilation must fail with InternalError, proving the read path ran.
    await expect(platform.loadModule(fixture)).rejects.toThrow(/failed to compile/);
  });
});
