// SPDX-License-Identifier: MIT
import { describe, expect, it, vi } from 'vitest';
import type { Cc1Factory, Cc1Module, Cc1ModuleOptions } from '../../src/cc1psx.js';
import type { CompileMessage } from '../../src/protocol.js';
import { createWorkerRuntime } from '../../src/worker-runtime.js';

const EMPTY_MODULE = new WebAssembly.Module(
  new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
);
const BUILD_ID = 'sha256:0123456789abcdef';

interface FakeFs {
  files: Map<string, Uint8Array>;
  dirs: string[];
  cwd: string;
}

interface FakeCc1 {
  factory: Cc1Factory;
  fs: FakeFs;
  options: Cc1ModuleOptions[];
  instances: number;
}

/**
 * Build a fake Emscripten factory. `onMain` decides what `callMain` does; it
 * may write the output file into the fake FS, return an exit status, or throw.
 */
function fakeCc1(
  onMain: (argv: readonly string[], fs: FakeFs, opts: Cc1ModuleOptions) => number,
): FakeCc1 {
  const fs: FakeFs = { files: new Map(), dirs: [], cwd: '/' };
  const state: FakeCc1 = {
    factory: undefined as unknown as Cc1Factory,
    fs,
    options: [],
    instances: 0,
  };
  state.factory = (opts = {}) => {
    state.options.push(opts);
    state.instances += 1;
    const module: Cc1Module = {
      ENV: {},
      FS: {
        mkdir: (p) => fs.dirs.push(p),
        chdir: (p) => {
          fs.cwd = p;
        },
        writeFile: (p, data) => fs.files.set(p, data),
        readFile: (p) => {
          const data = fs.files.get(p);
          if (data === undefined) {
            const err = new Error(`ENOENT: ${p}`) as Error & { errno: number };
            err.errno = 44;
            throw err;
          }
          return data;
        },
      },
      callMain: (argv) => onMain(argv, fs, opts),
    };
    for (const hook of opts.preRun ?? []) hook(module);
    return Promise.resolve(module);
  };
  return state;
}

function compileMessage(overrides: Partial<CompileMessage> = {}): CompileMessage {
  return {
    type: 'compile',
    id: 7,
    filename: 'rations.i',
    argv: ['-quiet', '-G', '8', '-O2', 'rations.i', '-o', 'out.s'],
    source: new TextEncoder().encode('# 1 "rations.c"\nint otacon(void) { return 1; }\n'),
    ...overrides,
  };
}

function clock(...ticks: number[]): () => number {
  let i = 0;
  return () => ticks[Math.min(i++, ticks.length - 1)] ?? 0;
}

