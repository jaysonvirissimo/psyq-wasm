// SPDX-License-Identifier: MIT
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import type { MessagePortLike, WorkerToMainMessage } from '../../src/protocol.js';
import { attachRuntime, nodePortAdapter, type WorkerRuntime } from '../../src/worker-port.js';

function fakePort(): MessagePortLike & { posted: [unknown, ArrayBuffer[] | undefined][] } {
  const posted: [unknown, ArrayBuffer[] | undefined][] = [];
  return {
    posted,
    onmessage: null,
    postMessage(message, transfer) {
      posted.push([message, transfer]);
    },
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const timings = { instantiateMs: 1, compileMs: 2, totalMs: 3 };

describe('attachRuntime', () => {
  it('forwards messages to the runtime and posts the reply', async () => {
    const port = fakePort();
    const handle = vi.fn(() =>
      Promise.resolve<WorkerToMainMessage>({ type: 'ready', buildId: 'sha256:cardboard' }),
    );
    const runtime: WorkerRuntime = { handle };
    attachRuntime(port, runtime);
    port.onmessage?.({ data: { type: 'init' } });
    await vi.waitFor(() => {
      expect(port.posted).toHaveLength(1);
    });
    expect(handle).toHaveBeenCalledWith({ type: 'init' });
    expect(port.posted[0]).toEqual([{ type: 'ready', buildId: 'sha256:cardboard' }, undefined]);
  });

  it('transfers the assembly buffer with a result', async () => {
    const port = fakePort();
    const asm = new Uint8Array([1, 2, 3]);
    const result: WorkerToMainMessage = {
      type: 'result',
      id: 1,
      exitCode: 0,
      asm,
      stdout: '',
      stderr: '',
      timings,
    };
    attachRuntime(port, { handle: () => Promise.resolve(result) });
    port.onmessage?.({ data: {} });
    await vi.waitFor(() => {
      expect(port.posted).toHaveLength(1);
    });
    expect(port.posted[0]?.[1]).toEqual([asm.buffer]);
  });

  it('does not transfer anything for a result without output', async () => {
    const port = fakePort();
    const result: WorkerToMainMessage = {
      type: 'result',
      id: 1,
      exitCode: 1,
      stdout: '',
      stderr: '',
      timings,
    };
    attachRuntime(port, { handle: () => Promise.resolve(result) });
    port.onmessage?.({ data: {} });
    await vi.waitFor(() => {
      expect(port.posted).toHaveLength(1);
    });
    expect(port.posted[0]?.[1]).toBeUndefined();
  });

  it('converts a rejected handle() into a crash message', async () => {
    const port = fakePort();
    attachRuntime(port, { handle: () => Promise.reject(new Error('shadow moses')) });
    port.onmessage?.({ data: { type: 'compile', id: 3 } });
    await vi.waitFor(() => {
      expect(port.posted).toHaveLength(1);
    });
    expect(port.posted[0]?.[0]).toEqual({ type: 'crash', id: 3, message: 'Error: shadow moses' });

    // Non-Error rejection values must still be reported.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    const rejectWithString = (): Promise<WorkerToMainMessage> => Promise.reject('plain string');
    const port2 = fakePort();
    attachRuntime(port2, { handle: rejectWithString });
    port2.onmessage?.({ data: 'not an object' });
    await vi.waitFor(() => {
      expect(port2.posted).toHaveLength(1);
    });
    expect(port2.posted[0]?.[0]).toEqual({ type: 'crash', message: 'plain string' });

    // An id that is not a number is not echoed back.
    const port3 = fakePort();
    attachRuntime(port3, { handle: rejectWithString });
    port3.onmessage?.({ data: { id: 'otacon' } });
    await vi.waitFor(() => {
      expect(port3.posted).toHaveLength(1);
    });
    expect(port3.posted[0]?.[0]).toEqual({ type: 'crash', message: 'plain string' });
  });

  it('processes messages strictly in order', async () => {
    const port = fakePort();
    const first = deferred<WorkerToMainMessage>();
    const handle = vi
      .fn<(m: unknown) => Promise<WorkerToMainMessage>>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => Promise.resolve({ type: 'ready', buildId: 'second' }));
    attachRuntime(port, { handle });
    port.onmessage?.({ data: 1 });
    port.onmessage?.({ data: 2 });
    await Promise.resolve();
    expect(handle).toHaveBeenCalledTimes(1);
    expect(port.posted).toHaveLength(0);
    first.resolve({ type: 'ready', buildId: 'first' });
    await vi.waitFor(() => {
      expect(port.posted).toHaveLength(2);
    });
    expect(port.posted.map(([m]) => (m as { buildId: string }).buildId)).toEqual([
      'first',
      'second',
    ]);
  });
});

describe('nodePortAdapter', () => {
  it('maps worker_threads events onto the MessagePortLike shape', () => {
    const emitter = new EventEmitter();
    const postMessage = vi.fn();
    const adapter = nodePortAdapter({
      postMessage,
      on: (event: 'message', listener: (value: unknown) => void) => {
        emitter.on(event, listener);
        return undefined;
      },
    });
    const seen: unknown[] = [];
    adapter.onmessage = (e) => seen.push(e.data);
    emitter.emit('message', { type: 'init' });
    expect(seen).toEqual([{ type: 'init' }]);
    adapter.postMessage({ type: 'ready' }, [new ArrayBuffer(1)]);
    expect(postMessage).toHaveBeenCalledWith({ type: 'ready' }, [expect.any(ArrayBuffer)]);
    expect(adapter.onmessage).toBeTypeOf('function');
  });

  it('ignores messages until a handler is attached, and after it is removed', () => {
    const emitter = new EventEmitter();
    const adapter = nodePortAdapter({
      postMessage: vi.fn(),
      on: (event: 'message', listener: (value: unknown) => void) => {
        emitter.on(event, listener);
        return undefined;
      },
    });
    expect(adapter.onmessage).toBeNull();
    emitter.emit('message', 1);
    const seen: unknown[] = [];
    adapter.onmessage = (e) => seen.push(e.data);
    emitter.emit('message', 2);
    adapter.onmessage = null;
    emitter.emit('message', 3);
    expect(seen).toEqual([2]);
  });
});
