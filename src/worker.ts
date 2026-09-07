// SPDX-License-Identifier: MIT
// Browser worker bootstrap. Excluded from unit coverage (see CONTRIBUTING.md);
// exercised end to end by the Playwright suite.
import createCc1, { BUILD_ID } from './cc1psx.js';
import type { MessagePortLike } from './protocol.js';
import { attachRuntime } from './worker-port.js';
import { createWorkerRuntime } from './worker-runtime.js';

attachRuntime(
  globalThis as unknown as MessagePortLike,
  createWorkerRuntime({ createModule: createCc1, buildId: BUILD_ID }),
);
