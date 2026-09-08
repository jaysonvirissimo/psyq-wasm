// SPDX-License-Identifier: MIT
// TypeScript consumer: the package must type-check through its `exports` map's
// `types` condition, exercising the declarations a TS user actually resolves.
// This is compiled with `tsc --noEmit`; it is never executed. A `stripInternal`
// accident once removed `createCompiler` from the shipped declarations while
// leaving the runtime export intact, and every JavaScript smoke test still passed.
import {
  CompileTimeoutError,
  DEFAULT_CPP_FLAGS,
  DEFAULT_LIMITS,
  EncodingError,
  InvalidOptionsError,
  createCompiler,
  encodeEucJp,
  isAbortError,
  parseDiagnostics,
  type CompilePreprocessedOptions,
  type CompileResult,
  type CompileSourceOptions,
  type Compiler,
  type CompilerDiagnostic,
  type CompilerInfo,
  type CompilerLimits,
  type ErrorCode,
  type CreateCompilerOptions,
  type SourceEncoding,
} from 'psyq-wasm';

const options: CreateCompilerOptions = {
  limits: { defaultTimeoutMs: DEFAULT_LIMITS.defaultTimeoutMs },
};

export async function compile(source: Uint8Array): Promise<CompileResult> {
  const compiler: Compiler = await createCompiler(options);
  const info: CompilerInfo = compiler.info;
  console.log(info.buildId, info.preprocessorBuildId, info.psyqVersion, info.gccVersion);

  const preprocessed: CompilePreprocessedOptions = {
    gpSize: 8,
    filename: 'rations.i',
    rawFlags: ['-O2', '-g0', '-Wall'],
  };
  const encoding: SourceEncoding = 'eucjp';
  const fromSource: CompileSourceOptions = {
    gpSize: 0,
    filename: 'rations.c',
    headers: { 'codec.h': '#define FREQ 140\n' },
    cppFlags: [...DEFAULT_CPP_FLAGS],
    encoding,
  };

  try {
    const result = await compiler.compilePreprocessed(source, preprocessed);
    if (result.success) {
      const asm: Uint8Array = result.asm;
      console.log(asm.byteLength, result.text.length, result.timings.compileMs);
    } else {
      const diagnostics: readonly CompilerDiagnostic[] = result.diagnostics;
      console.log(result.exitCode, result.stage, diagnostics.map((d) => d.severity).join());
    }
    return await compiler.compileSource('int stock(void) { return FREQ; }', fromSource);
  } catch (error: unknown) {
    if (isAbortError(error)) throw error;
    // A catch binding is `unknown`, so instanceof is still the way in. What
    // the packed declarations must get right is that `code` is then the
    // class's own literal rather than the whole union.
    if (error instanceof EncodingError) {
      const encoding: 'encoding' = error.code;
      console.log(encoding, error.name, describeError(error));
    }
    if (error instanceof InvalidOptionsError) {
      const invalidOptions: 'invalid-options' = error.code;
      console.log(invalidOptions, error.name);
    }
    throw error;
  } finally {
    compiler.dispose();
  }
}

/**
 * `code` discriminates a union of error classes: both branches below reach
 * subclass-only fields with no instanceof in sight.
 */
function describeError(error: EncodingError | CompileTimeoutError): string {
  return error.code === 'encoding'
    ? `${error.character} at ${String(error.index)}`
    : `${String(error.timeoutMs)} ms`;
}

const code: ErrorCode = 'timeout';
const limits: CompilerLimits = DEFAULT_LIMITS;
console.log(code);
console.log(limits.maxHeaderCount, encodeEucJp('補給').byteLength, parseDiagnostics('').length);
