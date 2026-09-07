// SPDX-License-Identifier: MIT
import { readFileSync } from 'node:fs';
import { fromRoot } from './paths.js';

export interface FixtureEntry {
  /** Unique id, e.g. `t01_arith-g8`. */
  readonly name: string;
  /** Path (relative to test/fixtures) of the preprocessed input. */
  readonly input: string;
  /** Logical filename handed to the compiler. */
  readonly filename: string;
  readonly gpSize: 0 | 8;
  readonly rawFlags: readonly string[];
  /** Path of the expected assembly, absent when the compiler is expected to fail. */
  readonly expected?: string;
  /** Path of the expected stderr text, absent when stderr is expected to be empty. */
  readonly expectedStderr?: string;
  readonly expectedExitCode: number;
}

/** A `compileSource()` fixture: raw C plus virtual headers through the whole pipeline. */
export interface SourceFixtureEntry {
  /** Unique id, e.g. `t18_include-g8`. */
  readonly name: string;
  /** Path (relative to test/fixtures) of the raw C source. */
  readonly source: string;
  /** Logical filename handed to the preprocessor. */
  readonly filename: string;
  /** Virtual header path → fixture file (relative to test/fixtures). */
  readonly headers?: Readonly<Record<string, string>>;
  /** Appended to `DEFAULT_CPP_FLAGS`. */
  readonly extraCppFlags?: readonly string[];
  readonly encoding?: 'utf8' | 'eucjp';
  readonly gpSize: 0 | 8;
  readonly rawFlags: readonly string[];
  /** Path of the bytes the compiler must receive (the reference `.i`, transcoded when `encoding` says so). */
  readonly expectedPreprocessed: string;
  readonly expected?: string;
  /** Expected `rawStderr` of the whole pipeline. */
  readonly expectedStderr?: string;
  readonly expectedExitCode: number;
  /** Which program is expected to fail, when `expectedExitCode` is non-zero. */
  readonly expectedStage?: 'preprocess' | 'compile';
}

export interface FixtureManifest {
  readonly fixtures: readonly FixtureEntry[];
  readonly sources: readonly SourceFixtureEntry[];
}

export const FIXTURES_DIR: string = fromRoot('test', 'fixtures');

export function loadManifest(): FixtureManifest {
  return JSON.parse(readFileSync(`${FIXTURES_DIR}/manifest.json`, 'utf8')) as FixtureManifest;
}

export function fixturePath(relative: string): string {
  return `${FIXTURES_DIR}/${relative}`;
}

export function readFixture(relative: string): Uint8Array {
  return new Uint8Array(readFileSync(fixturePath(relative)));
}

export function readFixtureText(relative: string): string {
  return readFileSync(fixturePath(relative), 'utf8');
}

/** The `headers` option for a source fixture, with file contents loaded. */
export function loadSourceHeaders(entry: SourceFixtureEntry): Record<string, Uint8Array> {
  return Object.fromEntries(
    Object.entries(entry.headers ?? {}).map(([path, file]) => [path, readFixture(file)]),
  );
}
