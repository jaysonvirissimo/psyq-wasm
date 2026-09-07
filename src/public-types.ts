// SPDX-License-Identifier: MIT
/**
 * Public types of the psyq-wasm API. Type-only module; see index.ts for the
 * runtime exports.
 */

export interface CompilerInfo {
  readonly psyqVersion: '4.4';
  readonly gccVersion: '2.8.1';
  /**
   * Opaque identifier for the exact compiler artifact. Include it in bug
   * reports and saved compilation records.
   */
  readonly buildId: string;
  /** Opaque identifier for the exact preprocessor artifact used by `compileSource()`. */
  readonly preprocessorBuildId: string;
}

export interface CompilerDiagnostic {
  readonly severity: 'error' | 'warning';
  readonly file?: string;
  readonly line?: number;
  readonly column?: number;
  readonly message: string;
}

export interface CompileTimings {
  /** Time to instantiate a fresh compiler instance for this request. */
  readonly instantiateMs: number;
  /** Time spent inside the compiler. */
  readonly compileMs: number;
  /** Wall-clock time inside the worker for this request. */
  readonly totalMs: number;
  /** `compileSource()` only: time to instantiate and run the preprocessor. */
  readonly preprocessMs?: number;
}

export interface CompileSuccess {
  readonly success: true;
  readonly exitCode: 0;
  /** Exact compiler output bytes. No newline normalization is applied. */
  readonly asm: Uint8Array;
  /**
   * Convenience string representation. Line endings are normalized to LF.
   * Do not use this field for byte-level fidelity checks.
   */
  readonly text: string;
  /**
   * `compileSource()` only: the exact bytes handed to the compiler (the
   * preprocessor output, re-encoded when `encoding` asked for it).
   */
  readonly preprocessed?: Uint8Array;
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly rawStdout: string;
  readonly rawStderr: string;
  readonly compiler: CompilerInfo;
  readonly timings: CompileTimings;
}

export interface CompileFailure {
  readonly success: false;
  readonly exitCode: number;
  /** Partial output, if the compiler produced any before failing. */
  readonly asm?: Uint8Array;
  readonly text?: string;
  /** `compileSource()` only: the preprocessor output, when the preprocessor produced one. */
  readonly preprocessed?: Uint8Array;
  /** `compileSource()` only: which program reported the non-zero exit code. */
  readonly stage?: 'preprocess' | 'compile';
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly rawStdout: string;
  readonly rawStderr: string;
  readonly compiler: CompilerInfo;
  readonly timings: CompileTimings;
}

export type CompileResult = CompileSuccess | CompileFailure;

export interface CompilePreprocessedOptions {
  /**
   * PsyQ small-data threshold (`-G`). Required; the library never guesses it.
   */
  readonly gpSize: 0 | 8;
  /**
   * Logical source filename passed to the compiler. Part of the exact compiler
   * input: it can appear in emitted assembly and diagnostics when the source
   * carries no preprocessor line markers. A single path segment. Defaults to
   * `input.i`.
   */
  readonly filename?: string;
  /**
   * Additional cc1psx switches, for example `['-O2', '-g0', '-Wall']`.
   * Wrapper-owned flags (`-G`, `-o`, `-quiet`, input path) are rejected.
   */
  readonly rawFlags?: readonly string[];
  /** Cancel the request. In-flight compiles terminate the worker. */
  readonly signal?: AbortSignal;
  /** Maximum compile time; defaults to the compiler's `defaultTimeoutMs` limit. */
  readonly timeoutMs?: number;
}

export interface CompilerLimits {
  /** Maximum accepted source size in bytes (after UTF-8 encoding for string input). */
  readonly maxSourceBytes: number;
  /** Default per-request timeout when `timeoutMs` is not given. */
  readonly defaultTimeoutMs: number;
  /** Maximum time to wait for a worker to report ready. */
  readonly initTimeoutMs: number;
  /** Maximum total size of all virtual headers of one `compileSource()` call, in bytes. */
  readonly maxHeaderBytes: number;
  /** Maximum number of virtual headers of one `compileSource()` call. */
  readonly maxHeaderCount: number;
}

/** How `compileSource()` turns the preprocessed text into compiler input bytes. */
export type SourceEncoding = 'utf8' | 'eucjp';

export interface CompileSourceOptions extends CompilePreprocessedOptions {
  /**
   * Logical source filename, a single path segment; it appears in the line
   * markers and therefore in `.file` directives and diagnostics. Defaults to
   * `input.c`.
   */
  readonly filename?: string;
  /**
   * Virtual include files, keyed by path relative to the source file's
   * directory (`codec.h`, `psyq/include/libgte.h`). Strings are written as
   * UTF-8. Quote-includes resolve relative to the including file; angle
   * includes only search the `-I` directories given in `cppFlags`.
   */
  readonly headers?: Readonly<Record<string, string | Uint8Array>>;
  /**
   * Preprocessor switches. Defaults to `DEFAULT_CPP_FLAGS` (the PsyQ 4.4
   * predefined macros). Accepted forms: `-D`, `-U`, `-I`, `-W`, `-pedantic`,
   * `-pedantic-errors`, `-trigraphs`, `-lang-c`, `-traditional`. The wrapper
   * always adds `-nostdinc -undef` and owns the input and output paths.
   */
  readonly cppFlags?: readonly string[];
  /**
   * `'utf8'` (default) hands the preprocessed bytes to the compiler unchanged;
   * `'eucjp'` re-encodes the preprocessed text (which must be valid UTF-8)
   * as EUC-JP first, rejecting unmappable characters with `EncodingError`.
   */
  readonly encoding?: SourceEncoding;
}

export interface Compiler {
  readonly info: CompilerInfo;
  /** Compile exact preprocessed bytes; the fidelity boundary. */
  compilePreprocessed(
    source: Uint8Array,
    options: CompilePreprocessedOptions,
  ): Promise<CompileResult>;
  /**
   * Preprocess raw C (with virtual headers), optionally re-encode, and
   * compile, all inside the worker. Strings are encoded as UTF-8.
   */
  compileSource(source: string | Uint8Array, options: CompileSourceOptions): Promise<CompileResult>;
  /** Terminate the worker and reject pending requests. Idempotent. */
  dispose(): void;
}

export interface CreateCompilerOptions {
  /** Override the worker script URL (default: package-relative). */
  readonly workerUrl?: string | URL;
  /** Override the compiler `.wasm` URL (default: package-relative). */
  readonly wasmUrl?: string | URL;
  /** Override the preprocessor `cccp.wasm` URL (default: package-relative). */
  readonly preprocessorWasmUrl?: string | URL;
  /** Override resource limits. */
  readonly limits?: Partial<CompilerLimits>;
}

export type ErrorCode =
  'timeout' | 'worker-crash' | 'internal' | 'invalid-options' | 'disposed' | 'encoding';
