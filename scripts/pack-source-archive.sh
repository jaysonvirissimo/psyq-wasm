#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Produce the corresponding-source archive for a release of the GPL-2.0-only
# compiler artifact: the pinned GCC/PsyQ sources plus everything needed to
# rebuild cc1psx.wasm from them.
#
#   scripts/pack-source-archive.sh [VERSION] [OUT_DIR]
#
# Writes OUT_DIR/psyq-wasm-VERSION-corresponding-source.tar.gz and a .sha256.
source "$(dirname "$0")/../build/lib.sh"
need git
need tar

VERSION="${1:-$(node -p "require('$ROOT/package.json').version")}"
OUT="${2:-$ROOT/build/out/release}"
NAME="psyq-wasm-$VERSION-corresponding-source"
STAGE="$OUT/$NAME"

"$ROOT/build/fetch-vendor.sh"
rm -rf "$STAGE"
mkdir -p "$STAGE/homebrew-psyq" "$STAGE/psyq-wasm"

log "exporting homebrew-psyq @ $HOMEBREW_PSYQ_SHA"
git -C "$VENDOR_DIR" archive --format=tar "$HOMEBREW_PSYQ_SHA" | tar -x -C "$STAGE/homebrew-psyq"

log "copying build inputs"
git -C "$ROOT" archive --format=tar HEAD build PROVENANCE.md LICENSE LICENSES package.json |
  tar -x -C "$STAGE/psyq-wasm"

cat >"$STAGE/README.txt" <<EOF
psyq-wasm $VERSION -- corresponding source for dist/cc1psx.wasm and dist/cc1psx.js

homebrew-psyq/   GCC 2.8.1 / PsyQ 4.4 compiler sources, commit $HOMEBREW_PSYQ_SHA
                 (GNU General Public License v2; see homebrew-psyq/$GCC_SUBDIR/gcc/COPYING)
psyq-wasm/build/ pinned inputs, generated sources, compatibility patch, and build scripts
psyq-wasm/PROVENANCE.md   how the artifact is built and verified

To rebuild: copy psyq-wasm/build into a checkout of psyq-wasm $VERSION, place
homebrew-psyq at build/vendor/homebrew-psyq, and run build/build-wasm.sh (requires
Docker; uses $EMSDK_IMAGE).
EOF

(
  cd "$OUT"
  tar -czf "$NAME.tar.gz" "$NAME"
  sha256_file "$NAME.tar.gz" | sed "s|\$|  $NAME.tar.gz|" >"$NAME.tar.gz.sha256"
)
rm -rf "$STAGE"
log "wrote $OUT/$NAME.tar.gz"
cat "$OUT/$NAME.tar.gz.sha256"
