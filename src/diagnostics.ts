// SPDX-License-Identifier: MIT
import type { CompilerDiagnostic } from './public-types.js';

/**
 * GCC 2.8.1 diagnostic shape: `file:line: [warning: ]message`. There are no
 * column numbers and errors carry no `error:` prefix. The file name may itself
 * contain colons (drive letters), so the match is anchored on `:<digits>: `.
 */
const LOCATED = /^(?<file>.+?):(?<line>\d+): (?:(?<warn>warning): )?(?<msg>.*)$/;
/** Messages from the compiler driver level, e.g. `cc1: warning: …`. */
const DRIVER = /^cc1: (?:(?<warn>warning): )?(?<msg>.*)$/;

const CONTEXT_PATTERNS: readonly RegExp[] = [
  /^(?:.+: )?In function `.*':$/,
  /^(?:.+: )?At top level:$/,
  /^In file included from .+:\d+[:,]$/,
  /^\s+from .+:\d+[:,]$/,
];

/** True for GCC context lines that precede a diagnostic but are not one. */
export function isContextLine(line: string): boolean {
  return CONTEXT_PATTERNS.some((p) => p.test(line));
}

/** Parse cc1psx stderr into structured diagnostics. Unrecognised lines are ignored. */
export function parseDiagnostics(stderr: string): CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = [];
  for (const line of stderr.split(/\r?\n/)) {
    if (line === '' || isContextLine(line)) continue;
    const located = LOCATED.exec(line);
    if (located?.groups) {
      // Named groups are always present on a match; the defaults only satisfy the type checker.
      const { file = '', line: lineText = '', warn, msg = '' } = located.groups;
      diagnostics.push({
        severity: warn === undefined ? 'error' : 'warning',
        file,
        line: Number(lineText),
        message: msg,
      });
      continue;
    }
    const driver = DRIVER.exec(line);
    if (driver?.groups) {
      const { warn, msg = '' } = driver.groups;
      diagnostics.push({ severity: warn === undefined ? 'error' : 'warning', message: msg });
    }
  }
  return diagnostics;
}
