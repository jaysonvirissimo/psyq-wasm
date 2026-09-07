#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Rebuild an extracted source archive without Git or source-network access.
# Usage: scripts/verify-source-archive.sh ARCHIVE EXPECTED_SHA256SUMS [--twice]
source "$(dirname "$0")/../build/lib.sh"
need tar
ARCHIVE="${1:?archive path required}"
EXPECTED="${2:?expected SHA256SUMS path required}"
COUNT=1
[[ "${3:-}" != "--twice" ]] || COUNT=2
mkdir -p "$OUT_DIR"
WORK="$(mktemp -d "$OUT_DIR/archive-check.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
for ((run=1; run<=COUNT; run++)); do
  mkdir "$WORK/$run"
  tar -xzf "$ARCHIVE" -C "$WORK/$run"
  roots=("$WORK/$run/"*/psyq-wasm)
  [[ ${#roots[@]} -eq 1 && -d "${roots[0]}" ]] || die "unexpected source archive layout"
  "${roots[0]}/build/build-wasm.sh" --offline-source
  diff -u "$EXPECTED" "${roots[0]}/dist/SHA256SUMS" || die "source archive build $run differs from the release artifacts"
done
log "source archive rebuild verified ($COUNT independent clean builds)"
