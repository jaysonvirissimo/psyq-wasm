// SPDX-License-Identifier: MIT
/**
 * Main-thread controller: owns the compiled `WebAssembly.Module`s, drives one
 * worker at a time, queues requests, and implements cancellation, timeouts,
 * and terminate-and-respawn recovery.
 */
import { buildArgv, buildCppArgv } from './argv.js';
import {
  CompileTimeoutError,
  CompilerDisposedError,
  EncodingError,
  InternalError,
  WorkerCrashError,
  createAbortError,
} from './errors.js';
import {
  RESERVED_PREPROCESSED_NAME,
  normalizeSourceInput,
  validateCompileOptions,
  validateSource,
  validateSourceOptions,
} from './options.js';
import {
  createRequestIdGenerator,
  isWorkerToMainMessage,
  type CompileMessage,
  type MainToWorkerMessage,
  type ProgramModules,
  type RejectMessage,
  type ResultMessage,
  type SourceMessage,
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
  readonly modules: ProgramModules;
  readonly spawnWorker: WorkerFactory;
  readonly limits: CompilerLimits;
}

interface Pending {
  readonly id: number;
  /** The fully built request; its buffers are owned by the controller and transferred on post. */
  readonly message: CompileMessage | SourceMessage;
  readonly transfer: ArrayBuffer[];
  readonly timeoutMs: number;
  readonly signal: AbortSignal | undefined;
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
  readonly #modules: ProgramModules;
  readonly #spawnWorker: WorkerFactory;
  readonly #limits: CompilerLimits;
  readonly #nextId = createRequestIdGenerator();
  readonly #queue: Pending[] = [];
  #current: Pending | undefined;
  #worker: ActiveWorker | undefined;
  #info: CompilerInfo | undefined;
  #disposed = false;

  constructor(options: ControllerOptions) {
    this.#modules = options.modules;
    this.#spawnWorker = options.spawnWorker;
    this.#limits = options.limits;
  }

  /** Spawn the first worker and wait for its handshake. */
  async start(): Promise<CompilerInfo> {
    await this.#ensureWorker();
    return this.info;
  }

  get info(): CompilerInfo {
    if (this.#info === undefined) {
      throw new InternalError('the compiler has not been started');
    }
    return this.#info;
  }

