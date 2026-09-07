# psyq-wasm

The PsyQ 4.4 `cc1psx` compiler (GCC 2.8.1, `mips-psx`) as WebAssembly, for
PlayStation 1 matching-decompilation tools that run entirely in the browser or
in Node.js.

Given the same preprocessed C bytes, filename, flags, and `-G` setting, the
output is byte-for-byte identical to the reference PsyQ 4.4 compiler. That is
the contract, and the differential test suite enforces it on every build.

```text
preprocessed C bytes  →  cc1psx.wasm (in a worker)  →  exact PsyQ assembly bytes
```

The package does not assemble, link, emulate, or score matches. It compiles.

## Install

```sh
npm install psyq-wasm
```

Node.js 20 or later on Linux, macOS, and Windows; current Chrome, Firefox, and Safari. No
`SharedArrayBuffer`, threads, or cross-origin isolation required, so it works
from plain static hosting.

## Usage

```ts
import { createCompiler } from 'psyq-wasm';

const compiler = await createCompiler();

const result = await compiler.compilePreprocessed(preprocessedBytes, {
  gpSize: 8, // -G 8 or -G 0; required, never guessed
  filename: 'rations.i', // logical input name (optional, default "input.i")
  rawFlags: ['-O2', '-g0', '-Wall'], // any other cc1psx switches
});

if (result.success) {
  result.asm; // Uint8Array: exact compiler output (CRLF line endings)
  result.text; // string:     same content with LF line endings, for display
} else {
  result.exitCode; // non-zero compiler exit status
  result.diagnostics; // [{ severity, file, line, message }, ...]
}

compiler.dispose();
```

Node `Buffer` inputs are accepted directly. The compiler snapshots input bytes
when a request is submitted; it never detaches the caller's buffer, and later
caller mutations do not change queued compilation input.

The same code runs in Node.js; the `node` export condition selects an entry
that uses `worker_threads`:

```js
import { readFile } from 'node:fs/promises';
import { createCompiler } from 'psyq-wasm';

const compiler = await createCompiler();
const source = new Uint8Array(await readFile('rations.i'));
const { asm } = await compiler.compilePreprocessed(source, { gpSize: 8, rawFlags: ['-O2', '-g0'] });
```

### Cancellation and timeouts

```ts
const controller = new AbortController();
const pending = compiler.compilePreprocessed(source, { gpSize: 0, signal: controller.signal });
controller.abort(); // rejects with an AbortError (or the signal's reason)

await compiler.compilePreprocessed(source, { gpSize: 0, timeoutMs: 2000 }); // rejects with CompileTimeoutError
```

An in-flight compile cannot be interrupted inside the compiler, so cancelling
or timing out terminates the worker. A replacement is started from the
already-compiled `WebAssembly.Module` without another network fetch, and queued
requests continue on it.

## The exact-input contract

`compilePreprocessed()` performs no preprocessing, no encoding conversion, and
no line-ending normalization. The output is a function of:

| Input          | Where it comes from                                                                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| source bytes   | your `Uint8Array`, written unchanged to the compiler's virtual filesystem                                                                                        |
| `gpSize`       | `-G 0` or `-G 8`                                                                                                                                                 |
| `rawFlags`     | passed through in order; typical PsyQ builds use `-O2 -g0 -Wall` or `-O2 -g -Wall`                                                                               |
| `filename`     | the input path; it shows up in `.file` directives and diagnostics only when the source has no `# 1 "name.c"` line marker (preprocessed files normally carry one) |
| compiler build | `compiler.info.buildId`, an opaque id of the exact artifact; record it with saved results                                                                        |

The wrapper owns `-quiet`, `-G`, the input path, and `-o`. Passing any of them
(or `-version`, `-aux-info`, `-dumpbase`) in `rawFlags` throws
`InvalidOptionsError`; nothing is silently ignored.

### Line endings

The PsyQ compiler emits assembly with CRLF line endings. `asm` preserves them,
because assemblers and diff tools that compare against original build output
need the exact bytes. `text` is a convenience view with LF endings; do not use
it for fidelity checks.

