// SPDX-License-Identifier: MIT
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyFixtures } from '../../scripts/verify-fixtures.mjs';
import { fromRoot } from '../helpers/paths.js';
import { loadPins } from '../helpers/pins.js';

const temporary: string[] = [];
function directory(): string {
  const dir = mkdtempSync(join(tmpdir(), 'psyq-verification-'));
  temporary.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('isolated fixture verification', () => {
  function fixtures(): { original: string; generated: string } {
    const root = directory();
    const original = join(root, 'original');
    const generated = join(root, 'generated');
    mkdirSync(join(original, 'src'), { recursive: true });
    mkdirSync(join(original, 'expected', 'g8'), { recursive: true });
    writeFileSync(
      join(original, 'manifest.json'),
      JSON.stringify({
        fixtures: [
          {
            name: 'sample',
            filename: 'sample.i',
            input: 'src/sample.i',
            gpSize: 8,
            rawFlags: ['-O2'],
            expected: 'expected/g8/sample.s',
            expectedStderr: 'expected/g8/sample.err',
            expectedExitCode: 0,
          },
        ],
      }),
    );
    writeFileSync(join(original, 'src', 'sample.i'), 'int sample;');
    writeFileSync(join(original, 'expected', 'g8', 'sample.s'), 'asm\r\n');
    writeFileSync(join(original, 'expected', 'g8', 'sample.err'), 'warning\n');
    writeFileSync(join(original, 'SHA256SUMS'), 'test inventory\n');
    cpSync(original, generated, { recursive: true });
    writeFileSync(join(generated, 'exit-codes.txt'), 'sample g8 0\n');
    return { original, generated };
  }
  it('accepts matching output and reports changed inputs, diagnostics, status, and inventory', () => {
    const { original, generated } = fixtures();
    expect(verifyFixtures(original, generated)).toEqual([]);
    writeFileSync(join(generated, 'src', 'sample.i'), 'changed');
    writeFileSync(join(generated, 'expected', 'g8', 'sample.s'), 'asm\n');
    writeFileSync(join(generated, 'expected', 'g8', 'sample.err'), 'different warning');
    writeFileSync(join(generated, 'exit-codes.txt'), 'sample g8 33\n');
    writeFileSync(join(generated, 'SHA256SUMS'), 'changed inventory');
    expect(verifyFixtures(original, generated)).toEqual([
      'sample: exit status differs',
      'sample: s bytes differ',
      'sample: err bytes differ',
      'sample: preprocessed input differs',
      'fixture checksum inventory differs',
    ]);
    expect(readFileSync(join(original, 'src', 'sample.i'), 'utf8')).toBe('int sample;');
  });
  it('fails on missing output and refuses an unexpected diagnostics file', () => {
    const { original, generated } = fixtures();
    rmSync(join(generated, 'expected', 'g8', 'sample.s'));
    const manifestPath = join(original, 'manifest.json');
    const manifest = readFileSync(manifestPath, 'utf8').replace(
      ',"expectedStderr":"expected/g8/sample.err"',
      '',
    );
    writeFileSync(manifestPath, manifest);
    expect(verifyFixtures(original, generated)).toEqual([
      'sample: missing s output',
      'sample: unexpected err output',
    ]);
  });
});

describe('exported source verification', () => {
  it('works without Git metadata and rejects altered bytes, added files, and stale pins', () => {
    const root = directory();
    const build = join(root, 'build');
    mkdirSync(build);
    for (const file of ['lib.sh', 'pins.env', 'verify-source.sh'])
      cpSync(fromRoot('build', file), join(build, file));
    const pins = loadPins();
    const source = join(
      build,
      'vendor',
      'homebrew-psyq',
      pins.get('GCC_SUBDIR') ?? '',
      'gcc',
      'toplev.c',
    );
    mkdirSync(join(source, '..'), { recursive: true });
    writeFileSync(source, 'original source');
    const sums = execFileSync('bash', [
      '-c',
      'source "$1"; source_checksums',
      'bash',
      join(build, 'lib.sh'),
    ]);
    writeFileSync(join(build, 'source.SHA256SUMS'), sums);
    writeFileSync(
      join(build, 'source-pins.txt'),
      `${pins.get('HOMEBREW_PSYQ_SHA') ?? ''}\n${pins.get('GCC_TREE_SHA') ?? ''}\n`,
    );
    const verify = (): number | null => spawnSync('bash', [join(build, 'verify-source.sh')]).status;
    expect(verify()).toBe(0);
    writeFileSync(source, 'changed source');
    expect(verify()).toBe(1);
    writeFileSync(source, 'original source');
    writeFileSync(join(source, '..', 'extra.h'), 'extra');
    expect(verify()).toBe(1);
    rmSync(join(source, '..', 'extra.h'));
    writeFileSync(join(build, 'source-pins.txt'), 'stale\n');
    expect(verify()).toBe(1);
  });
});

describe('isolated verification of source fixtures', () => {
  function fixtures(): { original: string; generated: string } {
    const root = directory();
    const original = join(root, 'original');
    const generated = join(root, 'generated');
    mkdirSync(join(original, 'src'), { recursive: true });
    mkdirSync(join(original, 'expected', 'pp'), { recursive: true });
    writeFileSync(
      join(original, 'manifest.json'),
      JSON.stringify({
        fixtures: [],
        sources: [
          {
            name: 'codec-g8',
            source: 'src/codec.c',
            filename: 'codec.c',
            gpSize: 8,
            rawFlags: ['-O2'],
            expectedPreprocessed: 'src/codec.i',
            expected: 'expected/g8/codec.s',
            expectedExitCode: 0,
          },
          {
            name: 'hound-g8',
            source: 'src/hound.c',
            filename: 'hound.c',
            gpSize: 8,
            rawFlags: ['-O2'],
            expectedPreprocessed: 'src/hound.i',
            expectedStderr: 'expected/pp/hound.err',
            expectedExitCode: 33,
            expectedStage: 'preprocess',
          },
        ],
      }),
    );
    writeFileSync(join(original, 'src', 'codec.i'), '# 1 "codec.c"\nint codec;\n');
    writeFileSync(join(original, 'src', 'hound.i'), '# 1 "hound.c"\n');
    writeFileSync(join(original, 'expected', 'pp', 'hound.err'), 'hound.c:1: #error\n');
    writeFileSync(join(original, 'SHA256SUMS'), 'test inventory\n');
    cpSync(original, generated, { recursive: true });
    writeFileSync(join(generated, 'exit-codes.txt'), 'codec pp 0\nhound pp 33\ncodec g8 0\n');
    return { original, generated };
  }

  it('accepts matching output and reports each kind of drift', () => {
    const { original, generated } = fixtures();
    expect(verifyFixtures(original, generated)).toEqual([]);
    writeFileSync(join(generated, 'src', 'codec.i'), 'changed');
    writeFileSync(join(generated, 'expected', 'pp', 'codec.err'), 'codec.c:1: warning\n');
    writeFileSync(join(generated, 'expected', 'pp', 'hound.err'), 'hound.c:2: #error\n');
    writeFileSync(join(generated, 'exit-codes.txt'), 'codec pp 33\nhound pp 0\ncodec g8 0\n');
    writeFileSync(join(generated, 'SHA256SUMS'), 'changed inventory');
    expect(verifyFixtures(original, generated)).toEqual([
      'codec-g8: preprocess exit status differs',
      'codec-g8: unexpected preprocess err output',
      'codec-g8: preprocessed bytes differ',
      'hound-g8: preprocess exit status differs',
      'hound-g8: preprocess err bytes differ',
      'fixture checksum inventory differs',
    ]);
    rmSync(join(generated, 'expected', 'pp', 'hound.err'));
    rmSync(join(generated, 'src', 'hound.i'));
    expect(verifyFixtures(original, generated, false)).toEqual([
      'codec-g8: preprocess exit status differs',
      'codec-g8: unexpected preprocess err output',
      'hound-g8: preprocess exit status differs',
      'hound-g8: missing preprocess err output',
      'hound-g8: missing preprocessed output',
    ]);
  });
});
