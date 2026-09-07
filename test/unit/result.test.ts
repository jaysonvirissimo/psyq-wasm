// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import type { CompilerInfo } from '../../src/public-types.js';
import { buildCompileResult } from '../../src/result.js';

const info: CompilerInfo = {
  psyqVersion: '4.4',
  gccVersion: '2.8.1',
  buildId: 'sha256:0123456789abcdef',
  preprocessorBuildId: 'sha256:fedcba9876543210',
};
const timings = { instantiateMs: 14.1, compileMs: 140.85, totalMs: 154.95 };

describe('buildCompileResult', () => {
  it('builds a success without touching the assembly bytes', () => {
    const asm = new TextEncoder().encode('\t.file\t1 "rations.c"\r\n\t.text\r\n');
    const result = buildCompileResult(
      {
        exitCode: 0,
        asm,
        stdout: '',
        stderr: "rations.c: In function `otacon':\nrations.c:3: warning: unused variable `x'\n",
        timings,
      },
      info,
    );
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.asm).toBe(asm);
    expect(result.text).toBe('\t.file\t1 "rations.c"\n\t.text\n');
    expect(result.diagnostics).toEqual([
      { severity: 'warning', file: 'rations.c', line: 3, message: "unused variable `x'" },
    ]);
    expect(result.rawStdout).toBe('');
    expect(result.rawStderr).toContain('unused variable');
    expect(result.compiler).toBe(info);
    expect(result.timings).toEqual(timings);
  });

  it('builds a failure without asm/text keys when no output was produced', () => {
    const result = buildCompileResult(
      { exitCode: 1, stdout: '', stderr: "hound.i:1: parse error before `{'\n", timings },
      info,
    );
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect('asm' in result).toBe(false);
    expect('text' in result).toBe(false);
    expect(result.diagnostics).toEqual([
      { severity: 'error', file: 'hound.i', line: 1, message: "parse error before `{'" },
    ]);
  });

  it('keeps partial output on failure', () => {
    const asm = new TextEncoder().encode('\t.text\r\n');
    const result = buildCompileResult({ exitCode: 1, asm, stdout: '', stderr: '', timings }, info);
    expect(result.success).toBe(false);
    expect(result.asm).toBe(asm);
    expect(result.text).toBe('\t.text\n');
  });

  it('exit code 0 with output is the only success shape', () => {
    const asm = new Uint8Array([0x41]);
    expect(
      buildCompileResult({ exitCode: 0, asm, stdout: '', stderr: '', timings }, info).success,
    ).toBe(true);
    expect(
      buildCompileResult({ exitCode: 2, asm, stdout: '', stderr: '', timings }, info).success,
    ).toBe(false);
  });

  it('decodes non-UTF-8 bytes without throwing', () => {
    const asm = new Uint8Array([0xa4, 0xb3, 0x0d, 0x0a]);
    const result = buildCompileResult({ exitCode: 0, asm, stdout: '', stderr: '', timings }, info);
    expect(result.text).toHaveLength(3);
    expect(result.text?.endsWith('\n')).toBe(true);
  });

  it('does not normalize a lone CR', () => {
    const asm = new TextEncoder().encode('a\rb\r\n');
    const result = buildCompileResult({ exitCode: 0, asm, stdout: '', stderr: '', timings }, info);
    expect(result.text).toBe('a\rb\n');
  });
});

describe('buildCompileResult for source requests', () => {
  const preprocessed = new TextEncoder().encode('# 1 "rations.c"\nint otacon;\n');

  it('keeps the preprocessed bytes on success and failure', () => {
    const asm = new Uint8Array([0x41]);
    const ok = buildCompileResult(
      { exitCode: 0, asm, preprocessed, stdout: '', stderr: '', timings },
      info,
    );
    expect(ok.success).toBe(true);
    expect(ok.preprocessed).toBe(preprocessed);
    const failed = buildCompileResult(
      { exitCode: 1, preprocessed, stage: 'compile', stdout: '', stderr: '', timings },
      info,
    );
    expect(failed.success).toBe(false);
    expect(failed.preprocessed).toBe(preprocessed);
    if (!failed.success) expect(failed.stage).toBe('compile');
  });

  it('reports a preprocessor failure without assembly', () => {
    const result = buildCompileResult(
      {
        exitCode: 33,
        preprocessed,
        stage: 'preprocess',
        stdout: '',
        stderr: 'rations.c:2: #error hound\n',
        timings: { ...timings, preprocessMs: 14.1 },
      },
      info,
    );
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(33);
    expect('asm' in result).toBe(false);
    expect('text' in result).toBe(false);
    if (!result.success) expect(result.stage).toBe('preprocess');
    expect(result.diagnostics).toEqual([
      { severity: 'error', file: 'rations.c', line: 2, message: '#error hound' },
    ]);
    expect(result.timings.preprocessMs).toBe(14.1);
  });

  it('omits preprocessed and stage keys when the worker did not send them', () => {
    const result = buildCompileResult({ exitCode: 1, stdout: '', stderr: '', timings }, info);
    expect('preprocessed' in result).toBe(false);
    expect('stage' in result).toBe(false);
    const ok = buildCompileResult(
      { exitCode: 0, asm: new Uint8Array([0x41]), stdout: '', stderr: '', timings },
      info,
    );
    expect('preprocessed' in ok).toBe(false);
  });
});
