# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

Compiler-build changes and fidelity fixes are listed separately from API
changes, because they can alter emitted assembly.

## [Unreleased]

## [1.0.0] - 2026-09-07

First stable release. The public API is now covered by semantic versioning, and
that covers both layers: `compilePreprocessed()` and `compileSource()`. See the
README's Stability section for exactly what is promised.

### Fixed

- **`createCompiler` was missing from the shipped type declarations.** The
  `@internal` tag documenting the `platform` test seam applied to the whole
  declaration rather than to the parameter, and `stripInternal` therefore
  deleted `createCompiler` from `dist/index.d.ts` and `dist/index.node.d.ts`.
  The runtime export was unaffected, so JavaScript consumers worked and no test
  noticed; every TypeScript consumer would have failed to resolve the library's
  primary entry point. The seam is gone from the public signature, and two new
  guards cover it: an API-surface test that every runtime export is declared,
  and a TypeScript consumer in the packaging matrix.

### Changed

- `createCompiler()` no longer takes a second `platform` argument. It was an
  undocumented test seam; `createCompilerWith()` remains the injection point the
  tests use.
- Require Node 22 or newer (`engines.node`). Node 20 reached end of life on
  2026-04-30.

### Added

- `docs/PERFORMANCE.md`: warm-compile p50/p95 for Node, Chromium, Firefox, and
  WebKit across a size ladder, with `npm run bench` and `npm run bench:browser`
  to reproduce them. Every runtime meets the design targets; the numbers are a
  report, not a CI gate.
- Packaging matrix completed: TypeScript (`tsc --noEmit` against the shipped
  declarations), direct browser ESM with no bundler, and the demo served from a
  project subpath as GitHub Pages serves it, alongside the existing Node and
  Vite consumers.
- `scripts/assemble-site.mjs`, shared by the Pages workflow and the packaging
  test so the layout under test is the layout that ships.
- A weekly `Reference drift` workflow regenerating `build/gen` and the fixtures
  from the historical reference compiler. That check previously ran only on
  tags, so drift surfaced mid-release.
- The release gate now requires a `CHANGELOG.md` section for the version being
  tagged.

### Removed

- An unreachable worker-URL fallback in `createCompilerWith()`. TypeScript
  coverage is now 100% of statements, functions, and lines.

### Security

- npm publishing moved to trusted publishing (OIDC); no `NPM_TOKEN` secret is
  stored in the repository.

## [0.2.0] - 2026-09-07

### Added

- `compileSource()`: raw C in, exact PsyQ assembly out. The matching GCC 2.8.1
  preprocessor (`cccp`) now ships as `dist/cccp.wasm` and runs in the same worker
  before `cc1psx`. Options: `headers` (virtual include files keyed by relative
  path), `cppFlags` (defaulting to the exported `DEFAULT_CPP_FLAGS`, the PsyQ 4.4
  predefines; `-D`, `-U`, `-I`, `-W`, `-pedantic`, `-pedantic-errors`,
  `-trigraphs`, `-lang-c`, `-traditional` accepted), and `encoding`
  (`'utf8'` pass-through or `'eucjp'` re-encoding of the preprocessed text).
- `CompileResult.preprocessed` (the exact bytes handed to the compiler),
  `CompileFailure.stage` (`'preprocess'` or `'compile'`), and
  `CompileTimings.preprocessMs`.
- `CompilerInfo.preprocessorBuildId`, `CreateCompilerOptions.preprocessorWasmUrl`,
  and the `maxHeaderBytes` / `maxHeaderCount` limits.
- `encodeEucJp()` and `EncodingError` (`code: 'encoding'`): an in-tree EUC-JP
  encoder with the JIS X 0208/0212 mappings; unmappable characters reject the
  request instead of being substituted.
- Package export `psyq-wasm/cccp.wasm`.

### Fixed

- Snapshot Node `Buffer` inputs without aliasing or detaching caller storage.
- Prevent immediate cancellation/disposal and stale timers from disrupting queued work.
- Report worker construction, posting, and Wasm instantiation failures promptly through typed errors.
- Load Node file URLs using native filesystem handling, including Windows paths.
- Reject timeout values above 2,147,483,647 milliseconds instead of overflowing timers.

### Compiler build

- Build `cccp.wasm` (5 objects, `build/cccp-objs.txt`) next to `cc1psx.wasm` with the
  same flags under its own export name; commit the bison-generated `cexp.c` to
  `build/gen` and record the preprocessor artifact in `build-info.json`, `SHA256SUMS`,
  and `PROVENANCE.md`.
- Set `thisProgram` so program-level diagnostics carry `cc1psx:` / `cccp:` like the
  reference binaries.
- Pin Emscripten 6.0.9 by digest and use the canonical `linux/amd64` platform.
- Recompile all objects in a fresh directory and reapply compatibility patches on every build.
- Ship verifiable source exports that rebuild without Git metadata or another checkout.
- Verify fresh reference fixtures without overwriting expectations; compare source-archive rebuild hashes before publication.
- Exclude Git metadata from the historical build's source copy.

### Tests

- Preprocessing differential suite: every fixture `.c` must reproduce its committed
  `.i` through `cccp.wasm`, and new fixtures cover `#include` with virtual headers,
  macros, EUC-JP string literals (re-encoded after preprocessing, as the reference
  build systems do), and a `#error` failure. `build/compile-fixtures.sh` now runs in
  three stages (preprocess, transcode with Ruby, compile) with a pipeline-order check.
- Add cancellation, buffer ownership, failure propagation, timer, and archive verification regressions.
- Exercise Node 20/22/24 on Linux and Node 24 on macOS/Windows, including packed-package consumers.

## [0.1.0] - 2026-09-07

### Added

- `createCompiler()` and `compilePreprocessed()`: PsyQ 4.4 `cc1psx`
  (GCC 2.8.1, `mips-psx`) as WebAssembly, for browsers (module Web Worker) and
  Node.js (`worker_threads`).
- Byte-exact `asm` output, LF-normalized `text`, structured diagnostics, raw
  stdout/stderr, and per-compile timings.
- Cancellation via `AbortSignal`, per-request timeouts, and automatic worker
  replacement without refetching the compiler.
- Validation of caller flags: wrapper-owned switches (`-G`, `-o`, `-quiet`,
  input path) cannot be overridden.
- Reproducible compiler build from pinned sources in a pinned Emscripten
  container; provenance record and license split (MIT wrapper, GPL-2.0-only
  compiler).
- Differential test suite against the reference PsyQ 4.4 compiler.

### Compiler build

- Initial artifact: homebrew-psyq `bdee891` (GCC 2.8.1 / PsyQ 4.4), Emscripten
  6.0.9, `-O2 -flto` objects with an `-O1` link.

[Unreleased]: https://github.com/jaysonvirissimo/psyq-wasm/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/jaysonvirissimo/psyq-wasm/compare/v0.2.0...v1.0.0
[0.2.0]: https://github.com/jaysonvirissimo/psyq-wasm/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/jaysonvirissimo/psyq-wasm/releases/tag/v0.1.0
