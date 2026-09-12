# psyq-wasm

The PsyQ 4.4 `cc1psx` compiler (GCC 2.8.1, `mips-psx`) and its `cccp`
preprocessor as WebAssembly, for PlayStation 1 matching-decompilation tools
that run entirely in the browser or in Node.js.

Given the same preprocessed C bytes, filename, flags, and `-G` setting, the
output is byte-for-byte identical to the reference PsyQ 4.4 compiler. That is
the contract, and the differential test suite enforces it on every build. The
same holds one step earlier: given the same C source, headers, and
preprocessor flags, the bundled preprocessor produces the reference `.i` bytes.

```text
C source + virtual headers  →  cccp.wasm  →  (EUC-JP)  →  cc1psx.wasm  →  exact PsyQ assembly bytes
                               ▲ compileSource()                ▲ compilePreprocessed()
```

Everything runs in one worker. The package does not assemble, link, emulate,
or score matches. It preprocesses and compiles.

## Install

```sh
npm install psyq-wasm
```

Node.js 22 or later on Linux, macOS, and Windows; current Chrome, Firefox, and Safari. No
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

Raw C goes through the bundled preprocessor first:

```ts
const result = await compiler.compileSource(cSourceText, {
  gpSize: 8,
  filename: 'rations.c', // appears in line markers, .file directives, diagnostics
  rawFlags: ['-O2', '-g0', '-Wall'], // cc1psx switches, as above
  headers: {
    'codec.h': '#define CODEC_FREQ 14085\n', // #include "codec.h" from rations.c
    'psyq/include/libgte.h': libgteBytes, // #include <libgte.h> with -Ipsyq/include
  },
  cppFlags: [...DEFAULT_CPP_FLAGS, '-Ipsyq/include'], // preprocessor switches
  encoding: 'eucjp', // re-encode the preprocessed text before compiling
});

result.preprocessed; // Uint8Array: the exact bytes the compiler received
result.stage; // on failure: 'preprocess' or 'compile'
```

Node `Buffer` inputs are accepted directly.
The compiler snapshots input bytes
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

### The raw-source pipeline

`compileSource()` adds one stage in front of the exact compiler: the historical
GCC 2.8.1 `cccp`, built from the same sources. Its output is a function of:

| Input      | Where it comes from                                                                                                                                                                                                                                                           |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| source     | your string (encoded as UTF-8) or bytes, written unchanged as `filename` (default `input.c`)                                                                                                                                                                                  |
| `headers`  | virtual files written next to the source; keys are relative paths (`codec.h`, `psyq/include/libgte.h`), no `.`, `..`, or absolute paths. `#include "x.h"` resolves relative to the including file; `#include <x.h>` only searches the `-I` directories you give in `cppFlags` |
| `cppFlags` | preprocessor switches, default `DEFAULT_CPP_FLAGS` (the PsyQ 4.4 predefines: `-D__GNUC__=2 -D__OPTIMIZE__ -lang-c -Dmips … -DLANGUAGE_C`); replace the whole list to add `-D`, `-U`, `-I`, `-W`, `-pedantic`, `-pedantic-errors`, `-trigraphs`, `-lang-c`, or `-traditional`  |
| `encoding` | `'utf8'` (default) hands the preprocessor output to the compiler unchanged; `'eucjp'` re-encodes it as EUC-JP first                                                                                                                                                           |

The wrapper owns `-nostdinc`, `-undef`, and the input and output paths. Any
other preprocessor switch (`-include`, `-M`, `-P`, `-o`, …) is rejected. The
line markers in the preprocessed output name `filename`, so it decides the
`.file` directive and diagnostic locations.

Two things the historical preprocessor does that a caller should know about:
`__DATE__` and `__TIME__` expand to the current time, so a unit that uses them
is not reproducible; and a `\` followed by CRLF is not a line continuation, so
headers with DOS line endings need converting first (the library never
changes bytes it is given).

### EUC-JP

Some PlayStation build systems re-encode the preprocessed source from UTF-8 to
EUC-JP before the compiler sees it, which changes string-literal bytes and
`sizeof` results. `encoding: 'eucjp'` does the same, after preprocessing, with
an in-tree encoder using the JIS X 0208 and JIS X 0212 mappings (the ones
Ruby, Python, and iconv implement: U+301C WAVE DASH, U+2212 MINUS SIGN, and so
on; ASCII `\` and `~` stay ASCII, U+00A5 and U+203E have no mapping). A
character without a mapping rejects the request with `EncodingError`, naming
the character and its line; nothing is substituted. Because the encoding runs
after preprocessing, `#if` over a multibyte character constant sees UTF-8
bytes. The encoder is exported as `encodeEucJp()` for callers who build their
own bytes for `compilePreprocessed()`.

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
  preprocessorWasmUrl?: string | URL; // default: package-relative dist/cccp.wasm
  limits?: Partial<CompilerLimits>;
}

interface Compiler {
  readonly info: {
    psyqVersion: '4.4';
    gccVersion: '2.8.1';
    buildId: string; // the cc1psx artifact
    preprocessorBuildId: string; // the cccp artifact
  };
  compilePreprocessed(source: Uint8Array, options: CompilePreprocessedOptions): Promise<CompileResult>;
  compileSource(source: string | Uint8Array, options: CompileSourceOptions): Promise<CompileResult>;
  dispose(): void;
}

