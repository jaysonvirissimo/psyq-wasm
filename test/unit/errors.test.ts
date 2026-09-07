// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import {
  CompileTimeoutError,
  CompilerDisposedError,
  InternalError,
  InvalidOptionsError,
  PsyqWasmError,
  WorkerCrashError,
  createAbortError,
  isAbortError,
} from '../../src/errors.js';

describe('error hierarchy', () => {
  it('CompileTimeoutError carries the timeout', () => {
    const err = new CompileTimeoutError(14085);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(PsyqWasmError);
    expect(err.name).toBe('CompileTimeoutError');
    expect(err.code).toBe('timeout');
    expect(err.timeoutMs).toBe(14085);
    expect(err.message).toContain('14085');
  });

  it('WorkerCrashError exposes the cause', () => {
    const cause = new WebAssembly.RuntimeError('null function or function signature mismatch');
    const err = new WorkerCrashError('worker crashed', { cause });
    expect(err.name).toBe('WorkerCrashError');
    expect(err.code).toBe('worker-crash');
    expect(err.cause).toBe(cause);
    expect(err.message).toBe('worker crashed');
  });

  it('InternalError, InvalidOptionsError, and CompilerDisposedError have distinct codes', () => {
    expect(new InternalError('otacon').code).toBe('internal');
    expect(new InternalError('otacon').name).toBe('InternalError');
    expect(new InvalidOptionsError('mei ling').code).toBe('invalid-options');
    expect(new InvalidOptionsError('mei ling').name).toBe('InvalidOptionsError');
    expect(new CompilerDisposedError().code).toBe('disposed');
    expect(new CompilerDisposedError().name).toBe('CompilerDisposedError');
    expect(new CompilerDisposedError().message).toMatch(/disposed/i);
  });

  it('InternalError forwards a cause', () => {
    const cause = new Error('codec');
    expect(new InternalError('x', { cause }).cause).toBe(cause);
  });

  it('every subclass survives instanceof after being thrown', () => {
    const errors = [
      new CompileTimeoutError(1),
      new WorkerCrashError('a'),
      new InternalError('b'),
      new InvalidOptionsError('c'),
      new CompilerDisposedError(),
    ];
    for (const err of errors) {
      try {
        throw err;
      } catch (caught) {
        expect(caught).toBeInstanceOf(PsyqWasmError);
        expect(caught).toBe(err);
      }
    }
  });
});

describe('abort errors', () => {
  it('returns the signal reason when one was supplied', () => {
    const controller = new AbortController();
    const reason = new Error('campbell called');
    controller.abort(reason);
    expect(createAbortError(controller.signal)).toBe(reason);
  });

  it('creates an AbortError DOMException otherwise', () => {
    const err = createAbortError(undefined);
    expect(err).toBeInstanceOf(DOMException);
    expect((err as DOMException).name).toBe('AbortError');

    const controller = new AbortController();
    controller.abort();
    // Default abort reason is itself an AbortError DOMException.
    const fromSignal = createAbortError(controller.signal);
    expect(isAbortError(fromSignal)).toBe(true);
  });

  it('recognises AbortError-shaped values', () => {
    expect(isAbortError(new DOMException('x', 'AbortError'))).toBe(true);
    const named = new Error('x');
    named.name = 'AbortError';
    expect(isAbortError(named)).toBe(true);
    expect(isAbortError(new DOMException('x', 'TimeoutError'))).toBe(false);
    expect(isAbortError(new Error('x'))).toBe(false);
    expect(isAbortError('AbortError')).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});
