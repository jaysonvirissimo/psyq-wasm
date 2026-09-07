// SPDX-License-Identifier: MIT
/**
 * Glue between a message port (Web Worker global scope or a `worker_threads`
 * parent port) and the worker runtime.
 */
import type { MessagePortLike, WorkerToMainMessage } from './protocol.js';
import type { WorkerRuntime } from './worker-runtime.js';

export type { WorkerRuntime } from './worker-runtime.js';

function describeError(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

function requestId(message: unknown): number | undefined {
  if (typeof message === 'object' && message !== null && 'id' in message) {
    return typeof message.id === 'number' ? message.id : undefined;
  }
  return undefined;
}

/**
 * Route incoming messages to `runtime.handle` one at a time and post each
 * reply, transferring the output buffers (assembly, preprocessed source) when
 * present. A buffer shared by both views is transferred once.
 */
function transferList(reply: WorkerToMainMessage): ArrayBuffer[] {
  if (reply.type !== 'result') return [];
  const buffers = new Set<ArrayBuffer>();
  for (const view of [reply.asm, reply.preprocessed]) {
    if (view !== undefined) buffers.add(view.buffer as ArrayBuffer);
  }
  return [...buffers];
}

export function attachRuntime(port: MessagePortLike, runtime: WorkerRuntime): void {
  let chain: Promise<void> = Promise.resolve();
  port.onmessage = (event) => {
    const { data } = event;
    chain = chain.then(async () => {
      try {
        const reply = await runtime.handle(data);
        const transfer = transferList(reply);
        if (transfer.length > 0) {
          port.postMessage(reply, transfer);
        } else {
          port.postMessage(reply);
        }
      } catch (err) {
        const id = requestId(data);
        port.postMessage(
          id === undefined
            ? { type: 'crash', message: describeError(err) }
            : { type: 'crash', id, message: describeError(err) },
        );
      }
    });
  };
}

/** The part of `worker_threads.MessagePort` the adapter needs. */
export interface NodeParentPortLike {
  postMessage(value: unknown, transferList?: ArrayBuffer[]): void;
  on(event: 'message', listener: (value: unknown) => void): unknown;
}

/** Adapt a `worker_threads` parent port to the browser-style `MessagePortLike`. */
export function nodePortAdapter(parentPort: NodeParentPortLike): MessagePortLike {
  let handler: MessagePortLike['onmessage'] = null;
  parentPort.on('message', (value) => {
    handler?.({ data: value });
  });
  return {
    postMessage(message, transfer) {
      parentPort.postMessage(message, transfer);
    },
    get onmessage() {
      return handler;
    },
    set onmessage(value) {
      handler = value;
    },
  };
}
