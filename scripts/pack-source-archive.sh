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
need node

VERSION="${1:-$(node -p "require('$ROOT/package.json').version")}"
OUT="${2:-$ROOT/build/out/release}"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([+-][A-Za-z0-9.-]+)?$ ]] || die "invalid version: $VERSION"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"
NAME="psyq-wasm-$VERSION-corresponding-source"
STAGE="$OUT/$NAME"

"$ROOT/build/fetch-vendor.sh"
[[ ! -e "$STAGE" ]] || die "staging directory already exists: $STAGE"
mkdir -p "$STAGE/psyq-wasm"
trap 'rm -rf "$STAGE"' EXIT

# Package the current checkout, including new build scripts, rather than stale
# HEAD contents when validating a change locally. Ignore build output/vendor.
log "copying build inputs from the current checkout"
(
  cd "$ROOT"
  git ls-files -z --cached --others --exclude-standard -- build PROVENANCE.md LICENSE LICENSES package.json |
    tar --null -T - -cf -
) | tar -xf - -C "$STAGE/psyq-wasm"

EXPORT="$STAGE/psyq-wasm/build/vendor/homebrew-psyq"
mkdir -p "$EXPORT"
log "exporting homebrew-psyq @ $HOMEBREW_PSYQ_SHA"
git -C "$VENDOR_DIR" archive --format=tar "$HOMEBREW_PSYQ_SHA" | tar -xf - -C "$EXPORT"
(
  VENDOR_DIR="$EXPORT"
  source_checksums
) >"$STAGE/psyq-wasm/build/source.SHA256SUMS"
printf '%s\n%s\n' "$HOMEBREW_PSYQ_SHA" "$GCC_TREE_SHA" >"$STAGE/psyq-wasm/build/source-pins.txt"

cat >"$STAGE/README.txt" <<EOF
psyq-wasm $VERSION -- corresponding source for dist/cc1psx.{wasm,js} and dist/cccp.{wasm,js}

psyq-wasm/build/vendor/homebrew-psyq/  GCC 2.8.1 / PsyQ 4.4 sources
Commit: $HOMEBREW_PSYQ_SHA; tree: $GCC_TREE_SHA
License: build/vendor/homebrew-psyq/$GCC_SUBDIR/gcc/COPYING
psyq-wasm/build/  pins, generated sources, compatibility patch, build scripts,
                  and the exported-source checksum inventory

To rebuild from this extracted archive:
  cd psyq-wasm
  build/build-wasm.sh --offline-source

Requires Bash and Docker, using $EMSDK_IMAGE on $EMSDK_PLATFORM.
Docker may download the pinned toolchain image if it is not cached. Compilation
runs with networking disabled. Git, npm, and a separate checkout are not needed.
The build validates source checksums and pins before starting Docker.
Outputs: psyq-wasm/dist/cc1psx.wasm, cc1psx.js, cccp.wasm, cccp.js, build-info.json,
SHA256SUMS.

EOF

(
  cd "$OUT"
  tar -czf "$NAME.tar.gz" "$NAME"
  sha256_file "$NAME.tar.gz" | sed "s|\$|  $NAME.tar.gz|" >"$NAME.tar.gz.sha256"
)
rm -rf "$STAGE"
log "wrote $OUT/$NAME.tar.gz"
cat "$OUT/$NAME.tar.gz.sha256"
