// SPDX-License-Identifier: MIT
/**
 * Hand-written types for the Emscripten glue `dist/cccp.js` (the GCC 2.8.1
 * preprocessor, built by build/build-wasm.sh with the same settings as the
 * compiler glue; see cc1psx.d.ts for the shared module shape).
 */
import type { Cc1Factory } from './cc1psx.js';

/** Opaque identifier of the preprocessor artifact, appended at build time. */
export const BUILD_ID: string;

declare const createCccp: Cc1Factory;
export default createCccp;
