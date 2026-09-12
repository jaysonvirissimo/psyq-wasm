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
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { connect, createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const HERE = join(ROOT, 'test', 'package');
const OUT = join(HERE, 'out');
const skipVite = process.argv.includes('--skip-vite');
const rootPkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const tsVersion = rootPkg.devDependencies.typescript;
const typesNodeVersion = rootPkg.devDependencies['@types/node'];

function step(name) {
  console.log(`\n==> ${name}`);
}

function run(cmd, args, cwd) {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  // npm.cmd cannot be executed directly on Windows. Invoke npm's JS entry
  // with the current Node executable, preserving arguments without a shell.
  // The same applies to npx, so callers reach a package's bin through
  // nodeBin() rather than through npx.
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

/**
 * Path to a JS entry point of a dependency installed in one of the consumer
 * apps, to be run with `process.execPath`. Windows has no executable `npx`
 * for execFileSync to find, and going through a shell would need quoting.
 */
function nodeBin(app, ...segments) {
  return join(app, 'node_modules', ...segments);
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

/**
 * Resolve once something accepts TCP connections on 127.0.0.1:port, reject
 * if the child exits first or the deadline passes. Polling the port instead
 * of parsing the child's stdout keeps this independent of vite's output
 * format (colored when CI=true, for example).
 */
async function waitForPort(port, child, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let exitCode = null;
  child.on('exit', (code) => {
    exitCode = code;
  });
  while (Date.now() < deadline) {
    if (exitCode !== null) throw new Error(`vite preview exited with ${String(exitCode)}`);
    const open = await new Promise((resolveOpen) => {
      const socket = connect({ host: '127.0.0.1', port });
      socket.once('connect', () => {
        socket.destroy();
        resolveOpen(true);
      });
      socket.once('error', () => resolveOpen(false));
    });
    if (open) return;
    await new Promise((resolveTick) => setTimeout(resolveTick, 250));
  }
  throw new Error('vite preview did not start');
}

// ---------------------------------------------------------------------------
step('build check');
for (const rel of [
  'dist/cc1psx.wasm',
  'dist/cc1psx.js',
  'dist/cccp.wasm',
  'dist/cccp.js',
  'dist/index.js',
  'dist/index.node.js',
]) {
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
  'dist/cccp.wasm',
  'dist/cccp.js',
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
step('typescript consumer app');
const tsApp = join(OUT, 'ts-app');
cpSync(join(HERE, 'ts-app'), tsApp, { recursive: true });
writeFileSync(
  join(tsApp, 'package.json'),
  JSON.stringify(
    {
      name: 'psyq-wasm-ts-smoke',
      private: true,
      type: 'module',
      dependencies: { 'psyq-wasm': `file:${tarball}` },
      devDependencies: { typescript: tsVersion, '@types/node': typesNodeVersion },
    },
    null,
    2,
  ),
);
run('npm', ['install', '--no-audit', '--no-fund', '--no-package-lock', '--ignore-scripts'], tsApp);
// The JavaScript consumers above never look at a declaration file, so only this
// step can catch a package that resolves at runtime but not for a TS user.
run(process.execPath, [nodeBin(tsApp, 'typescript', 'bin', 'tsc'), '--noEmit'], tsApp);
assert(true, 'typescript consumer type-checks against the packed declarations');

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
  run(
    process.execPath,
    [nodeBin(viteApp, 'vite', 'bin', 'vite.js'), 'build', '--logLevel', 'warn'],
    viteApp,
  );
  const assets = readdirSync(join(viteApp, 'dist'), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
  assert(assets.filter((a) => a.endsWith('.wasm')).length >= 2, 'vite emitted both wasm assets');
  assert(
    assets.filter((a) => a.endsWith('.js')).length >= 2,
    'vite emitted a separate worker chunk',
  );

  const port = await freePort();
  // Bind explicitly to 127.0.0.1: without --host, vite listens on "localhost",
  // which Linux resolves to ::1 first, and the page navigation below (IPv4)
  // would be refused.
  const previewUrl = `http://127.0.0.1:${String(port)}/`;
  const preview = spawn(
    process.execPath,
    [
      nodeBin(viteApp, 'vite', 'bin', 'vite.js'),
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    { cwd: viteApp, stdio: ['ignore', 'inherit', 'inherit'] },
  );
  try {
    await waitForPort(port, preview, 30_000);
    const { chromium } = await import('@playwright/test');
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(previewUrl);
      await page.waitForFunction(() => window.result !== undefined, undefined, { timeout: 60_000 });
      const result = await page.evaluate(() => window.result);
      console.log(JSON.stringify(result));
      const expected = readFileSync(join(ROOT, 'test/fixtures/expected/g8/t01_arith.s'));
      const { createHash } = await import('node:crypto');
      assert(errors.length === 0, `no page errors (${errors.join('; ')})`);
      assert(result.success === true, 'vite consumer compile succeeded');
      assert(result.sourceSuccess === true, 'vite consumer compileSource succeeded');
      assert(
        result.sourceSha256 === createHash('sha256').update(expected).digest('hex'),
        'vite consumer compileSource output is byte-exact',
      );
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

// ---------------------------------------------------------------------------
/** Serve `root` and drive the page at `path` with headless Chromium. */
async function checkInBrowser(label, root, path, drive) {
  const port = await freePort();
  const server = spawn(process.execPath, [join(ROOT, 'scripts/serve.mjs'), String(port), root], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  try {
    await waitForPort(port, server, 30_000);
    const { chromium } = await import('@playwright/test');
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(`http://127.0.0.1:${String(port)}${path}`);
      await drive(page);
      assert(errors.length === 0, `${label}: no page errors (${errors.join('; ')})`);
    } finally {
      await browser.close();
    }
  } finally {
    server.kill();
  }
}

if (skipVite) {
  console.log('\n(browser ESM and Pages consumers skipped)');
} else {
  const { createHash } = await import('node:crypto');
  const expectedSha = createHash('sha256')
    .update(readFileSync(join(ROOT, 'test/fixtures/expected/g8/t01_arith.s')))
    .digest('hex');

  // -------------------------------------------------------------------------
  step('direct browser ESM consumer (no bundler)');
  const esmApp = join(OUT, 'esm-app');
  cpSync(join(HERE, 'esm-app'), esmApp, { recursive: true });
  cpSync(join(ROOT, 'test/fixtures/src/t01_arith.i'), join(esmApp, 't01_arith.i'));
  writeFileSync(
    join(esmApp, 'package.json'),
    JSON.stringify(
      {
        name: 'psyq-wasm-esm-smoke',
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
    esmApp,
  );
  await checkInBrowser('browser ESM', esmApp, '/', async (page) => {
    await page.waitForFunction(() => window.result !== undefined, undefined, { timeout: 60_000 });
    const result = await page.evaluate(() => window.result);
    console.log(JSON.stringify(result));
    assert(result.success === true, 'browser ESM: compile succeeded');
    assert(result.sha256 === expectedSha, 'browser ESM: output is byte-exact');
    assert(result.sourceSuccess === true, 'browser ESM: compileSource succeeded');
    assert(result.sourceSha256 === expectedSha, 'browser ESM: compileSource output is byte-exact');
  });

  // -------------------------------------------------------------------------
  step('GitHub Pages consumer (project subpath)');
  // Pages serves a project site from /<repo>/, not from the domain root, so the
  // site is assembled inside a subdirectory and served from its parent. Only a
  // fully relative site survives that.
  const pagesRoot = join(OUT, 'pages');
  const { assembleSite } = await import(
    pathToFileURL(join(ROOT, 'scripts/assemble-site.mjs')).href
  );
  assembleSite(join(pagesRoot, 'psyq-wasm'));
  await checkInBrowser('GitHub Pages', pagesRoot, '/psyq-wasm/demo/', async (page) => {
    // The compile button stays disabled until the compiler has loaded, so
    // waiting for it to enable proves both .wasm assets resolved from the
    // subpath.
    await page.waitForSelector('#compile:not([disabled])', { timeout: 60_000 });
    await page.click('#compile');
    await page.waitForFunction(
      () => /^ok \(\d+ bytes\)$/.test(document.getElementById('status')?.textContent ?? ''),
      undefined,
      { timeout: 60_000 },
    );
    const output = await page.evaluate(() => document.getElementById('output')?.textContent ?? '');
    console.log(
      `  demo status: ${await page.evaluate(() => document.getElementById('status')?.textContent)}`,
    );
    assert(output.includes('.text'), 'GitHub Pages: demo emitted assembly from a project subpath');
  });
}

console.log('\nPACKAGE-SMOKE-OK');
