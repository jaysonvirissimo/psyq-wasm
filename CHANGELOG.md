# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

Compiler-build changes and fidelity fixes are listed separately from API
changes, because they can alter emitted assembly.

## [Unreleased]

### Fixed

- Snapshot Node `Buffer` inputs without aliasing or detaching caller storage.
- Prevent immediate cancellation/disposal and stale timers from disrupting queued work.
- Report worker construction, posting, and Wasm instantiation failures promptly through typed errors.
- Load Node file URLs using native filesystem handling, including Windows paths.
- Reject timeout values above 2,147,483,647 milliseconds instead of overflowing timers.

### Compiler build

- Pin Emscripten 6.0.9 by digest and use the canonical `linux/amd64` platform.
- Recompile all objects in a fresh directory and reapply compatibility patches on every build.
- Ship verifiable source exports that rebuild without Git metadata or another checkout.
- Verify fresh reference fixtures without overwriting expectations; compare source-archive rebuild hashes before publication.
- Exclude Git metadata from the historical build's source copy.

### Tests

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

[Unreleased]: https://github.com/jaysonvirissimo/psyq-wasm/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/jaysonvirissimo/psyq-wasm/releases/tag/v0.1.0
