// SPDX-License-Identifier: MIT
/**
 * The compiler side of the worker protocol, kept free of any worker-global
 * access so it can be unit-tested with fake Emscripten factories.
 *
 * Two programs live here: cc1psx (the compiler) and cccp (the preprocessor).
 * A `compile` request runs the compiler on exact bytes; a `source` request
 * runs the preprocessor, optionally re-encodes its output, and then runs the
 * compiler on that output, all inside one worker request.
 */
import type { Cc1Factory, Cc1Module } from './cc1psx.js';
import { EncodingError } from './errors.js';
import { encodeEucJp } from './eucjp.js';
import { RESERVED_OUTPUT_NAME, RESERVED_PREPROCESSED_NAME, WORK_DIR } from './options.js';
import {
  isMainToWorkerMessage,
  type CompileMessage,
  type HeaderEntry,
  type ProgramModules,
  type ResultMessage,
  type SourceMessage,
  type WorkerToMainMessage,
} from './protocol.js';

export interface ProgramDeps {
  /** The Emscripten factory (`createCc1` / `createCccp` from the glue). */
  readonly createModule: Cc1Factory;
  /** Reported in the `ready` handshake. */
  readonly buildId: string;
}

export interface WorkerRuntimeDeps {
  readonly cc1: ProgramDeps;
  readonly cccp: ProgramDeps;
  /** Monotonic clock in milliseconds; defaults to `performance.now`. */
  readonly now?: () => number;
  /** Instantiates a retained module; defaults to `WebAssembly.instantiate`. */
  readonly instantiate?: (
    module: WebAssembly.Module,
    imports: WebAssembly.Imports,
  ) => Promise<WebAssembly.Instance>;
}

export interface WorkerRuntime {
  handle(message: unknown): Promise<WorkerToMainMessage>;
}

interface ProgramRun {
  readonly program: ProgramDeps;
  readonly module: WebAssembly.Module;
  /** argv[0]; the program prints its basename in front of program-level diagnostics. */
  readonly thisProgram: string;
  readonly files: readonly HeaderEntry[];
  readonly argv: readonly string[];
  readonly outputName: string;
  /** Start stamp of the request; the first stage samples the clock itself. */
  readonly startedAt?: number;
}

