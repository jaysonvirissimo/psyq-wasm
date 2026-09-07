// SPDX-License-Identifier: MIT
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  createRequestIdGenerator,
  isMainToWorkerMessage,
  isWorkerToMainMessage,
} from '../../src/protocol.js';

// Smallest valid WebAssembly module: magic + version.
const EMPTY_MODULE = new WebAssembly.Module(
  new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
);

const timings = { instantiateMs: 14.1, compileMs: 140.85, totalMs: 154.95 };
const modules = { cc1: EMPTY_MODULE, cccp: EMPTY_MODULE };
const source = {
  type: 'source',
  id: 1,
  filename: 'rations.c',
  cppArgv: ['-nostdinc', '-undef', 'rations.c', 'out.i'],
  headers: [{ path: 'codec.h', data: new Uint8Array([0x69]) }],
  encoding: 'utf8',
  argv: ['-quiet', '-G', '8', 'out.i', '-o', 'out.s'],
  source: new Uint8Array([0x69]),
};

describe('createRequestIdGenerator', () => {
  it('starts at 1 and increments', () => {
    const next = createRequestIdGenerator();
    expect([next(), next(), next()]).toEqual([1, 2, 3]);
  });

  it('is strictly increasing and never repeats (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5000 }), (n) => {
        const next = createRequestIdGenerator();
        let prev = 0;
        for (let i = 0; i < n; i++) {
          const id = next();
          expect(id).toBeGreaterThan(prev);
          prev = id;
        }
      }),
    );
  });

  it('generators are independent', () => {
    const a = createRequestIdGenerator();
    const b = createRequestIdGenerator();
    a();
    a();
    expect(b()).toBe(1);
  });
});

describe('isMainToWorkerMessage', () => {
  it('accepts init, compile, and source messages', () => {
    expect(isMainToWorkerMessage({ type: 'init', modules })).toBe(true);
    expect(isMainToWorkerMessage(source)).toBe(true);
    expect(isMainToWorkerMessage({ ...source, headers: [], encoding: 'eucjp' })).toBe(true);
    expect(
      isMainToWorkerMessage({
        type: 'compile',
        id: 1,
        filename: 'rations.i',
        argv: ['-quiet', '-G', '8', 'rations.i', '-o', 'out.s'],
        source: new Uint8Array([0x69]),
      }),
    ).toBe(true);
  });

  it.each([
    [null],
    ['init'],
    [{}],
    [{ type: 'init' }],
    [{ type: 'init', module: EMPTY_MODULE }],
    [{ type: 'init', modules: { cc1: EMPTY_MODULE } }],
    [{ type: 'init', modules: { cc1: EMPTY_MODULE, cccp: {} } }],
    [{ type: 'init', modules: null }],
    [{ ...source, id: '1' }],
    [{ ...source, filename: 7 }],
    [{ ...source, cppArgv: 'x' }],
    [{ ...source, cppArgv: ['-D', 3] }],
    [{ ...source, argv: [3] }],
    [{ ...source, source: [1] }],
    [{ ...source, encoding: 'raw' }],
    [{ ...source, headers: { 'codec.h': new Uint8Array() } }],
    [{ ...source, headers: [{ path: 'codec.h' }] }],
    [{ ...source, headers: [{ path: 3, data: new Uint8Array() }] }],
    [{ ...source, headers: [{ path: 'codec.h', data: 'text' }] }],
    [{ ...source, headers: [null] }],
    [{ type: 'compile', id: '1', filename: 'x', argv: [], source: new Uint8Array() }],
    [{ type: 'compile', id: 1, filename: 7, argv: [], source: new Uint8Array() }],
    [{ type: 'compile', id: 1, filename: 'x', argv: ['-O2', 3], source: new Uint8Array() }],
    [{ type: 'compile', id: 1, filename: 'x', argv: 'x', source: new Uint8Array() }],
    [{ type: 'compile', id: 1, filename: 'x', argv: [], source: [1, 2] }],
    [{ type: 'ready', buildId: 'x', preprocessorBuildId: 'y' }],
  ])('rejects %j', (bad) => {
    expect(isMainToWorkerMessage(bad)).toBe(false);
  });
});

