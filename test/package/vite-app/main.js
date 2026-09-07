// SPDX-License-Identifier: MIT
// Vite consumer: bundle psyq-wasm with default settings and compile a fixture.
import { createCompiler } from 'psyq-wasm';

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const out = document.getElementById('out');
try {
  const compiler = await createCompiler();
  const source = new Uint8Array(await (await fetch('/t01_arith.i')).arrayBuffer());
  const result = await compiler.compilePreprocessed(source, {
    gpSize: 8,
    filename: 't01_arith.i',
    rawFlags: ['-O2', '-g0', '-Wall'],
  });
  window.result = {
    success: result.success,
    buildId: compiler.info.buildId,
    sha256: result.asm === undefined ? null : await sha256Hex(result.asm),
  };
  compiler.dispose();
} catch (err) {
  window.result = { success: false, error: String(err) };
}
out.textContent = JSON.stringify(window.result, null, 2);
