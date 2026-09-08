// SPDX-License-Identifier: MIT
import type { ErrorCode } from './public-types.js';

/**
 * Base class of every error thrown by psyq-wasm (compiler-reported failures
 * are results, not errors).
 *
 * Each subclass redeclares `code` as its own literal, so `code` is a
 * discriminant: `if (err.code === "encoding")` narrows a union of these
 * classes to `EncodingError`. The redeclarations are `declare`-only; the base
 * constructor is what assigns the value. A generic base would read better here
 * but would make `code` `any` after `x instanceof PsyqWasmError`, since
 * instanceof narrowing fills a generic class's type arguments with `any`.
 */
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
  declare readonly code: 'timeout';

  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super('timeout', `Compilation exceeded the timeout of ${String(timeoutMs)} ms.`);
    this.name = 'CompileTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/** The worker died or trapped while compiling; the worker was replaced. */
export class WorkerCrashError extends PsyqWasmError {
  declare readonly code: 'worker-crash';

  constructor(message: string, options?: ErrorOptions) {
    super('worker-crash', message, options);
    this.name = 'WorkerCrashError';
  }
}

/** A failure inside the library itself, such as a protocol violation or an asset that failed to load. */
export class InternalError extends PsyqWasmError {
  declare readonly code: 'internal';

  constructor(message: string, options?: ErrorOptions) {
    super('internal', message, options);
    this.name = 'InternalError';
  }
}

/** The caller supplied invalid options or an oversized source. */
export class InvalidOptionsError extends PsyqWasmError {
  declare readonly code: 'invalid-options';

  constructor(message: string) {
    super('invalid-options', message);
    this.name = 'InvalidOptionsError';
  }
}

/** A character in the preprocessed source has no representation in the requested encoding. */
export class EncodingError extends PsyqWasmError {
  declare readonly code: 'encoding';

  /** The offending character (one code point). */
  readonly character: string;
  /** Code-unit index of that character in the text being encoded. */
  readonly index: number;

  constructor(message: string, details: { character: string; index: number }) {
    super('encoding', message);
    this.name = 'EncodingError';
    this.character = details.character;
    this.index = details.index;
  }
}

/** The compiler was disposed before or while the request ran. */
export class CompilerDisposedError extends PsyqWasmError {
  declare readonly code: 'disposed';

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
