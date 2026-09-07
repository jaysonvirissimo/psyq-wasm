// SPDX-License-Identifier: MIT
import { CompilerController, type WorkerHandle } from './controller.js';
import { resolveLimits } from './options.js';
import type { Compiler, CreateCompilerOptions } from './public-types.js';

/** What a host environment (browser or Node) must provide. */
export interface Platform {
  /** URL that relative overrides are resolved against (the entry module's own URL). */
  readonly baseUrl: URL;
  defaultWorkerUrl(): URL;
  /** The compiler, `cc1psx.wasm`. */
  defaultWasmUrl(): URL;
  /** The preprocessor, `cccp.wasm`. */
  defaultPreprocessorWasmUrl(): URL;
  loadModule(url: URL): Promise<WebAssembly.Module>;
  /** `undefined` means "the package's own worker", letting bundlers see the literal reference. */
  spawnWorker(url: URL | undefined): WorkerHandle;
}

function resolveUrl(value: string | URL | undefined, fallback: () => URL, base: URL): URL {
  if (value === undefined) return fallback();
  return value instanceof URL ? value : new URL(value, base);
}

/** Shared implementation behind both `createCompiler` entry points. */
export async function createCompilerWith(
  platform: Platform,
  options: CreateCompilerOptions | undefined,
): Promise<Compiler> {
  const limits = resolveLimits(options?.limits);
  const wasmUrl = resolveUrl(options?.wasmUrl, () => platform.defaultWasmUrl(), platform.baseUrl);
  const preprocessorWasmUrl = resolveUrl(
    options?.preprocessorWasmUrl,
    () => platform.defaultPreprocessorWasmUrl(),
    platform.baseUrl,
  );
  const workerUrl =
    options?.workerUrl === undefined
      ? undefined
      : resolveUrl(options.workerUrl, () => platform.defaultWorkerUrl(), platform.baseUrl);

  const [cc1, cccp] = await Promise.all([
    platform.loadModule(wasmUrl),
    platform.loadModule(preprocessorWasmUrl),
  ]);
  const controller = new CompilerController({
    modules: { cc1, cccp },
    limits,
    spawnWorker: () => platform.spawnWorker(workerUrl),
  });
  const info = await controller.start();

  return {
    info,
    compilePreprocessed: (source, compileOptions) => controller.compile(source, compileOptions),
    compileSource: (source, sourceOptions) => controller.compileSource(source, sourceOptions),
    dispose: () => {
      controller.dispose();
    },
  };
}
