// SPDX-License-Identifier: MIT
/**
 * psyq-wasm browser entry point. Compiles run in a module Web Worker.
 */
import { createCompilerWith, type Platform } from './create-compiler.js';
import { createBrowserPlatform } from './platform-browser.js';
import type { Compiler, CreateCompilerOptions } from './public-types.js';

export type {
  CompileFailure,
  CompilePreprocessedOptions,
  CompileResult,
  CompileSuccess,
  CompileTimings,
  Compiler,
  CompilerDiagnostic,
  CompilerInfo,
  CompilerLimits,
  CreateCompilerOptions,
  ErrorCode,
} from './public-types.js';
export {
  CompileTimeoutError,
  CompilerDisposedError,
  InternalError,
  InvalidOptionsError,
  PsyqWasmError,
  WorkerCrashError,
  isAbortError,
} from './errors.js';
export { DEFAULT_LIMITS } from './options.js';
export { parseDiagnostics } from './diagnostics.js';

/**
 * Fetch and compile the compiler module once, then start a worker.
 *
 * @param options asset URL and limit overrides
 * @param platform host bindings; only tests should pass this
 * @internal the `platform` parameter is not part of the public API
 */
export function createCompiler(
  options?: CreateCompilerOptions,
  platform: Platform = createBrowserPlatform(),
): Promise<Compiler> {
  return createCompilerWith(platform, options);
}
