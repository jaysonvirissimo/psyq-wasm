# Compiler fixtures

SPDX-License-Identifier: MIT

Original C test inputs and the assembly the reference PsyQ 4.4 toolchain
produces for them. Every fixture is original code written for this project;
nothing here is copied from a game, an SDK, or another decompilation project.

## Layout

```
src/                 *.c original sources; *.h quote-included headers; *.i preprocessed
                     inputs (what the compiler sees)
include/             angle-included headers (searched with -Iinclude)
expected/g8/         reference output for  -quiet -O2 -G 8 -g0 -Wall  (.s assembly, .err stderr)
expected/g0/         reference output for  -quiet -O2 -G 0 -g0 -Wall
expected/g/          reference output for  -quiet -O2 -G 8 -g  -Wall  (debug info)
expected/pp/         reference preprocessor stderr for fixtures whose preprocessing fails
manifest.json        `fixtures`: one entry per (preprocessed input, options, output) tuple;
                     `sources`: one entry per raw-C pipeline case for compileSource()
SHA256SUMS           checksums of every file under src/, include/, and expected/
```

`.s` and `.err` files are byte-exact reference material. They use CRLF line
endings because `cc1psx` runs a DOS line-ending pass on its output. `.i` files
use LF endings (`cccp` has no such pass). None of them may be reformatted;
`.gitattributes` and `.editorconfig` exclude the whole directory.

A fixture named `*_eucjp.c` is written in UTF-8; its `.i` holds EUC-JP bytes,
because the reference build systems re-encode after preprocessing, and that is
what the compiler must see (`compileSource()` with `encoding: 'eucjp'`).

## Regeneration

`build/compile-fixtures.sh` runs the historical preprocessor and the reference
compiler in the pinned Debian slink container, with Ruby on the host for the
EUC-JP step:

```
cccp -nostdinc -undef -D__GNUC__=2 -D__OPTIMIZE__ -lang-c \
     -Dmips -D__mips__ -D__mips -Dpsx -D__psx__ -D__psx -D_PSYQ \
     -D__EXTENSIONS__ -D_MIPSEL -D__CHAR_UNSIGNED__ -D_LANGUAGE_C -DLANGUAGE_C \
     -Iinclude src/NAME.c src/NAME.i                       # 2> expected/pp/NAME.err on failure

ruby -e '... .force_encoding("UTF-8").encode("EUC-JP")'   src/NAME_eucjp.i   (in place)

cc1psx -quiet -O2 -G 8 -g0 -Wall NAME.i -o expected/g8/NAME.s 2> expected/g8/NAME.err
cc1psx -quiet -O2 -G 0 -g0 -Wall NAME.i -o expected/g0/NAME.s 2> expected/g0/NAME.err
```

The defines are exactly `DEFAULT_CPP_FLAGS` (plus the wrapper-owned `-undef`),
which is why every fixture `.c` also serves as a preprocessing differential
case for `compileSource()`. The script also checks that encoding the `.c`
before preprocessing yields the same bytes as encoding the `.i` afterwards.

The `.i` files begin with a `# 1 "NAME.c"` line marker, which is why the `.file`
directive and any diagnostics in the reference output name the `.c` file rather
than the `.i` file handed to the compiler. Empty `.err` files are not committed.

`build/compile-fixtures.sh --verify` regenerates into a temporary directory and
compares inputs, assembly, stderr, exit status, and `SHA256SUMS` with the
committed files without writing anything here; the release workflow runs it
against a freshly built reference compiler.
