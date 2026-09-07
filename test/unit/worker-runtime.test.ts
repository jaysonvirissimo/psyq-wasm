// SPDX-License-Identifier: MIT
import { describe, expect, it, vi } from 'vitest';
import type { Cc1Factory, Cc1Module, Cc1ModuleOptions } from '../../src/cc1psx.js';
import type { CompileMessage, SourceMessage } from '../../src/protocol.js';
import { createWorkerRuntime, type WorkerRuntimeDeps } from '../../src/worker-runtime.js';

const EMPTY_MODULE = new WebAssembly.Module(
  new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
);
const CCCP_MODULE = new WebAssembly.Module(
  new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
);
const BUILD_ID = 'sha256:0123456789abcdef';
const CCCP_BUILD_ID = 'sha256:fedcba9876543210';
const MODULES = { cc1: EMPTY_MODULE, cccp: CCCP_MODULE };
const INIT = { type: 'init', modules: MODULES };
const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

interface FakeFs {
  files: Map<string, Uint8Array>;
  dirs: string[];
  cwd: string;
}

interface FakeProgram {
  factory: Cc1Factory;
  /** Filesystem of the most recent instance. */
  fs: FakeFs;
  options: Cc1ModuleOptions[];
  instances: number;
}

/**
 * Build a fake Emscripten factory. `onMain` decides what `callMain` does; it
 * may write the output file into the fake FS, return an exit status, or throw.
 * Every instance gets its own filesystem, like a fresh Emscripten module.
 */
