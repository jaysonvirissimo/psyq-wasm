#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# (Re)generate test/fixtures: preprocess every src/*.c with the reference cccp
# and compile with the reference cc1psx, inside the pinned slink container.
#
#   build/compile-fixtures.sh [RESULT_DIR]     RESULT_DIR holds cc1psx + cccp
#                                              (default build/out/reference)
#
# Each compile runs twice and the outputs must match (determinism check).
# Existing expected files are overwritten; review `git diff test/fixtures`
# afterwards. Empty .err files are removed. SHA256SUMS is regenerated.
source "$(dirname "$0")/lib.sh"
need docker

RESULT_DIR="${1:-$OUT_DIR/reference}"
[[ -x "$RESULT_DIR/cc1psx" && -x "$RESULT_DIR/cccp" ]] || die "no reference compiler in $RESULT_DIR; run build/build-reference.sh"
FIXTURES="$ROOT/test/fixtures"

docker run --rm -i \
  --platform "$SLINK_PLATFORM" \
  --tmpfs /work:exec,size=512m \
  -v "$RESULT_DIR:/ref:ro" \
  -v "$FIXTURES:/fixtures" \
  "$SLINK_IMAGE" sh -s <<'EOF'
set -e
CPP_DEFS="-undef -D__GNUC__=2 -D__OPTIMIZE__ -lang-c -Dmips -D__mips__ -D__mips -Dpsx -D__psx__ -D__psx -D_PSYQ -D__EXTENSIONS__ -D_MIPSEL -D__CHAR_UNSIGNED__ -D_LANGUAGE_C -DLANGUAGE_C"
mkdir -p /work/src /work/tmp /work/out/g8 /work/out/g0 /work/out/g /work/run2
export TMPDIR=/work/tmp
cp /fixtures/src/*.c /work/src/
cp /ref/cc1psx /ref/cccp /work/
cd /work/src
for c in *.c; do
  b="${c%.c}"
  /work/cccp -nostdinc $CPP_DEFS "$c" "$b.i"
  for g in 8 0; do
    dir="g$g"
    set +e
    /work/cc1psx -quiet -O2 -G $g -g0 -Wall "$b.i" -o "/work/out/$dir/$b.s" 2>"/work/out/$dir/$b.err"
    rc=$?
    /work/cc1psx -quiet -O2 -G $g -g0 -Wall "$b.i" -o "/work/run2/$b.s" 2>/dev/null
    set -e
    echo "EXIT $b $dir $rc"
    if [ -f "/work/out/$dir/$b.s" ] && ! cmp -s "/work/out/$dir/$b.s" "/work/run2/$b.s"; then
      echo "error: nondeterministic output for $b (-G $g)" >&2; exit 1
    fi
    [ -s "/work/out/$dir/$b.err" ] || rm -f "/work/out/$dir/$b.err"
    [ -s "/work/out/$dir/$b.s" ] || rm -f "/work/out/$dir/$b.s"
  done
done
# Debug-info variant kept for one fixture only.
/work/cc1psx -quiet -O2 -G 8 -g -Wall t07_struct.i -o /work/out/g/t07_struct.s 2>/dev/null
cp /work/src/*.i /fixtures/src/
rm -rf /fixtures/expected
mkdir -p /fixtures/expected
cp -a /work/out/g8 /work/out/g0 /work/out/g /fixtures/expected/
echo FIXTURES-DONE
EOF

(
  cd "$FIXTURES"
  find src expected stress -type f 2>/dev/null | sort | xargs shasum -a 256 >SHA256SUMS
)
log "fixtures regenerated; review with: git status test/fixtures"