## API

```ts
createCompiler(options?: CreateCompilerOptions): Promise<Compiler>

interface CreateCompilerOptions {
  workerUrl?: string | URL; // default: package-relative dist/worker.js (or worker.node.js)
  wasmUrl?: string | URL;   // default: package-relative dist/cc1psx.wasm
  limits?: Partial<CompilerLimits>;
}

interface Compiler {
  readonly info: { psyqVersion: '4.4'; gccVersion: '2.8.1'; buildId: string };
  compilePreprocessed(source: Uint8Array, options: CompilePreprocessedOptions): Promise<CompileResult>;
  dispose(): void;
}
```

`compileSource()` (raw C with preprocessing) is not part of this release and is
deliberately absent rather than stubbed.

### Errors

Compiler-reported failures (syntax errors and the like) are not exceptions:
they resolve to a `CompileResult` with `success: false`. The promise rejects
only for these:

| Error                   | `code`            | Meaning                                                          |
| ----------------------- | ----------------- | ---------------------------------------------------------------- |
| `InvalidOptionsError`   | `invalid-options` | bad `gpSize`, filename, flags, limits, or source over the limit  |
| `CompileTimeoutError`   | `timeout`         | `timeoutMs` elapsed; the worker was replaced                     |
| `AbortError` (DOM)      |                   | your `AbortSignal` fired (or its `reason` is thrown instead)     |
| `WorkerCrashError`      | `worker-crash`    | the worker died or the compiler trapped; the worker was replaced |
| `CompilerDisposedError` | `disposed`        | `dispose()` was called                                           |
| `InternalError`         | `internal`        | asset failed to load, protocol violation, worker never came up   |

All library errors extend `PsyqWasmError`; `isAbortError()` recognises abort
rejections.

### Limits

| Limit              | Default | Where                                              |
| ------------------ | ------- | -------------------------------------------------- |
| `maxSourceBytes`   | 4 MiB   | `createCompiler({ limits })`                       |
| `defaultTimeoutMs` | 20 000  | `createCompiler({ limits })`, per-call `timeoutMs` |
| `initTimeoutMs`    | 10 000  | `createCompiler({ limits })`                       |

All timeout values must be integers from 1 through 2,147,483,647 milliseconds.
Larger values reject with `InvalidOptionsError` instead of overflowing host timers.

## Hosting and bundlers

- Serve `.wasm` as `application/wasm`.
- The default asset URLs are resolved relative to the installed package with
  `import.meta.url`, and the worker is created with the literal
  `new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })`
  form, so Vite bundles it without configuration (the package smoke test
  builds a Vite app). Other setups can pass `workerUrl` and `wasmUrl`.
- Nothing is fetched after start-up, and no data leaves the page. The library
  contains no telemetry.

## Demo

```sh
npm run build   # needs Docker for the compiler build
npm run serve   # then open http://127.0.0.1:4173/demo/
```

## Fidelity and provenance

`cc1psx.wasm` is built from a pinned revision of
[homebrew-psyq](https://github.com/nocato/homebrew-psyq) (the reconstructed
PsyQ 4.4 compiler sources) with a pinned Emscripten image, using the generated
sources of the historical GCC build so that no modern `bison` or `gperf` is
involved. The differential oracle is a native i386 build of the same sources in
a pinned 1999 Debian container. `PROVENANCE.md` records every input; each
release ships the artifact hashes and the corresponding source archive.

Two compatibility changes exist, neither touching code generation: a six-macro
`obstack.h` patch for a construct Clang rejects, and Emscripten's
function-pointer-cast emulation for GCC 2.8.1's K&R-style callbacks.

## License

Original code (the TypeScript wrapper, build scripts, tests, fixtures, docs) is
MIT. The compiler artifact and the generated GCC sources are GPL-2.0-only,
being derived from GCC. See `LICENSE` for the file-level split and
`PROVENANCE.md` for the corresponding source. No proprietary Sony binaries are
included.
