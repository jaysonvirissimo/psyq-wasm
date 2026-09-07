// SPDX-License-Identifier: MIT
import { RESERVED_OUTPUT_NAME, type NormalizedCompileOptions } from './options.js';

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
