# Provenance

This document records every input that determines the distributed compiler
artifact (`dist/cc1psx.wasm` and its loader `dist/cc1psx.js`), so that a
maintainer can rebuild a release from pinned sources and a user can verify what
they received. The machine-readable copy of the pins is `build/pins.env`;
`scripts/verify-provenance.mjs` checks that this document, the pins, and a built
artifact agree.

## 1. Artifact identity

Every build writes `dist/build-info.json` and `dist/SHA256SUMS`. Releases publish
both next to the artifacts. `CompilerInfo.buildId` (reported at runtime) is
`sha256:` followed by the first 16 hex digits of the SHA-256 of `cc1psx.wasm`.

| Field           | Value                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| Compiler        | PsyQ 4.4 `cc1psx` (GCC 2.8.1)                                                                        |
| Target          | `mips-psx`                                                                                           |
| Host data model | wasm32 (ILP32, little-endian)                                                                        |
| Version banner  | `GNU C version 2.8.1, Psy-Q 4.4, Homebrew Psy-Q 0.2.0 (mips-psx) compiled by GNU C version 2.7.2.3.` |

## 2. Compiler source

| Field        | Value                                                                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository   | `https://github.com/nocato/homebrew-psyq`                                                                                                    |
| Commit       | `bdee891005a0aec6bf6fe40e504cf068ebf38caf`                                                                                                   |
| Subdirectory | `gcc-2.8.1_psyq-4.4`                                                                                                                         |
| Tree object  | `5331d55810156d0634e7c01d916aaa48e57253ad` (git tree of the subdirectory at that commit)                                                     |
| Version file | `HOMEBREW_PSYQ_VERSION "0.2.0"`                                                                                                              |
| License      | GNU General Public License, version 2 (`gcc/COPYING`); the PsyQ-specific files (`config/mips/psx.h`, `unix2dos.c`) carry GPL headers as well |

`homebrew-psyq` reconstructs Sony's PsyQ 4.4 C compiler from the GCC 2.8.1
sources and the PsyQ-specific changes. Notable PsyQ behaviour preserved in the
build: the assembler output is post-processed to DOS (CRLF) line endings by
default (`-fdos-line-endings`, on unless `-fno-dos-line-endings` is passed), and
the compiler creates two temporary files via `mktemp()` during every run.

`build/fetch-vendor.sh` clones the repository at the pinned commit into the
git-ignored `build/vendor/` directory and refuses to proceed if either hash
differs.

## 3. Historical build environment (reference compiler)

The differential-test oracle is a native i386 Linux build of the same sources,
compiled with the toolchain that was contemporary with GCC 2.8.1:

| Field           | Value                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| Container image | `docker.io/debian/eol@sha256:50b8edf5ebbc6a6e266cf6972c32ac6ecb293222d82f6f191dc4a7df49f217ba`                        |
| Platform        | `linux/386` (Debian 2.1 "slink")                                                                                      |
| Packages        | `gcc autoconf libc6-dev make bison gperf` (gcc 2.7.2.3, autoconf 2.12, libc6 2.0.7, make 3.77, bison 1.25, gperf 2.7) |
| Configure       | `configure --target=mips-psx --host=i686-pc-linux`                                                                    |
| Build           | `make cc1 CFLAGS="-O2 -g"` and `make cpp CFLAGS="-O2 -g"`                                                             |

`build/build-reference.sh` runs `build/slink/inside.sh` in that container. Two
workarounds are needed to run the 1999 userland under emulation on modern hosts;
neither affects compiler output:

- `dpkg` cannot run under QEMU user-mode emulation, so the packages are
  downloaded with `apt-get install -d` and unpacked with `dpkg-deb -x`.
- glibc 2.0's `getcwd()` fails on container bind mounts, so the source tree is
  copied to a tmpfs before `configure` runs.

The reference compiler is used only for tests. It is never shipped.

## 4. Generated build-time sources

GCC's build generates parser tables and instruction-pattern code with
`bison`, `gperf`, and its own `gen*` programs. Regenerating them with modern
tool versions would change the compiler, so the outputs of the historical build
are committed under `build/gen/` byte-for-byte (24 files, GPL-2.0-only).
`build/gen/README.md` lists which tool produced each file, `build/gen/SHA256SUMS`
records their checksums, and `build/check-gen.sh` verifies them against a fresh
regeneration. The parser is regenerated exactly as `gcc/Makefile.in` specifies:

```
sed -e "/^ifobjc/,/^end ifobjc/d" -e "/^ifc/d" -e "/^end ifc/d" c-parse.in > c-parse.y
bison -d c-parse.y -o c-parse.c
gperf -p -j1 -i 1 -g -o -t -G -N is_reserved_word -k1,3,$ c-parse.gperf > c-gperf.h
```

