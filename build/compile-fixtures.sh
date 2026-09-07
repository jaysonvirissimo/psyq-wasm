#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# (Re)generate test/fixtures: preprocess every src/*.c with the reference cccp,
# transcode the EUC-JP fixtures, and compile with the reference cc1psx, inside
# the pinned slink container.
#
#   build/compile-fixtures.sh [--verify] [RESULT_DIR]     RESULT_DIR holds cc1psx + cccp
#                                              (default build/out/reference)
#
# Three stages:
#   A  (container) cccp -nostdinc $CPP_DEFS -Iinclude NAME.c NAME.i, twice
#      (determinism); stderr kept as expected/pp/NAME.err; exit status recorded
#      as "NAME pp STATUS". The .i is kept even when cccp fails (it flushes
#      its output before exiting), so a failing fixture still has an
#      expectedPreprocessed file.
#   B  (host, Ruby) src/*_eucjp.i are transcoded UTF-8 -> EUC-JP in place: the
#      reference build systems encode after preprocessing. The .c is encoded
#      too, as input for the pipeline-order check in stage C.
#   C  (container) the order check (cccp on the EUC-JP .c must equal the
#      transcoded .i), then cc1psx on every .i whose preprocess succeeded,
#      twice (determinism).
#
# Output is generated into a temporary directory and compared with the
# committed fixtures. Without --verify, the committed files are then replaced;
# review `git diff test/fixtures` afterwards. With --verify, any difference in
# inputs, assembly, stderr, exit status, or SHA256SUMS fails and nothing under
# test/fixtures is written. Empty .err files are removed.
source "$(dirname "$0")/lib.sh"
need docker
need node
need ruby

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
mkdir -p "$GENERATED/src" "$GENERATED/expected/pp" "$GENERATED/order"
cp "$FIXTURES/src/"*.c "$FIXTURES/src/"*.h "$GENERATED/src/"
cp -R "$FIXTURES/include" "$GENERATED/include"

run_in_slink() {
  docker run --rm -i \
    --platform "$SLINK_PLATFORM" \
    --tmpfs /work:exec,size=512m \
    -v "$RESULT_DIR:/ref:ro" \
    -v "$GENERATED:/generated" \
    "$SLINK_IMAGE" sh -s
}

# --- stage A: preprocess -----------------------------------------------------
# Keep CPP_DEFS on one line: test/unit/argv.test.ts checks it against DEFAULT_CPP_FLAGS.
run_in_slink <<'EOF'
set -e
CPP_DEFS="-undef -D__GNUC__=2 -D__OPTIMIZE__ -lang-c -Dmips -D__mips__ -D__mips -Dpsx -D__psx__ -D__psx -D_PSYQ -D__EXTENSIONS__ -D_MIPSEL -D__CHAR_UNSIGNED__ -D_LANGUAGE_C -DLANGUAGE_C"
mkdir -p /work/src /work/tmp /work/pp /work/run2
export TMPDIR=/work/tmp
cp /generated/src/*.c /generated/src/*.h /work/src/
cp -R /generated/include /work/src/include
cp /ref/cccp /work/
cd /work/src
: >/work/exit-codes.txt
for c in *.c; do
  b="${c%.c}"
  set +e
  /work/cccp -nostdinc $CPP_DEFS -Iinclude "$c" "$b.i" 2>"/work/pp/$b.err"
  rc=$?
  /work/cccp -nostdinc $CPP_DEFS -Iinclude "$c" "/work/run2/$b.i" 2>"/work/run2/$b.err"
  rc2=$?
  set -e
  echo "PP $b $rc"
  echo "$b pp $rc" >>/work/exit-codes.txt
  [ "$rc" = "$rc2" ] && cmp -s "/work/pp/$b.err" "/work/run2/$b.err" || { echo "error: nondeterministic preprocessor diagnostics/status for $b" >&2; exit 1; }
  if { [ -f "$b.i" ] || [ -f "/work/run2/$b.i" ]; } && ! cmp -s "$b.i" "/work/run2/$b.i"; then
    echo "error: nondeterministic preprocessor output for $b" >&2; exit 1
  fi
  [ -s "/work/pp/$b.err" ] && cp "/work/pp/$b.err" /generated/expected/pp/ || true
done
cp /work/src/*.i /generated/src/
cp /work/exit-codes.txt /generated/exit-codes.txt
echo PREPROCESS-DONE
EOF

# --- stage B: EUC-JP transcoding (host) ---------------------------------------
for i in "$GENERATED/src/"*_eucjp.i; do
  [[ -e "$i" ]] || continue
  b="$(basename "$i" .i)"
  log "transcoding $b.i to EUC-JP"
  ruby -e 'src, dst = ARGV; File.binwrite(dst, File.binread(src).force_encoding("UTF-8").encode("EUC-JP"))' "$i" "$i"
  ruby -e 'src, dst = ARGV; File.binwrite(dst, File.binread(src).force_encoding("UTF-8").encode("EUC-JP"))' "$GENERATED/src/$b.c" "$GENERATED/order/$b.c"
done

# --- stage C: order check + compile ------------------------------------------
run_in_slink <<'EOF'
set -e
CPP_DEFS="-undef -D__GNUC__=2 -D__OPTIMIZE__ -lang-c -Dmips -D__mips__ -D__mips -Dpsx -D__psx__ -D__psx -D_PSYQ -D__EXTENSIONS__ -D_MIPSEL -D__CHAR_UNSIGNED__ -D_LANGUAGE_C -DLANGUAGE_C"
mkdir -p /work/src /work/tmp /work/out/g8 /work/out/g0 /work/out/g /work/run2 /work/order
export TMPDIR=/work/tmp
cp /generated/src/*.i /work/src/
cp /ref/cc1psx /ref/cccp /work/
# Pipeline-order check: preprocessing an EUC-JP source gives the same bytes as
# transcoding the preprocessed UTF-8 source (cccp is byte-transparent).
for c in /generated/order/*.c; do
  [ -e "$c" ] || continue
  b="$(basename "$c" .c)"
  cp "$c" /work/order/
  ( cd /work/order && /work/cccp -nostdinc $CPP_DEFS -Iinclude "$b.c" "$b.i" )
  cmp "/work/order/$b.i" "/work/src/$b.i" || { echo "error: encoding before and after preprocessing differ for $b" >&2; exit 1; }
  echo "ORDER $b ok"
done
cd /work/src
for i in *.i; do
  b="${i%.i}"
  # Skip fixtures whose preprocessing failed; their .i is reference material only.
  grep -q "^$b pp 0$" /generated/exit-codes.txt || continue
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
    echo "$b $dir $rc" >>/generated/exit-codes.txt
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
echo "t07_struct g 0" >>/generated/exit-codes.txt
cp -a /work/out/g8 /work/out/g0 /work/out/g /generated/expected/
echo FIXTURES-DONE
EOF
rm -rf "$GENERATED/order"

(
  cd "$GENERATED"
  find src include expected -type f | LC_ALL=C sort | while IFS= read -r name; do
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
