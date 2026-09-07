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
  /** Maximum accepted source size in bytes. */
  readonly maxSourceBytes: number;
  /** Default per-request timeout when `timeoutMs` is not given. */
  readonly defaultTimeoutMs: number;
  /** Maximum time to wait for a worker to report ready. */
  readonly initTimeoutMs: number;
}

export interface Compiler {
  readonly info: CompilerInfo;
  compilePreprocessed(
    source: Uint8Array,
    options: CompilePreprocessedOptions,
  ): Promise<CompileResult>;
  /** Terminate the worker and reject pending requests. Idempotent. */
  dispose(): void;
}

export interface CreateCompilerOptions {
  /** Override the worker script URL (default: package-relative). */
  readonly workerUrl?: string | URL;
  /** Override the compiler `.wasm` URL (default: package-relative). */
  readonly wasmUrl?: string | URL;
  /** Override resource limits. */
  readonly limits?: Partial<CompilerLimits>;
}

export type ErrorCode = 'timeout' | 'worker-crash' | 'internal' | 'invalid-options' | 'disposed';
