// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { loadPins, parsePins } from '../helpers/pins.js';

const SHA1 = /^[0-9a-f]{40}$/;
const OCI_DIGEST = /^[a-z0-9./-]+@sha256:[0-9a-f]{64}$/;

describe('build/pins.env', () => {
  const pins = loadPins();

  it.each([
    ['HOMEBREW_PSYQ_REPO', /^https:\/\/github\.com\/nocato\/homebrew-psyq$/],
    ['HOMEBREW_PSYQ_SHA', SHA1],
    ['HOMEBREW_PSYQ_VERSION', /^\d+\.\d+\.\d+$/],
    ['GCC_SUBDIR', /^gcc-2\.8\.1_psyq-4\.4$/],
    ['GCC_TREE_SHA', SHA1],
    ['SLINK_IMAGE', OCI_DIGEST],
    ['SLINK_PLATFORM', /^linux\/386$/],
    ['SLINK_PACKAGES', /\bgcc\b.*\bbison\b.*\bgperf\b/],
    ['EMSDK_IMAGE', OCI_DIGEST],
    ['EMSDK_PLATFORM', /^linux\/amd64$/],
    ['TARGET_NAME', /^mips-psx$/],
    [
      'CC1_VERSION_BANNER',
      /^GNU C version 2\.8\.1, Psy-Q 4\.4, Homebrew Psy-Q \d+\.\d+\.\d+ \(mips-psx\)/,
    ],
    ['CC1_WASM_CFLAGS', /-std=gnu89/],
    ['CC1_WASM_LDFLAGS', /-sEMULATE_FUNCTION_POINTER_CASTS=1/],
    ['CCCP_WASM_LDFLAGS', /-sEXPORT_NAME=createCccp/],
    ['CPP_VERSION_BANNER', /^GNU CPP version 2\.8\.1, Psy-Q 4\.4, Homebrew Psy-Q \d+\.\d+\.\d+/],
  ])('pins %s', (key, pattern) => {
    expect(pins.get(key), key).toMatch(pattern);
  });

  it('keeps the conservative compile flags', () => {
    const cflags = pins.get('CC1_WASM_CFLAGS') ?? '';
    for (const flag of [
      '-O2',
      '-flto',
      '-std=gnu89',
      '-fno-strict-aliasing',
      '-fwrapv',
      '-DCROSS_COMPILE',
      '-DIN_GCC',
      '-DHAVE_CONFIG_H',
    ]) {
      expect(cflags.split(' ')).toContain(flag);
    }
  });

  it('links as a modularized ES module for web, worker, and node without threads', () => {
    const ldflags = (pins.get('CC1_WASM_LDFLAGS') ?? '').split(' ');
    expect(ldflags).toContain('-sMODULARIZE=1');
    expect(ldflags).toContain('-sEXPORT_ES6=1');
    expect(ldflags).toContain('-sEXPORT_NAME=createCc1');
    expect(ldflags).toContain('-sENVIRONMENT=web,worker,node');
    expect(ldflags).toContain('-sFORCE_FILESYSTEM=1');
    expect(ldflags).toContain('-sINVOKE_RUN=0');
    expect(ldflags).toContain('-sEXPORTED_RUNTIME_METHODS=FS,callMain,ENV');
    expect(ldflags.join(' ')).not.toMatch(/PTHREAD|SHARED_MEMORY|MEMORY64/);
  });

  it('links the preprocessor exactly like the compiler, under its own export name', () => {
    expect(pins.get('CCCP_WASM_LDFLAGS')).toBe(
      (pins.get('CC1_WASM_LDFLAGS') ?? '').replace(
        '-sEXPORT_NAME=createCc1',
        '-sEXPORT_NAME=createCccp',
      ),
    );
    expect(pins.get('CCCP_WASM_LDFLAGS')).not.toBe(pins.get('CC1_WASM_LDFLAGS'));
  });

  it('parses quoted values and ignores comments', () => {
    const parsed = parsePins('# codec\nFREQ="140.85"\nNAME=otacon\n\n');
    expect(parsed.get('FREQ')).toBe('140.85');
    expect(parsed.get('NAME')).toBe('otacon');
    expect(() => parsePins('nonsense')).toThrow(/malformed/);
  });
});
