// SPDX-License-Identifier: MIT
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fromRoot } from '../helpers/paths.js';

interface PackageJson {
  name: string;
  version: string;
  type: string;
  license: string;
  sideEffects: boolean;
  engines: { node: string };
  files: string[];
  exports: Record<string, string | Record<string, string>>;
  dependencies?: Record<string, string>;
  scripts: Record<string, string>;
}

const pkg = JSON.parse(readFileSync(fromRoot('package.json'), 'utf8')) as PackageJson;

describe('package.json', () => {
  it('is an ESM package with no runtime dependencies', () => {
    expect(pkg.name).toBe('psyq-wasm');
    expect(pkg.type).toBe('module');
    expect(pkg.sideEffects).toBe(false);
    expect(pkg.dependencies).toBeUndefined();
    expect(pkg.engines.node).toMatch(/^>=\d+/);
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('ships dist and the license and provenance files only', () => {
    expect(pkg.files).toEqual(
      expect.arrayContaining(['dist/', 'LICENSE', 'LICENSES/', 'PROVENANCE.md', 'README.md']),
    );
    expect(pkg.files).not.toContain('src/');
    expect(pkg.files).not.toContain('build/');
  });

  it('exposes browser and Node entry points plus the worker and wasm assets', () => {
    const root = pkg.exports['.'];
    expect(root).toEqual({
      types: './dist/index.d.ts',
      node: './dist/index.node.js',
      default: './dist/index.js',
    });
    expect(pkg.exports['./worker']).toBe('./dist/worker.js');
    expect(pkg.exports['./worker.node']).toBe('./dist/worker.node.js');
    expect(pkg.exports['./cc1psx.wasm']).toBe('./dist/cc1psx.wasm');
    expect(pkg.exports['./package.json']).toBe('./package.json');
  });

  it('wires the CI scripts', () => {
    for (const script of [
      'format:check',
      'lint',
      'typecheck',
      'test:coverage',
      'test:node',
      'test:browser',
      'test:package',
      'build:wasm',
      'build:ts',
    ]) {
      expect(pkg.scripts[script], script).toBeDefined();
    }
  });
});
