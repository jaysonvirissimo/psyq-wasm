// SPDX-License-Identifier: MIT
// Node worker bootstrap. Excluded from unit coverage (see CONTRIBUTING.md);
// exercised end to end by the Node integration suite.
import { parentPort } from 'node:worker_threads';
import createCc1, { BUILD_ID } from './cc1psx.js';
import { attachRuntime, nodePortAdapter } from './worker-port.js';
import { createWorkerRuntime } from './worker-runtime.js';

if (parentPort === null) {
  throw new Error('worker.node.js must be loaded inside a worker_threads Worker');
}

attachRuntime(
  nodePortAdapter(parentPort),
  createWorkerRuntime({ createModule: createCc1, buildId: BUILD_ID }),
);
