// SPDX-License-Identifier: MIT
import type { ErrorCode } from './public-types.js';

/** Base class of every error thrown by psyq-wasm (compiler-reported failures are results, not errors). */
export class PsyqWasmError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
    this.name = 'PsyqWasmError';
  }
}

/** The compile exceeded its time budget; the worker was terminated and replaced. */
export class CompileTimeoutError extends PsyqWasmError {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super('timeout', `Compilation exceeded the timeout of ${String(timeoutMs)} ms.`);
    this.name = 'CompileTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/** The worker died or trapped while compiling; the worker was replaced. */
export class WorkerCrashError extends PsyqWasmError {
  constructor(message: string, options?: ErrorOptions) {
    super('worker-crash', message, options);
    this.name = 'WorkerCrashError';
  }
}

/** A failure inside the library itself, such as a protocol violation or an asset that failed to load. */
export class InternalError extends PsyqWasmError {
  constructor(message: string, options?: ErrorOptions) {
    super('internal', message, options);
    this.name = 'InternalError';
  }
}

/** The caller supplied invalid options or an oversized source. */
export class InvalidOptionsError extends PsyqWasmError {
  constructor(message: string) {
    super('invalid-options', message);
    this.name = 'InvalidOptionsError';
  }
}

/** The compiler was disposed before or while the request ran. */
export class CompilerDisposedError extends PsyqWasmError {
  constructor() {
    super('disposed', 'The compiler has been disposed.');
    this.name = 'CompilerDisposedError';
  }
}

/**
 * Build the rejection value for an aborted request: the signal's own reason
 * when present, otherwise an `AbortError` DOMException.
 */
export function createAbortError(signal: AbortSignal | undefined): unknown {
  if (signal?.aborted === true && signal.reason !== undefined) {
    return signal.reason;
  }
  return new DOMException('The compilation was aborted.', 'AbortError');
}

/** True for `DOMException`/`Error` values named `AbortError`. */
export function isAbortError(value: unknown): boolean {
  return (value instanceof DOMException || value instanceof Error) && value.name === 'AbortError';
}
