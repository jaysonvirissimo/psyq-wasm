#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Verify the source export included in a corresponding-source archive.
source "$(dirname "$0")/lib.sh"

[[ -f "$GCC_DIR/toplev.c" ]] || die "exported compiler sources are missing"
[[ -f "$ROOT/build/source-pins.txt" && -f "$ROOT/build/source.SHA256SUMS" ]] || die "no exported-source verification record; use build/fetch-vendor.sh for a Git checkout"
cmp -s "$ROOT/build/source-pins.txt" <(printf '%s\n%s\n' "$HOMEBREW_PSYQ_SHA" "$GCC_TREE_SHA") || die "exported source pins differ from build/pins.env"
actual="$(mktemp)"
trap 'rm -f "$actual"' EXIT
source_checksums >"$actual"
diff -u "$ROOT/build/source.SHA256SUMS" "$actual" || die "exported source checksum inventory differs"
log "exported sources verified: $HOMEBREW_PSYQ_SHA ($GCC_TREE_SHA)"
