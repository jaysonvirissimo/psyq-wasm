# Compiler fixtures

SPDX-License-Identifier: MIT

Original C test inputs and the assembly the reference PsyQ 4.4 `cc1psx` produces
for them. Every fixture is original code written for this project; nothing here
is copied from a game, an SDK, or another decompilation project.

## Layout

```
src/                 *.c original sources; *.i preprocessed inputs (what the compiler sees)
expected/g8/         reference output for  -quiet -O2 -G 8 -g0 -Wall  (.s assembly, .err stderr)
expected/g0/         reference output for  -quiet -O2 -G 0 -g0 -Wall
expected/g/          reference output for  -quiet -O2 -G 8 -g  -Wall  (debug info)
manifest.json        one entry per (input, options, expected output) tuple
SHA256SUMS           checksums of every file referenced by the manifest
```

`.s` and `.err` files are byte-exact reference material. They use CRLF line
endings because `cc1psx` runs a DOS line-ending pass on its output. They must
never be reformatted; `.gitattributes` and `.editorconfig` exclude them.

## Regeneration

`build/compile-fixtures.sh` runs the historical preprocessor and the reference
compiler in the pinned Debian slink container:

```
cccp -nostdinc -undef -D__GNUC__=2 -D__OPTIMIZE__ -lang-c \
     -Dmips -D__mips__ -D__mips -Dpsx -D__psx__ -D__psx -D_PSYQ \
     -D__EXTENSIONS__ -D_MIPSEL -D__CHAR_UNSIGNED__ -D_LANGUAGE_C -DLANGUAGE_C \
     src/NAME.c src/NAME.i

cc1psx -quiet -O2 -G 8 -g0 -Wall NAME.i -o expected/g8/NAME.s 2> expected/g8/NAME.err
cc1psx -quiet -O2 -G 0 -g0 -Wall NAME.i -o expected/g0/NAME.s 2> expected/g0/NAME.err
```

The `.i` files begin with a `# 1 "NAME.c"` line marker, which is why the `.file`
directive and any diagnostics in the reference output name the `.c` file rather
than the `.i` file handed to the compiler. Empty `.err` files are not committed.
