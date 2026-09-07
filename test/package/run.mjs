// SPDX-License-Identifier: MIT
/**
 * Package smoke test: pack the library with `npm pack`, check the tarball
 * contents, install it into two small consumer applications, and run them.
 *
 *   node test/package/run.mjs [--skip-vite]
 *
 * Requires a full build (`npm run build`) and network access for installing
 * the consumer apps' dependencies.
 */
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const HERE = join(ROOT, 'test', 'package');
const OUT = join(HERE, 'out');
const skipVite = process.argv.includes('--skip-vite');

function step(name) {
  console.log(`\n==> ${name}`);
}

function run(cmd, args, cwd) {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  // npm.cmd cannot be executed directly on Windows. Invoke npm's JS entry
  // with the current Node executable, preserving arguments without a shell.
  const npmCli =
    process.env.npm_execpath ?? join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  const useNpmCli = cmd === 'npm' && existsSync(npmCli);
  return execFileSync(useNpmCli ? process.execPath : cmd, useNpmCli ? [npmCli, ...args] : args, {
    cwd,
    stdio: ['ignore', 'pipe', 'inherit'],
    encoding: 'utf8',
    env: { ...process.env, PSYQ_FIXTURES: join(ROOT, 'test', 'fixtures') },
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`ok   ${message}`);
}

async function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

// ---------------------------------------------------------------------------
step('build check');
for (const rel of ['dist/cc1psx.wasm', 'dist/cc1psx.js', 'dist/index.js', 'dist/index.node.js']) {
  assert(existsSync(join(ROOT, rel)), `${rel} exists (run npm run build first)`);
}

// ---------------------------------------------------------------------------
step('npm pack');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const packJson = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', OUT], ROOT));
const tarball = join(OUT, packJson[0].filename);
const files = packJson[0].files.map((f) => f.path);
console.log(`packed ${packJson[0].filename} (${String(files.length)} files)`);
for (const required of [
  'dist/cc1psx.wasm',
  'dist/cc1psx.js',
  'dist/worker.js',
  'dist/worker.node.js',
  'dist/index.js',
  'dist/index.node.js',
  'dist/index.d.ts',
  'dist/build-info.json',
  'LICENSE',
  'LICENSES/MIT.txt',
  'LICENSES/GPL-2.0-only.txt',
  'PROVENANCE.md',
  'README.md',
]) {
  assert(files.includes(required), `tarball contains ${required}`);
}
assert(!files.some((f) => f.startsWith('src/')), 'tarball has no src/');
assert(!files.some((f) => f.startsWith('build/')), 'tarball has no build/');
assert(!files.some((f) => f.startsWith('test/')), 'tarball has no test/');

// ---------------------------------------------------------------------------
step('node consumer app');
const nodeApp = join(OUT, 'node app #encoded');
cpSync(join(HERE, 'node-app'), nodeApp, { recursive: true });
writeFileSync(
  join(nodeApp, 'package.json'),
  JSON.stringify(
    {
      name: 'psyq-wasm-node-smoke',
      private: true,
      type: 'module',
      dependencies: { 'psyq-wasm': `file:${tarball}` },
    },
    null,
    2,
  ),
);
run(
  'npm',
  ['install', '--no-audit', '--no-fund', '--no-package-lock', '--ignore-scripts'],
  nodeApp,
);
const nodeOut = run(process.execPath, ['main.mjs'], nodeApp);
console.log(nodeOut.trim());
assert(nodeOut.includes('NODE-SMOKE-OK'), 'node consumer compiled the fixture byte-exactly');

// ---------------------------------------------------------------------------
if (skipVite) {
  console.log('\n(vite consumer app skipped)');
} else {
  step('vite consumer app');
  const viteApp = join(OUT, 'vite-app');
  cpSync(join(HERE, 'vite-app'), viteApp, { recursive: true });
  mkdirSync(join(viteApp, 'public'), { recursive: true });
  cpSync(join(ROOT, 'test/fixtures/src/t01_arith.i'), join(viteApp, 'public', 't01_arith.i'));
  writeFileSync(
    join(viteApp, 'package.json'),
    JSON.stringify(
      {
        name: 'psyq-wasm-vite-smoke',
        private: true,
        type: 'module',
        dependencies: { 'psyq-wasm': `file:${tarball}` },
        devDependencies: { vite: '^8.0.0' },
      },
      null,
      2,
    ),
  );
  run(
    'npm',
    ['install', '--no-audit', '--no-fund', '--no-package-lock', '--ignore-scripts'],
    viteApp,
  );
  run('npx', ['vite', 'build', '--logLevel', 'warn'], viteApp);
  const assets = execFileSync('find', [join(viteApp, 'dist'), '-type', 'f'], { encoding: 'utf8' })
    .trim()
    .split('\n');
  assert(
    assets.some((a) => a.endsWith('.wasm')),
    'vite emitted the wasm asset',
  );
  assert(
    assets.filter((a) => a.endsWith('.js')).length >= 2,
    'vite emitted a separate worker chunk',
  );

  const port = await freePort();
  const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
    cwd: viteApp,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  try {
    await new Promise((resolveReady, reject) => {
      const timer = setTimeout(() => reject(new Error('vite preview did not start')), 30_000);
      preview.stdout.on('data', (chunk) => {
        if (String(chunk).includes('http')) {
          clearTimeout(timer);
          resolveReady();
        }
      });
      preview.on('exit', (code) => reject(new Error(`vite preview exited with ${String(code)}`)));
    });
    const { chromium } = await import('@playwright/test');
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(`http://127.0.0.1:${String(port)}/`);
      await page.waitForFunction(() => window.result !== undefined, undefined, { timeout: 60_000 });
      const result = await page.evaluate(() => window.result);
      console.log(JSON.stringify(result));
      const expected = readFileSync(join(ROOT, 'test/fixtures/expected/g8/t01_arith.s'));
      const { createHash } = await import('node:crypto');
      assert(errors.length === 0, `no page errors (${errors.join('; ')})`);
      assert(result.success === true, 'vite consumer compile succeeded');
      assert(
        result.sha256 === createHash('sha256').update(expected).digest('hex'),
        'vite consumer output is byte-exact',
      );
    } finally {
      await browser.close();
    }
  } finally {
    preview.kill();
  }
}

console.log('\nPACKAGE-SMOKE-OK');
