# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

Compiler-build changes and fidelity fixes are listed separately from API
changes, because they can alter emitted assembly.

## [Unreleased]

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
