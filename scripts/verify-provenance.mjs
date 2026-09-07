// SPDX-License-Identifier: MIT
/**
 * Check that PROVENANCE.md, build/pins.env, and (when present) dist/build-info.json
 * agree with each other. Exits non-zero on any mismatch.
 *
 *   node scripts/verify-provenance.mjs [--tag vX.Y.Z]
 *
 * With --tag, also requires package.json's version to match the tag.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * @typedef {object} BuildInfo
 * @property {string} [buildId]
 * @property {string} [wasmSha256]
 * @property {string} [emsdkPlatform]
 * @property {string} [emsdkImage]
 * @property {string} [homebrewPsyqSha]
 * @property {string} [gccTreeSha]
 * @property {string} [cflags]
 * @property {string} [ldflags]
 */

/**
 * @typedef {object} VerifyInput
 * @property {string} provenance          contents of PROVENANCE.md
 * @property {Map<string, string>} pins   parsed build/pins.env
 * @property {BuildInfo} [buildInfo]      parsed dist/build-info.json, when built
 * @property {string} packageVersion      package.json version
 * @property {string} [tag]               release tag to check against the version
 */

/**
 * @param {string} text
 * @returns {Map<string, string>}
 */
export function parsePins(text) {
  const pins = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) throw new Error(`pins.env: malformed line: ${raw}`);
    let value = line.slice(eq + 1);
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    pins.set(line.slice(0, eq), value);
  }
  return pins;
}

/**
 * Return the list of problems found (empty when everything agrees).
 * @param {VerifyInput} input
 * @returns {string[]}
 */
export function verify({ provenance, pins, buildInfo, packageVersion, tag }) {
  /** @type {string[]} */
  const problems = [];
  /** @param {string} key @param {string | undefined} [value] */
  const mustContain = (key, value = pins.get(key)) => {
    if (value === undefined) problems.push(`pins.env is missing ${key}`);
    else if (!provenance.includes(value))
      problems.push(`PROVENANCE.md does not mention ${key}=${value}`);
  };
  for (const key of [
    'HOMEBREW_PSYQ_REPO',
    'HOMEBREW_PSYQ_SHA',
    'GCC_SUBDIR',
    'GCC_TREE_SHA',
    'SLINK_IMAGE',
    'EMSDK_IMAGE',
    'EMSDK_PLATFORM',
    'CC1_WASM_CFLAGS',
    'CC1_WASM_LDFLAGS',
    'CC1_VERSION_BANNER',
  ]) {
    mustContain(key);
  }
  if (buildInfo !== undefined) {
    /** @param {keyof BuildInfo} field @param {string} key */
    const expect = (field, key) => {
      if (buildInfo[field] !== pins.get(key)) {
        problems.push(
          `build-info.json ${field}=${String(buildInfo[field])} differs from pins ${key}=${String(pins.get(key))}`,
        );
      }
    };
    expect('emsdkImage', 'EMSDK_IMAGE');
    expect('emsdkPlatform', 'EMSDK_PLATFORM');
    expect('homebrewPsyqSha', 'HOMEBREW_PSYQ_SHA');
    expect('gccTreeSha', 'GCC_TREE_SHA');
    expect('cflags', 'CC1_WASM_CFLAGS');
    expect('ldflags', 'CC1_WASM_LDFLAGS');
    if (buildInfo.buildId !== `sha256:${String(buildInfo.wasmSha256).slice(0, 16)}`) {
      problems.push('build-info.json buildId is not derived from wasmSha256');
    }
  }
  if (tag !== undefined && `v${packageVersion}` !== tag) {
    problems.push(`package.json version ${packageVersion} does not match tag ${tag}`);
  }
  return problems;
}

const invokedDirectly =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const tagIndex = process.argv.indexOf('--tag');
  const tag = tagIndex === -1 ? undefined : process.argv[tagIndex + 1];
  const buildInfoPath = `${ROOT}dist/build-info.json`;
  const problems = verify({
    provenance: readFileSync(`${ROOT}PROVENANCE.md`, 'utf8'),
    pins: parsePins(readFileSync(`${ROOT}build/pins.env`, 'utf8')),
    buildInfo: existsSync(buildInfoPath)
      ? JSON.parse(readFileSync(buildInfoPath, 'utf8'))
      : undefined,
    packageVersion: JSON.parse(readFileSync(`${ROOT}package.json`, 'utf8')).version,
    tag,
  });
  for (const p of problems) console.error(`provenance: ${p}`);
  if (problems.length === 0) console.log('provenance: OK');
  process.exit(problems.length === 0 ? 0 : 1);
}
