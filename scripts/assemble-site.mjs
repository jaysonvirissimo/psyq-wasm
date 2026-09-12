// SPDX-License-Identifier: MIT
/**
 * Assemble the static demo site deployed to GitHub Pages.
 *
 *   node scripts/assemble-site.mjs <out-dir>
 *
 * The Pages workflow and the packaging test both call this, so the layout the
 * test exercises is the layout that actually ships. Everything the demo loads
 * is relative, which is what lets the site work from a project subpath
 * (user.github.io/psyq-wasm/) rather than only from a domain root.
 */
import { cpSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * @param {string} outDir directory to create the site in
 * @returns {string[]} the dist files copied
 */
export function assembleSite(outDir) {
  const site = resolve(outDir);
  mkdirSync(join(site, 'dist'), { recursive: true });
  cpSync(join(ROOT, 'demo'), join(site, 'demo'), { recursive: true });

  const copied = readdirSync(join(ROOT, 'dist')).filter(
    (name) => name.endsWith('.js') || name.endsWith('.wasm') || name === 'build-info.json',
  );
  for (const name of copied) cpSync(join(ROOT, 'dist', name), join(site, 'dist', name));

  writeFileSync(
    join(site, 'index.html'),
    '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=demo/">\n',
  );
  return copied;
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href
) {
  const outDir = process.argv[2];
  if (outDir === undefined) {
    console.error('usage: node scripts/assemble-site.mjs <out-dir>');
    process.exit(2);
  }
  const copied = assembleSite(outDir);
  console.log(`assembled site in ${resolve(outDir)} (${String(copied.length)} dist files)`);
}
