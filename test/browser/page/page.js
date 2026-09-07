// SPDX-License-Identifier: MIT
// Test harness page: exposes the library and a few helpers on window.psyq so
// Playwright specs can drive real compiles in a real browser.
import * as psyq from '../../../dist/index.js';
import { generate } from '../../../scripts/gen-stress-fixture.mjs';

const log = document.getElementById('log');

/** Fetch a fixture file relative to test/fixtures as bytes. */
async function fetchFixture(relative) {
  const response = await fetch(`/test/fixtures/${relative}`);
  if (!response.ok) throw new Error(`fixture ${relative}: HTTP ${String(response.status)}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Make a CompileResult structured-cloneable for page.evaluate(). */
async function summarize(result) {
  return {
    success: result.success,
    exitCode: result.exitCode,
    asmSha256: result.asm === undefined ? null : await sha256Hex(result.asm),
    asmLength: result.asm === undefined ? null : result.asm.length,
    textHasCr: result.text === undefined ? null : result.text.includes('\r'),
    diagnostics: result.diagnostics,
    rawStderr: result.rawStderr,
    compiler: result.compiler,
    timings: result.timings,
  };
}

function describeError(err) {
  return {
    name: err instanceof Error || err instanceof DOMException ? err.name : typeof err,
    code: err !== null && typeof err === 'object' && 'code' in err ? err.code : undefined,
    message: err instanceof Error || err instanceof DOMException ? err.message : String(err),
    isAbortError: psyq.isAbortError(err),
  };
}

window.psyq = {
  ...psyq,
  fetchFixture,
  sha256Hex,
  summarize,
  describeError,
  generate,
  log: (message) => {
    log.textContent += `${message}\n`;
  },
};
window.psyqReady = true;
