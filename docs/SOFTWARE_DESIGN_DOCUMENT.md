# psyq-wasm — Software Design Document

> A client-side WebAssembly build of the PsyQ `cc1psx` compiler for PlayStation 1 matching-decompilation tools.

| Field               | Value                                               |
| ------------------- | --------------------------------------------------- |
| Status              | Draft                                               |
| Initial compiler    | PsyQ 4.4 / GCC 2.8.1 / `mips-psx`                   |
| Primary runtime     | Modern web browsers                                 |
| Secondary runtime   | Node.js                                             |
| Package language    | TypeScript                                          |
| Compiler language   | C, built from the existing GCC 2.8.1-derived source |
| Distribution        | npm package and release artifacts                   |
| Hosting requirement | Static hosting only; no compiler backend            |

---

## 1. Summary

`psyq-wasm` provides the PsyQ 4.4 `cc1psx` compiler as WebAssembly.

Its main purpose is to let browser applications compile preprocessed C into the same PlayStation 1 MIPS assembly produced by the reference PsyQ 4.4 compiler.

The primary correctness requirement is exact output:

> Given the same preprocessed source bytes, compiler options, source filename, and compiler build, `psyq-wasm` must emit the same assembly bytes as the reference `cc1psx`.

The compiler runs entirely on the client. Source code does not need to leave the browser.

The first public API is deliberately small:

```text
preprocessed C bytes
        │
        ▼
   cc1psx.wasm
        │
        ▼
exact PsyQ assembly bytes
```

A later API will add the PsyQ preprocessor and source-encoding pipeline so callers can provide normal C source.

`psyq-wasm` does not assemble, link, emulate a PlayStation, or score decompilation matches.

---

## 2. Problem

PlayStation 1 matching decompilation is ultimately a machine-code matching task.

A contributor reconstructs C source until the original toolchain reproduces the target code found in the retail game.

For projects built with PsyQ, `cc1psx` is an important part of that toolchain. It is Sony's modified GCC compiler for the PlayStation target.