interface CompileSourceOptions extends CompilePreprocessedOptions {
  headers?: Record<string, string | Uint8Array>;
  cppFlags?: readonly string[]; // default DEFAULT_CPP_FLAGS
  encoding?: 'utf8' | 'eucjp'; // default 'utf8'
}
```

A `CompileResult` from `compileSource()` also carries `preprocessed` (the bytes
the compiler received), `timings.preprocessMs`, and, on failure, `stage`.
`rawStderr` and `diagnostics` cover both programs.

### Stability

The public API is covered by semantic versioning as of 1.0. That covers both
layers: `compilePreprocessed()`, the exact primitive, and `compileSource()`,
the raw-source pipeline with virtual headers and EUC-JP. The preprocessing
pipeline reproduces the reference `cccp` byte for byte across the whole fixture
set in Node and in all three browsers, so it carries the same promise as the
compiler itself.

Also stable: the exported error classes and their `code` values, `DEFAULT_LIMITS`,
`DEFAULT_CPP_FLAGS`, `parseDiagnostics()`, and `encodeEucJp()`.

Two things are deliberately not stable. `CompilerInfo.buildId` and
`preprocessorBuildId` are opaque strings; record them, do not parse them. And
the compiler artifact itself may change to correct a mismatch against the
reference compiler: such a change alters emitted assembly without altering the
API, so it is a fidelity fix rather than a breaking API change and is listed
separately in the changelog.

### Errors

Compiler-reported failures (syntax errors and the like) are not exceptions:
they resolve to a `CompileResult` with `success: false`. The promise rejects
only for these:

| Error                   | `code`            | Meaning                                                                  |
| ----------------------- | ----------------- | ------------------------------------------------------------------------ |
| `InvalidOptionsError`   | `invalid-options` | bad `gpSize`, filename, flags, headers, limits, or source over the limit |
| `EncodingError`         | `encoding`        | `encoding: 'eucjp'` met a character with no EUC-JP mapping               |
| `CompileTimeoutError`   | `timeout`         | `timeoutMs` elapsed; the worker was replaced                             |
| `AbortError` (DOM)      |                   | your `AbortSignal` fired (or its `reason` is thrown instead)             |
| `WorkerCrashError`      | `worker-crash`    | the worker died or the compiler trapped; the worker was replaced         |
| `CompilerDisposedError` | `disposed`        | `dispose()` was called                                                   |
| `InternalError`         | `internal`        | asset failed to load, protocol violation, worker never came up           |

All library errors extend `PsyqWasmError`; `isAbortError()` recognises abort
rejections. Each class fixes `code` to its own literal, so `code` discriminates
a union of them and reaches subclass-only fields on its own:

```ts
function describe(error: EncodingError | CompileTimeoutError): string {
  return error.code === 'encoding'
    ? `${error.character} at ${error.index}`
    : `${error.timeoutMs} ms`;
}
```

A `catch` binding is `unknown`, so start there with `instanceof`. Narrowing to
`PsyqWasmError` gives you the base class, whose `code` is the whole `ErrorCode`
union; narrowing to a subclass gives you that class's literal and its extra fields.

### Limits

| Limit              | Default | Where                                                          |
| ------------------ | ------- | -------------------------------------------------------------- |
| `maxSourceBytes`   | 4 MiB   | `createCompiler({ limits })`                                   |
| `defaultTimeoutMs` | 20 000  | `createCompiler({ limits })`, per-call `timeoutMs`             |
| `initTimeoutMs`    | 10 000  | `createCompiler({ limits })`                                   |
| `maxHeaderBytes`   | 8 MiB   | `createCompiler({ limits })`, total per `compileSource()` call |
| `maxHeaderCount`   | 512     | `createCompiler({ limits })`, per `compileSource()` call       |

All timeout values must be integers from 1 through 2,147,483,647 milliseconds.
Larger values reject with `InvalidOptionsError` instead of overflowing host timers.

## Hosting and bundlers

- Serve `.wasm` as `application/wasm`. Two are fetched at start-up, `cc1psx.wasm`
  (about 0.6 MB gzipped) and `cccp.wasm` (about 0.05 MB gzipped), each once.
- The default asset URLs are resolved relative to the installed package with
  `import.meta.url`, and the worker is created with the literal
  `new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })`
  form, so Vite bundles it without configuration (the package smoke test
  builds a Vite app). Other setups can pass `workerUrl`, `wasmUrl`, and
  `preprocessorWasmUrl`.
- Nothing is fetched after start-up, and no data leaves the page. The library
  contains no telemetry.

## Demo

```sh
npm run build   # needs Docker for the compiler build
npm run serve   # then open http://127.0.0.1:4173/demo/
```

## Fidelity and provenance

`cc1psx.wasm` and `cccp.wasm` are built from a pinned revision of
[homebrew-psyq](https://github.com/nocato/homebrew-psyq) (the reconstructed
PsyQ 4.4 compiler sources) with a pinned Emscripten image, using the generated
sources of the historical GCC build so that no modern `bison` or `gperf` is
involved. The differential oracle is a native i386 build of the same sources in
a pinned 1999 Debian container; its `cccp` produced the reference `.i` files
that the preprocessor is tested against. `PROVENANCE.md` records every input;
each release ships the artifact hashes and the corresponding source archive.

Two compatibility changes exist, neither touching code generation: a six-macro
`obstack.h` patch for a construct Clang rejects, and Emscripten's
function-pointer-cast emulation for GCC 2.8.1's K&R-style callbacks.

## License

Original code (the TypeScript wrapper, build scripts, tests, fixtures, docs) is
MIT. The compiler and preprocessor artifacts and the generated GCC sources are GPL-2.0-only,
being derived from GCC. See `LICENSE` for the file-level split and
`PROVENANCE.md` for the corresponding source. No proprietary Sony binaries are
included.
