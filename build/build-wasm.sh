#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Build dist/cc1psx.wasm + dist/cc1psx.js from the pinned sources with the pinned
# Emscripten image.
#
#   build/build-wasm.sh            # host side: fetch vendor, run the emsdk container
#   build/build-wasm.sh --inside   # container side (invoked by the above)
#
# Outputs (all in dist/): cc1psx.wasm, cc1psx.js, build-info.json, SHA256SUMS.
source "$(dirname "$0")/lib.sh"

if [[ "${1:-}" != "--inside" ]]; then
  need docker
  "$ROOT/build/fetch-vendor.sh"
  mkdir -p "$OUT_DIR/emcache" "$DIST_DIR"
  log "building in $EMSDK_IMAGE"
  exec docker run --rm \
    -u "$(id -u):$(id -g)" \
    -v "$ROOT:/src" -w /src \
    -e HOME=/tmp \
    "$EMSDK_IMAGE" bash build/build-wasm.sh --inside
fi

# ---------------------------------------------------------------- inside ----
need emcc
OBJ_DIR="$OUT_DIR/obj"
PATCHED_DIR="$OUT_DIR/patched"
# Emscripten's system-library cache lives in the repository so it survives
# container restarts (the image's own config ignores EM_CACHE).
CACHE_DIR="$OUT_DIR/emcache"
mkdir -p "$OBJ_DIR" "$PATCHED_DIR" "$DIST_DIR" "$CACHE_DIR"

log "emcc: $(emcc --version | head -1)"

# Compatibility patch. Applied to a copy so the vendor tree stays pristine; the
# copy is pre-included on every compile, and its include guard makes the later
# `#include "obstack.h"` from the source tree a no-op.
PATCH_FILE="$ROOT/build/patches/obstack.h.diff"
if [[ ! -f "$PATCHED_DIR/obstack.h" || "$GCC_DIR/obstack.h" -nt "$PATCHED_DIR/obstack.h" || "$PATCH_FILE" -nt "$PATCHED_DIR/obstack.h" ]]; then
  cp "$GCC_DIR/obstack.h" "$PATCHED_DIR/obstack.h"
  patch --silent "$PATCHED_DIR/obstack.h" "$PATCH_FILE" || die "obstack.h.diff did not apply cleanly"
fi

# shellcheck disable=SC2206
CFLAGS=($CC1_WASM_CFLAGS --cache="$CACHE_DIR" -I"$GEN_DIR" -I"$GCC_DIR" -I"$GCC_DIR/config" -include "$PATCHED_DIR/obstack.h")

objects=()
while IFS= read -r obj; do
  [[ -z "$obj" || "$obj" == \#* ]] && continue
  base="${obj%.o}"
  extra=()
  case "$base" in
    insn-* | c-parse) src="$GEN_DIR/$base.c" ;;
    mips) src="$GCC_DIR/config/mips/mips.c" ;;
    toplev)
      src="$GCC_DIR/$base.c"
      extra=("-DTARGET_NAME=\"${TARGET_NAME:?}\"")
      ;;
    *) src="$GCC_DIR/$base.c" ;;
  esac
  [[ -f "$src" ]] || die "missing source for $obj: $src"
  out="$OBJ_DIR/$obj"
  if [[ ! -f "$out" || "$src" -nt "$out" || "$PATCHED_DIR/obstack.h" -nt "$out" ]]; then
    log "cc $base"
    emcc "${CFLAGS[@]}" "${extra[@]}" -c "$src" -o "$out"
  fi
  objects+=("$out")
done <"$ROOT/build/objs.txt"

[[ ${#objects[@]} -eq 70 ]] || die "expected 70 objects, got ${#objects[@]}"

log "link"
# shellcheck disable=SC2206
LDFLAGS=($CC1_WASM_LDFLAGS --cache="$CACHE_DIR")
emcc "${LDFLAGS[@]}" "${objects[@]}" -o "$DIST_DIR/cc1psx.js"

wasm_sha="$(sha256_file "$DIST_DIR/cc1psx.wasm")"
build_id="sha256:${wasm_sha:0:16}"
printf '\nexport const BUILD_ID = "%s";\n' "$build_id" >>"$DIST_DIR/cc1psx.js"
glue_sha="$(sha256_file "$DIST_DIR/cc1psx.js")"

emsdk_version="$(emcc --version | head -1 | sed -E 's/.* ([0-9]+\.[0-9]+\.[0-9]+).*/\1/')"

cat >"$DIST_DIR/build-info.json" <<EOF
{
  "buildId": "$build_id",
  "wasmSha256": "$wasm_sha",
  "glueSha256": "$glue_sha",
  "psyqVersion": "4.4",
  "gccVersion": "2.8.1",
  "target": "${TARGET_NAME:?}",
  "emsdkImage": "$EMSDK_IMAGE",
  "emsdkVersion": "$emsdk_version",
  "homebrewPsyqRepo": "$HOMEBREW_PSYQ_REPO",
  "homebrewPsyqSha": "$HOMEBREW_PSYQ_SHA",
  "gccSubdir": "$GCC_SUBDIR",
  "gccTreeSha": "$GCC_TREE_SHA",
  "cflags": "$CC1_WASM_CFLAGS",
  "ldflags": "$CC1_WASM_LDFLAGS",
  "objects": ${#objects[@]}
}
EOF

(
  cd "$DIST_DIR"
  {
    echo "$wasm_sha  cc1psx.wasm"
    echo "$glue_sha  cc1psx.js"
  } >SHA256SUMS
)

gz() { gzip -9 -c "$1" | wc -c | tr -d ' '; }
log "cc1psx.wasm $(wc -c <"$DIST_DIR/cc1psx.wasm" | tr -d ' ') bytes ($(gz "$DIST_DIR/cc1psx.wasm") gzip)"
log "cc1psx.js   $(wc -c <"$DIST_DIR/cc1psx.js" | tr -d ' ') bytes ($(gz "$DIST_DIR/cc1psx.js") gzip)"
log "buildId $build_id"
