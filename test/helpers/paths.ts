// SPDX-License-Identifier: MIT
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/** Absolute path of the repository root. */
export const ROOT: string = fileURLToPath(new URL('../..', import.meta.url));

/** Join path segments onto the repository root. */
export function fromRoot(...segments: string[]): string {
  return join(ROOT, ...segments);
}
