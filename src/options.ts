// SPDX-License-Identifier: MIT
import { InvalidOptionsError } from './errors.js';
import type { CompilerLimits } from './public-types.js';

/** Working directory on the compiler's virtual filesystem. */
export const WORK_DIR = '/work';
/** Output file name the wrapper passes with `-o`; callers may not use it as an input name. */
export const RESERVED_OUTPUT_NAME = 'out.s';
/** Input file name used when the caller does not provide one. */
export const DEFAULT_FILENAME = 'input.i';
/** Largest delay supported without overflow by browser and Node timers. */
const MAX_TIMEOUT_MS = 2_147_483_647;

export const DEFAULT_LIMITS: CompilerLimits = Object.freeze({
  maxSourceBytes: 4 * 1024 * 1024,
  defaultTimeoutMs: 20_000,
  initTimeoutMs: 10_000,
});

export interface NormalizedCompileOptions {
  readonly gpSize: 0 | 8;
  readonly filename: string;
  readonly rawFlags: readonly string[];
  readonly timeoutMs: number;
  readonly signal: AbortSignal | undefined;
}

/**
 * Switches the wrapper owns or that would break output capture. Exact matches.
 * `-G…` and `-o…` are rejected by prefix in `validateFlag`.
 */
const DENIED_FLAGS: ReadonlySet<string> = new Set(['-quiet', '-version', '-dumpbase']);
const DENIED_PREFIXES: readonly string[] = ['-G', '-o', '-aux-info'];
const FLAG_SHAPE = /^-[A-Za-z][A-Za-z0-9=_.,+-]*$/;
const FILENAME_SHAPE = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function validateFilename(value: unknown): string {
  if (typeof value !== 'string') {
    throw new InvalidOptionsError('filename must be a string.');
  }
  if (value === RESERVED_OUTPUT_NAME) {
    throw new InvalidOptionsError(`filename ${JSON.stringify(value)} is reserved for the output.`);
  }
  if (value === '.' || value === '..' || !FILENAME_SHAPE.test(value)) {
    throw new InvalidOptionsError(
      `filename ${JSON.stringify(value)} must be a single path segment of letters, digits, '_', '-' or '.'.`,
    );
  }
  if (new TextEncoder().encode(value).length > 255) {
    throw new InvalidOptionsError('filename must be at most 255 bytes.');
  }
  return value;
}

function validateFlag(flag: unknown): string {
  if (typeof flag !== 'string') {
    throw new InvalidOptionsError('rawFlags must contain only strings.');
  }
  const shown = JSON.stringify(flag);
  if (!FLAG_SHAPE.test(flag)) {
    throw new InvalidOptionsError(`rawFlags entry ${shown} is not a well-formed compiler switch.`);
  }
  if (DENIED_FLAGS.has(flag) || DENIED_PREFIXES.some((p) => flag.startsWith(p))) {
    throw new InvalidOptionsError(
      `rawFlags entry ${shown} is owned by the wrapper and cannot be overridden.`,
    );
  }
  return flag;
}

function validateRawFlags(value: unknown): readonly string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new InvalidOptionsError('rawFlags must be an array of strings.');
  }
  return value.map(validateFlag);
}

/**
 * Validate and normalize `CompilePreprocessedOptions`. Accepts `unknown` so
 * that JavaScript callers get the same errors as TypeScript callers.
 */
export function validateCompileOptions(
  options: unknown,
  limits: CompilerLimits,
): NormalizedCompileOptions {
  if (!isRecord(options)) {
    throw new InvalidOptionsError('options must be an object with at least a gpSize.');
  }
  const gpSize = options['gpSize'];
  if (gpSize !== 0 && gpSize !== 8) {
    throw new InvalidOptionsError('gpSize is required and must be 0 or 8.');
  }
  const filename =
    options['filename'] === undefined ? DEFAULT_FILENAME : validateFilename(options['filename']);
  const rawFlags = validateRawFlags(options['rawFlags']);
  const timeoutMs =
    options['timeoutMs'] === undefined ? limits.defaultTimeoutMs : options['timeoutMs'];
  if (!isPositiveInteger(timeoutMs) || timeoutMs > MAX_TIMEOUT_MS) {
    throw new InvalidOptionsError(
      `timeoutMs must be an integer between 1 and ${String(MAX_TIMEOUT_MS)}.`,
    );
  }
  const signal = options['signal'];
  if (signal !== undefined && !(signal instanceof AbortSignal)) {
    throw new InvalidOptionsError('signal must be an AbortSignal.');
  }
  return { gpSize, filename, rawFlags, timeoutMs, signal };
}

/** Check the source bytes against the size limit. */
export function validateSource(source: Uint8Array, limits: CompilerLimits): void {
  if (!(source instanceof Uint8Array)) {
    throw new InvalidOptionsError('source must be a Uint8Array of preprocessed C.');
  }
  if (source.byteLength > limits.maxSourceBytes) {
    throw new InvalidOptionsError(
      `source is ${String(source.byteLength)} bytes; the limit is ${String(limits.maxSourceBytes)} bytes.`,
    );
  }
}

/** Merge caller overrides onto `DEFAULT_LIMITS`, validating each value. */
export function resolveLimits(overrides: Partial<CompilerLimits> | undefined): CompilerLimits {
  const merged: CompilerLimits = { ...DEFAULT_LIMITS, ...overrides };
  for (const key of ['maxSourceBytes', 'defaultTimeoutMs', 'initTimeoutMs'] as const) {
    if (!isPositiveInteger(merged[key])) {
      throw new InvalidOptionsError(`limits.${key} must be a positive integer.`);
    }
    if (key !== 'maxSourceBytes' && merged[key] > MAX_TIMEOUT_MS) {
      throw new InvalidOptionsError(`limits.${key} must be at most ${String(MAX_TIMEOUT_MS)}.`);
    }
  }
  return merged;
}
