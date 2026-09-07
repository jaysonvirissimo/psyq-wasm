// SPDX-License-Identifier: MIT
import { readFile } from 'node:fs/promises';
import { Worker } from 'node:worker_threads';
import type { WorkerHandle } from './controller.js';
import type { Platform } from './create-compiler.js';
import { loadWasmModule } from './module-loader.js';
import type { MainToWorkerMessage } from './protocol.js';

/** The part of `worker_threads.Worker` the platform uses. */
export interface NodeWorkerLike {
  postMessage(value: unknown, transferList?: ArrayBuffer[]): void;
  on(event: 'message', listener: (value: unknown) => void): unknown;
  on(event: 'error', listener: (error: unknown) => void): unknown;
  on(event: 'exit', listener: (code: number) => void): unknown;
  terminate(): unknown;
}

export interface NodePlatformDeps {
  readonly Worker?: new (url: URL, options?: { type?: 'module' }) => NodeWorkerLike;
  readonly readFile?: (path: string) => Promise<Uint8Array>;
  /** The entry module URL used to resolve package-relative assets. */
  readonly baseUrl?: URL;
}

function wrap(worker: NodeWorkerLike): WorkerHandle {
  return {
    postMessage(message: MainToWorkerMessage, transfer?: ArrayBuffer[]) {
      worker.postMessage(message, transfer);
    },
    onMessage(handler) {
      worker.on('message', handler);
    },
    onError(handler) {
      worker.on('error', handler);
    },
    onExit(handler) {
      worker.on('exit', handler);
    },
    terminate() {
      void worker.terminate();
    },
  };
}

export function createNodePlatform(deps: NodePlatformDeps = {}): Platform {
  const WorkerCtor = deps.Worker ?? Worker;
  const read = deps.readFile ?? ((path: string) => readFile(path));
  const baseUrl = deps.baseUrl ?? new URL(import.meta.url);
  const defaultWorkerUrl = (): URL => new URL('./worker.node.js', baseUrl);
  return {
    baseUrl,
    defaultWorkerUrl,
    defaultWasmUrl: () => new URL('./cc1psx.wasm', baseUrl),
    loadModule: (url) => loadWasmModule(url, { readFile: read }),
    spawnWorker: (url) => wrap(new WorkerCtor(url ?? defaultWorkerUrl(), { type: 'module' })),
  };
}
