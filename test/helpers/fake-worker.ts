// SPDX-License-Identifier: MIT
import { vi } from 'vitest';
import type { WorkerFactory, WorkerHandle } from '../../src/controller.js';
import type { MainToWorkerMessage, ResultMessage } from '../../src/protocol.js';

export const BUILD_ID = 'sha256:0123456789abcdef';
export const PREPROCESSOR_BUILD_ID = 'sha256:fedcba9876543210';

export const TIMINGS = { instantiateMs: 14.1, compileMs: 140.85, totalMs: 154.95 };

type RequestMessage = Exclude<MainToWorkerMessage, { type: 'init' }>;

/** An in-memory stand-in for a worker: records posts and lets tests emit events. */
export class FakeWorker implements WorkerHandle {
  readonly posted: { message: MainToWorkerMessage; transfer: Transferable[] | undefined }[] = [];
  terminated = false;
  private messageHandler: ((data: unknown) => void) | undefined;
  private errorHandler: ((error: unknown) => void) | undefined;
  private exitHandler: ((code: number) => void) | undefined;

  postMessage(message: MainToWorkerMessage, transfer?: Transferable[]): void {
    if (this.terminated) throw new Error('postMessage after terminate');
    this.posted.push({ message, transfer });
  }

  onMessage(handler: (data: unknown) => void): void {
    this.messageHandler = handler;
  }

  onError(handler: (error: unknown) => void): void {
    this.errorHandler = handler;
  }

  onExit(handler: (code: number) => void): void {
    this.exitHandler = handler;
  }

  terminate(): void {
    this.terminated = true;
  }

  // --- test helpers -------------------------------------------------------

  emit(data: unknown): void {
    this.messageHandler?.(data);
  }

  ready(buildId: string = BUILD_ID, preprocessorBuildId: string = PREPROCESSOR_BUILD_ID): void {
    this.emit({ type: 'ready', buildId, preprocessorBuildId });
  }

  /** Emit a result; pass `asm: undefined` explicitly to omit the output. */
  result(
    id: number,
    overrides: Partial<Omit<ResultMessage, 'asm'>> & { asm?: Uint8Array | undefined } = {},
  ): void {
    const { asm: asmOverride, ...rest } = overrides;
    const asm = 'asm' in overrides ? asmOverride : new TextEncoder().encode('\t.text\r\n');
    const message = {
      type: 'result',
      id,
      exitCode: 0,
      stdout: '',
      stderr: '',
      timings: TIMINGS,
      ...rest,
    };
    this.emit(asm === undefined ? message : { ...message, asm });
  }

  /** Emit an encoding rejection for a request. */
  reject(id: number, message = 'U+00A5 "¥" at line 1 has no EUC-JP mapping.'): void {
    this.emit({ type: 'reject', id, code: 'encoding', message, character: '¥', index: 0 });
  }

  crash(message: string, id?: number): void {
    this.emit(id === undefined ? { type: 'crash', message } : { type: 'crash', id, message });
  }

  error(err: unknown): void {
    this.errorHandler?.(err);
  }

  exit(code: number): void {
    this.exitHandler?.(code);
  }

  /** Compile and source requests posted so far. */
  requests(): RequestMessage[] {
    return this.posted.map((p) => p.message).filter((m) => m.type !== 'init');
  }

  /** Compile messages posted so far. */
  compiles(): MainToWorkerMessage[] {
    return this.posted.map((p) => p.message).filter((m) => m.type === 'compile');
  }

  /** Source messages posted so far. */
  sources(): MainToWorkerMessage[] {
    return this.posted.map((p) => p.message).filter((m) => m.type === 'source');
  }

  /** Id of the most recently posted request of either kind. */
  lastCompileId(): number {
    const last = this.requests().at(-1);
    if (last === undefined) throw new Error('no request posted');
    return last.id;
  }
}

export function fakeWorkerFactory(): {
  spawn: WorkerFactory & ReturnType<typeof vi.fn>;
  workers: FakeWorker[];
} {
  const workers: FakeWorker[] = [];
  const spawn = vi.fn(() => {
    const w = new FakeWorker();
    workers.push(w);
    return w;
  });
  return { spawn, workers };
}
