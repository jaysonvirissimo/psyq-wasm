// SPDX-License-Identifier: MIT
import { readFileSync } from 'node:fs';
import { fromRoot } from './paths.js';

/**
 * Parse `build/pins.env`: `KEY=value` lines, optional double quotes around the
 * value, `#` comments, blank lines. Mirrors what `build/lib.sh` sources.
 */
export function parsePins(text: string): Map<string, string> {
  const pins = new Map<string, string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) throw new Error(`pins.env: malformed line: ${rawLine}`);
    const key = line.slice(0, eq);
    let value = line.slice(eq + 1);
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    pins.set(key, value);
  }
  return pins;
}

export function loadPins(): Map<string, string> {
  return parsePins(readFileSync(fromRoot('build', 'pins.env'), 'utf8'));
}
