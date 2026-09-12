// SPDX-License-Identifier: MIT
/**
 * The shipped type declarations must describe the whole public runtime surface.
 *
 * A stray `@internal` tag combined with `stripInternal` once deleted the entire
 * `createCompiler` declaration from dist/index.d.ts while leaving the runtime
 * export in place, so every TypeScript consumer failed to resolve the library's
 * primary entry point. Nothing else caught it: the packaging smoke consumers are
 * plain JavaScript, and the only other assertions about index.d.ts check that the
 * file exists and is referenced, never what is in it.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fromRoot } from '../helpers/paths.js';

/** Names exported by an emitted declaration file's `export { ... }` clauses. */
function declaredNames(dts: string): string[] {
  return [...dts.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)]
    .flatMap((match) => (match[1] ?? '').split(','))
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .map((name) => name.split(/\s+as\s+/).pop() ?? name);
}

/** Names declared by `export declare function|const|class ...` statements. */
function declaredStatements(dts: string): string[] {
  return [
    ...dts.matchAll(/export\s+declare\s+(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g),
  ].map((match) => match[1] ?? '');
}

const entries = [
  { name: 'browser', js: 'index.js', dts: 'index.d.ts' },
  { name: 'node', js: 'index.node.js', dts: 'index.node.d.ts' },
] as const;

describe.each(entries)('dist/$js public surface', ({ js, dts }) => {
  it('declares every runtime export', async () => {
    const runtime = Object.keys(
      (await import(pathToFileURL(fromRoot('dist', js)).href)) as Record<string, unknown>,
    ).sort();
    const declaration = readFileSync(fromRoot('dist', dts), 'utf8');
    const declared = [...declaredNames(declaration), ...declaredStatements(declaration)];

    expect(runtime.length).toBeGreaterThan(0);
    expect(runtime.filter((name) => !declared.includes(name))).toEqual([]);
  });

  it('declares createCompiler, the primary entry point', () => {
    expect(readFileSync(fromRoot('dist', dts), 'utf8')).toMatch(/\bcreateCompiler\b/);
  });
});
