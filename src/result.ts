// SPDX-License-Identifier: MIT
import { parseDiagnostics } from './diagnostics.js';
import type { CompileResult, CompileTimings, CompilerInfo } from './public-types.js';

/** What the worker reports back for one compile. */
export interface WorkerCompileOutcome {
  readonly exitCode: number;
  readonly asm?: Uint8Array;
  readonly stdout: string;
  readonly stderr: string;
  readonly timings: CompileTimings;
}

const decoder = new TextDecoder('utf-8', { fatal: false });

/** Decode assembly bytes for display: UTF-8, CRLF normalized to LF. Lone CRs are kept. */
function toText(asm: Uint8Array): string {
  return decoder.decode(asm).replaceAll('\r\n', '\n');
}

/** Turn a worker outcome into the public `CompileResult`. The `asm` bytes are passed through untouched. */
export function buildCompileResult(
  outcome: WorkerCompileOutcome,
  compiler: CompilerInfo,
): CompileResult {
  const common = {
    diagnostics: parseDiagnostics(outcome.stderr),
    rawStdout: outcome.stdout,
    rawStderr: outcome.stderr,
    compiler,
    timings: outcome.timings,
  };
  if (outcome.exitCode === 0 && outcome.asm !== undefined) {
    return {
      success: true,
      exitCode: 0,
      asm: outcome.asm,
      text: toText(outcome.asm),
      ...common,
    };
  }
  if (outcome.asm === undefined) {
    return { success: false, exitCode: outcome.exitCode, ...common };
  }
  return {
    success: false,
    exitCode: outcome.exitCode,
    asm: outcome.asm,
    text: toText(outcome.asm),
    ...common,
  };
}
