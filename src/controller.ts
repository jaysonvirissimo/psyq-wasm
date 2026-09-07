// SPDX-License-Identifier: MIT
/**
 * Main-thread controller: owns the compiled `WebAssembly.Module`, drives one
 * worker at a time, queues requests, and implements cancellation, timeouts,
 * and terminate-and-respawn recovery.
 */
import { buildArgv } from './argv.js';
import {
  CompileTimeoutError,
  CompilerDisposedError,
  InternalError,
  WorkerCrashError,
  createAbortError,
} from './errors.js';
import {
  validateCompileOptions,
  validateSource,
  type NormalizedCompileOptions,
} from './options.js';
import {
  createRequestIdGenerator,
  isWorkerToMainMessage,
  type MainToWorkerMessage,
  type ResultMessage,
} from './protocol.js';
import type { CompileResult, CompilerInfo, CompilerLimits } from './public-types.js';
import { buildCompileResult } from './result.js';

/** Platform-neutral view of a worker. */
export interface WorkerHandle {
  postMessage(message: MainToWorkerMessage, transfer?: ArrayBuffer[]): void;
  onMessage(handler: (data: unknown) => void): void;
  onError(handler: (error: unknown) => void): void;
  onExit(handler: (code: number) => void): void;
  terminate(): void;
}

export type WorkerFactory = () => WorkerHandle;

export interface ControllerOptions {
  readonly module: WebAssembly.Module;
  readonly spawnWorker: WorkerFactory;
  readonly limits: CompilerLimits;
}

interface Pending {
  readonly id: number;
  readonly source: Uint8Array;
  readonly options: NormalizedCompileOptions;
  readonly resolve: (result: CompileResult) => void;
  readonly reject: (reason: unknown) => void;
  onAbort?: () => void;
  timer?: ReturnType<typeof setTimeout>;
}

