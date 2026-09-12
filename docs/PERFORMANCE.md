# Performance

Warm-compile measurements. Reproduce them with:

```sh
npm run bench           # Node.js
npm run bench:browser   # Chromium, Firefox, WebKit
```

These are single-machine numbers, not thresholds. **Nothing in CI asserts them.**
Shared CI runners are far too noisy to hold latency to a bound without producing
flaky failures, so §20.3 is treated as a reporting target. The payload sizes
below *are* enforced, in `test/node/artifact.test.ts`.

## What is measured

One `Compiler` is created and reused for the whole sweep, so every timed run
finds the worker already up — the state an editor keeps it in. The first 5 runs
of each size are discarded as warmup (they pay module instantiation and JIT
warmup); the figures below come from the runs after that. The reported number is
`CompileTimings.compileMs`, the time inside the compiler.

Percentiles are nearest-rank over 50 samples for the small/medium sizes and 10
for the two large ones. The median is reported rather than the mean, because
compile times are right-skewed and a mean overstates typical latency.

Inputs come from `scripts/gen-stress-fixture.mjs`, which emits a deterministic
translation unit of `n` functions, each a 32-case switch. `generate(16)` at
about 27 KB is the closest to a real decompilation translation unit; the
committed fixtures are all under 2 KB and too small to characterise anything.

## Environment

| | |
| --- | --- |
| Machine | Apple M1, 8 cores, 16 GiB |
| OS | darwin 25.5.0 (arm64) |
| Node.js | v24.2.0 |
| Chromium | 153.0.8010.12 |
| Firefox | 155.0 |
| WebKit | 26.6 |
| Compiler build | `sha256:e3cdde0d4dc69a95` |
| Measured | 2026-09-07 |

## Warm compile latency

Milliseconds, p50 / p95.

| Input | Bytes | Band | Node.js p50 / p95 | Chromium p50 / p95 | Firefox p50 / p95 | WebKit p50 / p95 |
| --- | --- | --- | --- | --- | --- | --- |
| `generate(1)` | 1,716 | small/medium | 2.4 / 4.5 | 2.0 / 3.7 | 3.0 / 4.0 | 2.0 / 6.0 |
| `generate(4)` | 6,724 | small/medium | 7.1 / 7.4 | 5.8 / 6.4 | 9.0 / 10.0 | 5.0 / 6.0 |
| `generate(16)` | 26,837 | small/medium | 25.6 / 26.1 | 21.4 / 22.2 | 27.0 / 28.0 | 18.0 / 19.0 |
| `generate(64)` | 107,642 | large | 100.3 / 102.1 | 84.6 / 85.9 | 90.0 / 93.0 | 70.0 / 72.0 |
| `generate(256)` | 431,193 | large | 394.6 / 397.5 | 335.8 / 338.1 | 345.0 / 350.0 | 272.0 / 278.0 |

## Against the §20.3 targets

The targets are p50 < 50 ms and p95 < 150 ms for representative small/medium
units, which is the `generate(1)`–`generate(16)` band above. **Every runtime
meets both**, with the slowest small/medium p95 at 28.0 ms — comfortably
inside the 150 ms bound.

The two large sizes are reported for shape and are not held to the target; §20.3
says explicitly that large translation units may take longer. Latency scales
roughly linearly with input size across all four runtimes.

WebKit is the fastest of the three browsers here and Firefox the slowest, but
the spread across engines is small: no engine is an outlier, which is what
risk §26.4 asked to confirm.

## Payload

Gzipped, level 9, as asserted by `test/node/artifact.test.ts`:

| Asset | Size |
| --- | --- |
| `cc1psx.wasm` + glue | 611 KB |
| `cccp.wasm` + glue | 85 KB |
| EUC-JP table | 28 KB |
| **Full pipeline** | **724 KB** |

Against §20.1 (compiler core ≤ 1 MB gzip) and §20.2 (full pipeline under about
3 MB compressed), both with wide margin. Both `.wasm` files are fetched once
per `Compiler`; worker replacement after a timeout or crash reuses the compiled
`WebAssembly.Module` and does not refetch (§20.4).
