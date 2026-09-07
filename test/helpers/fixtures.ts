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

export interface FixtureManifest {
  readonly fixtures: readonly FixtureEntry[];
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
