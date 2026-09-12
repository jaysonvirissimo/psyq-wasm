// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import {
  CompileTimeoutError,
  CompilerDisposedError,
  EncodingError,
  InternalError,
  InvalidOptionsError,
  PsyqWasmError,
  WorkerCrashError,
  createAbortError,
  isAbortError,
} from '../../src/errors.js';
import type { ErrorCode } from '../../src/public-types.js';

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

  it('EncodingError names the character and its index', () => {
    const err = new EncodingError('U+00A5 "¥" at line 3 has no EUC-JP mapping.', {
      character: '¥',
      index: 140,
    });
    expect(err).toBeInstanceOf(PsyqWasmError);
    expect(err.name).toBe('EncodingError');
    expect(err.code).toBe('encoding');
    expect(err.character).toBe('¥');
    expect(err.index).toBe(140);
    expect(err.message).toContain('U+00A5');
  });

  it('InternalError forwards a cause', () => {
    const cause = new Error('codec');
    expect(new InternalError('x', { cause }).cause).toBe(cause);
  });

  it('types each code as its own literal, not the whole union', () => {
    // Compile-time assertions: `npm run typecheck` covers this file, so a
    // `code` widened back to the union fails the build even though nothing
    // here can fail at run time.
    const timeout: 'timeout' = new CompileTimeoutError(1).code;
    const workerCrash: 'worker-crash' = new WorkerCrashError('rex went down').code;
    const internal: 'internal' = new InternalError('otacon').code;
    const invalidOptions: 'invalid-options' = new InvalidOptionsError('mei ling').code;
    const encoding: 'encoding' = new EncodingError('no mapping', {
      character: '¥',
      index: 0,
    }).code;
    const disposed: 'disposed' = new CompilerDisposedError().code;

    expect([timeout, workerCrash, internal, invalidOptions, encoding, disposed]).toEqual([
      'timeout',
      'worker-crash',
      'internal',
      'invalid-options',
      'encoding',
      'disposed',
    ]);

    const acceptsTimeout = (value: 'timeout'): string => value;
    // @ts-expect-error one class's code must never be assignable to another's.
    expect(acceptsTimeout(encoding)).toBe('encoding');
  });

  it('narrows a union of error classes on code', () => {
    const errors: (CompileTimeoutError | EncodingError)[] = [
      new CompileTimeoutError(14085),
      new EncodingError('U+00A5 "¥" has no EUC-JP mapping.', { character: '¥', index: 140 }),
    ];
    const seen: string[] = [];

    for (const err of errors) {
      // Reaching a subclass-only field behind a `code` test is the whole
      // point: consumers should not need `instanceof` to get here.
      if (err.code === 'encoding') {
        seen.push(`${err.character}@${String(err.index)}`);
      } else {
        seen.push(String(err.timeoutMs));
      }
    }

    expect(seen).toEqual(['14085', '¥@140']);
  });

  it('still exposes the whole union on the base class', () => {
    const caught: unknown = new EncodingError('x', { character: '¥', index: 0 });

    expect(caught).toBeInstanceOf(PsyqWasmError);
    if (caught instanceof PsyqWasmError) {
      // A broad `catch` reads the union, exactly as before. `code` being
      // `any` here would also compile, so the guard is lint: no-unsafe-assignment
      // fails the moment this stops being a real `ErrorCode`.
      const code: ErrorCode = caught.code;
      expect(code).toBe('encoding');
    }
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
