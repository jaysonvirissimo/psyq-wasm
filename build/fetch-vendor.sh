#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Clone the pinned compiler source into build/vendor/ and verify the pins.
# Idempotent: re-running only re-verifies.
source "$(dirname "$0")/lib.sh"
need git

if [[ ! -d "$VENDOR_DIR/.git" ]]; then
  log "cloning $HOMEBREW_PSYQ_REPO"
  mkdir -p "$(dirname "$VENDOR_DIR")"
  git clone --quiet --no-checkout "$HOMEBREW_PSYQ_REPO" "$VENDOR_DIR"
fi

if ! git -C "$VENDOR_DIR" cat-file -e "$HOMEBREW_PSYQ_SHA^{commit}" 2>/dev/null; then
  log "fetching $HOMEBREW_PSYQ_SHA"
  git -C "$VENDOR_DIR" fetch --quiet origin "$HOMEBREW_PSYQ_SHA" 2>/dev/null || git -C "$VENDOR_DIR" fetch --quiet origin
fi
# Always (re)check out: a fresh `--no-checkout` clone has HEAD at the pin but
# an empty working tree, and a stale tree must be reset to the pin.
git -C "$VENDOR_DIR" checkout --quiet --detach --force "$HOMEBREW_PSYQ_SHA"

actual_head="$(git -C "$VENDOR_DIR" rev-parse HEAD)"
[[ "$actual_head" == "$HOMEBREW_PSYQ_SHA" ]] || die "vendor HEAD is $actual_head, expected $HOMEBREW_PSYQ_SHA"

actual_tree="$(git -C "$VENDOR_DIR" rev-parse "HEAD:$GCC_SUBDIR")"
[[ "$actual_tree" == "$GCC_TREE_SHA" ]] || die "tree $GCC_SUBDIR is $actual_tree, expected $GCC_TREE_SHA"

[[ -f "$GCC_DIR/toplev.c" ]] || die "GCC source tree missing at $GCC_DIR"

if [[ -n "$(git -C "$VENDOR_DIR" status --porcelain)" ]]; then
  die "vendor checkout has local modifications; refusing to build from it"
fi

log "vendor OK: $HOMEBREW_PSYQ_SHA ($GCC_SUBDIR tree $GCC_TREE_SHA)"
