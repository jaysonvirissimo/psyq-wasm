#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# (Re)generate test/fixtures: preprocess every src/*.c with the reference cccp
# and compile with the reference cc1psx, inside the pinned slink container.
#
#   build/compile-fixtures.sh [--verify] [RESULT_DIR]     RESULT_DIR holds cc1psx + cccp
#                                              (default build/out/reference)
#
# Each compile runs twice and the outputs must match (determinism check).
# Output is generated into a temporary directory and compared with the
# committed fixtures. Without --verify, the committed files are then replaced;
# review `git diff test/fixtures` afterwards. With --verify, any difference in
# inputs, assembly, stderr, exit status, or SHA256SUMS fails and nothing under
# test/fixtures is written. Empty .err files are removed.
source "$(dirname "$0")/lib.sh"
need docker
need node

VERIFY=false
if [[ "${1:-}" == "--verify" ]]; then VERIFY=true; shift; fi
RESULT_DIR="${1:-$OUT_DIR/reference}"
[[ -x "$RESULT_DIR/cc1psx" && -x "$RESULT_DIR/cccp" ]] || die "no reference compiler in $RESULT_DIR; run build/build-reference.sh"
# Docker bind mounts need absolute host paths.
RESULT_DIR="$(cd "$RESULT_DIR" && pwd)"
FIXTURES="$ROOT/test/fixtures"
mkdir -p "$OUT_DIR"
GENERATED="$(mktemp -d "$OUT_DIR/fixtures.XXXXXX")"
trap 'rm -rf "$GENERATED"' EXIT
mkdir -p "$GENERATED/src"
cp "$FIXTURES/src/"*.c "$GENERATED/src/"

docker run --rm -i \
  --platform "$SLINK_PLATFORM" \
  --tmpfs /work:exec,size=512m \
  -v "$RESULT_DIR:/ref:ro" \
  -v "$FIXTURES:/fixtures:ro" \
  -v "$GENERATED:/generated" \
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
    rm -f "/work/run2/$b.s" "/work/run2/$b.err"
    set +e
    /work/cc1psx -quiet -O2 -G $g -g0 -Wall "$b.i" -o "/work/out/$dir/$b.s" 2>"/work/out/$dir/$b.err"
    rc=$?
    /work/cc1psx -quiet -O2 -G $g -g0 -Wall "$b.i" -o "/work/run2/$b.s" 2>"/work/run2/$b.err"
    rc2=$?
    set -e
    echo "EXIT $b $dir $rc"
    echo "$b $dir $rc" >>/work/exit-codes.txt
    [ "$rc" = "$rc2" ] && cmp -s "/work/out/$dir/$b.err" "/work/run2/$b.err" || { echo "error: nondeterministic diagnostics/status for $b" >&2; exit 1; }
    if { [ -f "/work/out/$dir/$b.s" ] || [ -f "/work/run2/$b.s" ]; } && ! cmp -s "/work/out/$dir/$b.s" "/work/run2/$b.s"; then
      echo "error: nondeterministic output for $b (-G $g)" >&2; exit 1
    fi
    [ -s "/work/out/$dir/$b.err" ] || rm -f "/work/out/$dir/$b.err"
    [ -s "/work/out/$dir/$b.s" ] || rm -f "/work/out/$dir/$b.s"
  done
done
# Debug-info variant kept for one fixture only; compare both runs too.
/work/cc1psx -quiet -O2 -G 8 -g -Wall t07_struct.i -o /work/out/g/t07_struct.s 2>/work/out/g/t07_struct.err
/work/cc1psx -quiet -O2 -G 8 -g -Wall t07_struct.i -o /work/run2/t07_struct.s 2>/work/run2/t07_struct.err
cmp /work/out/g/t07_struct.s /work/run2/t07_struct.s
cmp /work/out/g/t07_struct.err /work/run2/t07_struct.err
[ -s /work/out/g/t07_struct.err ] || rm /work/out/g/t07_struct.err
echo "t07_struct g 0" >>/work/exit-codes.txt
cp /work/src/*.i /generated/src/
mkdir -p /generated/expected
cp -a /work/out/g8 /work/out/g0 /work/out/g /generated/expected/
cp /work/exit-codes.txt /generated/exit-codes.txt
echo FIXTURES-DONE
EOF

(
  cd "$GENERATED"
  find src expected -type f | LC_ALL=C sort | while IFS= read -r name; do
    printf '%s  %s\n' "$(sha256_file "$name")" "$name"
  done >SHA256SUMS
)
node "$ROOT/scripts/verify-fixtures.mjs" "$FIXTURES" "$GENERATED" "$VERIFY"
if [[ "$VERIFY" == true ]]; then
  log "fixtures match fresh reference output; committed files were not modified"
else
  cp "$GENERATED/src/"*.i "$FIXTURES/src/"
  rm -rf "$FIXTURES/expected"
  cp -R "$GENERATED/expected" "$FIXTURES/expected"
  cp "$GENERATED/SHA256SUMS" "$FIXTURES/SHA256SUMS"
  log "fixtures regenerated; review with: git status test/fixtures"
fi
