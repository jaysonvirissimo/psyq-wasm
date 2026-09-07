// SPDX-License-Identifier: MIT
/**
 * The compiler side of the worker protocol, kept free of any worker-global
 * access so it can be unit-tested with a fake Emscripten factory.
 */
import type { Cc1Factory, Cc1Module } from './cc1psx.js';
import { RESERVED_OUTPUT_NAME, WORK_DIR } from './options.js';
import {
  isMainToWorkerMessage,
  type CompileMessage,
  type WorkerToMainMessage,
} from './protocol.js';

export interface WorkerRuntimeDeps {
  /** The Emscripten factory (`createCc1` from the glue). */
  readonly createModule: Cc1Factory;
  /** Reported in the `ready` handshake. */
  readonly buildId: string;
  /** Monotonic clock in milliseconds; defaults to `performance.now`. */
  readonly now?: () => number;
  /** Instantiates the retained module; defaults to `WebAssembly.instantiate`. */
  readonly instantiate?: (
    module: WebAssembly.Module,
    imports: WebAssembly.Imports,
  ) => Promise<WebAssembly.Instance>;
}

export interface WorkerRuntime {
  handle(message: unknown): Promise<WorkerToMainMessage>;
}

/** Collect `print`/`printErr` lines into one string, newline-terminated. */
function captureLines(): { push: (line: string) => void; text: () => string } {
  const lines: string[] = [];
  return {
    push: (line) => lines.push(line),
    text: () => (lines.length === 0 ? '' : `${lines.join('\n')}\n`),
  };
}

function describeError(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

function readOutput(module: Cc1Module): Uint8Array | undefined {
  try {
    return module.FS.readFile(`${WORK_DIR}/${RESERVED_OUTPUT_NAME}`);
  } catch {
    return undefined;
  }
}

export function createWorkerRuntime(deps: WorkerRuntimeDeps): WorkerRuntime {
  const now = deps.now ?? (() => performance.now());
  const instantiate =
    deps.instantiate ?? ((module, imports) => WebAssembly.instantiate(module, imports));
  let retained: WebAssembly.Module | undefined;

  async function compile(request: CompileMessage): Promise<WorkerToMainMessage> {
    if (retained === undefined) {
      return { type: 'crash', id: request.id, message: 'worker not initialized' };
    }
    const module = retained;
    const stdout = captureLines();
    const stderr = captureLines();
    const started = now();

    // A fresh instance per compile: GCC 2.8.1 keeps global state and the
    // runtime exits after main() returns.
    let failInstantiation!: (error: unknown) => void;
    const failed = new Promise<never>((_resolve, reject) => {
      failInstantiation = reject;
    });
    // Observe failure even if the factory throws synchronously before the race.
    void failed.catch(() => undefined);
    const cc1 = await Promise.race([
      failed,
      deps.createModule({
        instantiateWasm: (imports, receive) => {
          void Promise.resolve()
            .then(() => instantiate(module, imports))
            .then((instance) => {
              receive(instance, module);
            })
            .catch(failInstantiation);
          return {};
        },
        print: stdout.push,
        printErr: stderr.push,
        preRun: [
          (m) => {
            // cc1psx creates two temporary files via mktemp().
            m.ENV['TMPDIR'] = '/tmp';
          },
        ],
      }),
    ]);
    cc1.FS.mkdir(WORK_DIR);
    cc1.FS.chdir(WORK_DIR);
    cc1.FS.writeFile(`${WORK_DIR}/${request.filename}`, request.source);
    const instantiated = now();

    const exitCode = cc1.callMain(request.argv);
    const finished = now();

    const asm = readOutput(cc1);
    if (exitCode === 0 && asm === undefined) {
      return { type: 'crash', id: request.id, message: 'compiler exited 0 without output' };
    }
    const timings = {
      instantiateMs: instantiated - started,
      compileMs: finished - instantiated,
      totalMs: finished - started,
    };
    const base = {
      type: 'result' as const,
      id: request.id,
      exitCode,
      stdout: stdout.text(),
      stderr: stderr.text(),
      timings,
    };
    return asm === undefined ? base : { ...base, asm };
  }

  return {
    async handle(message) {
      if (!isMainToWorkerMessage(message)) {
        return { type: 'crash', message: `unexpected message: ${JSON.stringify(message)}` };
      }
      switch (message.type) {
        case 'init':
          retained = message.module;
          return { type: 'ready', buildId: deps.buildId };
        case 'compile':
          try {
            return await compile(message);
          } catch (err) {
            return { type: 'crash', id: message.id, message: describeError(err) };
          }
      }
    },
  };
}