function fakeProgram(
  onMain: (argv: readonly string[], fs: FakeFs, opts: Cc1ModuleOptions) => number,
): FakeProgram {
  const state: FakeProgram = {
    factory: undefined as unknown as Cc1Factory,
    fs: { files: new Map(), dirs: [], cwd: '/' },
    options: [],
    instances: 0,
  };
  state.factory = (opts = {}) => {
    const fs: FakeFs = { files: new Map(), dirs: [], cwd: '/' };
    state.fs = fs;
    state.options.push(opts);
    state.instances += 1;
    const module: Cc1Module = {
      ENV: {},
      FS: {
        mkdir: (p) => {
          if (fs.dirs.includes(p)) throw new Error(`EEXIST: ${p}`);
          fs.dirs.push(p);
        },
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

function deps(
  cc1: FakeProgram | Cc1Factory,
  cccp: FakeProgram | Cc1Factory = fakeProgram(() => 0),
  extra: Partial<WorkerRuntimeDeps> = {},
): WorkerRuntimeDeps {
  return {
    cc1: { createModule: 'factory' in cc1 ? cc1.factory : cc1, buildId: BUILD_ID },
    cccp: { createModule: 'factory' in cccp ? cccp.factory : cccp, buildId: CCCP_BUILD_ID },
    ...extra,
  };
}

function compileMessage(overrides: Partial<CompileMessage> = {}): CompileMessage {
  return {
    type: 'compile',
    id: 7,
    filename: 'rations.i',
    argv: ['-quiet', '-G', '8', '-O2', 'rations.i', '-o', 'out.s'],
    source: utf8('# 1 "rations.c"\nint otacon(void) { return 1; }\n'),
    ...overrides,
  };
}

function sourceMessage(overrides: Partial<SourceMessage> = {}): SourceMessage {
  return {
    type: 'source',
    id: 9,
    filename: 'rations.c',
    cppArgv: ['-nostdinc', '-undef', '-Iinclude', 'rations.c', 'out.i'],
    headers: [
      { path: 'include/codec.h', data: utf8('#define CODEC 14085\n') },
      { path: 'include/codec/freq.h', data: utf8('#define FREQ 14085\n') },
    ],
    encoding: 'utf8',
    argv: ['-quiet', '-G', '8', '-O2', 'out.i', '-o', 'out.s'],
    source: utf8('#include <codec.h>\nint otacon(void) { return CODEC; }\n'),
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
      const failing: Cc1Factory = (options) =>
        new Promise(() => {
          options?.instantiateWasm?.({}, () => {
            throw new Error('receive failed');
          });
        });
      const runtime = createWorkerRuntime(
        deps(failing, undefined, {
          instantiate: (module, imports) => {
            if (failure === 'throw') throw new Error('instantiate failed');
            return failure === 'reject'
              ? Promise.reject(new Error('instantiate failed'))
              : WebAssembly.instantiate(module, imports);
          },
        }),
      );
      await runtime.handle(INIT);
      await expect(runtime.handle(compileMessage())).resolves.toEqual({
        type: 'crash',
        id: 7,
        message: failure === 'receive' ? 'Error: receive failed' : 'Error: instantiate failed',
      });
    },
  );

  it('answers init with ready and both build ids', async () => {
    const runtime = createWorkerRuntime(deps(fakeProgram(() => 0)));
    await expect(runtime.handle(INIT)).resolves.toEqual({
      type: 'ready',
      buildId: BUILD_ID,
      preprocessorBuildId: CCCP_BUILD_ID,
    });
  });

  it('rejects the old single-module init shape', async () => {
    const runtime = createWorkerRuntime(deps(fakeProgram(() => 0)));
    await expect(runtime.handle({ type: 'init', module: EMPTY_MODULE })).resolves.toMatchObject({
      type: 'crash',
      message: expect.stringMatching(/unexpected message/) as string,
    });
  });

  it.each([compileMessage(), sourceMessage()])(
    'crashes a $type request received before init',
    async (message) => {
      const runtime = createWorkerRuntime(deps(fakeProgram(() => 0)));
      await expect(runtime.handle(message)).resolves.toMatchObject({
        type: 'crash',
        id: message.id,
        message: expect.stringMatching(/not initialized/) as string,
      });
    },
  );

  it('runs a fresh compiler instance per request with the retained module', async () => {
    const asm = utf8('\t.text\r\n');
    const fake = fakeProgram((argv, fs, opts) => {
      opts.print?.('pass banner');
      opts.printErr?.("rations.c: In function `otacon':");
      opts.printErr?.('rations.c:1: warning: something');
      expect(argv).toEqual(['-quiet', '-G', '8', '-O2', 'rations.i', '-o', 'out.s']);
      fs.files.set('/work/out.s', asm);
      return 0;
    });
    const cccp = fakeProgram(() => 0);
    const instantiate = vi.fn((module: WebAssembly.Module, imports: WebAssembly.Imports) =>
      WebAssembly.instantiate(module, imports),
    );
    const runtime = createWorkerRuntime(deps(fake, cccp, { now: clock(0, 15, 155), instantiate }));
    await runtime.handle(INIT);

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
    expect(cccp.instances).toBe(0);

    // Filesystem layout and environment.
    expect(fake.fs.dirs).toEqual(['/work']);
    expect(fake.fs.cwd).toBe('/work');
    expect(fake.fs.files.get('/work/rations.i')).toEqual(compileMessage().source);
    const opts = fake.options[0];
    expect(opts).toBeDefined();
    expect(opts?.thisProgram).toBe('cc1psx');
    const env: Record<string, string> = {};
    opts?.preRun?.[0]?.({ ENV: env } as unknown as Cc1Module);
    expect(env['TMPDIR']).toBe('/tmp');

    // instantiateWasm hands the retained compiler module to the injected instantiate().
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
    const fake = fakeProgram((_argv, _fs, opts) => {
      opts.printErr?.("hound.i:1: parse error before `{'");
      return 1;
    });
    const runtime = createWorkerRuntime(deps(fake));
    await runtime.handle(INIT);
    const reply = await runtime.handle(compileMessage({ filename: 'hound.i' }));
    expect(reply).toMatchObject({
      type: 'result',
      id: 7,
      exitCode: 1,
      stderr: "hound.i:1: parse error before `{'\n",
    });
    expect(reply).not.toHaveProperty('asm');
    expect(reply).not.toHaveProperty('stage');
    expect(reply).not.toHaveProperty('preprocessed');
  });

  it('keeps partial output on failure', async () => {
    const partial = new Uint8Array([0x41]);
    const fake = fakeProgram((_argv, fs) => {
      fs.files.set('/work/out.s', partial);
      return 1;
    });
    const runtime = createWorkerRuntime(deps(fake));
    await runtime.handle(INIT);
    await expect(runtime.handle(compileMessage())).resolves.toMatchObject({
      exitCode: 1,
      asm: partial,
    });
  });

  it('treats exit 0 without an output file as a crash', async () => {
    const runtime = createWorkerRuntime(deps(fakeProgram(() => 0)));
    await runtime.handle(INIT);
    await expect(runtime.handle(compileMessage())).resolves.toEqual({
      type: 'crash',
      id: 7,
      message: expect.stringMatching(/compiler exited 0 without output/) as string,
    });
  });

  it('reports a wasm trap as a crash', async () => {
    const fake = fakeProgram(() => {
      throw new WebAssembly.RuntimeError('null function or function signature mismatch');
    });
    const runtime = createWorkerRuntime(deps(fake));
    await runtime.handle(INIT);
    await expect(runtime.handle(compileMessage())).resolves.toEqual({
      type: 'crash',
      id: 7,
      message: 'RuntimeError: null function or function signature mismatch',
    });
  });

  it('reports a factory failure as a crash, including non-Error throwables', async () => {
    const failing: Cc1Factory = () => Promise.reject(new Error('instantiate failed'));
    const runtime = createWorkerRuntime(deps(failing));
    await runtime.handle(INIT);
    await expect(runtime.handle(compileMessage())).resolves.toEqual({
      type: 'crash',
      id: 7,
      message: 'Error: instantiate failed',
    });

    // Non-Error rejection values must still be reported.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    const weird: Cc1Factory = () => Promise.reject('codec static');
    const runtime2 = createWorkerRuntime(deps(weird));
    await runtime2.handle(INIT);
    await expect(runtime2.handle(compileMessage())).resolves.toEqual({
      type: 'crash',
      id: 7,
      message: 'codec static',
    });
  });

  it('crashes on malformed messages without an id', async () => {
    const runtime = createWorkerRuntime(deps(fakeProgram(() => 0)));
    const reply = await runtime.handle({ type: 'dance' });
    expect(reply).toMatchObject({
      type: 'crash',
      message: expect.stringMatching(/unexpected message/) as string,
    });
    expect(reply).not.toHaveProperty('id');
    await expect(runtime.handle(null)).resolves.toMatchObject({ type: 'crash' });
  });

  it('uses performance.now and WebAssembly.instantiate by default', async () => {
    const fake = fakeProgram((_argv, fs) => {
      fs.files.set('/work/out.s', new Uint8Array([1]));
      return 0;
    });
    const runtime = createWorkerRuntime(deps(fake));
    await runtime.handle(INIT);
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

describe('source requests', () => {
  const preprocessedText = '# 1 "rations.c"\nint otacon(void) { return 14085; }\n';
  const asm = utf8('\t.text\r\n');

  function preprocessor(output: Uint8Array = utf8(preprocessedText), exitCode = 0): FakeProgram {
    return fakeProgram((_argv, fs, opts) => {
      opts.printErr?.('rations.c:1: warning: preprocessor says hi');
      fs.files.set('/work/out.i', output);
      return exitCode;
    });
  }

  function compiler(): FakeProgram {
    return fakeProgram((_argv, fs, opts) => {
      opts.print?.('compiler banner');
      opts.printErr?.('rations.c:2: warning: compiler says hi');
      fs.files.set('/work/out.s', asm);
      return 0;
    });
  }

  it('runs the preprocessor and then the compiler on its output', async () => {
    const cccp = preprocessor();
    const cc1 = compiler();
    const instantiate = vi.fn((module: WebAssembly.Module, imports: WebAssembly.Imports) =>
      WebAssembly.instantiate(module, imports),
    );
    const runtime = createWorkerRuntime(
      deps(cc1, cccp, { now: clock(0, 10, 25, 40, 180), instantiate }),
    );
    await runtime.handle(INIT);
    const reply = await runtime.handle(sourceMessage());
    expect(reply).toEqual({
      type: 'result',
      id: 9,
      exitCode: 0,
      asm,
      preprocessed: utf8(preprocessedText),
      stdout: 'compiler banner\n',
      stderr:
        'rations.c:1: warning: preprocessor says hi\nrations.c:2: warning: compiler says hi\n',
      timings: { instantiateMs: 25, preprocessMs: 15, compileMs: 140, totalMs: 180 },
    });
    expect(reply).not.toHaveProperty('stage');

    // The preprocessor saw the source and the headers, in their directories.
    const request = sourceMessage();
    expect(cccp.options[0]?.thisProgram).toBe('cccp');
    expect(cccp.fs.dirs).toEqual(['/work', '/work/include', '/work/include/codec']);
    expect(cccp.fs.cwd).toBe('/work');
    expect(cccp.fs.files.get('/work/rations.c')).toEqual(request.source);
    expect(cccp.fs.files.get('/work/include/codec.h')).toEqual(request.headers[0]?.data);
    expect(cccp.fs.files.get('/work/include/codec/freq.h')).toEqual(request.headers[1]?.data);
    const env: Record<string, string> = {};
    cccp.options[0]?.preRun?.[0]?.({ ENV: env } as unknown as Cc1Module);
    expect(env['TMPDIR']).toBe('/tmp');

    // The compiler saw only the preprocessed file: the exact-input contract.
    expect(cc1.options[0]?.thisProgram).toBe('cc1psx');
    expect([...cc1.fs.files.keys()].sort()).toEqual(['/work/out.i', '/work/out.s']);
    expect(cc1.fs.files.get('/work/out.i')).toEqual(utf8(preprocessedText));

    // Each program instantiates its own retained module.
    const receive = vi.fn();
    cccp.options[0]?.instantiateWasm?.({}, receive);
    cc1.options[0]?.instantiateWasm?.({}, receive);
    await vi.waitFor(() => {
      expect(receive).toHaveBeenCalledTimes(2);
    });
    expect(instantiate).toHaveBeenNthCalledWith(1, CCCP_MODULE, {});
    expect(instantiate).toHaveBeenNthCalledWith(2, EMPTY_MODULE, {});
    expect(cccp.instances).toBe(1);
    expect(cc1.instances).toBe(1);
  });

  it('re-encodes the preprocessed text as EUC-JP before compiling', async () => {
    const cccp = preprocessor(utf8('char *s = "日本語";\n'));
    const cc1 = compiler();
    const runtime = createWorkerRuntime(deps(cc1, cccp));
    await runtime.handle(INIT);
    const reply = await runtime.handle(sourceMessage({ encoding: 'eucjp' }));
    const eucjp = new Uint8Array([
      ...utf8('char *s = "'),
      0xc6,
      0xfc,
      0xcb,
      0xdc,
      0xb8,
      0xec,
      ...utf8('";\n'),
    ]);
    expect(reply).toMatchObject({ type: 'result', exitCode: 0, preprocessed: eucjp });
    expect(cc1.fs.files.get('/work/out.i')).toEqual(eucjp);
  });

  it('rejects an unmappable character without running the compiler', async () => {
    const cccp = preprocessor(utf8('int a;\n/* ¥ */\n'));
    const cc1 = compiler();
    const runtime = createWorkerRuntime(deps(cc1, cccp));
    await runtime.handle(INIT);
    await expect(runtime.handle(sourceMessage({ encoding: 'eucjp' }))).resolves.toEqual({
      type: 'reject',
      id: 9,
      code: 'encoding',
      message: expect.stringMatching(/U\+00A5 .* line 2 .*EUC-JP/) as string,
      character: '¥',
      index: 10,
    });
    expect(cc1.instances).toBe(0);
  });

  it('rejects preprocessed bytes that are not valid UTF-8 when re-encoding', async () => {
    const cccp = preprocessor(new Uint8Array([0x69, 0xff, 0x0a]));
    const cc1 = compiler();
    const runtime = createWorkerRuntime(deps(cc1, cccp));
    await runtime.handle(INIT);
    await expect(runtime.handle(sourceMessage({ encoding: 'eucjp' }))).resolves.toEqual({
      type: 'reject',
      id: 9,
      code: 'encoding',
      message: expect.stringMatching(/not valid UTF-8/) as string,
      character: '',
      index: -1,
    });
    // Without re-encoding the same bytes pass through untouched.
    await expect(runtime.handle(sourceMessage({ encoding: 'utf8' }))).resolves.toMatchObject({
      type: 'result',
      preprocessed: new Uint8Array([0x69, 0xff, 0x0a]),
    });
    expect(cc1.fs.files.get('/work/out.i')).toEqual(new Uint8Array([0x69, 0xff, 0x0a]));
  });

  it('reports a preprocessor failure with its output and skips the compiler', async () => {
    const cccp = fakeProgram((_argv, fs, opts) => {
      opts.printErr?.('rations.c:3: #error hound');
      fs.files.set('/work/out.i', utf8('# 1 "rations.c"\n'));
      return 33;
    });
    const cc1 = compiler();
    const runtime = createWorkerRuntime(deps(cc1, cccp, { now: clock(0, 10, 25, 25) }));
    await runtime.handle(INIT);
    const reply = await runtime.handle(sourceMessage());
    expect(reply).toEqual({
      type: 'result',
      id: 9,
      exitCode: 33,
      stage: 'preprocess',
      preprocessed: utf8('# 1 "rations.c"\n'),
      stdout: '',
      stderr: 'rations.c:3: #error hound\n',
      timings: { instantiateMs: 10, preprocessMs: 15, compileMs: 0, totalMs: 25 },
    });
    expect(reply).not.toHaveProperty('asm');
    expect(cc1.instances).toBe(0);
  });

  it('omits preprocessed when the failing preprocessor wrote nothing', async () => {
    const cccp = fakeProgram(() => 33);
    const runtime = createWorkerRuntime(deps(compiler(), cccp));
    await runtime.handle(INIT);
    const reply = await runtime.handle(sourceMessage());
    expect(reply).toMatchObject({ type: 'result', exitCode: 33, stage: 'preprocess' });
    expect(reply).not.toHaveProperty('preprocessed');
  });

  it('reports a compiler failure at the compile stage, keeping the preprocessed bytes', async () => {
    const cc1 = fakeProgram((_argv, fs, opts) => {
      opts.printErr?.("rations.c:2: parse error before `}'");
      fs.files.set('/work/out.s', new Uint8Array([0x41]));
      return 1;
    });
    const runtime = createWorkerRuntime(deps(cc1, preprocessor()));
    await runtime.handle(INIT);
    const reply = await runtime.handle(sourceMessage());
    expect(reply).toMatchObject({
      type: 'result',
      exitCode: 1,
      stage: 'compile',
      asm: new Uint8Array([0x41]),
      preprocessed: utf8(preprocessedText),
      stderr: "rations.c:1: warning: preprocessor says hi\nrations.c:2: parse error before `}'\n",
    });
  });

  it('reports a compile-stage failure that produced no assembly', async () => {
    const cc1 = fakeProgram((_argv, _fs, opts) => {
      opts.printErr?.('cc1psx: out of memory');
      return 1;
    });
    const runtime = createWorkerRuntime(deps(cc1, preprocessor()));
    await runtime.handle(INIT);
    const reply = await runtime.handle(sourceMessage());
    expect(reply).toMatchObject({ type: 'result', exitCode: 1, stage: 'compile' });
    expect(reply).toHaveProperty('preprocessed');
    expect(reply).not.toHaveProperty('asm');
  });

  it('treats a preprocessor exiting 0 without output as a crash', async () => {
    const runtime = createWorkerRuntime(
      deps(
        compiler(),
        fakeProgram(() => 0),
      ),
    );
    await runtime.handle(INIT);
    await expect(runtime.handle(sourceMessage())).resolves.toEqual({
      type: 'crash',
      id: 9,
      message: expect.stringMatching(/preprocessor exited 0 without output/) as string,
    });
  });

  it('treats a compiler exiting 0 without output as a crash', async () => {
    const runtime = createWorkerRuntime(
      deps(
        fakeProgram(() => 0),
        preprocessor(),
      ),
    );
    await runtime.handle(INIT);
    await expect(runtime.handle(sourceMessage())).resolves.toEqual({
      type: 'crash',
      id: 9,
      message: expect.stringMatching(/compiler exited 0 without output/) as string,
    });
  });

  it.each(['preprocessor', 'compiler'] as const)('reports a %s trap as a crash', async (which) => {
    const trap = fakeProgram(() => {
      throw new WebAssembly.RuntimeError(`${which} trapped`);
    });
    const runtime = createWorkerRuntime(
      which === 'preprocessor' ? deps(compiler(), trap) : deps(trap, preprocessor()),
    );
    await runtime.handle(INIT);
    await expect(runtime.handle(sourceMessage())).resolves.toEqual({
      type: 'crash',
      id: 9,
      message: `RuntimeError: ${which} trapped`,
    });
  });

  it('creates each header directory once', async () => {
    const cccp = preprocessor();
    const runtime = createWorkerRuntime(deps(compiler(), cccp));
    await runtime.handle(INIT);
    await runtime.handle(
      sourceMessage({
        headers: [
          { path: 'a/b/c.h', data: utf8('') },
          { path: 'a/b/d.h', data: utf8('') },
          { path: 'a/e.h', data: utf8('') },
          { path: 'top.h', data: utf8('') },
        ],
      }),
    );
    expect(cccp.fs.dirs).toEqual(['/work', '/work/a', '/work/a/b']);
    expect([...cccp.fs.files.keys()]).toEqual([
      '/work/rations.c',
      '/work/a/b/c.h',
      '/work/a/b/d.h',
      '/work/a/e.h',
      '/work/top.h',
      '/work/out.i',
    ]);
  });
});
