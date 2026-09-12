#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Build dist/cc1psx.{wasm,js} (the compiler) and dist/cccp.{wasm,js} (the
# preprocessor) from the pinned sources with the pinned Emscripten image.
#
#   build/build-wasm.sh            # host side: fetch vendor, run the emsdk container
#   build/build-wasm.sh --offline-source # verify bundled sources without Git/network
#   build/build-wasm.sh --inside   # container side (invoked by the above)
#
# Outputs (all in dist/): cc1psx.wasm, cc1psx.js, cccp.wasm, cccp.js,
# build-info.json, SHA256SUMS.
source "$(dirname "$0")/lib.sh"

case "${1:-}" in
  ""|--inside|--offline-source) ;;
  *) die "usage: build/build-wasm.sh [--offline-source]" ;;
esac
if [[ "${1:-}" != "--inside" ]]; then
  need docker
  if [[ "${1:-}" == "--offline-source" ]]; then
    "$ROOT/build/verify-source.sh"
  else
    "$ROOT/build/fetch-vendor.sh"
  fi
  mkdir -p "$OUT_DIR/emcache" "$DIST_DIR"
  log "building in $EMSDK_IMAGE"
  exec docker run --rm --network none --platform "$EMSDK_PLATFORM" \
    -u "$(id -u):$(id -g)" \
    -v "$ROOT:/src" -w /src \
    -e HOME=/tmp \
    "$EMSDK_IMAGE" bash build/build-wasm.sh --inside
fi

# ---------------------------------------------------------------- inside ----
need emcc
mkdir -p "$OUT_DIR"
# Every invocation compiles fresh objects and reapplies the compatibility patch.
# A timestamp cache cannot account for all headers, flags, and toolchain inputs.
WORK_DIR="$(mktemp -d "$OUT_DIR/wasm.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT
PATCHED_DIR="$WORK_DIR/patched"
# Emscripten's system-library cache lives in the repository so it survives
# container restarts (the image's own config ignores EM_CACHE).
CACHE_DIR="$OUT_DIR/emcache"
mkdir -p "$PATCHED_DIR" "$DIST_DIR" "$CACHE_DIR"

log "emcc: $(emcc --version | head -1)"

# Compatibility patch. Applied to a copy so the vendor tree stays pristine; the
# copy is pre-included on every compile, and its include guard makes the later
# `#include "obstack.h"` from the source tree a no-op.
PATCH_FILE="$ROOT/build/patches/obstack.h.diff"
cp "$GCC_DIR/obstack.h" "$PATCHED_DIR/obstack.h"
patch --silent "$PATCHED_DIR/obstack.h" "$PATCH_FILE" || die "obstack.h.diff did not apply cleanly"

# shellcheck disable=SC2206
CFLAGS=($CC1_WASM_CFLAGS --cache="$CACHE_DIR" -I"$GEN_DIR" -I"$GCC_DIR" -I"$GCC_DIR/config" -include "$PATCHED_DIR/obstack.h")

# cccp.c references these directories whenever CROSS_COMPILE is defined (the
# historical Makefile passes them too). They are never searched: the wrapper
# always runs the preprocessor with -nostdinc on a virtual filesystem.
CCCP_DEFS=(
  '-DGCC_INCLUDE_DIR="/usr/lib/gcc-lib/mips-psx/../../VERSION/include"'
  '-DGPLUSPLUS_INCLUDE_DIR="/usr/include/g++"'
  '-DOLD_GPLUSPLUS_INCLUDE_DIR="/usr/lib/g++-include"'
  '-DLOCAL_INCLUDE_DIR="/usr/local/include"'
  '-DCROSS_INCLUDE_DIR="/usr/lib/gcc-lib/mips-psx/../../VERSION/sys-include"'
  '-DTOOL_INCLUDE_DIR="/usr/mips-psx/include"'
)
PREFIX_DEFS=('-DPREFIX="/usr"')