interface ProgramOutcome {
  readonly exitCode: number;
  readonly output: Uint8Array | undefined;
  readonly stdout: string;
  readonly stderr: string;
  readonly instantiateMs: number;
  readonly runMs: number;
  readonly startedAt: number;
  readonly finishedAt: number;
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

function readOutput(module: Cc1Module, name: string): Uint8Array | undefined {
  try {
    return module.FS.readFile(`${WORK_DIR}/${name}`);
  } catch {
    return undefined;
  }
}

/** Write the files under the work directory, creating each parent directory once. */
function writeFiles(module: Cc1Module, files: readonly HeaderEntry[]): void {
  const created = new Set<string>();
  for (const file of files) {
    const segments = file.path.split('/');
    let dir = WORK_DIR;
    for (const segment of segments.slice(0, -1)) {
      dir = `${dir}/${segment}`;
      if (!created.has(dir)) {
        module.FS.mkdir(dir);
        created.add(dir);
      }
    }
    module.FS.writeFile(`${WORK_DIR}/${file.path}`, file.data);
  }
}

const strictUtf8 = new TextDecoder('utf-8', { fatal: true });

export function createWorkerRuntime(deps: WorkerRuntimeDeps): WorkerRuntime {
  const now = deps.now ?? (() => performance.now());
  const instantiate =
    deps.instantiate ?? ((module, imports) => WebAssembly.instantiate(module, imports));
  let retained: ProgramModules | undefined;

  /** Run one program on a fresh instance: GCC 2.8.1 keeps global state and exits after main(). */
  async function runProgram(run: ProgramRun): Promise<ProgramOutcome> {
    const stdout = captureLines();
    const stderr = captureLines();
    const started = run.startedAt ?? now();

    let failInstantiation!: (error: unknown) => void;
    const failed = new Promise<never>((_resolve, reject) => {
      failInstantiation = reject;
    });
    // Observe failure even if the factory throws synchronously before the race.
    void failed.catch(() => undefined);
    const instance = await Promise.race([
      failed,
      run.program.createModule({
        instantiateWasm: (imports, receive) => {
          void Promise.resolve()
            .then(() => instantiate(run.module, imports))
            .then((wasm) => {
              receive(wasm, run.module);
            })
            .catch(failInstantiation);
          return {};
        },
        thisProgram: run.thisProgram,
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
    instance.FS.mkdir(WORK_DIR);
    instance.FS.chdir(WORK_DIR);
    writeFiles(instance, run.files);
    const instantiated = now();

    const exitCode = instance.callMain(run.argv);
    const finished = now();

    return {
      exitCode,
      output: readOutput(instance, run.outputName),
      stdout: stdout.text(),
      stderr: stderr.text(),
      instantiateMs: instantiated - started,
      runMs: finished - instantiated,
      startedAt: started,
      finishedAt: finished,
    };
  }

  function compile(request: CompileMessage, modules: ProgramModules): Promise<WorkerToMainMessage> {
    return runProgram({
      program: deps.cc1,
      module: modules.cc1,
      thisProgram: 'cc1psx',
      files: [{ path: request.filename, data: request.source }],
      argv: request.argv,
      outputName: RESERVED_OUTPUT_NAME,
    }).then((cc) => {
      if (cc.exitCode === 0 && cc.output === undefined) {
        return { type: 'crash', id: request.id, message: 'compiler exited 0 without output' };
      }
      const base: ResultMessage = {
        type: 'result',
        id: request.id,
        exitCode: cc.exitCode,
        stdout: cc.stdout,
        stderr: cc.stderr,
        timings: {
          instantiateMs: cc.instantiateMs,
          compileMs: cc.runMs,
          totalMs: cc.finishedAt - cc.startedAt,
        },
      };
      return cc.output === undefined ? base : { ...base, asm: cc.output };
    });
  }

  /** Re-encode the preprocessor output for the compiler; throws `EncodingError`. */
  function transcode(output: Uint8Array): Uint8Array {
    let text: string;
    try {
      text = strictUtf8.decode(output);
    } catch {
      throw new EncodingError(
        'The preprocessed output is not valid UTF-8, so it cannot be re-encoded as EUC-JP.',
        { character: '', index: -1 },
      );
    }
    return encodeEucJp(text);
  }

  async function source(
    request: SourceMessage,
    modules: ProgramModules,
  ): Promise<WorkerToMainMessage> {
    const pre = await runProgram({
      program: deps.cccp,
      module: modules.cccp,
      thisProgram: 'cccp',
      files: [{ path: request.filename, data: request.source }, ...request.headers],
      argv: request.cppArgv,
      outputName: RESERVED_PREPROCESSED_NAME,
    });
    if (pre.exitCode !== 0) {
      const base: ResultMessage = {
        type: 'result',
        id: request.id,
        exitCode: pre.exitCode,
        stage: 'preprocess',
        stdout: pre.stdout,
        stderr: pre.stderr,
        timings: {
          instantiateMs: pre.instantiateMs,
          preprocessMs: pre.runMs,
          compileMs: 0,
          totalMs: pre.finishedAt - pre.startedAt,
        },
      };
      return pre.output === undefined ? base : { ...base, preprocessed: pre.output };
    }
    if (pre.output === undefined) {
      return { type: 'crash', id: request.id, message: 'preprocessor exited 0 without output' };
    }
    const preprocessed = request.encoding === 'eucjp' ? transcode(pre.output) : pre.output;

    const cc = await runProgram({
      program: deps.cc1,
      module: modules.cc1,
      thisProgram: 'cc1psx',
      files: [{ path: RESERVED_PREPROCESSED_NAME, data: preprocessed }],
      argv: request.argv,
      outputName: RESERVED_OUTPUT_NAME,
      startedAt: pre.finishedAt,
    });
    if (cc.exitCode === 0 && cc.output === undefined) {
      return { type: 'crash', id: request.id, message: 'compiler exited 0 without output' };
    }
    const base: ResultMessage = {
      type: 'result',
      id: request.id,
      exitCode: cc.exitCode,
      preprocessed,
      stdout: pre.stdout + cc.stdout,
      stderr: pre.stderr + cc.stderr,
      timings: {
        instantiateMs: pre.instantiateMs + cc.instantiateMs,
        preprocessMs: pre.runMs,
        compileMs: cc.runMs,
        totalMs: cc.finishedAt - pre.startedAt,
      },
      ...(cc.exitCode === 0 ? {} : { stage: 'compile' as const }),
    };
    return cc.output === undefined ? base : { ...base, asm: cc.output };
  }

  return {
    async handle(message) {
      if (!isMainToWorkerMessage(message)) {
        return { type: 'crash', message: `unexpected message: ${JSON.stringify(message)}` };
      }
      if (message.type === 'init') {
        retained = message.modules;
        return {
          type: 'ready',
          buildId: deps.cc1.buildId,
          preprocessorBuildId: deps.cccp.buildId,
        };
      }
      if (retained === undefined) {
        return { type: 'crash', id: message.id, message: 'worker not initialized' };
      }
      try {
        return message.type === 'compile'
          ? await compile(message, retained)
          : await source(message, retained);
      } catch (err) {
        if (err instanceof EncodingError) {
          return {
            type: 'reject',
            id: message.id,
            code: 'encoding',
            message: err.message,
            character: err.character,
            index: err.index,
          };
        }
        return { type: 'crash', id: message.id, message: describeError(err) };
      }
    },
  };
}