## 5. Compatibility changes for WebAssembly

The port aims for the smallest possible change set. Nothing in the code
generator is modified.

### `build/patches/obstack.h.diff`

Six macros in `obstack.h` use GCC-specific lvalue casts of the form
`*((T *) p)++ = v`, which Clang rejects. The patch rewrites them to the
equivalent store-then-advance form. It is applied to a copy of the header at
build time; the pinned source tree is never modified.

### Function-pointer casts (`-sEMULATE_FUNCTION_POINTER_CASTS=1`)

GCC 2.8.1 calls K&R-style callbacks through function-pointer types that do not
always match the callee's signature. WebAssembly enforces indirect-call
signatures, so without emulation the compiler traps on its first such call.
Emscripten's emulation mode is enabled at link time instead of editing hundreds
of call sites. Removing it in the future requires a full differential run.

### `-DTARGET_NAME="mips-psx"`

`toplev.c` expects the target triple as a macro; the historical build passes it
on the command line, and so does `build/build-wasm.sh`.

## 6. WebAssembly toolchain and flags

| Field            | Value                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------ |
| Emscripten image | `emscripten/emsdk@sha256:3ba391c5b1554e06f9af0a69652ff20919dff14e771619339dba988bd62574b5` |

Canonical platform: `linux/amd64`, using Emscripten 6.0.9. Every build records
this platform, compiles all 70 objects in a fresh temporary directory, and
reapplies the compatibility patch. Only system libraries are cached.

Per-object compile flags (`CC1_WASM_CFLAGS`):

```
-O2 -flto -std=gnu89 -fno-strict-aliasing -fwrapv -DCROSS_COMPILE -DIN_GCC -DHAVE_CONFIG_H -Wno-everything
```

Link flags (`CC1_WASM_LDFLAGS`):

```
-O1 -flto -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=64MB -sSTACK_SIZE=16MB -sEXIT_RUNTIME=1 -sFORCE_FILESYSTEM=1 -sENVIRONMENT=web,worker,node -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createCc1 -sINVOKE_RUN=0 -sEXPORTED_RUNTIME_METHODS=FS,callMain,ENV -sEMULATE_FUNCTION_POINTER_CASTS=1
```

The link step uses `-O1` rather than `-O2`: the Binaryen snapshot bundled with
emsdk 6.0.x (`wasm-opt` 132-49-gd03c25ea4) aborts on an internal assertion when
its `-O2` pass pipeline runs after `--fpcast-emu` on this module. Objects are
still compiled at `-O2` with LTO, and the `-O1` link output is byte-exact
against the reference compiler across the whole fixture set.

The 70 objects are linked in the order listed in `build/objs.txt`, which is the
order of the reference `cc1` link line. `insn-*.c` and `c-parse.c` come from
`build/gen/`; `mips.c` from `gcc/config/mips/`; everything else from `gcc/`.

### Why wasm32

GCC 2.8.1 assumes a 32-bit host (`sizeof(int) == sizeof(long) == sizeof(void *) == 4`,
`HOST_WIDE_INT` is `int`). wasm32 has exactly the i386 data model, so the
unmodified `i386/xm-linux.h` host configuration is used. A 64-bit host build
of the same sources faults on every input; a future `memory64` port would need
its own fidelity investigation.

## 7. Reproducibility

Rebuilding with identical pinned inputs is expected to produce identical
`cc1psx.wasm` bytes. The release workflow rebuilds the source archive in two independent clean
directories and compares both Wasm and glue hashes with the release artifacts.
It freshly regenerates reference sources and verifies all fixture bytes,
diagnostics, and exit statuses without overwriting committed expectations. If a toolchain update introduces non-determinism, this
section must describe it rather than the project claiming bit-for-bit
reproducibility it does not have. Compiler-output fidelity (the differential
tests) is required regardless.

## 8. Corresponding source

The compiler artifact is a GPL-2.0-only work. Each release publishes a source
archive produced by `scripts/pack-source-archive.sh` containing:

- the pinned `homebrew-psyq` tree at `psyq-wasm/build/vendor/homebrew-psyq`, at the commit above (the complete GCC 2.8.1
  PsyQ sources);
- `build/` from this repository: pins, object list, generated sources, the
  compatibility patch, and every build script;
- this document and `LICENSES/`.

The npm package itself contains only the compiled artifact and the MIT
wrapper; it points here for the corresponding source.

Extract the archive, enter `psyq-wasm/`, and run
`build/build-wasm.sh --offline-source`. The bundled source checksums and commit/tree
record are verified before Docker runs. No Git metadata, npm installation, or
separate project checkout is needed. Docker may fetch the pinned image once;
compilation itself uses `--network none`. The release workflow rebuilds this
archive before publishing binaries.