# compile_objects LIST_FILE OBJ_DIR EXPECTED_COUNT -> sets `objects` (array).
compile_objects() {
  local list="$1" obj_dir="$2" expected="$3"
  mkdir -p "$obj_dir"
  objects=()
  while IFS= read -r obj; do
    [[ -z "$obj" || "$obj" == \#* ]] && continue
    local base="${obj%.o}" src extra=()
    case "$base" in
      insn-* | c-parse | cexp) src="$GEN_DIR/$base.c" ;;
      mips) src="$GCC_DIR/config/mips/mips.c" ;;
      toplev)
        src="$GCC_DIR/$base.c"
        extra=("-DTARGET_NAME=\"${TARGET_NAME:?}\"")
        ;;
      cccp)
        src="$GCC_DIR/$base.c"
        extra=("${CCCP_DEFS[@]}")
        ;;
      prefix)
        src="$GCC_DIR/$base.c"
        extra=("${PREFIX_DEFS[@]}")
        ;;
      *) src="$GCC_DIR/$base.c" ;;
    esac
    [[ -f "$src" ]] || die "missing source for $obj: $src"
    local out="$obj_dir/$obj"
    log "cc $base"
    emcc "${CFLAGS[@]}" "${extra[@]}" -c "$src" -o "$out"
    objects+=("$out")
  done <"$list"
  [[ ${#objects[@]} -eq "$expected" ]] || die "$list: expected $expected objects, got ${#objects[@]}"
}

# link_program NAME LDFLAGS_STRING OBJECTS... -> writes dist/NAME.{js,wasm}, sets wasm_sha/glue_sha/build_id.
link_program() {
  local name="$1" ldflags_string="$2"
  shift 2
  log "link $name"
  # shellcheck disable=SC2206
  local ldflags=($ldflags_string --cache="$CACHE_DIR")
  emcc "${ldflags[@]}" "$@" -o "$DIST_DIR/$name.js"
  wasm_sha="$(sha256_file "$DIST_DIR/$name.wasm")"
  build_id="sha256:${wasm_sha:0:16}"
  printf '\nexport const BUILD_ID = "%s";\n' "$build_id" >>"$DIST_DIR/$name.js"
  glue_sha="$(sha256_file "$DIST_DIR/$name.js")"
}

compile_objects "$ROOT/build/objs.txt" "$WORK_DIR/obj-cc1" 70
cc1_objects=("${objects[@]}")
link_program cc1psx "$CC1_WASM_LDFLAGS" "${cc1_objects[@]}"
cc1_wasm_sha="$wasm_sha" cc1_glue_sha="$glue_sha" cc1_build_id="$build_id"

compile_objects "$ROOT/build/cccp-objs.txt" "$WORK_DIR/obj-cccp" 5
cccp_objects=("${objects[@]}")
link_program cccp "$CCCP_WASM_LDFLAGS" "${cccp_objects[@]}"
cccp_wasm_sha="$wasm_sha" cccp_glue_sha="$glue_sha" cccp_build_id="$build_id"

emsdk_version="$(emcc --version | head -1 | sed -E 's/.* ([0-9]+\.[0-9]+\.[0-9]+).*/\1/')"
cccp_defs_json="$(printf '%s ' "${CCCP_DEFS[@]}" "${PREFIX_DEFS[@]}" | sed -e 's/ $//' -e 's/\\/\\\\/g' -e 's/"/\\"/g')"

cat >"$DIST_DIR/build-info.json" <<EOF
{
  "buildId": "$cc1_build_id",
  "wasmSha256": "$cc1_wasm_sha",
  "glueSha256": "$cc1_glue_sha",
  "psyqVersion": "4.4",
  "gccVersion": "2.8.1",
  "target": "${TARGET_NAME:?}",
  "emsdkImage": "$EMSDK_IMAGE",
  "emsdkPlatform": "$EMSDK_PLATFORM",
  "emsdkVersion": "$emsdk_version",
  "homebrewPsyqRepo": "$HOMEBREW_PSYQ_REPO",
  "homebrewPsyqSha": "$HOMEBREW_PSYQ_SHA",
  "gccSubdir": "$GCC_SUBDIR",
  "gccTreeSha": "$GCC_TREE_SHA",
  "cflags": "$CC1_WASM_CFLAGS",
  "ldflags": "$CC1_WASM_LDFLAGS",
  "objects": ${#cc1_objects[@]},
  "preprocessor": {
    "buildId": "$cccp_build_id",
    "wasmSha256": "$cccp_wasm_sha",
    "glueSha256": "$cccp_glue_sha",
    "ldflags": "$CCCP_WASM_LDFLAGS",
    "defines": "$cccp_defs_json",
    "objects": ${#cccp_objects[@]}
  }
}
EOF

(
  cd "$DIST_DIR"
  {
    echo "$cc1_wasm_sha  cc1psx.wasm"
    echo "$cc1_glue_sha  cc1psx.js"
    echo "$cccp_wasm_sha  cccp.wasm"
    echo "$cccp_glue_sha  cccp.js"
  } >SHA256SUMS
)

gz() { gzip -9 -c "$1" | wc -c | tr -d ' '; }
for name in cc1psx cccp; do
  log "$name.wasm $(wc -c <"$DIST_DIR/$name.wasm" | tr -d ' ') bytes ($(gz "$DIST_DIR/$name.wasm") gzip)"
  log "$name.js   $(wc -c <"$DIST_DIR/$name.js" | tr -d ' ') bytes ($(gz "$DIST_DIR/$name.js") gzip)"
done
log "buildId $cc1_build_id (compiler), $cccp_build_id (preprocessor)"
