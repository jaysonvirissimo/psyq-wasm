# SPDX-License-Identifier: MIT
# Shared helpers for build/*.sh. Source, don't execute.
#
#   source "$(dirname "$0")/lib.sh"
#
# Provides: ROOT, all pins from build/pins.env, die(), log(), need().

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ROOT

die() {
  echo "error: $*" >&2
  exit 1
}

log() {
  echo "==> $*" >&2
}

need() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

# shellcheck disable=SC1091
set -a
. "$ROOT/build/pins.env"
set +a

: "${HOMEBREW_PSYQ_REPO:?}" "${HOMEBREW_PSYQ_SHA:?}" "${GCC_SUBDIR:?}" "${GCC_TREE_SHA:?}"
: "${SLINK_IMAGE:?}" "${SLINK_PLATFORM:?}" "${EMSDK_IMAGE:?}" "${EMSDK_PLATFORM:?}" "${CC1_WASM_CFLAGS:?}" "${CC1_WASM_LDFLAGS:?}"

VENDOR_DIR="$ROOT/build/vendor/homebrew-psyq"
GCC_DIR="$VENDOR_DIR/$GCC_SUBDIR/gcc"
GEN_DIR="$ROOT/build/gen"
OUT_DIR="$ROOT/build/out"
DIST_DIR="$ROOT/dist"
export VENDOR_DIR GCC_DIR GEN_DIR OUT_DIR DIST_DIR

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

# Sorted, complete inventory of exported source files; no Git metadata needed.
source_checksums() {
  (
    cd "$VENDOR_DIR"
    [[ -z "$(find . -type l -print)" ]] || die "exported sources must not contain symlinks"
    hash_command=(shasum -a 256)
    if command -v sha256sum >/dev/null 2>&1; then hash_command=(sha256sum); fi
    find . -type f -print | LC_ALL=C sort | while IFS= read -r name; do
      printf '%s\0' "$name"
    done | xargs -0 "${hash_command[@]}"
  )
}
