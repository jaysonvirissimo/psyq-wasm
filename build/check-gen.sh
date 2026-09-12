#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Verify that build/gen/ matches a fresh regeneration from the pinned sources.
#
#   build/check-gen.sh [--fresh] [RESULT_DIR]
#
# If RESULT_DIR (default build/out/reference) has no gen/ directory yet, the
# reference build is run first.
source "$(dirname "$0")/lib.sh"

if [[ "${1:-}" == "--fresh" ]]; then
  mkdir -p "$OUT_DIR"
  RESULT_DIR="$(mktemp -d "$OUT_DIR/reference.XXXXXX")"
  trap 'rm -rf "$RESULT_DIR"' EXIT
else
  RESULT_DIR="${1:-$OUT_DIR/reference}"
fi
if [[ ! -d "$RESULT_DIR/gen" ]]; then
  "$ROOT/build/build-reference.sh" "$RESULT_DIR"
fi

status=0
while read -r expected name; do
  actual="$(sha256_file "$RESULT_DIR/gen/$name")"
  if [[ "$actual" == "$expected" ]]; then
    echo "ok       $name"
  else
    echo "MISMATCH $name"
    status=1
  fi
done < <(sed -E 's/^([0-9a-f]{64}) [ *](.+)$/\1 \2/' "$GEN_DIR/SHA256SUMS")

extra="$(comm -13 <(cut -d' ' -f3- <"$GEN_DIR/SHA256SUMS" | sort) <(ls "$RESULT_DIR/gen" | sort))"
if [[ -n "$extra" ]]; then
  echo "unexpected regenerated files: $extra"
  status=1
fi

[[ $status -eq 0 ]] && log "build/gen matches the regenerated sources"
exit $status
