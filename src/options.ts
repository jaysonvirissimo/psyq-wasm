// SPDX-License-Identifier: MIT
import { DEFAULT_CPP_FLAGS } from './argv.js';
import { InvalidOptionsError } from './errors.js';
import type { CompilerLimits, SourceEncoding } from './public-types.js';

/** Working directory on the compiler's virtual filesystem. */
export const WORK_DIR = '/work';
/** Output file name the wrapper passes with `-o`; callers may not use it as an input name. */
export const RESERVED_OUTPUT_NAME = 'out.s';
/** Preprocessor output name (and the compiler's input name in `compileSource()`). */
export const RESERVED_PREPROCESSED_NAME = 'out.i';
/** Input file name used when the caller does not provide one. */
export const DEFAULT_FILENAME = 'input.i';
/** Source file name used by `compileSource()` when the caller does not provide one. */
export const DEFAULT_SOURCE_FILENAME = 'input.c';
/** Largest delay supported without overflow by browser and Node timers. */
const MAX_TIMEOUT_MS = 2_147_483_647;
const MAX_PATH_BYTES = 4096;
const MAX_SEGMENT_BYTES = 255;

export const DEFAULT_LIMITS: CompilerLimits = Object.freeze({
  maxSourceBytes: 4 * 1024 * 1024,
  defaultTimeoutMs: 20_000,
  initTimeoutMs: 10_000,
  maxHeaderBytes: 8 * 1024 * 1024,
  maxHeaderCount: 512,
});

export interface NormalizedCompileOptions {
  readonly gpSize: 0 | 8;
  readonly filename: string;
  readonly rawFlags: readonly string[];
  readonly timeoutMs: number;
  readonly signal: AbortSignal | undefined;
}

/** One virtual header, ready to be written to the preprocessor's filesystem. */
export interface HeaderFile {
  readonly path: string;
  readonly data: Uint8Array;
}

export interface NormalizedSourceOptions extends NormalizedCompileOptions {
  readonly cppFlags: readonly string[];
  readonly headers: readonly HeaderFile[];
  readonly encoding: SourceEncoding;
}

/**
 * Switches the wrapper owns or that would break output capture. Exact matches.
 * `-G…` and `-o…` are rejected by prefix in `validateFlag`.
 */
const DENIED_FLAGS: ReadonlySet<string> = new Set(['-quiet', '-version', '-dumpbase']);
const DENIED_PREFIXES: readonly string[] = ['-G', '-o', '-aux-info'];
const FLAG_SHAPE = /^-[A-Za-z][A-Za-z0-9=_.,+-]*$/;
const FILENAME_SHAPE = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;
const RESERVED_NAMES: readonly string[] = [RESERVED_OUTPUT_NAME, RESERVED_PREPROCESSED_NAME];

/**
 * Preprocessor switches accepted in `cppFlags`: self-contained forms only, so
 * that no entry can consume the next argument or redirect the output. Every
 * other cccp switch (`-include`, `-M`, `-P`, `-o`, …) is rejected.
 */
const CPP_IDENT = '[A-Za-z_][A-Za-z0-9_]*';
const CPP_DEFINE = new RegExp(`^-D${CPP_IDENT}(?:\\(${CPP_IDENT}(?:,${CPP_IDENT})*\\))?(?:=.*)?$`);
const CPP_UNDEFINE = new RegExp(`^-U${CPP_IDENT}$`);
const CPP_WARNING = /^-W[A-Za-z][A-Za-z0-9-]*$/;
const CPP_SWITCHES: ReadonlySet<string> = new Set([
  '-pedantic',
  '-pedantic-errors',
  '-trigraphs',
  '-lang-c',
  '-traditional',
]);
// eslint-disable-next-line no-control-regex -- control characters are exactly what is rejected
const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

const encoder = new TextEncoder();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function byteLength(text: string): number {
  return encoder.encode(text).length;
}

