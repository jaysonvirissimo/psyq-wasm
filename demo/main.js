// SPDX-License-Identifier: MIT
// Static demo: no bundler, no backend. Serve the repository root (npm run serve)
// and open /demo/.
import { DEFAULT_CPP_FLAGS, createCompiler, isAbortError } from '../dist/index.js';

const $ = (id) => document.getElementById(id);
const source = $('source');
const output = $('output');
const diagnostics = $('diagnostics');
const status = $('status');
const timings = $('timings');
const build = $('build');
const compileButton = $('compile');
const cancelButton = $('cancel');

const SAMPLE_SOURCE = `#include "codec.h"

struct Ration { int calories; short weight; unsigned char kind; };

int stock(struct Ration *r, int count)
{
    int total = 0;
    int i;
    for (i = 0; i < count; i++)
        total += r[i].calories * (r[i].kind == RATION_KIND_SPECIAL ? 2 : 1);
    return total;
}

unsigned pack(unsigned char r, unsigned char g, unsigned char b)
{
    return r | (g << 8) | (b << 16);
}
`;

const SAMPLE_HEADER = `#define RATION_KIND_SPECIAL 3
`;

const SAMPLE_PREPROCESSED = `# 1 "rations.c"
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

const cppFlagsInput = $('cppflags');
const encodingSelect = $('encoding');
const headerPath = $('header-path');
const headerText = $('header');
const filenameInput = $('filename');
const sourceLabel = $('source-label');

cppFlagsInput.value = DEFAULT_CPP_FLAGS.join(' ');
headerText.value = SAMPLE_HEADER;
source.value = SAMPLE_SOURCE;

function mode() {
  return document.querySelector('input[name="mode"]:checked').value;
}

function applyMode() {
  const sourceMode = mode() === 'source';
  for (const el of document.querySelectorAll('.source-only')) el.hidden = !sourceMode;
  sourceLabel.innerHTML = sourceMode
    ? 'C source (<code>.c</code>)'
    : 'Preprocessed C (<code>.i</code>)';
  if (sourceMode && source.value === SAMPLE_PREPROCESSED) source.value = SAMPLE_SOURCE;
  if (!sourceMode && source.value === SAMPLE_SOURCE) source.value = SAMPLE_PREPROCESSED;
  if (sourceMode && filenameInput.value === 'input.i') filenameInput.value = 'input.c';
  if (!sourceMode && filenameInput.value === 'input.c') filenameInput.value = 'input.i';
}

for (const radio of document.querySelectorAll('input[name="mode"]')) {
  radio.addEventListener('change', applyMode);
}
applyMode();

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
    const common = { gpSize, rawFlags, signal: abort.signal };
    const result =
      mode() === 'source'
        ? await compiler.compileSource(source.value, {
            ...common,
            filename: filenameInput.value || 'input.c',
            cppFlags: cppFlagsInput.value.split(/\s+/).filter((f) => f !== ''),
            encoding: encodingSelect.value,
            headers:
              headerText.value.trim() === '' || headerPath.value.trim() === ''
                ? {}
                : { [headerPath.value.trim()]: headerText.value },
          })
        : await compiler.compilePreprocessed(new TextEncoder().encode(source.value), {
            ...common,
            filename: filenameInput.value || 'input.i',
          });

    output.textContent = result.text ?? '';
    showDiagnostics(result.diagnostics, result.rawStderr);
    status.textContent = result.success
      ? `ok (${String(result.asm.length)} bytes)`
      : `${result.stage === 'preprocess' ? 'preprocessor' : 'compiler'} exited with code ${String(result.exitCode)}`;
    const preprocess =
      result.timings.preprocessMs === undefined
        ? ''
        : `preprocess ${result.timings.preprocessMs.toFixed(1)} ms · `;
    timings.textContent = `${preprocess}instantiate ${result.timings.instantiateMs.toFixed(1)} ms · compile ${result.timings.compileMs.toFixed(1)} ms`;
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
  build.textContent = `PsyQ ${compiler.info.psyqVersion} · GCC ${compiler.info.gccVersion} · cc1psx ${compiler.info.buildId} · cccp ${compiler.info.preprocessorBuildId}`;
  status.textContent = 'ready (⌘/Ctrl+Enter compiles)';
  setBusy(false);
} catch (err) {
  status.textContent = `failed to load compiler: ${err.message}`;
  console.error(err);
}
