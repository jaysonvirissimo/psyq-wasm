// SPDX-License-Identifier: MIT
// Static demo: no bundler, no backend. Serve the repository root (npm run serve)
// and open /demo/.
import { createCompiler, isAbortError } from '../dist/index.js';

const $ = (id) => document.getElementById(id);
const source = $('source');
const output = $('output');
const diagnostics = $('diagnostics');
const status = $('status');
const timings = $('timings');
const build = $('build');
const compileButton = $('compile');
const cancelButton = $('cancel');

const SAMPLE = `# 1 "rations.c"
struct Ration { int calories; short weight; unsigned char kind; };

int stock(struct Ration *r, int count)
{
    int total = 0;
    int i;
    for (i = 0; i < count; i++)
        total += r[i].calories * (r[i].kind == 3 ? 2 : 1);
    return total;
}

unsigned pack(unsigned char r, unsigned char g, unsigned char b)
{
    return r | (g << 8) | (b << 16);
}
`;

source.value = SAMPLE;

let compiler;
let abort;

function setBusy(busy) {
  compileButton.disabled = busy;
  cancelButton.disabled = !busy;
}

function showDiagnostics(list, rawStderr) {
  diagnostics.replaceChildren();
  if (list.length === 0 && rawStderr.trim() !== '') {
    const pre = document.createElement('pre');
    pre.textContent = rawStderr;
    diagnostics.append(pre);
    return;
  }
  for (const d of list) {
    const line = document.createElement('div');
    line.className = d.severity;
    const where = d.file === undefined ? '' : `${d.file}:${String(d.line ?? '')}: `;
    line.textContent = `${where}${d.severity}: ${d.message}`;
    diagnostics.append(line);
  }
}

async function compile() {
  if (compiler === undefined) return;
  abort = new AbortController();
  setBusy(true);
  status.textContent = 'compiling…';
  const gpSize = Number(document.querySelector('input[name="gp"]:checked').value);
  const rawFlags = $('flags')
    .value.split(/\s+/)
    .filter((f) => f !== '');
  try {
    const result = await compiler.compilePreprocessed(new TextEncoder().encode(source.value), {
      gpSize,
      rawFlags,
      filename: $('filename').value || 'input.i',
      signal: abort.signal,
    });
    output.textContent = result.text ?? '';
    showDiagnostics(result.diagnostics, result.rawStderr);
    status.textContent = result.success
      ? `ok (${String(result.asm.length)} bytes)`
      : `compiler exited with code ${String(result.exitCode)}`;
    timings.textContent = `instantiate ${result.timings.instantiateMs.toFixed(1)} ms · compile ${result.timings.compileMs.toFixed(1)} ms`;
  } catch (err) {
    if (isAbortError(err)) {
      status.textContent = 'cancelled';
    } else {
      status.textContent = `${err.name}: ${err.message}`;
      console.error(err);
    }
    output.textContent = '';
    diagnostics.replaceChildren();
    timings.textContent = '';
  } finally {
    setBusy(false);
  }
}

compileButton.addEventListener('click', () => {
  void compile();
});
cancelButton.addEventListener('click', () => abort?.abort());
source.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault();
    void compile();
  }
});

try {
  compiler = await createCompiler();
  build.textContent = `PsyQ ${compiler.info.psyqVersion} · GCC ${compiler.info.gccVersion} · ${compiler.info.buildId}`;
  status.textContent = 'ready (⌘/Ctrl+Enter compiles)';
  setBusy(false);
} catch (err) {
  status.textContent = `failed to load compiler: ${err.message}`;
  console.error(err);
}
