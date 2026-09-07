// SPDX-License-Identifier: MIT
import {
  RESERVED_OUTPUT_NAME,
  RESERVED_PREPROCESSED_NAME,
  type NormalizedCompileOptions,
  type NormalizedSourceOptions,
} from './options.js';

/**
 * Build the cc1psx argument vector (without argv[0]). The wrapper owns
 * `-quiet`, `-G`, the input path, and `-o`; everything else comes from
 * `rawFlags` in the caller's order.
 */
export function buildArgv(
  options: Pick<NormalizedCompileOptions, 'gpSize' | 'filename' | 'rawFlags'>,
): string[] {
  return [
    '-quiet',
    '-G',
    String(options.gpSize),
    ...options.rawFlags,
    options.filename,
    '-o',
    RESERVED_OUTPUT_NAME,
  ];
}

/**
 * Preprocessor switches used when `compileSource()` is called without
 * `cppFlags`: the PsyQ 4.4 predefined macros as the reference fixtures were
 * generated with. Callers replace the whole list to change them (for example
 * to add `-DINTEGRAL` or `-I` directories); `-nostdinc` and `-undef` are
 * always supplied by the wrapper.
 */
export const DEFAULT_CPP_FLAGS: readonly string[] = Object.freeze([
  '-D__GNUC__=2',
  '-D__OPTIMIZE__',
  '-lang-c',
  '-Dmips',
  '-D__mips__',
  '-D__mips',
  '-Dpsx',
  '-D__psx__',
  '-D__psx',
  '-D_PSYQ',
  '-D__EXTENSIONS__',
  '-D_MIPSEL',
  '-D__CHAR_UNSIGNED__',
  '-D_LANGUAGE_C',
  '-DLANGUAGE_C',
]);

/**
 * Build the cccp argument vector (without argv[0]). The wrapper owns
 * `-nostdinc`, `-undef`, and the two positional paths; `cppFlags` come from the
 * caller in order.
 */
export function buildCppArgv(
  options: Pick<NormalizedSourceOptions, 'filename' | 'cppFlags'>,
): string[] {
  return ['-nostdinc', '-undef', ...options.cppFlags, options.filename, RESERVED_PREPROCESSED_NAME];
}
