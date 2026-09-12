// SPDX-License-Identifier: MIT
import { createCompiler } from 'psyq-wasm';

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const out = document.getElementById('out');
try {
  const compiler = await createCompiler();
  const source = new Uint8Array(await (await fetch('./t01_arith.i')).arrayBuffer());
  const result = await compiler.compilePreprocessed(source, {
    gpSize: 8,
    filename: 't01_arith.i',
    rawFlags: ['-O2', '-g0', '-Wall'],
  });
  const raw = new TextDecoder().decode(source).replace(/^# 1 "t01_arith\.c"\n/, '');
  const fromSource = await compiler.compileSource(raw, {
    gpSize: 8,
    filename: 't01_arith.c',
    rawFlags: ['-O2', '-g0', '-Wall'],
  });
  window.result = {
    success: result.success,
    buildId: compiler.info.buildId,
    sha256: result.asm === undefined ? null : await sha256Hex(result.asm),
    sourceSuccess: fromSource.success,
    sourceSha256: fromSource.asm === undefined ? null : await sha256Hex(fromSource.asm),
  };
  out.textContent = JSON.stringify(window.result, null, 2);
  compiler.dispose();
} catch (error) {
  window.result = { success: false, error: String(error) };
  out.textContent = String(error);
}