  async compile(source: Uint8Array, options: unknown): Promise<CompileResult> {
    if (this.#disposed) throw new CompilerDisposedError();
    validateSource(source, this.#limits);
    const normalized = validateCompileOptions(options, this.#limits);
    const bytes = new Uint8Array(source);
    return this.#enqueue(
      (id) => ({
        type: 'compile',
        id,
        filename: normalized.filename,
        argv: buildArgv(normalized),
        source: bytes,
      }),
      [bytes.buffer],
      normalized,
    );
  }

  async compileSource(source: unknown, options: unknown): Promise<CompileResult> {
    if (this.#disposed) throw new CompilerDisposedError();
    const bytes = normalizeSourceInput(source);
    validateSource(bytes, this.#limits);
    const normalized = validateSourceOptions(options, this.#limits);
    return this.#enqueue(
      (id) => ({
        type: 'source',
        id,
        filename: normalized.filename,
        cppArgv: buildCppArgv(normalized),
        headers: normalized.headers,
        encoding: normalized.encoding,
        argv: buildArgv({ ...normalized, filename: RESERVED_PREPROCESSED_NAME }),
        source: bytes,
      }),
      [bytes.buffer as ArrayBuffer, ...normalized.headers.map((h) => h.data.buffer as ArrayBuffer)],
      normalized,
    );
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

  // --- request flow -------------------------------------------------------

  #enqueue(
    build: (id: number) => CompileMessage | SourceMessage,
    transfer: ArrayBuffer[],
    options: { readonly timeoutMs: number; readonly signal: AbortSignal | undefined },
  ): Promise<CompileResult> {
    if (options.signal?.aborted === true) {
      // Callers are async, so this surfaces as a rejection.
      throw createAbortError(options.signal);
    }
    return new Promise<CompileResult>((resolve, reject) => {
      const id = this.#nextId();
      const pending: Pending = {
        id,
        message: build(id),
        transfer,
        timeoutMs: options.timeoutMs,
        signal: options.signal,
        resolve,
        reject,
      };
      if (options.signal !== undefined) {
        const signal = options.signal;
        pending.onAbort = () => {
          this.#abort(pending, signal);
        };
        signal.addEventListener('abort', pending.onAbort, { once: true });
      }
      this.#queue.push(pending);
      void this.#pump();
    });
  }

  // --- worker lifecycle ---------------------------------------------------

  #ensureWorker(): Promise<ActiveWorker> {
    if (this.#disposed) return Promise.reject(new CompilerDisposedError());
    if (this.#worker !== undefined) return this.#worker.ready;

    let handle: WorkerHandle;
    try {
      handle = this.#spawnWorker();
    } catch (error) {
      return Promise.reject(
        new WorkerCrashError(`could not create worker: ${describeError(error)}`, { cause: error }),
      );
    }
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

    this.#worker = worker;
    try {
      handle.onMessage((data) => {
        if (this.#worker !== worker) return;
        if (worker.isReady) {
          this.#onMessage(data);
          return;
        }
        if (isWorkerToMainMessage(data) && data.type === 'ready') {
          clearTimeout(timer);
          worker.failInit = undefined;
          worker.isReady = true;
          this.#info = Object.freeze({
            psyqVersion: '4.4',
            gccVersion: '2.8.1',
            buildId: data.buildId,
            preprocessorBuildId: data.preprocessorBuildId,
          });
          resolveReady(worker);
          return;
        }
        fail(new WorkerCrashError(`worker sent ${JSON.stringify(data)} instead of ready`));
      });
      handle.onError((error) => {
        if (this.#worker !== worker) return;
        const crash = new WorkerCrashError(`worker error: ${describeError(error)}`, {
          cause: error,
        });
        if (worker.isReady) this.#failCurrent(crash);
        else fail(crash);
      });
      handle.onExit((code) => {
        if (this.#worker !== worker) return;
        const crash = new WorkerCrashError(`worker exited with code ${String(code)}`);
        if (worker.isReady) this.#failCurrent(crash);
        else fail(crash);
      });

      handle.postMessage({ type: 'init', modules: this.#modules });
    } catch (error) {
      fail(
        new WorkerCrashError(`could not initialize worker: ${describeError(error)}`, {
          cause: error,
        }),
      );
    }
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
    // Even an already-resolved ready promise yields. Cancellation, disposal,
    // or a crash can replace this request/worker before the continuation runs.
    if (!this.#isActive(next, worker)) return;
    next.timer = setTimeout(() => {
      this.#timeout(next);
    }, next.timeoutMs);
    try {
      worker.handle.postMessage(next.message, next.transfer);
    } catch (error) {
      this.#failCurrent(
        new WorkerCrashError(`could not post ${next.message.type}: ${describeError(error)}`, {
          cause: error,
        }),
      );
    }
  }

  #onMessage(data: unknown): void {
    if (!isWorkerToMainMessage(data)) {
      this.#failCurrent(new InternalError(`unexpected worker message: ${JSON.stringify(data)}`));
      return;
    }
    switch (data.type) {
      case 'ready':
        // A duplicate handshake is harmless.
        return;
      case 'result':
        this.#onResult(data);
        return;
      case 'reject':
        this.#onReject(data);
        return;
      case 'crash':
        this.#failCurrent(new WorkerCrashError(data.message));
        return;
    }
  }

  #isActive(pending: Pending, worker: ActiveWorker): boolean {
    return !this.#disposed && this.#current === pending && this.#worker === worker;
  }

  /** Take the in-flight request for a reply carrying its id; anything else is a protocol violation. */
  #takeCurrent(id: number): Pending | undefined {
    const current = this.#current;
    if (current?.id !== id) {
      this.#failCurrent(new InternalError(`reply for unknown request ${String(id)}`));
      return undefined;
    }
    this.#current = undefined;
    return current;
  }

  #onResult(message: ResultMessage): void {
    const current = this.#takeCurrent(message.id);
    if (current === undefined) return;
    const info = this.info;
    this.#settle(current, () => {
      current.resolve(buildCompileResult(message, info));
    });
    void this.#pump();
  }

  /** The worker declined the request but is still healthy: no respawn. */
  #onReject(message: RejectMessage): void {
    const current = this.#takeCurrent(message.id);
    if (current === undefined) return;
    this.#settle(current, () => {
      current.reject(
        new EncodingError(message.message, {
          character: message.character,
          index: message.index,
        }),
      );
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

  /** A callback already queued by the host must not affect a newer request. */
  #timeout(pending: Pending): void {
    if (this.#current !== pending) return;
    this.#current = undefined;
    this.#settle(pending, () => {
      pending.reject(new CompileTimeoutError(pending.timeoutMs));
    });
    this.#replaceWorker();
  }

  /** Clear timers and listeners, then run the settle callback. */
  #settle(pending: Pending, done: () => void): void {
    if (pending.timer !== undefined) clearTimeout(pending.timer);
    if (pending.onAbort !== undefined) {
      pending.signal?.removeEventListener('abort', pending.onAbort);
    }
    done();
  }
}
