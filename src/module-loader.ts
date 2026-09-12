// SPDX-License-Identifier: MIT
import { InternalError } from './errors.js';

export interface ModuleLoaderDeps {
  /** Used for every non-`file:` URL. Defaults to the global `fetch`. */
  readonly fetch?: (url: URL) => Promise<Response>;
  /** Used for `file:` URLs (Node). Absent in browsers. */
  readonly readFile?: (url: URL) => Promise<Uint8Array>;
}

async function loadBytes(url: URL, deps: ModuleLoaderDeps): Promise<Uint8Array> {
  if (url.protocol === 'file:') {
    if (deps.readFile === undefined) {
      throw new InternalError(`cannot load ${url.href}: file: URLs need a file reader`);
    }
    return deps.readFile(url);
  }
  const fetchFn = deps.fetch ?? ((u: URL) => fetch(u));
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new InternalError(
      `failed to fetch ${url.href}: HTTP ${String(response.status)} ${response.statusText}`,
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Fetch (or read) and compile the compiler module once. The result is retained
 * by the controller and shared with every worker it spawns.
 */
export async function loadWasmModule(
  url: URL,
  deps: ModuleLoaderDeps = {},
): Promise<WebAssembly.Module> {
  let bytes: Uint8Array;
  try {
    bytes = await loadBytes(url, deps);
  } catch (error) {
    if (error instanceof InternalError) throw error;
    throw new InternalError(`failed to load ${url.href}`, { cause: error });
  }
  try {
    return await WebAssembly.compile(new Uint8Array(bytes));
  } catch (error) {
    throw new InternalError(`failed to compile ${url.href} as WebAssembly`, { cause: error });
  }
}