A native reconstructed build of the PsyQ 4.4 compiler exists in [`homebrew-psyq`](https://github.com/nocato/homebrew-psyq). It can be used locally for matching work.

There is no supported browser build of that compiler.

This prevents a fully static web application from providing the following loop without a server:

```text
edit C
  ↓
compile with matching PsyQ compiler
  ↓
inspect generated MIPS
  ↓
compare with target
  ↓
edit again
```

A browser compiler is useful for:

* decompilation teaching tools;
* browser-based compiler explorers;
* matching-decompilation games;
* offline decompilation tools;
* small interactive examples;
* automated browser tests for PS1 decompilation tooling.

The compiler must preserve the behavior of the reference compiler. A modern replacement compiler is not enough.

For matching work, these are different results:

```asm
addu $v0, $a0, $a1
```

and:

```asm
addu $v1, $a0, $a1
```

even if both are functionally correct in a larger program.

---

## 3. Goals

### 3.1 Exact compiler output

For supported inputs, the WebAssembly compiler must produce assembly bytes identical to the reference PsyQ 4.4 `cc1psx`.

This is the main correctness contract.

The contract includes all compiler-visible inputs:

* preprocessed source bytes;
* source filename;
* compiler flags;
* `-G` small-data setting;
* compiler build.

Whitespace, labels, directives, line endings, and other emitted assembly text are part of the byte-level contract unless explicitly documented otherwise.

### 3.2 Fully client-side execution

Compilation must work without a backend.

After the required package assets have loaded:

* no source is uploaded;
* no compilation request is sent over the network;
* no remote compiler service is required.

The package must work from ordinary static hosting.

### 3.3 Small public API

The first stable primitive must do one job:

```text
preprocessed bytes → cc1psx → assembly bytes
```

Preprocessing and source encoding are separate layers.

This keeps the exact compiler boundary clear and makes failures easier to diagnose.

### 3.4 Browser-friendly runtime

Compilation must run in a Web Worker so compiler work does not block the page.

The package should not require:

* `SharedArrayBuffer`;
* WebAssembly threads;
* cross-origin isolation;
* special browser permissions.

### 3.5 Reusable package

The package must not depend on a particular game or UI.

It should be usable by any browser or Node application that needs PsyQ 4.4 compiler output.

### 3.6 Reproducible builds

Compiler artifacts must be built from pinned inputs.

The repository must record:

* source revisions;
* source archives where applicable;
* hashes;
* patches;
* build container;
* Emscripten version;
* relevant compiler flags.

A maintainer must be able to reproduce a release from the recorded inputs.

### 3.7 Maintainable TypeScript

The TypeScript wrapper must follow normal production-library standards.

At minimum:

* TypeScript strict mode;
* type-aware linting;
* automatic formatting;
* no unchecked use of `any`;
* no ignored compiler errors in committed code;
* unit and integration tests;
* at least 99% coverage of shipped TypeScript code;
* browser tests;
* Node tests;
* reproducible package builds;
* CI required for merges.

---

## 4. Non-goals

The first version does not provide the following.

### 4.1 Assembler

`psyq-wasm` does not ship:

* ASPSX;
* GNU `as`;
* `maspsx`.

Its output is compiler-generated `.s` text.

### 4.2 Linker

The package does not produce:

* PlayStation executables;
* linked overlays;
* final game binaries.

### 4.3 Object files

The compiler package stops before object generation.

It does not produce `.o` files.

### 4.4 Match scoring

The package does not decide whether a decompilation matches a target.

It only supplies compiler output.

### 4.5 PlayStation emulation

The package does not contain:

* a PlayStation CPU emulator;
* GPU emulation;
* BIOS support;
* CD image support;
* game execution.

### 4.6 The matching game

Curriculum, level design, scoring, UI, MGS-related content, and other game features belong in a separate downstream project.

### 4.7 Compiler rewrite

The goal is to build the existing GCC-derived `cc1psx` source for WebAssembly.

The project will not reimplement the compiler.

### 4.8 PsyQ 4.3 in the first release

The initial compiler is PsyQ 4.4 / GCC 2.8.1.

Support for other PsyQ compiler versions is separate work.

---

## 5. Output boundary

`psyq-wasm` ends at exact compiler-generated assembly.

```text
C or preprocessed C
        │
        ▼
     cc1psx
        │
        ▼
 PsyQ assembly .s
        │
        │     psyq-wasm ends here
        ▼
────────────────────────────────────────
        │
        ├──► custom assembly parser / normalizer
        │        │
        │        ▼
        │    instruction/text diff
        │
        └──► maspsx
                 │
                 ▼
             GNU mips as
                 │
                 ▼
               ELF .o
                 │
                 ▼
              objdiff
```

[`objdiff`](https://github.com/encounter/objdiff) compares relocatable object files. It does not directly compare the raw `.s` text emitted by GCC.

A downstream tool that wants to use `objdiff` must provide an object-generation stage such as:

```text
cc1psx → maspsx → GNU as → ELF object → objdiff
```

A downstream tool may instead parse or normalize the `.s` output directly and compare instruction streams without producing object files.

That choice is outside this package.

---

## 6. Compiler design

### 6.1 Source

The compiler source comes from [`homebrew-psyq`](https://github.com/nocato/homebrew-psyq), which reconstructs the PsyQ 4.4 `cc1psx` compiler from GCC 2.8.1 and the available PsyQ changes.

The build must pin the exact source revision.

The repository must not silently build against the current upstream branch.

### 6.2 Reference compiler

The differential test oracle is a 32-bit i386 Linux build of the same compiler source.

It is built in a pinned historical Linux environment.

The reference executable is used only during development and testing.

It is not shipped to browser users.

### 6.3 Why wasm32 is required

The compiler was designed for a 32-bit host data model.

The WebAssembly target must therefore remain `wasm32`.

Important properties include:

```text
sizeof(int)  = 4
sizeof(long) = 4
pointer size = 4
```

Host word size can affect old compiler code.

A future migration to `memory64` or another 64-bit host model is not an automatic upgrade. It would require a new fidelity investigation.

### 6.4 Emscripten

The compiler is built for WebAssembly with Emscripten.

The build reuses the source files generated by the historical GCC build process rather than regenerating them with modern parser-generator versions.

Examples include:

* `c-parse.c`;
* `insn-*.c`;
* generated configuration headers;
* generated tables.

This reduces differences caused by modern build tools.

### 6.5 Compatibility changes

The WebAssembly port should contain the smallest possible compatibility patch set.

The known compatibility work includes:

#### Obstack macros

Old GCC source uses lvalue-cast increment forms that modern Clang rejects.

The affected macros are rewritten to equivalent pointer operations.

The patch must be kept as a separate, reviewable file.

It must not change compiler code-generation logic.

#### Function-pointer casts

GCC 2.8.1 contains old K&R-style callback patterns where function-pointer types do not always match the effective call signature.

WebAssembly checks indirect-call signatures more strictly than native C environments.

The Emscripten build uses its function-pointer-cast compatibility mode rather than rewriting compiler callbacks throughout the source tree.

Any future removal of that compatibility mode requires full differential testing.

---

## 7. Build architecture

### 7.1 Build-time flow

```text
Pinned historical Linux container
        │
        ├── build reference cc1psx
        ├── build historical preprocessor
        └── generate GCC build-time source files
                     │
                     ▼
              generated source set
                     │
                     ▼
               Emscripten
                     │
                     ▼
              cc1psx.wasm
```

The historical container is used for:

* the reference compiler;
* generated GCC source files;
* generated tables;
* historical build configuration.

Emscripten compiles the resulting source set to wasm32.

### 7.2 Build inputs

The following must be pinned:

* historical container image digest;
* `homebrew-psyq` revision;
* GCC source archive or revision;
* PsyQ-specific source or patch revision;
* Emscripten version;
* build scripts;
* local compatibility patches.

The release process must record the values in `PROVENANCE.md`.

### 7.3 Compiler flags

The build should use conservative flags suitable for old C source.

The expected baseline includes:

```text
-O2
-flto
-std=gnu89
-fno-strict-aliasing
-fwrapv
-DCROSS_COMPILE
-DIN_GCC
-DHAVE_CONFIG_H
```

The exact release flags are part of the reproducible-build record.

Changing compiler-build flags requires running the full differential test suite.

### 7.4 Emscripten link model

The WebAssembly module should use:

* modularized output;
* filesystem support;
* browser, worker, and Node environments;
* memory growth where required;
* the function-pointer compatibility setting required by GCC 2.8.1.

Exact Emscripten settings must be pinned in the build scripts, not copied manually from documentation during release builds.

---

## 8. Runtime architecture

### 8.1 Main-thread controller

The main thread owns the long-lived `WebAssembly.Module`.

Initialization is:

```text
fetch .wasm once
      │
      ▼
WebAssembly.compile(...)
      │
      ▼
retain WebAssembly.Module
```

The compiled module remains owned by the controller.

This is important because workers may be terminated after cancellation, timeout, or compiler failure.

### 8.2 Worker

Compiler execution takes place in a dedicated Web Worker.

The controller sends the compiled `WebAssembly.Module` to the worker.

The worker creates a fresh Emscripten instance for each compilation.

```text
main thread
    │
    │ WebAssembly.Module
    ▼
worker
    │
    ├── fresh Emscripten instance
    ├── write input to MEMFS
    ├── run cc1psx
    ├── read assembly
    └── return result
```

The compiler instance is not reused.

GCC 2.8.1 has global mutable state and is not designed as a re-entrant library.

### 8.3 Virtual filesystem

The compiler uses Emscripten's in-memory filesystem.

A typical invocation uses paths such as:

```text
/work/input.i
/work/output.s
/tmp/
```

The worker does not expose the user's real filesystem to the compiler.

### 8.4 No network access during compilation

Compiler execution must not require network access.

The compiler receives:

* source bytes;
* options;
* virtual files.

It produces:

* assembly;
* diagnostics;
* status information.

The library itself must not include telemetry.

---

## 9. Cancellation and timeouts

Compiler execution is synchronous inside the worker.

A worker cannot reliably process a cancellation message while `cc1psx` is actively running.

For that reason, an in-flight cancellation is implemented by terminating the worker.

```text
main thread                         worker
    │                                │
    │ compile request                │
    ├───────────────────────────────►│
    │                                │ cc1psx running
    │                                │
    │ AbortSignal / timeout          │
    ├──── terminate worker ─────────►X
    │
    ├── create replacement worker
    │
    └── send retained WebAssembly.Module
```

Requests that have not started can be removed from the queue without terminating the worker.

### 9.1 Failure classes

The API must distinguish at least:

* compiler-reported failure;
* caller cancellation;
* timeout;
* worker crash;
* library/internal failure.

A syntax error in C is not the same kind of failure as a dead worker.

### 9.2 Abort behavior

An aborted request rejects with an `AbortError`-compatible error.

### 9.3 Timeout behavior

A timed-out request rejects with a distinct timeout error.

The package should define and export its timeout error type.

### 9.4 Resource limits

The package must enforce reasonable limits for:

* source size;
* total virtual-header size;
* number of virtual files;
* compile duration.

The initial limits should be selected from representative real inputs before the first public release.

Limits should be documented and configurable where appropriate.

---

## 10. Public TypeScript API

The API has two layers.

### 10.1 Exact layer

`compilePreprocessed()` is the main fidelity boundary.

It accepts exact source bytes and does not:

* preprocess;
* change source encoding;
* normalize line endings;
* guess `-G`.

### 10.2 Convenience layer

`compileSource()` is added later.

It provides:

* preprocessing;
* virtual headers;
* source encoding;
* the exact compiler stage.

---

### 10.3 Types

```ts
export interface CompilerInfo {
  psyqVersion: "4.4";
  gccVersion: "2.8.1";

  /**
   * Opaque identifier for the exact compiler artifact.
   * Include this in bug reports and saved compilation records.
   */
  buildId: string;
}

export interface CompilerDiagnostic {
  severity: "error" | "warning";
  file?: string;
  line?: number;
  column?: number;
  message: string;
}

export interface CompileTimings {
  instantiateMs: number;
  compileMs: number;
  totalMs: number;
}

export interface CompileSuccess {
  success: true;
  exitCode: 0;

  /**
   * Exact compiler output bytes.
   * No newline normalization is applied.
   */
  asm: Uint8Array;

  /**
   * Convenience string representation.
   * Line endings may be normalized to LF.
   * Do not use this field for byte-level fidelity checks.
   */
  text: string;

  diagnostics: CompilerDiagnostic[];
  rawStdout: string;
  rawStderr: string;

  compiler: CompilerInfo;
  timings: CompileTimings;
}

export interface CompileFailure {
  success: false;
  exitCode: number;

  /**
   * Partial output, if cc1psx produced any before failing.
   */
  asm?: Uint8Array;
  text?: string;

  diagnostics: CompilerDiagnostic[];
  rawStdout: string;
  rawStderr: string;

  compiler: CompilerInfo;
  timings: CompileTimings;
}

export type CompileResult = CompileSuccess | CompileFailure;
```

---

### 10.4 Preprocessed compiler options

```ts
export interface CompilePreprocessedOptions {
  /**
   * PsyQ small-data threshold.
   *
   * Required. The library must not guess this value.
   */
  gpSize: 0 | 8;

  /**
   * Logical source filename passed to the compiler.
   *
   * The filename is part of the exact compiler input because it can affect
   * emitted assembly text and diagnostics.
   */
  filename?: string;

  /**
   * Additional cc1psx switches not represented by typed options.
   *
   * Flags owned by this wrapper, including -G and output/input paths,
   * must not be supplied here.
   */
  rawFlags?: readonly string[];

  /**
   * Cancel the request.
   */
  signal?: AbortSignal;

  /**
   * Maximum compile time.
   */
  timeoutMs?: number;
}
```

The library validates `rawFlags`.

It must reject options that conflict with wrapper-owned arguments.

At minimum, callers must not override:

* `-G`;
* compiler input path;
* compiler output path;
* options that would prevent the wrapper from capturing output correctly.

A rejected option is a caller error and must not be silently ignored.

---

### 10.5 Source compiler options

```ts
export interface CompileSourceOptions
  extends CompilePreprocessedOptions {

  /**
   * Virtual include files.
   *
   * Keys are virtual paths.
   */
  headers?: Readonly<Record<string, string | Uint8Array>>;

  /**
   * Source encoding policy used by the convenience pipeline.
   */
  encoding?: "eucjp" | "utf8" | "raw";
}
```

---

### 10.6 Compiler interface

```ts
export interface Compiler {
  readonly info: CompilerInfo;

  compilePreprocessed(
    source: Uint8Array,
    options: CompilePreprocessedOptions
  ): Promise<CompileResult>;

  compileSource(
    source: string | Uint8Array,
    options: CompileSourceOptions
  ): Promise<CompileResult>;

  dispose(): void;
}
```

`compileSource()` may be absent from early `0.x` releases until the preprocessor and encoding pipeline are complete.

If so, it should not be included as a stub that always throws.

The exported type surface should describe what the published version actually supports.

---

### 10.7 Compiler creation

```ts
export interface CreateCompilerOptions {
  workerUrl?: string;
  wasmUrl?: string;
}

export function createCompiler(
  options?: CreateCompilerOptions
): Promise<Compiler>;
```

By default, package assets resolve relative to the installed package using `import.meta.url`.

Consumers may override the URLs for custom hosting or bundler setups.

---

## 11. Exact-input contract

For `compilePreprocessed()`, the exact-output contract is defined by the tuple:

```text
(
  compiler build,
  source bytes,
  source filename,
  gpSize,
  compiler flags
)
```

If all members of that tuple match the reference invocation, the emitted assembly bytes must match the reference output.

This is more precise than saying only:

> "same C produces same assembly."

The compiler can observe more than the C language semantics.

---

## 12. Preprocessing and source encoding

Preprocessing is intentionally separate from the exact compiler primitive.

### 12.1 Preprocessor

The convenience layer will use the matching GCC preprocessor from the same historical toolchain.

The browser build will provide it as a separate WebAssembly component.

```text
raw C
  │
  ▼
cccp
  │
  ▼
preprocessed source
  │
  ▼
encoding stage
  │
  ▼
compilePreprocessed()
```

### 12.2 EUC-JP

Some PlayStation source pipelines use EUC-JP before the compiler stage.

The browser platform does not provide a standard EUC-JP `TextEncoder`.

The project must therefore choose an implementation.

The selected encoder must have:

* deterministic output;
* documented behavior for unmappable characters;
* a compatible license;
* tests against known byte sequences;
* a measured payload cost.

`compilePreprocessed()` performs no encoding.

If exact EUC-JP bytes are required, callers can supply those bytes directly even before `compileSource()` exists.

### 12.3 Pipeline-order tests

The project must test where encoding occurs relative to preprocessing.

The convenience API is not considered fidelity-complete until its output has been compared with the reference preprocessing and compilation pipeline.

---

## 13. TypeScript engineering standards

The TypeScript code is a public library and should be maintained as production infrastructure.

### 13.1 TypeScript configuration

The project must use current stable TypeScript and enable strict checking.

Expected settings include:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "useUnknownInCatchVariables": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "verbatimModuleSyntax": true
  }
}
```

Exact settings may change as TypeScript evolves, but weakening type checks requires a documented reason.

### 13.2 `any`

Committed library code should not use implicit `any`.

Explicit `any` should be rare and limited to boundaries where an external API cannot be described more accurately.

Prefer:

* `unknown`;
* type guards;
* discriminated unions;
* narrow wrapper types.

### 13.3 Linting

Use ESLint with the official TypeScript ESLint tooling.

Linting should use type-aware rules where useful.

CI must fail on lint errors.

A lint disable must:

* be local;
* include a reason when the reason is not obvious;
* not disable a rule for the whole project merely to avoid fixing a small number of violations.

### 13.4 Formatting

Use Prettier for committed TypeScript, JavaScript, JSON, Markdown, and other supported text formats.

Formatting must be automatic.

CI must verify formatting.

Formatting rules should not also be duplicated in ESLint unless required for correctness.

### 13.5 Type checking

CI must run:

```text
tsc --noEmit
```

or the equivalent package command.

A successful bundle is not a replacement for TypeScript type checking.

### 13.6 Imports and package boundaries

Use ESM.

Avoid hidden global state in the TypeScript wrapper.

Internal modules should have narrow responsibilities.

Public exports should come from a small documented package entry point.

### 13.7 Dependency policy

Runtime dependencies should be kept small.

Before adding a runtime dependency, consider:

* payload size;
* browser compatibility;
* maintenance status;
* license;
* whether the required code is small enough to implement safely in-tree.

Development dependencies may be broader when they improve testing or code quality.

The dependency lockfile must be committed.

Automated dependency updates may use Renovate or Dependabot.

---

## 14. Test standards

Compiler fidelity and TypeScript code quality are different concerns. Both need tests.

### 14.1 TypeScript coverage

Shipped TypeScript code must maintain at least:

```text
99% statements
99% branches
99% functions
99% lines
```

Coverage should be measured with a standard TypeScript/JavaScript test runner and V8 coverage, such as Vitest with `@vitest/coverage-v8`.

Coverage exclusions must be small and documented.

Generated Emscripten glue code and generated compiler artifacts are not included in TypeScript coverage calculations.

The 99% requirement applies to code maintained by this project.

### 14.2 Critical modules

The following should normally reach 100% practical coverage:

* option validation;
* diagnostics parsing;
* worker protocol;
* cancellation mapping;
* timeout mapping;
* compile-result construction;
* package URL resolution;
* command-line construction.

High coverage is not a substitute for meaningful assertions.

Tests should check behavior, not only execute lines.

### 14.3 Differential compiler tests

Compiler correctness is tested by differential comparison.

For each fixture:

```text
same preprocessed bytes
same filename
same flags
same -G setting
        │
        ├──► reference cc1psx ──► expected .s
        │
        └──► wasm cc1psx ───────► actual .s

expected bytes == actual bytes
```

A single differing byte fails the test.

### 14.4 Generic compiler fixtures

The public repository should contain original test inputs covering at least:

* integer arithmetic;
* signed arithmetic;
* unsigned arithmetic;
* shifts;
* multiplication;
* division;
* branches;
* loops;
* switch statements;
* pointer loads and stores;
* byte loads;
* halfword loads;
* word loads;
* signed and unsigned loads;
* arrays;
* structures;
* structure copies;
* function calls;
* register pressure;
* stack spills;
* large frames;
* narrowing conversions;
* signed and unsigned comparisons;
* floating-point constants where supported by the compiler;
* `-G 0`;
* `-G 8`;
* representative GTE-related C patterns.

Fixtures must be original or otherwise clearly licensed for redistribution.

### 14.5 Regression tests from real projects

A maintainer may use external decompilation projects as local regression oracles.

For example, a maintainer-run test may compile inputs from:

* [`mgs_reversing`](https://github.com/FoxdieTeam/mgs_reversing);
* a separately obtained PsyQ SDK tree.

These tests must:

* pin exact revisions;
* not vendor unlicensed project or SDK content into this repository;
* not run automatically in public CI until redistribution and automated-fetch implications are understood.

The public CI suite must not depend on proprietary source material.

### 14.6 Browser tests

Use Playwright or an equivalent maintained browser-testing tool.

At minimum, test against:

* Chromium;
* Firefox;
* WebKit.

Browser tests must cover:

* compiler initialization;
* successful compilation;
* compiler error;
* timeout;
* cancellation;
* worker restart;
* second compilation after worker restart;
* package-relative asset loading.

### 14.7 Node tests

CI must exercise the same distributed `.wasm` artifact through the Node entry point.

A native compiler must not stand in for the distributed WebAssembly compiler in these tests.

### 14.8 Property tests

Property-based tests are appropriate for pure wrapper logic such as:

* flag validation;
* worker request IDs;
* diagnostics parser edge cases;
* virtual-path validation.

A library such as `fast-check` may be used if it provides enough value to justify the development dependency.

### 14.9 Regression policy

Every fixed bug should gain a regression test unless a test is technically impractical.

If a regression test cannot be added, the pull request should explain why.

---

## 15. Continuous integration

Every pull request must pass CI before merge.

The required CI pipeline should include:

```text
install dependencies
        │
        ├── format check
        ├── ESLint
        ├── TypeScript type check
        ├── unit tests
        ├── >=99% coverage gate
        ├── build wasm
        ├── generic differential compiler tests
        ├── Node test against built/dist wasm
        ├── package build
        ├── npm package smoke test
        └── browser smoke/integration tests
```

### 15.1 Package smoke test

CI should run `npm pack` or the package-manager equivalent and test the resulting tarball.

Tests should install the packed artifact into a small fixture application.

This catches failures caused by:

* missing `.wasm` files;
* missing worker files;
* bad package exports;
* incorrect `files` configuration;
* incorrect package-relative URLs.

### 15.2 Branch protection

The main branch should require:

* successful CI;
* review;
* no unresolved conversations.

Direct unreviewed pushes should be avoided for normal development.

### 15.3 Release CI

Releases should be created by CI from a tagged revision.

The release job should verify:

* clean build;
* all required tests;
* artifact hashes;
* source archive;
* license/provenance files;
* npm package contents.

Where supported, npm releases should use trusted publishing and npm provenance rather than long-lived repository secrets.

---

## 16. Repository layout

A proposed layout is:

```text
psyq-wasm/
├── src/
│   ├── index.ts
│   ├── compiler.ts
│   ├── controller.ts
│   ├── worker.ts
│   ├── protocol.ts
│   ├── options.ts
│   ├── diagnostics.ts
│   └── errors.ts
│
├── build/
│   ├── build-reference.sh
│   ├── build-wasm.sh
│   ├── Dockerfile.slink
│   └── patches/
│       └── obstack.h.diff
│
├── dist/
│   ├── cc1psx.wasm
│   ├── cc1psx.js
│   └── worker.js
│
├── test/
│   ├── fixtures/
│   ├── unit/
│   ├── differential/
│   ├── browser/
│   └── package/
│
├── scripts/
│   └── regression-mgs.*
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
│
├── PROVENANCE.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── SECURITY.md
├── README.md
├── LICENSES/
├── package.json
├── tsconfig.json
├── eslint.config.js
├── prettier.config.js
└── lockfile
```

The final layout may differ, but the following concerns should remain separate:

* compiler build;
* runtime wrapper;
* worker protocol;
* option validation;
* diagnostic parsing;
* tests;
* release/provenance files.

---

## 17. Security

### 17.1 Threat model

The compiler handles untrusted C source.

It runs in WebAssembly inside a worker with a virtual filesystem.

This limits direct access to the browser environment, but it is not an absolute security boundary against browser or WebAssembly runtime vulnerabilities.

The main application-level risks are:

* infinite or very long compiler execution;
* excessive memory allocation;
* compiler crashes;
* malformed output;
* oversized virtual files;
* worker failure.

### 17.2 Mitigations

Use:

* Web Worker isolation;
* terminate-and-respawn cancellation;
* compile timeout;
* source-size limits;
* virtual-header limits;
* input validation;
* no compiler network APIs;
* no host filesystem access.

### 17.3 No telemetry by default

The package must not send:

* source code;
* diagnostics;
* timing data;
* compiler usage data;

to a remote service.

Applications may add their own telemetry outside this library.

### 17.4 Security policy

The public repository should include `SECURITY.md` with:

* supported versions;
* private vulnerability-reporting instructions;
* expected response process.

---

## 18. Browser compatibility

Supported browsers for the stable release are the latest two major versions of:

* Chrome;
* Firefox;
* Safari.

The design should also work in Chromium-based browsers such as Edge.

### 18.1 No cross-origin isolation requirement

The package does not use:

* WebAssembly threads;
* `SharedArrayBuffer`;
* `Atomics`.

Normal static hosting should therefore be enough.

### 18.2 WASM MIME type

Hosts should serve `.wasm` as:

```text
application/wasm
```

The README should document this requirement.

### 18.3 Static hosting

The package should work from hosts such as:

* GitHub Pages;
* Cloudflare Pages;
* Netlify;
* Vercel static deployments;
* ordinary HTTP servers.

A compile backend is not required.

---

## 19. Packaging

### 19.1 npm

The primary library distribution is npm.

The package should use ESM and ship:

* JavaScript;
* TypeScript declaration files;
* worker asset;
* WebAssembly asset.

### 19.2 Package-relative assets

Default asset lookup must be based on the installed module location, normally with `import.meta.url`.

Consumers should not need to know the npm CDN or GitHub release URL.

### 19.3 Overrides

Allow explicit asset URL overrides for:

* custom CDN setups;
* unusual bundlers;
* embedded applications.

### 19.4 Packaging test matrix

Before `1.0`, test at least:

* direct browser ESM;
* Vite;
* Node.js;
* GitHub Pages.

Additional bundlers may be added when requested by real consumers.

The project should not add bundler-specific code without a failing compatibility case.

---

## 20. Performance targets

Performance is secondary to exact output, but compilation must be suitable for an interactive editor.

### 20.1 Compiler-core payload

Target:

```text
cc1psx wasm + required JS/worker glue
≤ 1 MB gzip
```

If a future compiler change exceeds the target, fidelity takes priority over payload size.

### 20.2 Full source pipeline

The later package containing:

* preprocessor;
* EUC-JP support;
* compiler;
* worker glue;

should target a compressed payload of no more than about 3 MB unless measurements show a larger package is justified.

### 20.3 Compile latency

The normal edit/compile loop should feel interactive on a current desktop browser.

Initial targets:

```text
warm compile p50  < 50 ms for representative small/medium units
warm compile p95  < 150 ms for representative small/medium units
```

Large translation units may take longer.

Performance measurements must state:

* browser;
* browser version;
* operating system;
* hardware class;
* input size.

### 20.4 Startup

The compiled `WebAssembly.Module` should be created once per `Compiler` controller and reused across worker replacements.

Worker replacement must not require another network fetch.

---

## 21. Licensing and provenance

Licensing is a release requirement.

It is not something to infer after publishing binaries.

### 21.1 Compiler source

The GCC-derived compiler is expected to be covered by a GPLv2-family license.

The exact license expression must be established from the actual source used by the build before the first public compiler release.

`PROVENANCE.md` must record:

* exact GCC source;
* exact PsyQ-related source or patch;
* source URLs;
* revisions;
* hashes;
* license for each source;
* project patches;
* generated-source process.

### 21.2 Corresponding source

If the distributed WebAssembly compiler is GPL-covered, releases must provide the complete corresponding source required by that license.

The safest release model is to publish a source archive alongside binary artifacts containing:

* exact GCC source used;
* PsyQ modifications;
* project compatibility patches;
* generated-source build inputs or generation instructions;
* build scripts;
* configuration;
* other source required to rebuild the distributed compiler.

Do not rely on an upstream repository remaining available forever.

### 21.3 File-level licensing

Not every file in the repository has to use the compiler's license.

Original TypeScript wrapper code and original test fixtures may use a permissive license if desired.

Licenses should be clear at file or directory level.

Use SPDX identifiers where practical.

For example:

```text
SPDX-License-Identifier: MIT
```

or the exact established GPL expression for compiler-derived files.

### 21.4 Sony binaries

The repository and npm package must not contain original proprietary binaries such as:

* `CC1PSX.EXE`;
* ASPSX;
* `psylink`.

### 21.5 External projects

`mgs_reversing`, the PsyQ SDK, and other external material must not be copied into this repository unless their licenses permit it.

Maintainer-run tests may use separately obtained external inputs, but public redistribution is a separate question.

---

## 22. Reproducibility

Each release should provide enough information to reproduce the compiler artifact.

A release record should identify values such as:

```text
psyq-wasm             <git sha>
homebrew-psyq         <git sha>
GCC source            <archive + sha256>
Emscripten            <exact version>
historical image      <image digest>
compatibility patches <hashes>
cc1psx.wasm           <sha256>
```

### 22.1 Build ID

`CompilerInfo.buildId` should identify the exact distributed compiler artifact.

The format is opaque to callers.

It may be derived from:

* release version;
* source revisions;
* artifact hash.

The project should not promise a particular formatting scheme unless consumers need one.

### 22.2 Reproducible binary goal

Where practical, rebuilding from identical pinned inputs should produce identical WebAssembly artifacts.

If Emscripten or another tool introduces non-deterministic binary metadata, the project must document it rather than claiming bit-for-bit reproducibility that is not present.

Compiler-output fidelity is required even if compiler-artifact reproducibility has a toolchain limitation.

---

## 23. Versioning and releases

Use Semantic Versioning for the public TypeScript API.

### 23.1 `0.x`

Early releases may include only:

```text
compilePreprocessed()
```

This is acceptable.

The package should not delay useful compiler access until preprocessing is complete.

### 23.2 `1.0`

A stable `1.0` should require:

* stable exact-layer API;
* browser worker support;
* Node support;
* cancellation;
* timeout handling;
* documented packaging;
* browser test matrix;
* provenance record;
* release source archive;
* production CI;
* at least 99% TypeScript test coverage;
* documented supported compiler version.

`compileSource()` may be included in `1.0` if the preprocessor and encoding pipeline are fully verified.

If it is not ready, the project should either delay `1.0` or explicitly define a `1.0` scope that does not promise raw-source compilation.

The decision should be made before the first release candidate.

### 23.3 Changelog

Maintain `CHANGELOG.md`.

Public releases should document:

* API changes;
* compiler-build changes;
* fidelity-related changes;
* browser support changes;
* fixed mismatches.

---

## 24. Contribution standards

### 24.1 Pull requests

A pull request should:

* have a clear purpose;
* include tests;
* pass format, lint, type, test, coverage, browser, and differential checks;
* avoid unrelated formatting or refactoring;
* update documentation when public behavior changes.

### 24.2 Compiler patches

Changes to GCC-derived compiler source require extra care.

A compiler patch must include:

1. the reason for the change;
2. why it is required for WebAssembly;
3. why it should preserve native compiler behavior;
4. a differential regression test.

Do not modernize old compiler code merely to make it look current.

Minimal changes are preferred.

### 24.3 Suppressions

Avoid:

* `@ts-ignore`;
* `eslint-disable` at file scope;
* unchecked type assertions;
* ignored test failures.

When a suppression is needed, keep it local and explain it.

Prefer `@ts-expect-error` over `@ts-ignore` when a TypeScript error is intentionally part of a test.

### 24.4 Documentation

Public API changes require documentation in the same pull request.

The README should include a minimal working example.

---

## 25. Milestones

### M0 — Build and provenance

Deliver:

* reproducible reference compiler build;
* reproducible `cc1psx.wasm` build;
* compatibility patch files;
* `PROVENANCE.md`;
* established compiler-source licensing;
* generic differential-test oracle;
* initial TypeScript project configuration;
* ESLint;
* Prettier;
* strict TypeScript;
* CI skeleton.

Acceptance:

* WebAssembly compiler can be built from pinned sources;
* a documented generic fixture matches the reference compiler byte for byte.

---

### M1 — Exact compiler API

Deliver:

* `createCompiler()`;
* `compilePreprocessed()`;
* `CompileResult`;
* typed options;
* raw stdout/stderr;
* diagnostics parser;
* Node entry point;
* option validation;
* generic differential suite.

Acceptance:

* all generic fixtures are byte-identical;
* TypeScript coverage is at least 99%;
* Node tests run against the actual distributed `.wasm`.

---

### M2 — Browser runtime

Deliver:

* main-thread `WebAssembly.Module` ownership;
* worker execution;
* fresh compiler instance per compile;
* cancellation;
* timeout;
* worker replacement;
* Chromium, Firefox, and WebKit tests.

Acceptance:

* worker replacement does not fetch the compiler again;
* a successful compile works after cancellation or timeout recovery;
* browser test suite passes.

---

### M3 — Public `0.x`

Deliver:

* npm package;
* package-relative asset loading;
* static demo;
* README;
* `CONTRIBUTING.md`;
* `SECURITY.md`;
* source archive;
* release hashes;
* packaging smoke tests.

Acceptance:

* packed npm artifact works in the supported package test fixtures;
* static demo compiles preprocessed C without a backend.

---

### M4 — Raw-source pipeline

Deliver:

* browser `cccp`;
* virtual headers;
* exact preprocessing pipeline;
* EUC-JP implementation;
* `compileSource()`;
* preprocessing differential tests.

Acceptance:

* convenience pipeline reproduces the reference preprocessing and compilation results for the supported fixture set.

---

### M5 — Stable release

Deliver:

* stable documented API;
* complete package compatibility matrix;
* performance report;
* final license/provenance review;
* release automation;
* `1.0` release criteria met.

---

## 26. Risks and open questions

### 26.1 PsyQ 4.3

Some projects use older PsyQ compilers.

PsyQ 4.3 support is not part of the first implementation.

The repository name `psyq-wasm` leaves room for additional compiler versions later.

Version-specific compiler behavior must remain isolated.

### 26.2 Preprocessor fidelity

The first compiler API begins after preprocessing.

The later convenience pipeline must prove its own fidelity.

A correct `cc1psx.wasm` does not automatically imply a correct `compileSource()` pipeline.

### 26.3 EUC-JP

The browser has no standard EUC-JP encoder.

The implementation and unmappable-character policy remain open until the raw-source milestone.

### 26.4 Browser performance

Compiler fidelity should not depend on the browser, but performance may.

Safari, Firefox, and Chromium must all be measured.

### 26.5 Emscripten compatibility settings

The old compiler currently depends on compatibility behavior for mismatched function-pointer signatures.

Future Emscripten changes may affect this feature.

The Emscripten version is therefore pinned, and upgrades require differential tests.

### 26.6 Packaging

Worker and `.wasm` asset handling differs among bundlers.

Package smoke tests are required before adding special-case code.

### 26.7 Licensing

The exact compiler-source license and corresponding-source obligations must be established before public binary distribution.

This is an M0 release blocker.

### 26.8 Downstream diff design

The future matching application still needs to choose between:

* assembly parsing and instruction-level comparison;
* browser object generation and `objdiff`.

That choice does not affect the compiler package.

---

## 27. Naming

The repository name is:

```text
psyq-wasm
```

This allows future support for more than one PsyQ compiler version.

The first compiler implementation is explicitly identified as:

```text
PsyQ 4.4
GCC 2.8.1
mips-psx
```

Public metadata must expose the compiler version.

If the project is later limited permanently to one compiler, a narrower package name such as `cc1psx-wasm` may be considered.

---

## 28. References

* [`nocato/homebrew-psyq`](https://github.com/nocato/homebrew-psyq) — reconstructed PsyQ compiler source
* [`FoxdieTeam/mgs_reversing`](https://github.com/FoxdieTeam/mgs_reversing) — Metal Gear Solid matching-decompilation project
* [`mkst/maspsx`](https://github.com/mkst/maspsx) — converts PsyQ-style assembly for GNU assembler workflows
* [`encounter/objdiff`](https://github.com/encounter/objdiff) — object-file diff tool
* [`decompme/decomp.me`](https://github.com/decompme/decomp.me) — browser-based matching-decompilation interface with server-side compilation
* [Emscripten](https://emscripten.org/) — C/C++ to WebAssembly toolchain

---

## 29. Initial implementation target

The first implementation should remain small:

```text
Uint8Array containing .i source
            │
            ▼
     main-thread controller
            │
            ├── retained WebAssembly.Module
            │
            ▼
        Web Worker
            │
            ├── fresh cc1psx instance
            ├── MEMFS input/output
            │
            ▼
Uint8Array containing exact .s output
```

The acceptance rule is simple:

> For the same exact inputs, the output bytes must equal the reference `cc1psx` output bytes.

Everything else can be built on top of that.
