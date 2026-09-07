// SPDX-License-Identifier: MIT
/**
 * Hand-written types for the Emscripten glue `dist/cc1psx.js` (built by
 * build/build-wasm.sh with MODULARIZE + EXPORT_ES6 and
 * EXPORTED_RUNTIME_METHODS=FS,callMain,ENV).
 */

export interface Cc1Fs {
  mkdir(path: string): void;
  chdir(path: string): void;
  writeFile(path: string, data: Uint8Array): void;
  readFile(path: string): Uint8Array;
}

export interface Cc1Module {
  readonly FS: Cc1Fs;
  readonly ENV: Record<string, string>;
  /** Runs `main(argv)`; returns the exit status. A wasm trap propagates as an exception. */
  callMain(args: readonly string[]): number;
}

export type InstantiateWasm = (
  imports: WebAssembly.Imports,
  receiveInstance: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void,
) => WebAssembly.Exports | Record<string, never>;

export interface Cc1ModuleOptions {
  instantiateWasm?: InstantiateWasm;
  print?: (line: string) => void;
  printErr?: (line: string) => void;
  preRun?: ((module: Cc1Module) => void)[];
}

export type Cc1Factory = (options?: Cc1ModuleOptions) => Promise<Cc1Module>;

/** Opaque identifier of the compiler artifact, appended at build time. */
export const BUILD_ID: string;

declare const createCc1: Cc1Factory;
export default createCc1;
