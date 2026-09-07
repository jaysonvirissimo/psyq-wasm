# Generated GCC build-time sources

SPDX-License-Identifier: GPL-2.0-only

Every file in this directory is an output of the historical GCC 2.8.1 build
process run inside the pinned Debian slink container (see `build/pins.env`,
`build/build-reference.sh`, and `PROVENANCE.md`). They are derived from the
GPL-2.0 GCC sources in the pinned `homebrew-psyq` revision and are therefore
licensed under the GNU General Public License, version 2 (`LICENSES/GPL-2.0-only.txt`).

The files are committed **byte-for-byte as produced**, without added headers, so
that `build/check-gen.sh` can compare a fresh regeneration against `SHA256SUMS`
directly. Committing them lets `build/build-wasm.sh` run with only Emscripten,
and avoids regenerating them with modern versions of autoconf, bison, or gperf,
whose output would differ from the historical toolchain.

| Files                                                                                                                                    | Produced by                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auto-config.h`                                                                                                                          | `configure --target=mips-psx --host=i686-pc-linux` (autoconf 2.12 / autoheader)                                                                                                                                   |
| `config.h`, `hconfig.h`, `tconfig.h`, `tm.h`, `options.h`, `specs.h`                                                                     | `configure` (header stubs selecting `i386/xm-linux.h` for the host and `mips/psx.h` for the target)                                                                                                               |
| `insn-attr.h`, `insn-attrtab.c`, `insn-codes.h`, `insn-config.h`, `insn-emit.c`, `insn-extract.c`, `insn-flags.h`, `insn-opinit.c`, `insn-output.c`, `insn-peep.c`, `insn-recog.c` | The `gen*` generator programs (`genattr`, `genattrtab`, `gencodes`, `genconfig`, `genemit`, `genextract`, `genflags`, `genopinit`, `genoutput`, `genpeep`, `genrecog`) run over `config/mips/mips.md` |
| `bc-arity.h`, `bc-opcode.h`, `bc-opname.h`                                                                                               | `bi-arity`, `bi-opcode`, `bi-opname` run over `bytecode.def`                                                                                                                                                      |
| `c-parse.c`, `c-parse.h`                                                                                                                 | `sed` over `c-parse.in` produces `c-parse.y` (per `gcc/Makefile.in`), then `bison -d c-parse.y -o c-parse.c` (bison 1.25); the intermediate `.y` is not committed                                                 |
| `c-gperf.h`                                                                                                                              | `gperf -p -j1 -i 1 -g -o -t -G -N is_reserved_word -k1,3,$ c-parse.gperf` (gperf 2.7)                                                                                                                             |
| `cexp.c`                                                                                                                                 | `bison -o cexp.c cexp.y` (bison 1.25), run by `make cpp` into the source directory per `gcc/Makefile.in`; the `#if` expression parser linked into `cccp`                                                                                          |

`SHA256SUMS` lists the checksum of every generated file. Regenerate and verify
with `build/check-gen.sh`.
