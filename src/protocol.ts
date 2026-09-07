// SPDX-License-Identifier: MIT
/**
 * Message protocol between the main-thread controller and the compiler worker.
 * Both directions are validated with type guards because messages cross a
 * structured-clone boundary and the worker may be replaced at any time.
 */
import type { CompileTimings } from './public-types.js';

export interface InitMessage {
  readonly type: 'init';
  /** The compiled module retained by the controller; instantiated afresh per compile. */
  readonly module: WebAssembly.Module;
}

export interface CompileMessage {
  readonly type: 'compile';
  readonly id: number;
  readonly filename: string;
  readonly argv: readonly string[];
  readonly source: Uint8Array;
}

export type MainToWorkerMessage = InitMessage | CompileMessage;

export interface ReadyMessage {
  readonly type: 'ready';
  readonly buildId: string;
}

export interface ResultMessage {
  readonly type: 'result';
  readonly id: number;
  readonly exitCode: number;
  readonly asm?: Uint8Array;
  readonly stdout: string;
  readonly stderr: string;
  readonly timings: CompileTimings;
}

export interface CrashMessage {
  readonly type: 'crash';
  /** Request being processed when the crash happened, if any. */
  readonly id?: number;
  readonly message: string;
}

export type WorkerToMainMessage = ReadyMessage | ResultMessage | CrashMessage;

/** The subset of a worker/port surface the runtime needs; satisfied by `DedicatedWorkerGlobalScope`. */
export interface MessagePortLike {
  postMessage(message: unknown, transfer?: ArrayBuffer[]): void;
  onmessage: ((event: { data: unknown }) => void) | null;
}

/** Monotonic request ids, starting at 1. */
export function createRequestIdGenerator(): () => number {
  let next = 0;
  return () => {
    next += 1;
    return next;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isTimings(value: unknown): value is CompileTimings {
  return (
    isRecord(value) &&
    typeof value['instantiateMs'] === 'number' &&
    typeof value['compileMs'] === 'number' &&
    typeof value['totalMs'] === 'number'
  );
}

export function isMainToWorkerMessage(value: unknown): value is MainToWorkerMessage {
  if (!isRecord(value)) return false;
  switch (value['type']) {
    case 'init':
      return value['module'] instanceof WebAssembly.Module;
    case 'compile':
      return (
        typeof value['id'] === 'number' &&
        typeof value['filename'] === 'string' &&
        isStringArray(value['argv']) &&
        value['source'] instanceof Uint8Array
      );
    default:
      return false;
  }
}

export function isWorkerToMainMessage(value: unknown): value is WorkerToMainMessage {
  if (!isRecord(value)) return false;
  switch (value['type']) {
    case 'ready':
      return typeof value['buildId'] === 'string';
    case 'result':
      return (
        typeof value['id'] === 'number' &&
        typeof value['exitCode'] === 'number' &&
        (value['asm'] === undefined || value['asm'] instanceof Uint8Array) &&
        typeof value['stdout'] === 'string' &&
        typeof value['stderr'] === 'string' &&
        isTimings(value['timings'])
      );
    case 'crash':
      return (
        (value['id'] === undefined || typeof value['id'] === 'number') &&
        typeof value['message'] === 'string'
      );
    default:
      return false;
  }
}
