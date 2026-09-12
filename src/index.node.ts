// SPDX-License-Identifier: MIT
/**
 * psyq-wasm Node.js entry point (selected by the `node` export condition).
 * Compiles run in a `worker_threads` Worker.
 */
import { createCompilerWith } from './create-compiler.js';
import { createNodePlatform } from './platform-node.js';
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
 * Load the compiler and preprocessor modules once and start a worker.
 *
 * @param options asset URL and limit overrides
 */
export function createCompiler(options?: CreateCompilerOptions): Promise<Compiler> {
  return createCompilerWith(createNodePlatform(), options);
}
