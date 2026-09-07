// SPDX-License-Identifier: MIT
import type { WorkerHandle } from './controller.js';
import type { Platform } from './create-compiler.js';
import { loadWasmModule } from './module-loader.js';
import type { MainToWorkerMessage } from './protocol.js';

/** The part of the DOM `Worker` the platform uses. */
export interface BrowserWorkerLike {
  postMessage(message: unknown, transfer: ArrayBuffer[]): void;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  terminate(): void;
}

export interface BrowserPlatformDeps {
  /** Constructor used for explicit `workerUrl` overrides. Defaults to the global `Worker`. */
  readonly Worker?: new (url: URL, options?: { type?: 'module' }) => BrowserWorkerLike;
  /** Creates the package's own worker. Defaults to the bundler-visible literal below. */
  readonly spawnDefaultWorker?: () => BrowserWorkerLike;
  /** Defaults to the global `fetch`. */
  readonly fetch?: (url: URL) => Promise<Response>;
}

/** Turn a worker `ErrorEvent` into an Error carrying its message; pass anything else through. */
function describeErrorEvent(event: ErrorEvent): unknown {
  if (typeof event === 'object' && 'message' in event) {
    return new Error(event.message);
  }
  return event;
}

function wrap(worker: BrowserWorkerLike): WorkerHandle {
  return {
    postMessage(message: MainToWorkerMessage, transfer: ArrayBuffer[] = []) {
      worker.postMessage(message, transfer);
    },
    onMessage(handler) {
      worker.onmessage = (event) => {
        handler(event.data as unknown);
      };
    },
    onError(handler) {
      worker.onerror = (event) => {
        handler(describeErrorEvent(event));
      };
    },
    onExit() {
      // Web Workers have no exit event; crashes surface through onerror.
    },
    terminate() {
      worker.terminate();
    },
  };
}

/**
 * The package's own worker, written exactly as bundlers expect so they emit a
 * separate chunk for it. test/unit/bundler-literals.test.ts guards this text.
 */
function spawnPackageWorker(): BrowserWorkerLike {
  return new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
}

/**
 * Browser bindings. Default asset URLs are literal `new URL('./…', import.meta.url)`
 * expressions for the same bundler-detection reason.
 */
export function createBrowserPlatform(deps: BrowserPlatformDeps = {}): Platform {
  const WorkerCtor = deps.Worker ?? Worker;
  const spawnDefault = deps.spawnDefaultWorker ?? spawnPackageWorker;
  const fetchFn = deps.fetch;
  return {
    baseUrl: new URL(import.meta.url),
    defaultWorkerUrl: () => new URL('./worker.js', import.meta.url),
    defaultWasmUrl: () => new URL('./cc1psx.wasm', import.meta.url),
    loadModule: (url) => loadWasmModule(url, fetchFn === undefined ? {} : { fetch: fetchFn }),
    spawnWorker: (url) =>
      wrap(url === undefined ? spawnDefault() : new WorkerCtor(url, { type: 'module' })),
  };
}