function validateFilename(value: unknown): string {
  if (typeof value !== 'string') {
    throw new InvalidOptionsError('filename must be a string.');
  }
  if (RESERVED_NAMES.includes(value)) {
    throw new InvalidOptionsError(`filename ${JSON.stringify(value)} is reserved for the output.`);
  }
  if (value === '.' || value === '..' || !FILENAME_SHAPE.test(value)) {
    throw new InvalidOptionsError(
      `filename ${JSON.stringify(value)} must be a single path segment of letters, digits, '_', '-' or '.'.`,
    );
  }
  if (byteLength(value) > MAX_SEGMENT_BYTES) {
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
 * Validate a virtual path: relative, `/`-separated, every segment a plain
 * file name (no `.`, `..`, hidden or dash-prefixed names), at most 4096 bytes.
 */
export function validateVirtualPath(value: unknown, what = 'header path'): string {
  if (typeof value !== 'string') {
    throw new InvalidOptionsError(`${what} must be a string.`);
  }
  const shown = JSON.stringify(value);
  if (byteLength(value) > MAX_PATH_BYTES) {
    throw new InvalidOptionsError(`${what} ${shown} must be at most 4096 bytes.`);
  }
  if (value.includes('\\')) {
    throw new InvalidOptionsError(`${what} ${shown} must use '/' separators, not backslashes.`);
  }
  for (const segment of value.split('/')) {
    if (segment === '.' || segment === '..' || !FILENAME_SHAPE.test(segment)) {
      throw new InvalidOptionsError(
        `${what} ${shown} must be a relative path whose every segment is a name of letters, digits, '_', '-' or '.', not starting with '.' or '-'.`,
      );
    }
    if (byteLength(segment) > MAX_SEGMENT_BYTES) {
      throw new InvalidOptionsError(`${what} ${shown} has a segment longer than 255 bytes.`);
    }
  }
  return value;
}

function validateCppFlag(flag: unknown): string {
  if (typeof flag !== 'string') {
    throw new InvalidOptionsError('cppFlags must contain only strings.');
  }
  const shown = JSON.stringify(flag);
  const reject = (): never => {
    throw new InvalidOptionsError(
      `cppFlags entry ${shown} is not an accepted preprocessor switch (-D, -U, -I, -W, -pedantic, -pedantic-errors, -trigraphs, -lang-c, -traditional).`,
    );
  };
  if (CONTROL_CHARS.test(flag)) return reject();
  if (flag.startsWith('-I')) {
    const dir = flag.slice(2);
    if (dir === '.') return flag;
    try {
      validateVirtualPath(dir, 'cppFlags -I directory');
    } catch {
      return reject();
    }
    return flag;
  }
  if (
    CPP_DEFINE.test(flag) ||
    CPP_UNDEFINE.test(flag) ||
    CPP_WARNING.test(flag) ||
    CPP_SWITCHES.has(flag)
  ) {
    return flag;
  }
  return reject();
}

function validateCppFlags(value: unknown): readonly string[] {
  if (value === undefined) return DEFAULT_CPP_FLAGS;
  if (!Array.isArray(value)) {
    throw new InvalidOptionsError('cppFlags must be an array of strings.');
  }
  return value.map(validateCppFlag);
}

function validateEncoding(value: unknown): SourceEncoding {
  if (value === undefined) return 'utf8';
  if (value === 'utf8' || value === 'eucjp') return value;
  throw new InvalidOptionsError(
    `encoding must be 'utf8' or 'eucjp', not ${JSON.stringify(value)}.`,
  );
}

function toBytes(content: unknown, path: string): Uint8Array {
  if (typeof content === 'string') return encoder.encode(content);
  if (content instanceof Uint8Array) return new Uint8Array(content);
  throw new InvalidOptionsError(`header ${JSON.stringify(path)} must be a string or a Uint8Array.`);
}

function validateHeaders(
  value: unknown,
  filename: string,
  limits: CompilerLimits,
): readonly HeaderFile[] {
  if (value === undefined) return [];
  if (!isRecord(value)) {
    throw new InvalidOptionsError('headers must be an object mapping virtual paths to contents.');
  }
  const headers: HeaderFile[] = [];
  let total = 0;
  for (const [path, content] of Object.entries(value)) {
    validateVirtualPath(path);
    if (path === filename || RESERVED_NAMES.includes(path)) {
      throw new InvalidOptionsError(`header path ${JSON.stringify(path)} is reserved.`);
    }
    const data = toBytes(content, path);
    total += data.byteLength;
    headers.push({ path, data });
  }
  if (headers.length > limits.maxHeaderCount) {
    throw new InvalidOptionsError(
      `${String(headers.length)} headers were given; the limit (maxHeaderCount) is ${String(limits.maxHeaderCount)}.`,
    );
  }
  if (total > limits.maxHeaderBytes) {
    throw new InvalidOptionsError(
      `headers total ${String(total)} bytes; the limit (maxHeaderBytes) is ${String(limits.maxHeaderBytes)} bytes.`,
    );
  }
  headers.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  // A path may not name both a file and a directory (the source file included).
  const files = [filename, ...headers.map((h) => h.path)];
  for (const file of files) {
    const prefix = `${file}/`;
    const inside = files.find((other) => other.startsWith(prefix));
    if (inside !== undefined) {
      throw new InvalidOptionsError(
        `${JSON.stringify(file)} is a file, so it cannot also be a directory of ${JSON.stringify(inside)}.`,
      );
    }
  }
  return headers;
}

/**
 * Validate and normalize `CompilePreprocessedOptions`. Accepts `unknown` so
 * that JavaScript callers get the same errors as TypeScript callers.
 */
export function validateCompileOptions(
  options: unknown,
  limits: CompilerLimits,
  defaultFilename: string = DEFAULT_FILENAME,
): NormalizedCompileOptions {
  if (!isRecord(options)) {
    throw new InvalidOptionsError('options must be an object with at least a gpSize.');
  }
  const gpSize = options['gpSize'];
  if (gpSize !== 0 && gpSize !== 8) {
    throw new InvalidOptionsError('gpSize is required and must be 0 or 8.');
  }
  const filename =
    options['filename'] === undefined ? defaultFilename : validateFilename(options['filename']);
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

/** Validate and normalize `CompileSourceOptions`. */
export function validateSourceOptions(
  options: unknown,
  limits: CompilerLimits,
): NormalizedSourceOptions {
  const base = validateCompileOptions(options, limits, DEFAULT_SOURCE_FILENAME);
  const record = options as Record<string, unknown>;
  return {
    ...base,
    cppFlags: validateCppFlags(record['cppFlags']),
    headers: validateHeaders(record['headers'], base.filename, limits),
    encoding: validateEncoding(record['encoding']),
  };
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

/** Turn `compileSource()` input into its own byte buffer: UTF-8 for strings, a copy for bytes. */
export function normalizeSourceInput(source: unknown): Uint8Array {
  if (typeof source === 'string') return encoder.encode(source);
  if (source instanceof Uint8Array) return new Uint8Array(source);
  throw new InvalidOptionsError('source must be a string or a Uint8Array of C source.');
}

/** Merge caller overrides onto `DEFAULT_LIMITS`, validating each value. */
export function resolveLimits(overrides: Partial<CompilerLimits> | undefined): CompilerLimits {
  const merged: CompilerLimits = { ...DEFAULT_LIMITS, ...overrides };
  for (const key of [
    'maxSourceBytes',
    'defaultTimeoutMs',
    'initTimeoutMs',
    'maxHeaderBytes',
    'maxHeaderCount',
  ] as const) {
    if (!isPositiveInteger(merged[key])) {
      throw new InvalidOptionsError(`limits.${key} must be a positive integer.`);
    }
    if (key.endsWith('TimeoutMs') && merged[key] > MAX_TIMEOUT_MS) {
      throw new InvalidOptionsError(`limits.${key} must be at most ${String(MAX_TIMEOUT_MS)}.`);
    }
  }
  return merged;
}