interface ActiveWorker {
  readonly handle: WorkerHandle;
  /** Resolves (with the worker itself) once it has acknowledged `init`. */
  readonly ready: Promise<ActiveWorker>;
  isReady: boolean;
  /** Rejects `ready`; present only while the handshake is outstanding. */
  failInit: ((error: unknown) => void) | undefined;
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class CompilerController {
  readonly #module: WebAssembly.Module;
  readonly #spawnWorker: WorkerFactory;
  readonly #limits: CompilerLimits;
  readonly #nextId = createRequestIdGenerator();
  readonly #queue: Pending[] = [];
  #current: Pending | undefined;
  #worker: ActiveWorker | undefined;
  #info: CompilerInfo | undefined;
  #disposed = false;

  constructor(options: ControllerOptions) {
    this.#module = options.module;
    this.#spawnWorker = options.spawnWorker;
    this.#limits = options.limits;
  }

  /** Spawn the first worker and wait for its handshake. */
  async start(): Promise<string> {
    await this.#ensureWorker();
    return this.buildId;
  }

  get buildId(): string {
    if (this.#info === undefined) {
      throw new InternalError('the compiler has not been started');
    }
    return this.#info.buildId;
  }

  async compile(source: Uint8Array, options: unknown): Promise<CompileResult> {
    if (this.#disposed) throw new CompilerDisposedError();
    validateSource(source, this.#limits);
    const normalized = validateCompileOptions(options, this.#limits);
    if (normalized.signal?.aborted === true) {
      throw createAbortError(normalized.signal);
    }
    return new Promise<CompileResult>((resolve, reject) => {
      const pending: Pending = {
        id: this.#nextId(),
        source: source.slice(),
        options: normalized,
        resolve,
        reject,
      };
      if (normalized.signal !== undefined) {
        const signal = normalized.signal;
        pending.onAbort = () => {
          this.#abort(pending, signal);
        };
        signal.addEventListener('abort', pending.onAbort, { once: true });
      }
      this.#queue.push(pending);
      void this.#pump();
    });
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    const error = new CompilerDisposedError();
    if (this.#current !== undefined) {
      this.#settle(this.#current, () => this.#current?.reject(error));
      this.#current = undefined;
    }
    for (const pending of this.#queue.splice(0)) {
      this.#settle(pending, () => {
        pending.reject(error);
      });
    }
    this.#dropWorker();
  }

  // --- worker lifecycle ---------------------------------------------------

  #ensureWorker(): Promise<ActiveWorker> {
    if (this.#disposed) return Promise.reject(new CompilerDisposedError());
    if (this.#worker !== undefined) return this.#worker.ready;

    const handle = this.#spawnWorker();
    let resolveReady!: (worker: ActiveWorker) => void;
    let rejectReady!: (error: unknown) => void;
    const ready = new Promise<ActiveWorker>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    // Keep the promise from being reported as unhandled when nobody awaits it.
    ready.catch(() => undefined);
    const worker: ActiveWorker = { handle, ready, isReady: false, failInit: undefined };

    const timer = setTimeout(() => {
      fail(
        new InternalError(
          `worker did not report ready within ${String(this.#limits.initTimeoutMs)} ms`,
        ),
      );
    }, this.#limits.initTimeoutMs);
    const fail = (error: unknown): void => {
      clearTimeout(timer);
      worker.failInit = undefined;
      if (this.#worker === worker) this.#dropWorker();
      rejectReady(error);
    };
    worker.failInit = fail;

    let info: CompilerInfo = { psyqVersion: '4.4', gccVersion: '2.8.1', buildId: '' };
    handle.onMessage((data) => {
      if (this.#worker !== worker) return;
      if (worker.isReady) {
        this.#onMessage(data, info);
        return;
      }
      if (isWorkerToMainMessage(data) && data.type === 'ready') {
        clearTimeout(timer);
        worker.failInit = undefined;
        worker.isReady = true;
        info = Object.freeze({ ...info, buildId: data.buildId });
        this.#info = info;
        resolveReady(worker);
        return;
      }
      fail(new WorkerCrashError(`worker sent ${JSON.stringify(data)} instead of ready`));
    });
    handle.onError((error) => {
      if (this.#worker !== worker) return;
      const crash = new WorkerCrashError(`worker error: ${describeError(error)}`, { cause: error });
      if (worker.isReady) this.#failCurrent(crash);
      else fail(crash);
    });
    handle.onExit((code) => {
      if (this.#worker !== worker) return;
      const crash = new WorkerCrashError(`worker exited with code ${String(code)}`);
      if (worker.isReady) this.#failCurrent(crash);
      else fail(crash);
    });

    this.#worker = worker;
    handle.postMessage({ type: 'init', module: this.#module });
    return ready;
  }

  #dropWorker(): void {
    const worker = this.#worker;
    this.#worker = undefined;
    // A worker dropped mid-handshake can only be a disposal; unblock start().
    worker?.failInit?.(new CompilerDisposedError());
    worker?.handle.terminate();
  }

  /** Terminate the current worker; a replacement is spawned lazily by the pump. */
  #replaceWorker(): void {
    this.#dropWorker();
    void this.#pump();
  }

  // --- request flow -------------------------------------------------------

  async #pump(): Promise<void> {
    if (this.#disposed || this.#current !== undefined) return;
    const next = this.#queue.shift();
    if (next === undefined) {
      // Idle: make sure a healthy worker is waiting for the next request.
      if (this.#worker === undefined) await this.#ensureWorker().catch(() => undefined);
      return;
    }
    this.#current = next;
    let worker: ActiveWorker;
    try {
      worker = await this.#ensureWorker();
    } catch (error) {
      if (this.#current === next) {
        this.#settle(next, () => {
          next.reject(error);
        });
        this.#current = undefined;
        // The same init failure applies to everything else that was waiting.
        for (const pending of this.#queue.splice(0)) {
          this.#settle(pending, () => {
            pending.reject(error);
          });
        }
      }
      return;
    }
    // An abort or dispose while waiting drops the worker, which rejects the
    // await above, so `next` is still the in-flight request here.
    next.timer = setTimeout(() => {
      this.#timeout(next);
    }, next.options.timeoutMs);
    worker.handle.postMessage(
      {
        type: 'compile',
        id: next.id,
        filename: next.options.filename,
        argv: buildArgv(next.options),
        source: next.source,
      },
      [next.source.buffer as ArrayBuffer],
    );
  }

  #onMessage(data: unknown, info: CompilerInfo): void {
    if (!isWorkerToMainMessage(data)) {
      this.#failCurrent(new InternalError(`unexpected worker message: ${JSON.stringify(data)}`));
      return;
    }
    switch (data.type) {
      case 'ready':
        // A duplicate handshake is harmless.
        return;
      case 'result':
        this.#onResult(data, info);
        return;
      case 'crash':
        this.#failCurrent(new WorkerCrashError(data.message));
        return;
    }
  }

  #onResult(message: ResultMessage, info: CompilerInfo): void {
    const current = this.#current;
    if (current?.id !== message.id) {
      this.#failCurrent(new InternalError(`result for unknown request ${String(message.id)}`));
      return;
    }
    this.#current = undefined;
    this.#settle(current, () => {
      current.resolve(buildCompileResult(message, info));
    });
    void this.#pump();
  }

  /** Reject the in-flight request (if any) and replace the worker. */
  #failCurrent(error: unknown): void {
    const current = this.#current;
    this.#current = undefined;
    if (current !== undefined)
      this.#settle(current, () => {
        current.reject(error);
      });
    this.#replaceWorker();
  }

  #abort(pending: Pending, signal: AbortSignal): void {
    const error = createAbortError(signal);
    if (this.#current === pending) {
      this.#current = undefined;
      this.#settle(pending, () => {
        pending.reject(error);
      });
      this.#replaceWorker();
      return;
    }
    // Not in flight, so it is still queued: the abort listener is removed on settle.
    this.#queue.splice(this.#queue.indexOf(pending), 1);
    this.#settle(pending, () => {
      pending.reject(error);
    });
  }

  /** Timer callback; the timer is cleared on settle, so `pending` is still in flight. */
  #timeout(pending: Pending): void {
    this.#current = undefined;
    this.#settle(pending, () => {
      pending.reject(new CompileTimeoutError(pending.options.timeoutMs));
    });
    this.#replaceWorker();
  }

  /** Clear timers and listeners, then run the settle callback. */
  #settle(pending: Pending, done: () => void): void {
    if (pending.timer !== undefined) clearTimeout(pending.timer);
    if (pending.onAbort !== undefined) {
      pending.options.signal?.removeEventListener('abort', pending.onAbort);
    }
    done();
  }
}