describe('isWorkerToMainMessage', () => {
  it('accepts ready, result, reject, and crash messages', () => {
    expect(
      isWorkerToMainMessage({
        type: 'ready',
        buildId: 'sha256:abc',
        preprocessorBuildId: 'sha256:def',
      }),
    ).toBe(true);
    expect(
      isWorkerToMainMessage({
        type: 'result',
        id: 4,
        exitCode: 33,
        preprocessed: new Uint8Array(),
        stage: 'preprocess',
        stdout: '',
        stderr: '',
        timings: { ...timings, preprocessMs: 1.5 },
      }),
    ).toBe(true);
    expect(
      isWorkerToMainMessage({
        type: 'result',
        id: 5,
        exitCode: 1,
        asm: new Uint8Array(),
        preprocessed: new Uint8Array(),
        stage: 'compile',
        stdout: '',
        stderr: '',
        timings,
      }),
    ).toBe(true);
    expect(
      isWorkerToMainMessage({
        type: 'reject',
        id: 6,
        code: 'encoding',
        message: 'no mapping',
        character: '¥',
        index: 3,
      }),
    ).toBe(true);
    expect(
      isWorkerToMainMessage({
        type: 'result',
        id: 1,
        exitCode: 0,
        asm: new Uint8Array(),
        stdout: '',
        stderr: '',
        timings,
      }),
    ).toBe(true);
    expect(
      isWorkerToMainMessage({
        type: 'result',
        id: 2,
        exitCode: 1,
        stdout: '',
        stderr: 'e',
        timings,
      }),
    ).toBe(true);
    expect(isWorkerToMainMessage({ type: 'crash', id: 3, message: 'boom' })).toBe(true);
    expect(isWorkerToMainMessage({ type: 'crash', message: 'boom' })).toBe(true);
  });

  it.each([
    [undefined],
    [42],
    [{ type: 'ready' }],
    [{ type: 'ready', buildId: 1 }],
    [{ type: 'ready', buildId: 'x' }],
    [{ type: 'ready', buildId: 'x', preprocessorBuildId: 2 }],
    [{ type: 'result', id: 1, exitCode: 0, stdout: '', stderr: '', timings, preprocessed: 'i' }],
    [{ type: 'result', id: 1, exitCode: 0, stdout: '', stderr: '', timings, stage: 'link' }],
    [
      {
        type: 'result',
        id: 1,
        exitCode: 0,
        stdout: '',
        stderr: '',
        timings: { ...timings, preprocessMs: '1' },
      },
    ],
    [{ type: 'reject', id: 1, code: 'timeout', message: 'm', character: '', index: -1 }],
    [{ type: 'reject', id: 1, code: 'encoding', message: 'm', character: 1, index: -1 }],
    [{ type: 'reject', id: 1, code: 'encoding', message: 'm', character: '', index: 'x' }],
    [{ type: 'reject', id: 'x', code: 'encoding', message: 'm', character: '', index: -1 }],
    [{ type: 'reject', id: 1, code: 'encoding' }],
    [{ type: 'reject', code: 'encoding', message: 'm', character: '', index: -1 }],
    [{ type: 'result', id: 1, exitCode: 0, stdout: '', stderr: '' }],
    [{ type: 'result', id: 'x', exitCode: 0, stdout: '', stderr: '', timings }],
    [{ type: 'result', id: 1, exitCode: '0', stdout: '', stderr: '', timings }],
    [{ type: 'result', id: 1, exitCode: 0, stdout: 1, stderr: '', timings }],
    [{ type: 'result', id: 1, exitCode: 0, stdout: '', stderr: '', timings: { instantiateMs: 1 } }],
    [{ type: 'result', id: 1, exitCode: 0, asm: 'text', stdout: '', stderr: '', timings }],
    [{ type: 'crash' }],
    [{ type: 'crash', id: 'x', message: 'm' }],
    [{ type: 'init', modules }],
    [{ type: 'nope' }],
  ])('rejects %j', (bad) => {
    expect(isWorkerToMainMessage(bad)).toBe(false);
  });
});