describe('createWorkerRuntime', () => {
  it.each(['reject', 'throw', 'receive'] as const)(
    'reports an instantiation %s without leaving the request pending',
    async (failure) => {
      const runtime = createWorkerRuntime({
        buildId: BUILD_ID,
        instantiate: (module, imports) => {
          if (failure === 'throw') throw new Error('instantiate failed');
          return failure === 'reject'
            ? Promise.reject(new Error('instantiate failed'))
            : WebAssembly.instantiate(module, imports);
        },
        createModule: (options) =>
          new Promise(() => {
            options?.instantiateWasm?.({}, () => {
              throw new Error('receive failed');
            });
          }),
      });
      await runtime.handle({ type: 'init', module: EMPTY_MODULE });
      await expect(runtime.handle(compileMessage())).resolves.toEqual({
        type: 'crash',
        id: 7,
        message: failure === 'receive' ? 'Error: receive failed' : 'Error: instantiate failed',
      });
    },
  );
  it('answers init with ready and the build id', async () => {
    const runtime = createWorkerRuntime({
      createModule: fakeCc1(() => 0).factory,
      buildId: BUILD_ID,
    });
    await expect(runtime.handle({ type: 'init', module: EMPTY_MODULE })).resolves.toEqual({
      type: 'ready',
      buildId: BUILD_ID,
    });
  });

  it('crashes a compile request received before init', async () => {
    const runtime = createWorkerRuntime({
      createModule: fakeCc1(() => 0).factory,
      buildId: BUILD_ID,
    });
    await expect(runtime.handle(compileMessage())).resolves.toMatchObject({
      type: 'crash',
      id: 7,
      message: expect.stringMatching(/not initialized/) as string,
    });
  });

  it('runs a fresh compiler instance per request with the retained module', async () => {
    const asm = new TextEncoder().encode('\t.text\r\n');
    const fake = fakeCc1((argv, fs, opts) => {
      opts.print?.('pass banner');
      opts.printErr?.("rations.c: In function `otacon':");
      opts.printErr?.('rations.c:1: warning: something');
      expect(argv).toEqual(['-quiet', '-G', '8', '-O2', 'rations.i', '-o', 'out.s']);
      fs.files.set('/work/out.s', asm);
      return 0;
    });
    const instantiate = vi.fn((module: WebAssembly.Module, imports: WebAssembly.Imports) =>
      WebAssembly.instantiate(module, imports),
    );
    const runtime = createWorkerRuntime({
      createModule: fake.factory,
      buildId: BUILD_ID,
      now: clock(0, 15, 155),
      instantiate,
    });
    await runtime.handle({ type: 'init', module: EMPTY_MODULE });

    const reply = await runtime.handle(compileMessage());
    expect(reply).toEqual({
      type: 'result',
      id: 7,
      exitCode: 0,
      asm,
      stdout: 'pass banner\n',
      stderr: "rations.c: In function `otacon':\nrations.c:1: warning: something\n",
      timings: { instantiateMs: 15, compileMs: 140, totalMs: 155 },
    });

    // Filesystem layout and environment.
    expect(fake.fs.dirs).toEqual(['/work']);
    expect(fake.fs.cwd).toBe('/work');
    expect(fake.fs.files.get('/work/rations.i')).toEqual(compileMessage().source);
    const opts = fake.options[0];
    expect(opts).toBeDefined();
    const env: Record<string, string> = {};
    opts?.preRun?.[0]?.({ ENV: env } as unknown as Cc1Module);
    expect(env['TMPDIR']).toBe('/tmp');

    // instantiateWasm hands the retained module to the injected instantiate().
    const receive = vi.fn();
    const ret = opts?.instantiateWasm?.({}, receive);
    expect(ret).toEqual({});
    await vi.waitFor(() => {
      expect(receive).toHaveBeenCalledTimes(1);
    });
    expect(instantiate).toHaveBeenCalledWith(EMPTY_MODULE, {});
    expect(receive.mock.calls[0]?.[1]).toBe(EMPTY_MODULE);

    // A second compile creates a second instance.
    await runtime.handle(compileMessage({ id: 8 }));
    expect(fake.instances).toBe(2);
  });

  it('reports a compiler failure without output', async () => {
    const fake = fakeCc1((_argv, _fs, opts) => {
      opts.printErr?.("hound.i:1: parse error before `{'");
      return 1;
    });
    const runtime = createWorkerRuntime({ createModule: fake.factory, buildId: BUILD_ID });
    await runtime.handle({ type: 'init', module: EMPTY_MODULE });
    const reply = await runtime.handle(compileMessage({ filename: 'hound.i' }));
    expect(reply).toMatchObject({
      type: 'result',
      id: 7,
      exitCode: 1,
      stderr: "hound.i:1: parse error before `{'\n",
    });
    expect(reply).not.toHaveProperty('asm');
  });

  it('keeps partial output on failure', async () => {
    const partial = new Uint8Array([0x41]);
    const fake = fakeCc1((_argv, fs) => {
      fs.files.set('/work/out.s', partial);
      return 1;
    });
    const runtime = createWorkerRuntime({ createModule: fake.factory, buildId: BUILD_ID });
    await runtime.handle({ type: 'init', module: EMPTY_MODULE });
    await expect(runtime.handle(compileMessage())).resolves.toMatchObject({
      exitCode: 1,
      asm: partial,
    });
  });

  it('treats exit 0 without an output file as a crash', async () => {
    const runtime = createWorkerRuntime({
      createModule: fakeCc1(() => 0).factory,
      buildId: BUILD_ID,
    });
    await runtime.handle({ type: 'init', module: EMPTY_MODULE });
    await expect(runtime.handle(compileMessage())).resolves.toEqual({
      type: 'crash',
      id: 7,
      message: expect.stringMatching(/exited 0 without output/) as string,
    });
  });

  it('reports a wasm trap as a crash', async () => {
    const fake = fakeCc1(() => {
      throw new WebAssembly.RuntimeError('null function or function signature mismatch');
    });
    const runtime = createWorkerRuntime({ createModule: fake.factory, buildId: BUILD_ID });
    await runtime.handle({ type: 'init', module: EMPTY_MODULE });
    await expect(runtime.handle(compileMessage())).resolves.toEqual({
      type: 'crash',
      id: 7,
      message: 'RuntimeError: null function or function signature mismatch',
    });
  });

  it('reports a factory failure as a crash, including non-Error throwables', async () => {
    const failing: Cc1Factory = () => Promise.reject(new Error('instantiate failed'));
    const runtime = createWorkerRuntime({ createModule: failing, buildId: BUILD_ID });
    await runtime.handle({ type: 'init', module: EMPTY_MODULE });
    await expect(runtime.handle(compileMessage())).resolves.toEqual({
      type: 'crash',
      id: 7,
      message: 'Error: instantiate failed',
    });

    // Non-Error rejection values must still be reported.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    const weird: Cc1Factory = () => Promise.reject('codec static');
    const runtime2 = createWorkerRuntime({ createModule: weird, buildId: BUILD_ID });
    await runtime2.handle({ type: 'init', module: EMPTY_MODULE });
    await expect(runtime2.handle(compileMessage())).resolves.toEqual({
      type: 'crash',
      id: 7,
      message: 'codec static',
    });
  });

  it('crashes on malformed messages without an id', async () => {
    const runtime = createWorkerRuntime({
      createModule: fakeCc1(() => 0).factory,
      buildId: BUILD_ID,
    });
    const reply = await runtime.handle({ type: 'dance' });
    expect(reply).toMatchObject({
      type: 'crash',
      message: expect.stringMatching(/unexpected message/) as string,
    });
    expect(reply).not.toHaveProperty('id');
    await expect(runtime.handle(null)).resolves.toMatchObject({ type: 'crash' });
  });

  it('uses performance.now and WebAssembly.instantiate by default', async () => {
    const fake = fakeCc1((_argv, fs) => {
      fs.files.set('/work/out.s', new Uint8Array([1]));
      return 0;
    });
    const runtime = createWorkerRuntime({ createModule: fake.factory, buildId: BUILD_ID });
    await runtime.handle({ type: 'init', module: EMPTY_MODULE });
    const reply = await runtime.handle(compileMessage());
    expect(reply).toMatchObject({ type: 'result', exitCode: 0 });
    if (reply.type !== 'result') throw new Error('unreachable');
    expect(reply.timings.totalMs).toBeGreaterThanOrEqual(0);
    const receive = vi.fn();
    fake.options[0]?.instantiateWasm?.({}, receive);
    await vi.waitFor(() => {
      expect(receive).toHaveBeenCalledTimes(1);
    });
    expect(receive.mock.calls[0]?.[0]).toBeInstanceOf(WebAssembly.Instance);
  });
});
