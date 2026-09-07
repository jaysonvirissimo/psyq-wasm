#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Build the reference (native i386 Linux) cc1psx and cccp and regenerate the GCC
# build-time sources inside the pinned Debian slink container.
#
#   build/build-reference.sh [RESULT_DIR]     default: build/out/reference
#
# Slow: the container is i386 and runs under emulation on non-x86 hosts.
# Requires network access inside the container for apt.
source "$(dirname "$0")/lib.sh"
need docker

RESULT_DIR="${1:-$OUT_DIR/reference}"
"$ROOT/build/fetch-vendor.sh"
mkdir -p "$RESULT_DIR"

log "reference build in $SLINK_IMAGE ($SLINK_PLATFORM) -> $RESULT_DIR"
docker run --rm -i \
  --privileged \
  --platform "$SLINK_PLATFORM" \
  --tmpfs /work:exec,size=2g \
  -v "$VENDOR_DIR:/mount:ro" \
  -v "$ROOT/build:/build:ro" \
  -v "$RESULT_DIR:/result" \
  -e SLINK_PACKAGES="$SLINK_PACKAGES" \
  -e GCC_SUBDIR="$GCC_SUBDIR" \
  -e CC1_VERSION_BANNER="$CC1_VERSION_BANNER" \
  "$SLINK_IMAGE" sh /build/slink/inside.sh

log "reference cc1psx: $RESULT_DIR/cc1psx ($(sha256_file "$RESULT_DIR/cc1psx"))"
log "generated sources: $RESULT_DIR/gen"
