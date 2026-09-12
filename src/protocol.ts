// SPDX-License-Identifier: MIT
/**
 * Message protocol between the main-thread controller and the compiler worker.
 * Both directions are validated with type guards because messages cross a
 * structured-clone boundary and the worker may be replaced at any time.
 */
import type { CompileTimings, SourceEncoding } from './public-types.js';

/** The two compiled modules retained by the controller; each is instantiated afresh per request. */
export interface ProgramModules {
  readonly cc1: WebAssembly.Module;
  readonly cccp: WebAssembly.Module;
}

export interface InitMessage {
  readonly type: 'init';
  readonly modules: ProgramModules;
}

/** `compilePreprocessed()`: run cc1psx on exact bytes. */
export interface CompileMessage {
  readonly type: 'compile';
  readonly id: number;
  readonly filename: string;
  readonly argv: readonly string[];
  readonly source: Uint8Array;
}

export interface HeaderEntry {
  readonly path: string;
  readonly data: Uint8Array;
}

/** `compileSource()`: run cccp, optionally re-encode, then run cc1psx, all inside the worker. */
export interface SourceMessage {
  readonly type: 'source';
  readonly id: number;
  readonly filename: string;
  readonly cppArgv: readonly string[];
  readonly headers: readonly HeaderEntry[];
  readonly encoding: SourceEncoding;
  readonly argv: readonly string[];
  readonly source: Uint8Array;
}

export type MainToWorkerMessage = InitMessage | CompileMessage | SourceMessage;

export interface ReadyMessage {
  readonly type: 'ready';
  readonly buildId: string;
  readonly preprocessorBuildId: string;
}

export type FailedStage = 'preprocess' | 'compile';

export interface ResultMessage {
  readonly type: 'result';
  readonly id: number;
  readonly exitCode: number;
  readonly asm?: Uint8Array;
  /** Bytes handed to the compiler by a `source` request (after any re-encoding). */
  readonly preprocessed?: Uint8Array;
  /** For a `source` request with a non-zero exit code: which program failed. */
  readonly stage?: FailedStage;
  readonly stdout: string;
  readonly stderr: string;
  readonly timings: CompileTimings;
}

/** A request the worker refused for a caller-visible reason; the worker stays healthy. */
export interface RejectMessage {
  readonly type: 'reject';
  readonly id: number;
  readonly code: 'encoding';
  readonly message: string;
  /** The offending character (empty when the text was not decodable at all). */
  readonly character: string;
  /** Its code-unit index in the text being encoded, or -1. */
  readonly index: number;
}

export interface CrashMessage {
  readonly type: 'crash';
  /** Request being processed when the crash happened, if any. */
  readonly id?: number;
  readonly message: string;
}

export type WorkerToMainMessage = ReadyMessage | ResultMessage | RejectMessage | CrashMessage;

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

function isOptional<T>(value: unknown, check: (v: unknown) => v is T): value is T | undefined {
  return value === undefined || check(value);
}

function isBytes(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

function isStage(value: unknown): value is FailedStage {
  return value === 'preprocess' || value === 'compile';
}

function isEncoding(value: unknown): value is SourceEncoding {
  return value === 'utf8' || value === 'eucjp';
}

function isHeaderEntry(value: unknown): value is HeaderEntry {
  return isRecord(value) && typeof value['path'] === 'string' && isBytes(value['data']);
}

function isTimings(value: unknown): value is CompileTimings {
  return (
    isRecord(value) &&
    isNumber(value['instantiateMs']) &&
    isNumber(value['compileMs']) &&
    isNumber(value['totalMs']) &&
    isOptional(value['preprocessMs'], isNumber)
  );
}

function isModules(value: unknown): value is ProgramModules {
  return (
    isRecord(value) &&
    value['cc1'] instanceof WebAssembly.Module &&
    value['cccp'] instanceof WebAssembly.Module
  );
}

export function isMainToWorkerMessage(value: unknown): value is MainToWorkerMessage {
  if (!isRecord(value)) return false;
  switch (value['type']) {
    case 'init':
      return isModules(value['modules']);
    case 'compile':
      return (
        isNumber(value['id']) &&
        typeof value['filename'] === 'string' &&
        isStringArray(value['argv']) &&
        isBytes(value['source'])
      );
    case 'source':
      return (
        isNumber(value['id']) &&
        typeof value['filename'] === 'string' &&
        isStringArray(value['cppArgv']) &&
        Array.isArray(value['headers']) &&
        value['headers'].every(isHeaderEntry) &&
        isEncoding(value['encoding']) &&
        isStringArray(value['argv']) &&
        isBytes(value['source'])
      );
    default:
      return false;
  }
}

export function isWorkerToMainMessage(value: unknown): value is WorkerToMainMessage {
  if (!isRecord(value)) return false;
  switch (value['type']) {
    case 'ready':
      return (
        typeof value['buildId'] === 'string' && typeof value['preprocessorBuildId'] === 'string'
      );
    case 'result':
      return (
        isNumber(value['id']) &&
        isNumber(value['exitCode']) &&
        isOptional(value['asm'], isBytes) &&
        isOptional(value['preprocessed'], isBytes) &&
        isOptional(value['stage'], isStage) &&
        typeof value['stdout'] === 'string' &&
        typeof value['stderr'] === 'string' &&
        isTimings(value['timings'])
      );
    case 'reject':
      return (
        isNumber(value['id']) &&
        value['code'] === 'encoding' &&
        typeof value['message'] === 'string' &&
        typeof value['character'] === 'string' &&
        isNumber(value['index'])
      );
    case 'crash':
      return isOptional(value['id'], isNumber) && typeof value['message'] === 'string';
    default:
      return false;
  }
}
