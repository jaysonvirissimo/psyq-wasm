// SPDX-License-Identifier: MIT
/**
 * psyq-wasm browser entry point. Compiles run in a module Web Worker.
 */
import { createCompilerWith } from './create-compiler.js';
import { createBrowserPlatform } from './platform-browser.js';
import type { Compiler, CreateCompilerOptions } from './public-types.js';

export type {
  CompileFailure,
  CompilePreprocessedOptions,
  CompileResult,
  CompileSourceOptions,
  CompileSuccess,
  CompileTimings,
  Compiler,
  CompilerDiagnostic,
  CompilerInfo,
  CompilerLimits,
  CreateCompilerOptions,
  ErrorCode,
  SourceEncoding,
} from './public-types.js';
export {
  CompileTimeoutError,
  CompilerDisposedError,
  EncodingError,
  InternalError,
  InvalidOptionsError,
  PsyqWasmError,
  WorkerCrashError,
  isAbortError,
} from './errors.js';
export { DEFAULT_LIMITS } from './options.js';
export { DEFAULT_CPP_FLAGS } from './argv.js';
export { parseDiagnostics } from './diagnostics.js';
export { encodeEucJp } from './eucjp.js';

/**
 * Fetch and compile the compiler and preprocessor modules once, then start a worker.
 *
 * @param options asset URL and limit overrides
 */
export function createCompiler(options?: CreateCompilerOptions): Promise<Compiler> {
  return createCompilerWith(createBrowserPlatform(), options);
}
