// SPDX-License-Identifier: MIT
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompilerController } from '../../src/controller.js';
import {
  CompileTimeoutError,
  CompilerDisposedError,
  InternalError,
  InvalidOptionsError,
  WorkerCrashError,
  isAbortError,
} from '../../src/errors.js';
import { DEFAULT_LIMITS } from '../../src/options.js';
import { BUILD_ID, fakeWorkerFactory, type FakeWorker } from '../helpers/fake-worker.js';

const EMPTY_MODULE = new WebAssembly.Module(
  new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
);

const SOURCE = new TextEncoder().encode('# 1 "rations.c"\nint otacon(void) { return 1; }\n');

const flush = (): Promise<void> => vi.advanceTimersByTimeAsync(0).then(() => undefined);

/** Swallow a rejection so an intentionally failing promise does not trip Vitest's unhandled-rejection guard. */
const settled = <T>(p: Promise<T>): Promise<T> => {
  p.catch(() => undefined);
  return p;
};

interface Harness {
  controller: CompilerController;
  workers: FakeWorker[];
  spawn: ReturnType<typeof fakeWorkerFactory>['spawn'];
  worker(): FakeWorker;
}

async function harness(limits = DEFAULT_LIMITS): Promise<Harness> {
  const { spawn, workers } = fakeWorkerFactory();
  const controller = new CompilerController({ module: EMPTY_MODULE, spawnWorker: spawn, limits });
  const started = controller.start();
  await flush();
  workers[0]?.ready();
  await started;
  return {
    controller,
    workers,
    spawn,
    worker: () => {
      const w = workers.at(-1);
      if (!w) throw new Error('no worker');
      return w;
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CompilerController.start', () => {
  it('normalizes a synchronous construction failure', async () => {
    const error = new Error('constructor failed');
    const controller = new CompilerController({
      module: EMPTY_MODULE,
      limits: DEFAULT_LIMITS,
      spawnWorker: () => {
        throw error;
      },
    });
    await expect(controller.start()).rejects.toMatchObject({ code: 'worker-crash', cause: error });
    expect(vi.getTimerCount()).toBe(0);
    controller.dispose();
  });

  it.each(['postMessage', 'onMessage'] as const)(
    'cleans up when initialization %s throws',
    async (method) => {
      const { spawn, workers } = fakeWorkerFactory();
      const controller = new CompilerController({
        module: EMPTY_MODULE,
        limits: DEFAULT_LIMITS,
        spawnWorker: () => {
          const w = spawn();
          vi.spyOn(w, method).mockImplementation(() => {
            throw new Error('init failed');
          });
          return w;
        },
      });
      await expect(controller.start()).rejects.toBeInstanceOf(WorkerCrashError);
      expect(workers[0]?.terminated).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    },
  );
  it('spawns one worker, posts init with the retained module, and reports the build id', async () => {
    const h = await harness();
    expect(h.spawn).toHaveBeenCalledTimes(1);
    expect(h.worker().posted[0]?.message).toEqual({ type: 'init', module: EMPTY_MODULE });
    expect(h.controller.buildId).toBe(BUILD_ID);
  });

  it('rejects with InternalError when the worker never reports ready', async () => {
    const { spawn } = fakeWorkerFactory();
    const controller = new CompilerController({
      module: EMPTY_MODULE,
      spawnWorker: spawn,
      limits: { ...DEFAULT_LIMITS, initTimeoutMs: 500 },
    });
    const started = settled(controller.start());
    await vi.advanceTimersByTimeAsync(499);
    await vi.advanceTimersByTimeAsync(1);
    await expect(started).rejects.toBeInstanceOf(InternalError);
    await expect(started).rejects.toThrow(/ready/);
  });

  it('rejects with WorkerCrashError when the worker errors during init', async () => {
    const { spawn, workers } = fakeWorkerFactory();
    const controller = new CompilerController({
      module: EMPTY_MODULE,
      spawnWorker: spawn,
      limits: DEFAULT_LIMITS,
    });
    const started = settled(controller.start());
    await flush();
    workers[0]?.error(new Error('script failed to load'));
    await expect(started).rejects.toBeInstanceOf(WorkerCrashError);
    await expect(started).rejects.toThrow(/script failed to load/);
  });

  it('rejects with WorkerCrashError when the worker exits during init', async () => {
    const { spawn, workers } = fakeWorkerFactory();
    const controller = new CompilerController({
      module: EMPTY_MODULE,
      spawnWorker: spawn,
      limits: DEFAULT_LIMITS,
    });
    const started = settled(controller.start());
    await flush();
    workers[0]?.exit(1);
    await expect(started).rejects.toThrow(/exited with code 1/);
  });

  it('treats a non-ready first message as a protocol violation', async () => {
    const { spawn, workers } = fakeWorkerFactory();
    const controller = new CompilerController({
      module: EMPTY_MODULE,
      spawnWorker: spawn,
      limits: DEFAULT_LIMITS,
    });
    const started = settled(controller.start());
    await flush();
    workers[0]?.crash('boom during init');
    await expect(started).rejects.toBeInstanceOf(WorkerCrashError);
  });

  it('buildId throws before start', () => {
    const { spawn } = fakeWorkerFactory();
    const controller = new CompilerController({
      module: EMPTY_MODULE,
      spawnWorker: spawn,
      limits: DEFAULT_LIMITS,
    });
    expect(() => controller.buildId).toThrow(InternalError);
  });
});

describe('CompilerController.compile', () => {
  it('ignores a timeout callback already queued when its request settles', async () => {
    const h = await harness();
    const timers = vi.spyOn(globalThis, 'setTimeout');
    const pending = h.controller.compile(SOURCE, { gpSize: 8, timeoutMs: 123 });
    await flush();
    const callback = timers.mock.calls.find((call) => call[1] === 123)?.[0];
    h.worker().result(1);
    await pending;
    if (typeof callback !== 'function') throw new Error('missing timer callback');
    callback();
    expect(h.worker().terminated).toBe(false);
    h.controller.dispose();
    timers.mockRestore();
  });
  it('recovers queued work after posting a compile throws', async () => {
    const h = await harness();
    vi.spyOn(h.worker(), 'postMessage').mockImplementation(() => {
      throw new Error('transfer failed');
    });
    const first = settled(h.controller.compile(SOURCE, { gpSize: 8 }));
    const next = h.controller.compile(SOURCE, { gpSize: 8 });
    await flush();
    await expect(first).rejects.toMatchObject({
      code: 'worker-crash',
      message: 'could not post compile: transfer failed',
    });
    h.worker().ready();
    await flush();
    h.worker().result(2);
    await expect(next).resolves.toMatchObject({ success: true });
    h.controller.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('can retry after idle replacement construction throws', async () => {
    const h = await harness();
    h.spawn.mockImplementationOnce(() => {
      throw new Error('spawn failed');
    });
    h.worker().crash('replace');
    await flush();
    const next = h.controller.compile(SOURCE, { gpSize: 8 });
    h.worker().ready();
    await flush();
    h.worker().result(1);
    await expect(next).resolves.toMatchObject({ success: true });
    h.controller.dispose();
  });
  it.each(['pooled', 'standalone', 'subarray'] as const)(
    'owns a copy of %s Buffer input',
    async (kind) => {
      const h = await harness();
      const buffer = kind === 'pooled' ? Buffer.from(SOURCE) : Buffer.alloc(SOURCE.length + 4);
      const source = kind === 'subarray' ? buffer.subarray(2, SOURCE.length + 2) : buffer;
      source.set(SOURCE);
      const expected = new Uint8Array(source);
      const pending = h.controller.compile(source, { gpSize: 8 });
      source.fill(0);
      await flush();
      const post = h.worker().posted[1];
      if (post?.message.type !== 'compile') throw new Error('no compile');
      expect(post.message.source).toEqual(expected);
      structuredClone(post.message, { transfer: post.transfer ?? [] });
      expect(source.byteLength).toBe(expected.length);
      h.worker().result(1);
      await pending;
      h.controller.dispose();
    },
  );
  it('validates before posting anything', async () => {
    const h = await harness();
    await expect(h.controller.compile(SOURCE, { gpSize: 4 })).rejects.toBeInstanceOf(
      InvalidOptionsError,
    );
    await expect(
      h.controller.compile(new Uint8Array(DEFAULT_LIMITS.maxSourceBytes + 1), { gpSize: 8 }),
    ).rejects.toBeInstanceOf(InvalidOptionsError);
    expect(h.worker().compiles()).toEqual([]);
  });

  it('posts a compile request with argv and a copied, transferred source', async () => {
    const h = await harness();
    const pending = h.controller.compile(SOURCE, {
      gpSize: 8,
      filename: 'rations.i',
      rawFlags: ['-O2', '-g0'],
    });
    await flush();
    const post = h.worker().posted[1];
    expect(post?.message).toEqual({
      type: 'compile',
      id: 1,
      filename: 'rations.i',
      argv: ['-quiet', '-G', '8', '-O2', '-g0', 'rations.i', '-o', 'out.s'],
      source: SOURCE,
    });
    const posted = post?.message;
    if (posted?.type !== 'compile') throw new Error('unreachable');
    expect(posted.source).not.toBe(SOURCE);
    expect(post?.transfer).toEqual([posted.source.buffer]);
    // The caller's buffer is intact even though the copy was transferred.
    expect(SOURCE.byteLength).toBeGreaterThan(0);
    h.worker().result(1);
    const result = await pending;
    expect(result.success).toBe(true);
  });

  it('maps a result into a CompileResult with the compiler info', async () => {
    const h = await harness();
    const pending = h.controller.compile(SOURCE, { gpSize: 0 });
    await flush();
    h.worker().result(1, {
      exitCode: 1,
      asm: undefined,
      stderr: "rations.c:1: parse error before `{'\n",
    });
    const result = await pending;
    expect(result).toMatchObject({
      success: false,
      exitCode: 1,
      compiler: { psyqVersion: '4.4', gccVersion: '2.8.1', buildId: BUILD_ID },
      diagnostics: [{ severity: 'error', file: 'rations.c', line: 1 }],
    });
  });

  it('runs requests one at a time with increasing ids', async () => {
    const h = await harness();
    const a = h.controller.compile(SOURCE, { gpSize: 8 });
    const b = h.controller.compile(SOURCE, { gpSize: 0 });
    await flush();
    expect(h.worker().compiles()).toHaveLength(1);
    h.worker().result(1);
    await a;
    await flush();
    expect(h.worker().compiles()).toHaveLength(2);
    expect(h.worker().lastCompileId()).toBe(2);
    h.worker().result(2);
    await b;
  });

  it('clears the timeout after a result', async () => {
    const h = await harness();
    const pending = h.controller.compile(SOURCE, { gpSize: 8, timeoutMs: 100 });
    await flush();
    h.worker().result(1);
    await pending;
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.worker().terminated).toBe(false);
    expect(h.spawn).toHaveBeenCalledTimes(1);
  });
});

describe('cancellation', () => {
  it('ignores a continuation cancelled before an already-ready worker resumes', async () => {
    const h = await harness();
    const old = h.worker();
    const abort = new AbortController();
    const first = settled(
      h.controller.compile(SOURCE, { gpSize: 8, signal: abort.signal, timeoutMs: 10 }),
    );
    abort.abort();
    const second = h.controller.compile(SOURCE, { gpSize: 0, timeoutMs: 100 });
    h.worker().ready();
    await flush();
    await expect(first).rejects.toSatisfy(isAbortError);
    expect(old.compiles()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(20);
    expect(h.worker().terminated).toBe(false);
    h.worker().result(2);
    await expect(second).resolves.toMatchObject({ success: true });
    h.controller.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores a readiness continuation cancelled after the handshake resolves', async () => {
    const h = await harness();
    h.worker().crash('replace');
    const abort = new AbortController();
    const pending = settled(h.controller.compile(SOURCE, { gpSize: 8, signal: abort.signal }));
    const old = h.worker();
    old.ready();
    abort.abort();
    h.worker().ready();
    await flush();
    await expect(pending).rejects.toSatisfy(isAbortError);
    expect(old.compiles()).toHaveLength(0);
    h.controller.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('rejects an already-aborted request immediately without posting', async () => {
    const h = await harness();
    const controller = new AbortController();
    controller.abort();
    await expect(
      h.controller.compile(SOURCE, { gpSize: 8, signal: controller.signal }),
    ).rejects.toSatisfy(isAbortError);
    expect(h.worker().compiles()).toEqual([]);
  });

  it('removes a queued request without terminating the worker', async () => {
    const h = await harness();
    const first = h.controller.compile(SOURCE, { gpSize: 8 });
    const abort = new AbortController();
    const second = settled(h.controller.compile(SOURCE, { gpSize: 8, signal: abort.signal }));
    const third = h.controller.compile(SOURCE, { gpSize: 8 });
    await flush();
    abort.abort();
    await expect(second).rejects.toSatisfy(isAbortError);
    expect(h.worker().terminated).toBe(false);
    h.worker().result(1);
    await first;
    await flush();
    expect(h.worker().lastCompileId()).toBe(3);
    h.worker().result(3);
    await third;
    expect(h.spawn).toHaveBeenCalledTimes(1);
  });

  it('terminates and replaces the worker for an in-flight abort, reusing the module', async () => {
    const h = await harness();
    const abort = new AbortController();
    const reason = new Error('campbell called');
    const inflight = settled(h.controller.compile(SOURCE, { gpSize: 8, signal: abort.signal }));
    const queued = h.controller.compile(SOURCE, { gpSize: 0 });
    await flush();
    const first = h.worker();
    abort.abort(reason);
    await expect(inflight).rejects.toBe(reason);
    expect(first.terminated).toBe(true);
    expect(h.spawn).toHaveBeenCalledTimes(2);
    const second = h.worker();
    expect(second).not.toBe(first);
    expect(second.posted[0]?.message).toEqual({ type: 'init', module: EMPTY_MODULE });
    // The queued request waits for the replacement to be ready.
    expect(second.compiles()).toHaveLength(0);
    second.ready();
    await flush();
    expect(second.lastCompileId()).toBe(2);
    second.result(2);
    await expect(queued).resolves.toMatchObject({ success: true });
  });

  it('uses an AbortError when the signal has no reason', async () => {
    const h = await harness();
    const abort = new AbortController();
    const inflight = settled(h.controller.compile(SOURCE, { gpSize: 8, signal: abort.signal }));
    await flush();
    abort.abort();
    await expect(inflight).rejects.toSatisfy(isAbortError);
  });

  it('detaches the abort listener once the request settles', async () => {
    const h = await harness();
    const abort = new AbortController();
    const remove = vi.spyOn(abort.signal, 'removeEventListener');
    const pending = h.controller.compile(SOURCE, { gpSize: 8, signal: abort.signal });
    await flush();
    h.worker().result(1);
    await pending;
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    abort.abort();
    await flush();
    expect(h.worker().terminated).toBe(false);
  });
});

describe('timeouts', () => {
  it('rejects with CompileTimeoutError exactly at the deadline and replaces the worker', async () => {
    const h = await harness();
    const pending = settled(h.controller.compile(SOURCE, { gpSize: 8, timeoutMs: 140 }));
    await vi.advanceTimersByTimeAsync(139);
    expect(h.worker().terminated).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).rejects.toBeInstanceOf(CompileTimeoutError);
    await expect(pending).rejects.toMatchObject({ timeoutMs: 140 });
    expect(h.workers[0]?.terminated).toBe(true);
    expect(h.spawn).toHaveBeenCalledTimes(2);
  });

  it('applies the default timeout from the limits', async () => {
    const h = await harness({ ...DEFAULT_LIMITS, defaultTimeoutMs: 250 });
    const pending = settled(h.controller.compile(SOURCE, { gpSize: 8 }));
    await vi.advanceTimersByTimeAsync(250);
    await expect(pending).rejects.toMatchObject({ timeoutMs: 250 });
  });

  it('a compile succeeds on the replacement worker after a timeout', async () => {
    const h = await harness();
    const timedOut = settled(h.controller.compile(SOURCE, { gpSize: 8, timeoutMs: 10 }));
    await vi.advanceTimersByTimeAsync(10);
    await expect(timedOut).rejects.toBeInstanceOf(CompileTimeoutError);
    const next = h.controller.compile(SOURCE, { gpSize: 8 });
    await flush();
    h.worker().ready();
    await flush();
    h.worker().result(h.worker().lastCompileId());
    await expect(next).resolves.toMatchObject({ success: true });
  });
});

describe('worker failures', () => {
  it('maps a crash message for the in-flight request to WorkerCrashError and respawns', async () => {
    const h = await harness();
    const pending = settled(h.controller.compile(SOURCE, { gpSize: 8 }));
    await flush();
    h.worker().crash('RuntimeError: null function or function signature mismatch', 1);
    await expect(pending).rejects.toBeInstanceOf(WorkerCrashError);
    await expect(pending).rejects.toThrow(/signature mismatch/);
    expect(h.workers[0]?.terminated).toBe(true);
    expect(h.spawn).toHaveBeenCalledTimes(2);
  });

  it('maps a crash message without an id to the in-flight request', async () => {
    const h = await harness();
    const pending = settled(h.controller.compile(SOURCE, { gpSize: 8 }));
    await flush();
    h.worker().crash('unexpected message');
    await expect(pending).rejects.toBeInstanceOf(WorkerCrashError);
  });

  it('maps a worker error event to WorkerCrashError and keeps serving the queue', async () => {
    const h = await harness();
    const inflight = settled(h.controller.compile(SOURCE, { gpSize: 8 }));
    const queued = h.controller.compile(SOURCE, { gpSize: 8 });
    await flush();
    h.worker().error(new Error('out of memory'));
    await expect(inflight).rejects.toBeInstanceOf(WorkerCrashError);
    await expect(inflight).rejects.toThrow(/out of memory/);
    h.worker().ready();
    await flush();
    h.worker().result(h.worker().lastCompileId());
    await expect(queued).resolves.toMatchObject({ success: true });
  });

  it('maps a worker exit event to WorkerCrashError', async () => {
    const h = await harness();
    const inflight = settled(h.controller.compile(SOURCE, { gpSize: 8 }));
    await flush();
    h.worker().exit(139);
    await expect(inflight).rejects.toThrow(/exited with code 139/);
  });

  it('describes non-Error error events', async () => {
    const h = await harness();
    const inflight = settled(h.controller.compile(SOURCE, { gpSize: 8 }));
    await flush();
    h.worker().error('codec static');
    await expect(inflight).rejects.toThrow(/codec static/);
  });

  it('treats an invalid message as an InternalError and respawns', async () => {
    const h = await harness();
    const inflight = settled(h.controller.compile(SOURCE, { gpSize: 8 }));
    await flush();
    h.worker().emit({ type: 'dance' });
    await expect(inflight).rejects.toBeInstanceOf(InternalError);
    expect(h.spawn).toHaveBeenCalledTimes(2);
  });

  it('treats a result with a stale id as an InternalError', async () => {
    const h = await harness();
    const inflight = settled(h.controller.compile(SOURCE, { gpSize: 8 }));
    await flush();
    h.worker().result(999);
    await expect(inflight).rejects.toBeInstanceOf(InternalError);
    await expect(inflight).rejects.toThrow(/999/);
  });

  it('fails a request that was aborted while its replacement worker was still starting', async () => {
    const h = await harness();
    const inflight = settled(h.controller.compile(SOURCE, { gpSize: 8 }));
    const abort = new AbortController();
    const queued = settled(h.controller.compile(SOURCE, { gpSize: 8, signal: abort.signal }));
    await flush();
    h.worker().crash('boom', 1);
    await expect(inflight).rejects.toBeInstanceOf(WorkerCrashError);
    // The queued request is now current and waiting for the new worker's ready.
    abort.abort();
    await expect(queued).rejects.toSatisfy(isAbortError);
    h.worker().ready();
    await flush();
    expect(h.worker().compiles()).toHaveLength(0);
  });

  it('respawns on an unexpected message while idle without failing anything', async () => {
    const h = await harness();
    h.worker().crash('idle crash');
    await flush();
    expect(h.spawn).toHaveBeenCalledTimes(2);
    const next = h.controller.compile(SOURCE, { gpSize: 8 });
    await flush();
    h.worker().ready();
    await flush();
    h.worker().result(h.worker().lastCompileId());
    await expect(next).resolves.toMatchObject({ success: true });
  });

  it('tolerates a replacement that never becomes ready while idle, then recovers on demand', async () => {
    const h = await harness({ ...DEFAULT_LIMITS, initTimeoutMs: 20 });
    h.worker().crash('idle crash');
    await flush();
    expect(h.spawn).toHaveBeenCalledTimes(2);
    // The idle replacement times out silently; nothing is pending to fail.
    await vi.advanceTimersByTimeAsync(20);
    expect(h.workers[1]?.terminated).toBe(true);
    const next = h.controller.compile(SOURCE, { gpSize: 8 });
    await flush();
    expect(h.spawn).toHaveBeenCalledTimes(3);
    h.worker().ready();
    await flush();
    h.worker().result(h.worker().lastCompileId());
    await expect(next).resolves.toMatchObject({ success: true });
  });

  it('ignores a stray ready message while idle', async () => {
    const h = await harness();
    h.worker().ready();
    h.worker().result(42);
    await flush();
    expect(h.spawn).toHaveBeenCalledTimes(2);
  });

  it('fails queued requests when the replacement worker never becomes ready', async () => {
    const h = await harness({ ...DEFAULT_LIMITS, initTimeoutMs: 50 });
    const inflight = settled(h.controller.compile(SOURCE, { gpSize: 8 }));
    const queued = settled(h.controller.compile(SOURCE, { gpSize: 8 }));
    const queuedToo = settled(h.controller.compile(SOURCE, { gpSize: 0 }));
    await flush();
    h.worker().crash('boom', 1);
    await expect(inflight).rejects.toBeInstanceOf(WorkerCrashError);
    await vi.advanceTimersByTimeAsync(50);
    await expect(queued).rejects.toBeInstanceOf(InternalError);
    await expect(queuedToo).rejects.toBeInstanceOf(InternalError);
    // The controller recovers on the next request.
    const later = h.controller.compile(SOURCE, { gpSize: 8 });
    await flush();
    h.worker().ready();
    await flush();
    h.worker().result(h.worker().lastCompileId());
    await expect(later).resolves.toMatchObject({ success: true });
  });
});

describe('dispose', () => {
  it('does not post or install a timer when disposed before the compile continuation', async () => {
    const h = await harness();
    const pending = settled(h.controller.compile(SOURCE, { gpSize: 8 }));
    h.controller.dispose();
    await flush();
    await expect(pending).rejects.toBeInstanceOf(CompilerDisposedError);
    expect(h.worker().compiles()).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('terminates the worker and rejects in-flight and queued requests', async () => {
    const h = await harness();
    const inflight = settled(h.controller.compile(SOURCE, { gpSize: 8 }));
    const queued = settled(h.controller.compile(SOURCE, { gpSize: 8 }));
    await flush();
    h.controller.dispose();
    await expect(inflight).rejects.toBeInstanceOf(CompilerDisposedError);
    await expect(queued).rejects.toBeInstanceOf(CompilerDisposedError);
    expect(h.worker().terminated).toBe(true);
    await expect(h.controller.compile(SOURCE, { gpSize: 8 })).rejects.toBeInstanceOf(
      CompilerDisposedError,
    );
    h.controller.dispose();
    expect(h.spawn).toHaveBeenCalledTimes(1);
  });

  it('does not respawn after dispose even if the old worker still emits', async () => {
    const h = await harness();
    const worker = h.worker();
    h.controller.dispose();
    worker.crash('late');
    worker.error(new Error('late'));
    worker.exit(0);
    await vi.advanceTimersByTimeAsync(DEFAULT_LIMITS.initTimeoutMs + 1);
    expect(h.spawn).toHaveBeenCalledTimes(1);
  });

  it('can dispose after a failed start', async () => {
    const { spawn, workers } = fakeWorkerFactory();
    const controller = new CompilerController({
      module: EMPTY_MODULE,
      spawnWorker: spawn,
      limits: { ...DEFAULT_LIMITS, initTimeoutMs: 5 },
    });
    const started = settled(controller.start());
    await vi.advanceTimersByTimeAsync(5);
    await expect(started).rejects.toBeInstanceOf(InternalError);
    expect(workers[0]?.terminated).toBe(true);
    controller.dispose();
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it('can dispose before or during start', async () => {
    const { spawn, workers } = fakeWorkerFactory();
    const controller = new CompilerController({
      module: EMPTY_MODULE,
      spawnWorker: spawn,
      limits: DEFAULT_LIMITS,
    });
    const started = settled(controller.start());
    await flush();
    controller.dispose();
    await expect(started).rejects.toBeInstanceOf(CompilerDisposedError);
    expect(workers[0]?.terminated).toBe(true);
    await expect(controller.start()).rejects.toBeInstanceOf(CompilerDisposedError);
  });
});
